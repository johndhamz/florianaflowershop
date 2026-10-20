-- ============================================================================
-- 0500 · Carts, promo codes, orders (immutable pricing snapshots), recipients,
--        delivery details, status history.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Carts: anonymous, identified by a secret token held in an httpOnly cookie.
-- Only the SHA-256 of the token is stored; access goes through RPCs (Phase 3).
-- ---------------------------------------------------------------------------
create table public.carts (
  id           uuid primary key default gen_random_uuid(),
  token_hash   text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  customer_id  uuid references public.customers (id) on delete set null,
  status       public.cart_status not null default 'active',
  currency     char(3) not null default 'PHP' check (currency = 'PHP'),
  expires_at   timestamptz not null default now() + interval '30 days',
  converted_order_id uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index carts_expiry_idx on public.carts (expires_at) where status = 'active';
create trigger carts_updated_at before update on public.carts
  for each row execute function app.set_updated_at();

create table public.cart_items (
  id            uuid primary key default gen_random_uuid(),
  cart_id       uuid not null references public.carts (id) on delete cascade,
  variant_id    uuid not null references public.product_variants (id) on delete cascade,
  quantity      integer not null check (quantity between 1 and 50),
  -- Price seen when added; checkout always revalidates against live prices.
  unit_price_centavos_at_add integer not null check (unit_price_centavos_at_add >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (cart_id, variant_id)
);
create trigger cart_items_updated_at before update on public.cart_items
  for each row execute function app.set_updated_at();

create table public.cart_item_add_ons (
  cart_item_id uuid not null references public.cart_items (id) on delete cascade,
  add_on_id    uuid not null references public.add_ons (id) on delete cascade,
  quantity     integer not null check (quantity between 1 and 20),
  primary key (cart_item_id, add_on_id)
);

-- ---------------------------------------------------------------------------
-- Promo codes
-- ---------------------------------------------------------------------------
create table public.promo_codes (
  id                     uuid primary key default gen_random_uuid(),
  code                   extensions.citext not null unique check (length(code) between 3 and 40),
  description            text,
  promo_type             public.promo_type not null,
  value                  integer not null check (value > 0),          -- percent (1–100) or centavos
  min_subtotal_centavos  integer not null default 0 check (min_subtotal_centavos >= 0),
  max_discount_centavos  integer check (max_discount_centavos is null or max_discount_centavos > 0),
  starts_at              timestamptz,
  ends_at                timestamptz,
  max_uses               integer check (max_uses is null or max_uses > 0),
  uses_count             integer not null default 0 check (uses_count >= 0),
  is_active              boolean not null default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint promo_codes_percent_range check (promo_type <> 'percent' or value between 1 and 100),
  constraint promo_codes_window check (starts_at is null or ends_at is null or ends_at > starts_at)
);
create trigger promo_codes_updated_at before update on public.promo_codes
  for each row execute function app.set_updated_at();
create trigger promo_codes_audit after insert or update or delete on public.promo_codes
  for each row execute function app.audit_row();

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
create sequence public.order_number_seq start 10001;

create table public.orders (
  id                   uuid primary key default gen_random_uuid(),
  order_number         text not null unique default ('FL-' || nextval('public.order_number_seq')::text),
  customer_id          uuid not null references public.customers (id) on delete restrict,
  cart_id              uuid references public.carts (id) on delete set null,
  idempotency_key      text not null unique check (length(idempotency_key) between 8 and 128),
  -- Guests track orders with order_number + secret token; only the hash is stored.
  tracking_token_hash  text not null unique check (tracking_token_hash ~ '^[a-f0-9]{64}$'),

  status               public.order_status not null default 'pending',
  payment_status       public.payment_status not null default 'unpaid',
  fulfillment_status   public.fulfillment_status not null default 'unfulfilled',
  delivery_status      public.delivery_status not null default 'pending',

  currency             char(3) not null default 'PHP' check (currency = 'PHP'),
  subtotal_centavos    integer not null check (subtotal_centavos >= 0),
  add_ons_centavos     integer not null default 0 check (add_ons_centavos >= 0),
  discount_centavos    integer not null default 0 check (discount_centavos >= 0),
  delivery_fee_centavos integer not null default 0 check (delivery_fee_centavos >= 0),
  total_centavos       integer not null check (total_centavos >= 0),
  promo_code_id        uuid references public.promo_codes (id) on delete set null,
  promo_code_snapshot  text,

  -- Customer contact snapshot (PII) — frozen at placement.
  customer_name        text not null,
  customer_email       extensions.citext not null,
  customer_phone       text not null check (app.is_ph_mobile(customer_phone)),

  gift_message         text check (gift_message is null or length(gift_message) <= 300),
  delivery_instructions text check (delivery_instructions is null or length(delivery_instructions) <= 500),
  internal_notes       text,

  delivery_zone_id     uuid references public.delivery_zones (id) on delete set null,
  delivery_zone_snapshot jsonb,
  delivery_date        date,
  delivery_slot_allocation_id uuid references public.delivery_slot_allocations (id) on delete set null,
  delivery_slot_snapshot jsonb,
  assigned_rider_id    uuid references public.staff_profiles (user_id) on delete set null,

  source               text not null default 'web' check (source in ('web', 'admin', 'phone', 'walk_in')),
  metadata             jsonb not null default '{}'::jsonb,

  placed_at            timestamptz not null default now(),
  confirmed_at         timestamptz,
  completed_at         timestamptz,
  cancelled_at         timestamptz,
  cancellation_reason  text,
  reservation_expires_at timestamptz,   -- unpaid orders release stock after this
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint orders_total_math check (total_centavos = subtotal_centavos + add_ons_centavos + delivery_fee_centavos - discount_centavos),
  constraint orders_discount_lte_goods check (discount_centavos <= subtotal_centavos + add_ons_centavos)
);
create index orders_customer_idx on public.orders (customer_id, placed_at desc);
create index orders_status_idx on public.orders (status, placed_at desc);
create index orders_payment_status_idx on public.orders (payment_status) where payment_status in ('unpaid', 'pending');
create index orders_delivery_date_idx on public.orders (delivery_date, delivery_status);
create index orders_rider_idx on public.orders (assigned_rider_id, delivery_date) where assigned_rider_id is not null;
create index orders_reservation_expiry_idx on public.orders (reservation_expires_at) where reservation_expires_at is not null;
create trigger orders_updated_at before update on public.orders
  for each row execute function app.set_updated_at();
create trigger orders_audit after insert or update or delete on public.orders
  for each row execute function app.audit_row('customer_email,customer_phone,gift_message,delivery_instructions');

alter table public.carts
  add constraint carts_converted_order_fk foreign key (converted_order_id) references public.orders (id) on delete set null;

-- Pricing columns are immutable once the order exists.
create or replace function app.orders_lock_pricing()
returns trigger
language plpgsql
as $$
begin
  if new.subtotal_centavos      is distinct from old.subtotal_centavos
  or new.add_ons_centavos       is distinct from old.add_ons_centavos
  or new.discount_centavos      is distinct from old.discount_centavos
  or new.delivery_fee_centavos  is distinct from old.delivery_fee_centavos
  or new.total_centavos         is distinct from old.total_centavos
  or new.currency               is distinct from old.currency
  or new.order_number           is distinct from old.order_number
  or new.idempotency_key        is distinct from old.idempotency_key
  or new.customer_id            is distinct from old.customer_id
  or new.placed_at              is distinct from old.placed_at
  then
    perform app.raise('ORDER_PRICING_IMMUTABLE', 'Order pricing and identity columns cannot be changed after placement.');
  end if;
  return new;
end;
$$;
create trigger orders_lock_pricing before update on public.orders
  for each row execute function app.orders_lock_pricing();

create table public.order_items (
  id                    uuid primary key default gen_random_uuid(),
  order_id              uuid not null references public.orders (id) on delete cascade,
  variant_id            uuid references public.product_variants (id) on delete set null,
  product_id            uuid references public.products (id) on delete set null,
  -- Snapshot: what the customer saw and paid for.
  product_name          text not null,
  variant_name          text not null,
  sku                   text not null,
  image_path            text,
  unit_price_centavos   integer not null check (unit_price_centavos >= 0),
  quantity              integer not null check (quantity between 1 and 50),
  line_total_centavos   integer not null check (line_total_centavos >= 0),
  created_at            timestamptz not null default now(),
  constraint order_items_line_math check (line_total_centavos = unit_price_centavos * quantity)
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_variant_idx on public.order_items (variant_id);

create table public.order_item_add_ons (
  id                  uuid primary key default gen_random_uuid(),
  order_item_id       uuid not null references public.order_items (id) on delete cascade,
  add_on_id           uuid references public.add_ons (id) on delete set null,
  name                text not null,
  sku                 text not null,
  unit_price_centavos integer not null check (unit_price_centavos >= 0),
  quantity            integer not null check (quantity between 1 and 20),
  line_total_centavos integer not null check (line_total_centavos >= 0),
  constraint order_item_add_ons_line_math check (line_total_centavos = unit_price_centavos * quantity)
);
create index order_item_add_ons_item_idx on public.order_item_add_ons (order_item_id);

-- Snapshots never change. Only deletion via order cascade is permitted.
create or replace function app.reject_mutation()
returns trigger
language plpgsql
as $$
begin
  perform app.raise('SNAPSHOT_IMMUTABLE', format('%s rows are immutable order snapshots.', tg_table_name));
  return null;
end;
$$;
create trigger order_items_immutable before update on public.order_items
  for each row execute function app.reject_mutation();
create trigger order_item_add_ons_immutable before update on public.order_item_add_ons
  for each row execute function app.reject_mutation();

-- Recipient + delivery address (PII). One per order.
create table public.order_recipients (
  order_id        uuid primary key references public.orders (id) on delete cascade,
  full_name       text not null check (length(full_name) between 1 and 160),
  phone           text not null check (app.is_ph_mobile(phone)),
  address_line1   text not null check (length(address_line1) between 1 and 200),
  address_line2   text check (address_line2 is null or length(address_line2) <= 200),
  barangay        text not null check (length(barangay) between 1 and 120),
  city            text not null check (length(city) between 1 and 120),
  province        text not null default 'Cebu',
  postal_code     text check (postal_code is null or postal_code ~ '^\d{4}$'),
  landmark        text,
  latitude        numeric(9,6) check (latitude is null or latitude between -90 and 90),
  longitude       numeric(9,6) check (longitude is null or longitude between -180 and 180),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger order_recipients_updated_at before update on public.order_recipients
  for each row execute function app.set_updated_at();

-- Every status transition, for any of the four independent state machines.
create table public.order_status_history (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders (id) on delete cascade,
  kind        public.status_kind not null,
  from_status text,
  to_status   text not null,
  note        text,
  changed_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index order_status_history_order_idx on public.order_status_history (order_id, created_at desc);

create or replace function app.orders_record_status_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_status_history (order_id, kind, from_status, to_status, changed_by)
    values
      (new.id, 'order',       null, new.status::text,             auth.uid()),
      (new.id, 'payment',     null, new.payment_status::text,     auth.uid()),
      (new.id, 'fulfillment', null, new.fulfillment_status::text, auth.uid()),
      (new.id, 'delivery',    null, new.delivery_status::text,    auth.uid());
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.order_status_history (order_id, kind, from_status, to_status, changed_by)
    values (new.id, 'order', old.status::text, new.status::text, auth.uid());
  end if;
  if new.payment_status is distinct from old.payment_status then
    insert into public.order_status_history (order_id, kind, from_status, to_status, changed_by)
    values (new.id, 'payment', old.payment_status::text, new.payment_status::text, auth.uid());
  end if;
  if new.fulfillment_status is distinct from old.fulfillment_status then
    insert into public.order_status_history (order_id, kind, from_status, to_status, changed_by)
    values (new.id, 'fulfillment', old.fulfillment_status::text, new.fulfillment_status::text, auth.uid());
  end if;
  if new.delivery_status is distinct from old.delivery_status then
    insert into public.order_status_history (order_id, kind, from_status, to_status, changed_by)
    values (new.id, 'delivery', old.delivery_status::text, new.delivery_status::text, auth.uid());
  end if;
  return new;
end;
$$;
create trigger orders_status_history after insert or update on public.orders
  for each row execute function app.orders_record_status_history();
