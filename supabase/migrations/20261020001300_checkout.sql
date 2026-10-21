-- ============================================================================
-- 1300 · Checkout & payments: atomic guest order placement, payment attempts,
--        idempotent webhook recording, state transitions, reservation expiry,
--        bank-transfer verification, refunds, tracking.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Internal (unchecked) versions of the transactional functions so SECURITY
-- DEFINER checkout code can call them on behalf of anonymous shoppers. The
-- public wrappers keep their staff/service assertion.
-- ---------------------------------------------------------------------------
create or replace function app.reserve_stock(
  p_reference_type text, p_reference_id uuid, p_idempotency_key text, p_lines jsonb, p_expires_at timestamptz
)
returns setof public.stock_reservations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_need   record;
  v_batch  record;
  v_take   numeric(12,3);
  v_left   numeric(12,3);
  v_material_ids uuid[];
begin
  if p_reference_type not in ('order', 'cart') then
    perform app.raise('INVALID_REFERENCE', 'reference_type must be order or cart');
  end if;
  if length(coalesce(p_idempotency_key, '')) < 8 then
    perform app.raise('INVALID_IDEMPOTENCY_KEY', 'idempotency_key must be at least 8 characters');
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    perform app.raise('INVALID_LINES', 'lines must be a non-empty JSON array');
  end if;

  if exists (select 1 from public.stock_reservations r where r.idempotency_key = p_idempotency_key) then
    return query select * from public.stock_reservations r where r.idempotency_key = p_idempotency_key;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtext('reserve_stock'), hashtext(p_idempotency_key));

  if exists (
    select 1
    from jsonb_to_recordset(p_lines) as l(variant_id uuid, quantity integer)
    join public.product_variants pv on pv.id = l.variant_id
    left join public.bouquet_recipes br on br.variant_id = pv.id
    where pv.inventory_mode = 'recipe' and br.id is null
  ) then
    perform app.raise('MISSING_RECIPE', 'A recipe-tracked variant has no bouquet recipe.');
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_lines) as l(variant_id uuid, quantity integer)
    where l.quantity is null or l.quantity < 1
  ) then
    perform app.raise('INVALID_QUANTITY', 'Line quantities must be >= 1.');
  end if;

  select coalesce(array_agg(x.material_id order by x.material_id), '{}')
  into v_material_ids
  from (
    select distinct ri.material_id
    from jsonb_to_recordset(p_lines) as l(variant_id uuid, quantity integer)
    join public.product_variants pv on pv.id = l.variant_id
    join public.bouquet_recipes br on br.variant_id = pv.id
    join public.recipe_items ri on ri.recipe_id = br.id and not ri.is_optional
    where pv.inventory_mode = 'recipe'
  ) x;

  perform 1
  from public.stock_batches b
  where b.material_id = any (v_material_ids) and b.status = 'active'
  order by b.material_id, b.expires_at nulls last, b.id
  for update;

  for v_need in
    select ri.material_id, sum(ri.quantity * l.quantity::numeric) as quantity
    from jsonb_to_recordset(p_lines) as l(variant_id uuid, quantity integer)
    join public.product_variants pv on pv.id = l.variant_id
    join public.bouquet_recipes br on br.variant_id = pv.id
    join public.recipe_items ri on ri.recipe_id = br.id and not ri.is_optional
    where pv.inventory_mode = 'recipe'
    group by ri.material_id
    order by ri.material_id
  loop
    v_left := v_need.quantity;
    for v_batch in
      select b.id, (b.quantity_remaining - b.quantity_reserved) as available
      from public.stock_batches b
      where b.material_id = v_need.material_id and b.status = 'active'
        and (b.expires_at is null or b.expires_at > now())
        and (b.quantity_remaining - b.quantity_reserved) > 0
      order by b.expires_at nulls last, b.id
    loop
      exit when v_left <= 0;
      v_take := least(v_left, v_batch.available);
      update public.stock_batches set quantity_reserved = quantity_reserved + v_take where id = v_batch.id;
      insert into public.stock_reservations (idempotency_key, reference_type, reference_id, material_id, batch_id, quantity, status, expires_at)
      values (p_idempotency_key, p_reference_type, p_reference_id, v_need.material_id, v_batch.id, v_take, 'active', p_expires_at);
      insert into public.stock_movements (batch_id, material_id, movement_type, quantity, reference_type, reference_id, created_by)
      values (v_batch.id, v_need.material_id, 'reserve', -v_take, p_reference_type, p_reference_id, auth.uid());
      v_left := v_left - v_take;
    end loop;
    if v_left > 0 then
      perform app.raise('INSUFFICIENT_STOCK', format('Insufficient stock for material %s: short by %s', v_need.material_id, v_left));
    end if;
  end loop;

  return query select * from public.stock_reservations r where r.idempotency_key = p_idempotency_key;
end;
$$;

create or replace function public.reserve_stock(
  p_reference_type text, p_reference_id uuid, p_idempotency_key text, p_lines jsonb,
  p_expires_at timestamptz default (now() + interval '30 minutes')
)
returns setof public.stock_reservations
language plpgsql security definer set search_path = ''
as $$
begin
  perform app.assert_staff();
  return query select * from app.reserve_stock(p_reference_type, p_reference_id, p_idempotency_key, p_lines, p_expires_at);
end;
$$;

create or replace function app.release_stock_reservations(p_reference_type text, p_reference_id uuid, p_reason text)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_row record;
  v_count integer := 0;
begin
  for v_row in
    select r.id, r.batch_id, r.material_id, r.quantity
    from public.stock_reservations r
    where r.reference_type = p_reference_type and r.reference_id = p_reference_id and r.status = 'active'
    order by r.batch_id
    for update
  loop
    update public.stock_batches set quantity_reserved = quantity_reserved - v_row.quantity where id = v_row.batch_id;
    update public.stock_reservations set status = 'released' where id = v_row.id;
    insert into public.stock_movements (batch_id, material_id, movement_type, quantity, reference_type, reference_id, reason, created_by)
    values (v_row.batch_id, v_row.material_id, 'release', v_row.quantity, p_reference_type, p_reference_id, p_reason, auth.uid());
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.release_stock_reservations(p_reference_type text, p_reference_id uuid, p_reason text default 'released')
returns integer
language plpgsql security definer set search_path = ''
as $$
begin
  perform app.assert_staff();
  return app.release_stock_reservations(p_reference_type, p_reference_id, p_reason);
end;
$$;

create or replace function app.reserve_delivery_slot(p_slot_id uuid, p_delivery_date date)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_slot  public.delivery_slots%rowtype;
  v_alloc public.delivery_slot_allocations%rowtype;
begin
  select * into v_slot from public.delivery_slots where id = p_slot_id and is_active;
  if v_slot.id is null then perform app.raise('SLOT_NOT_FOUND', 'Delivery slot is not available.'); end if;
  if not (extract(dow from p_delivery_date)::smallint = any (v_slot.days_of_week)) then
    perform app.raise('SLOT_NOT_OFFERED', 'This slot is not offered on the chosen day.');
  end if;
  insert into public.delivery_slot_allocations (slot_id, delivery_date, capacity)
  values (p_slot_id, p_delivery_date, v_slot.default_capacity)
  on conflict (slot_id, delivery_date) do nothing;
  select * into v_alloc from public.delivery_slot_allocations
  where slot_id = p_slot_id and delivery_date = p_delivery_date for update;
  if v_alloc.is_blocked or v_alloc.booked >= v_alloc.capacity then
    perform app.raise('SLOT_FULL', 'This delivery slot is fully booked.');
  end if;
  update public.delivery_slot_allocations set booked = booked + 1 where id = v_alloc.id;
  return v_alloc.id;
end;
$$;

create or replace function public.reserve_delivery_slot(p_slot_id uuid, p_delivery_date date)
returns uuid
language plpgsql security definer set search_path = ''
as $$
begin
  perform app.assert_staff();
  return app.reserve_delivery_slot(p_slot_id, p_delivery_date);
end;
$$;

create or replace function app.release_delivery_slot(p_allocation_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.delivery_slot_allocations set booked = greatest(booked - 1, 0) where id = p_allocation_id;
end;
$$;

create or replace function public.release_delivery_slot(p_allocation_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform app.assert_staff();
  perform app.release_delivery_slot(p_allocation_id);
end;
$$;

-- Jobs call the unchecked versions directly.
create or replace function public.expire_stock_reservations()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_ref record;
  v_total integer := 0;
begin
  for v_ref in
    select distinct reference_type, reference_id from public.stock_reservations
    where status = 'active' and expires_at is not null and expires_at < now()
  loop
    v_total := v_total + app.release_stock_reservations(v_ref.reference_type, v_ref.reference_id, 'expired');
  end loop;
  return v_total;
end;
$$;

-- ---------------------------------------------------------------------------
-- Plaintext tracking tokens, reachable only through definer functions, so an
-- idempotent replay of place_order can hand the same token back.
-- ---------------------------------------------------------------------------
create table public.order_access_tokens (
  order_id   uuid primary key references public.orders (id) on delete cascade,
  token      text not null check (token ~ '^[a-f0-9]{48,64}$'),
  created_at timestamptz not null default now()
);
alter table public.order_access_tokens enable row level security;
revoke all on public.order_access_tokens from anon, authenticated;

-- Hold duration for bank transfers (customers need time to transfer).
alter table public.business_settings
  add column bank_transfer_hold_hours integer not null default 24 check (bank_transfer_hold_hours between 1 and 168);

alter table public.payments
  add column checkout_url text,
  add column proof_uploaded_at timestamptz;

-- Manila-local helpers -------------------------------------------------------
create or replace function app.manila_now()
returns timestamp
language sql stable
as $$ select (now() at time zone 'Asia/Manila'); $$;

create or replace function app.manila_today()
returns date
language sql stable
as $$ select (now() at time zone 'Asia/Manila')::date; $$;

-- ---------------------------------------------------------------------------
-- Promo validation (anon-callable). Discount applies to goods (items + add-ons).
-- ---------------------------------------------------------------------------
create or replace function public.validate_promo_code(p_code text, p_goods_centavos integer)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_promo public.promo_codes%rowtype;
  v_discount integer;
begin
  if p_code is null or length(trim(p_code)) < 3 then
    return jsonb_build_object('valid', false, 'message', 'Enter a promo code.');
  end if;
  select * into v_promo from public.promo_codes where code = trim(p_code)::extensions.citext;
  if v_promo.id is null or not v_promo.is_active then
    return jsonb_build_object('valid', false, 'message', 'That promo code is not valid.');
  end if;
  if (v_promo.starts_at is not null and v_promo.starts_at > now()) or (v_promo.ends_at is not null and v_promo.ends_at < now()) then
    return jsonb_build_object('valid', false, 'message', 'That promo code has expired.');
  end if;
  if v_promo.max_uses is not null and v_promo.uses_count >= v_promo.max_uses then
    return jsonb_build_object('valid', false, 'message', 'That promo code has been fully redeemed.');
  end if;
  if p_goods_centavos < v_promo.min_subtotal_centavos then
    return jsonb_build_object('valid', false, 'message', format('Add %s more to use this code.', to_char((v_promo.min_subtotal_centavos - p_goods_centavos) / 100.0, 'FM₱999,999,990.00')));
  end if;
  v_discount := case v_promo.promo_type
    when 'percent' then floor(p_goods_centavos * v_promo.value / 100.0)::integer
    else v_promo.value end;
  if v_promo.max_discount_centavos is not null then v_discount := least(v_discount, v_promo.max_discount_centavos); end if;
  v_discount := least(v_discount, p_goods_centavos);
  return jsonb_build_object('valid', true, 'promo_id', v_promo.id, 'code', v_promo.code, 'description', v_promo.description, 'discount_centavos', v_discount);
end;
$$;
grant execute on function public.validate_promo_code(text, integer) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Delivery options for a zone + date (anon-callable): which slots can still be
-- booked, respecting day-of-week, lead time, same-day cutoff and capacity.
-- ---------------------------------------------------------------------------
create or replace function public.list_delivery_options(p_zone_id uuid, p_delivery_date date)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_zone public.delivery_zones%rowtype;
  v_now  timestamp := app.manila_now();
  v_today date := app.manila_today();
  v_slots jsonb;
  v_date_ok boolean := true;
  v_reason text;
begin
  select * into v_zone from public.delivery_zones where id = p_zone_id and is_active;
  if v_zone.id is null then
    return jsonb_build_object('ok', false, 'message', 'Delivery zone not found.');
  end if;
  if p_delivery_date < v_today then
    v_date_ok := false; v_reason := 'That date has passed.';
  elsif p_delivery_date > v_today + 60 then
    v_date_ok := false; v_reason := 'We take orders up to 60 days ahead.';
  elsif p_delivery_date = v_today and (v_zone.same_day_cutoff is null or v_now::time >= v_zone.same_day_cutoff) then
    v_date_ok := false; v_reason := case when v_zone.same_day_cutoff is null then 'Same-day delivery is not available in this zone.' else 'Same-day orders must be placed before ' || to_char(v_zone.same_day_cutoff, 'HH12:MI AM') || '.' end;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'slot_id', s.id, 'label', s.label, 'starts_at', s.starts_at, 'ends_at', s.ends_at,
      'remaining', greatest(coalesce(a.capacity, s.default_capacity) - coalesce(a.booked, 0), 0),
      'available', v_date_ok
        and coalesce(not a.is_blocked, true)
        and (coalesce(a.capacity, s.default_capacity) - coalesce(a.booked, 0)) > 0
        and (p_delivery_date + s.starts_at) >= v_now + make_interval(hours => v_zone.lead_time_hours)
    ) order by s.position), '[]'::jsonb)
  into v_slots
  from public.delivery_slots s
  left join public.delivery_slot_allocations a on a.slot_id = s.id and a.delivery_date = p_delivery_date
  where s.is_active and extract(dow from p_delivery_date)::smallint = any (s.days_of_week);

  return jsonb_build_object('ok', true, 'date_ok', v_date_ok, 'message', v_reason, 'fee_centavos', v_zone.fee_centavos,
    'free_delivery_threshold_centavos', v_zone.free_delivery_threshold_centavos, 'min_order_centavos', v_zone.min_order_centavos, 'slots', v_slots);
end;
$$;
grant execute on function public.list_delivery_options(uuid, date) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- place_order: the single atomic checkout transaction (anon-callable).
-- Everything is recomputed from the database; client-sent prices are ignored.
-- Idempotent on p_idempotency_key: a replay returns the existing order.
-- ---------------------------------------------------------------------------
create or replace function public.place_order(p_cart_token text, p_idempotency_key text, p_input jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_cart_id uuid := app.cart_id_for_token(p_cart_token);
  v_cart jsonb;
  v_item jsonb;
  v_addon jsonb;
  v_settings public.business_settings%rowtype;
  v_zone public.delivery_zones%rowtype;
  v_slot public.delivery_slots%rowtype;
  v_existing public.orders%rowtype;
  v_token text;
  v_customer_id uuid;
  v_order_id uuid := gen_random_uuid();
  v_order_number text;
  v_item_id uuid;
  v_subtotal integer := 0;
  v_addons integer := 0;
  v_discount integer := 0;
  v_fee integer := 0;
  v_total integer;
  v_promo jsonb;
  v_promo_id uuid;
  v_payment_method text := p_input ->> 'payment_method';
  v_delivery_date date;
  v_alloc_id uuid;
  v_lines jsonb;
  v_hold interval;
  v_barangay text;
begin
  if length(coalesce(p_idempotency_key, '')) < 16 then
    perform app.raise('INVALID_IDEMPOTENCY_KEY', 'Missing checkout key.');
  end if;
  perform pg_advisory_xact_lock(hashtext('place_order'), hashtext(p_idempotency_key));

  -- Replay?
  select * into v_existing from public.orders where idempotency_key = p_idempotency_key;
  if v_existing.id is not null then
    select token into v_token from public.order_access_tokens where order_id = v_existing.id;
    return jsonb_build_object('replayed', true, 'order_id', v_existing.id, 'order_number', v_existing.order_number,
      'tracking_token', v_token, 'total_centavos', v_existing.total_centavos, 'payment_status', v_existing.payment_status);
  end if;

  if v_cart_id is null then perform app.raise('CART_EMPTY', 'Your cart is empty.'); end if;
  v_cart := public.cart_get(p_cart_token);
  if jsonb_array_length(v_cart -> 'items') = 0 then perform app.raise('CART_EMPTY', 'Your cart is empty.'); end if;
  if (v_cart ->> 'has_issues')::boolean or (v_cart ->> 'item_count')::int = 0 then
    perform app.raise('CART_CHANGED', 'Some items in your cart changed (stock or price). Please review your cart.');
  end if;

  select * into v_settings from public.business_settings where id = 1;

  -- Payment method -----------------------------------------------------------
  if v_payment_method not in ('paymongo', 'bank_transfer') then
    perform app.raise('INVALID_PAYMENT_METHOD', 'Choose a payment method.');
  end if;
  if v_payment_method = 'paymongo' and not v_settings.online_payments_enabled then
    perform app.raise('PAYMENT_METHOD_DISABLED', 'Online payment is not available right now.');
  end if;
  if v_payment_method = 'bank_transfer' and not v_settings.bank_transfer_enabled then
    perform app.raise('PAYMENT_METHOD_DISABLED', 'Bank transfer is not available right now.');
  end if;

  -- Sender -------------------------------------------------------------------
  if coalesce(length(trim(p_input #>> '{sender,name}')), 0) not between 2 and 160 then perform app.raise('INVALID_SENDER', 'Enter your name.'); end if;
  if (p_input #>> '{sender,email}') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then perform app.raise('INVALID_SENDER', 'Enter a valid email address.'); end if;
  if not app.is_ph_mobile(p_input #>> '{sender,phone}') then perform app.raise('INVALID_SENDER', 'Enter a valid Philippine mobile number (+639XXXXXXXXX).'); end if;
  if coalesce((p_input ->> 'privacy_consent')::boolean, false) is not true then perform app.raise('CONSENT_REQUIRED', 'Please agree to the privacy notice.'); end if;

  -- Recipient ----------------------------------------------------------------
  if coalesce(length(trim(p_input #>> '{recipient,name}')), 0) not between 2 and 160 then perform app.raise('INVALID_RECIPIENT', 'Enter the recipient''s name.'); end if;
  if not app.is_ph_mobile(p_input #>> '{recipient,phone}') then perform app.raise('INVALID_RECIPIENT', 'Enter a valid recipient mobile number.'); end if;
  if coalesce(length(trim(p_input #>> '{recipient,address_line1}')), 0) not between 5 and 200 then perform app.raise('INVALID_RECIPIENT', 'Enter the delivery address.'); end if;
  v_barangay := trim(p_input #>> '{recipient,barangay}');
  if coalesce(length(v_barangay), 0) < 2 then perform app.raise('INVALID_RECIPIENT', 'Enter the barangay.'); end if;
  if coalesce(length(p_input ->> 'gift_message'), 0) > 300 then perform app.raise('INVALID_INPUT', 'Gift message is too long (300 characters max).'); end if;
  if coalesce(length(p_input #>> '{delivery,instructions}'), 0) > 500 then perform app.raise('INVALID_INPUT', 'Delivery instructions are too long (500 characters max).'); end if;

  -- Zone & barangay ----------------------------------------------------------
  select * into v_zone from public.delivery_zones where id = (p_input #>> '{delivery,zone_id}')::uuid and is_active;
  if v_zone.id is null then perform app.raise('INVALID_ZONE', 'Choose a delivery zone.'); end if;
  if not exists (select 1 from unnest(v_zone.barangays) b where lower(b) = lower(v_barangay)) then
    perform app.raise('BARANGAY_NOT_COVERED', format('%s is not in the %s zone. Check coverage and choose the matching zone.', v_barangay, v_zone.name));
  end if;

  -- Goods totals from live cart --------------------------------------------
  v_subtotal := (v_cart ->> 'subtotal_centavos')::int;
  v_addons := (v_cart ->> 'add_ons_centavos')::int;
  if v_subtotal + v_addons < v_zone.min_order_centavos then
    perform app.raise('MIN_ORDER', format('Orders to %s need a minimum of %s.', v_zone.name, to_char(v_zone.min_order_centavos / 100.0, 'FM₱999,999,990.00')));
  end if;

  -- Promo --------------------------------------------------------------------
  if nullif(trim(coalesce(p_input ->> 'promo_code', '')), '') is not null then
    v_promo := public.validate_promo_code(p_input ->> 'promo_code', v_subtotal + v_addons);
    if not (v_promo ->> 'valid')::boolean then perform app.raise('INVALID_PROMO', v_promo ->> 'message'); end if;
    v_discount := (v_promo ->> 'discount_centavos')::int;
    v_promo_id := (v_promo ->> 'promo_id')::uuid;
  end if;

  -- Delivery fee ---------------------------------------------------------------
  v_fee := case when v_zone.free_delivery_threshold_centavos is not null and v_subtotal + v_addons >= v_zone.free_delivery_threshold_centavos then 0 else v_zone.fee_centavos end;
  v_total := v_subtotal + v_addons + v_fee - v_discount;

  -- Delivery date & slot -------------------------------------------------------
  begin
    v_delivery_date := (p_input #>> '{delivery,date}')::date;
  exception when others then
    perform app.raise('INVALID_DATE', 'Choose a delivery date.');
  end;
  select * into v_slot from public.delivery_slots where id = (p_input #>> '{delivery,slot_id}')::uuid and is_active;
  if v_slot.id is null then perform app.raise('INVALID_SLOT', 'Choose a delivery time slot.'); end if;
  if not exists (
    select 1 from jsonb_array_elements(public.list_delivery_options(v_zone.id, v_delivery_date) -> 'slots') s
    where (s ->> 'slot_id')::uuid = v_slot.id and (s ->> 'available')::boolean
  ) then
    perform app.raise('SLOT_UNAVAILABLE', 'That delivery slot is no longer available. Please pick another.');
  end if;

  -- Customer (guest, keyed by email) -------------------------------------------
  insert into public.customers (email, full_name, phone, privacy_consent_at, marketing_opt_in)
  values (p_input #>> '{sender,email}', trim(p_input #>> '{sender,name}'), p_input #>> '{sender,phone}', now(), coalesce((p_input ->> 'marketing_opt_in')::boolean, false))
  on conflict (email) do update
    set full_name = excluded.full_name, phone = excluded.phone, privacy_consent_at = now(),
        marketing_opt_in = public.customers.marketing_opt_in or excluded.marketing_opt_in
  returning id into v_customer_id;

  -- Order --------------------------------------------------------------------
  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  v_hold := case when v_payment_method = 'bank_transfer'
    then make_interval(hours => v_settings.bank_transfer_hold_hours)
    else make_interval(mins => v_settings.reservation_ttl_minutes) end;

  -- Book delivery capacity first so the order row is inserted complete (no later
  -- UPDATE, which the staff column-guard trigger would reject for anonymous callers).
  v_alloc_id := app.reserve_delivery_slot(v_slot.id, v_delivery_date);

  insert into public.orders (
    id, customer_id, cart_id, idempotency_key, tracking_token_hash,
    status, payment_status, subtotal_centavos, add_ons_centavos, discount_centavos, delivery_fee_centavos, total_centavos,
    promo_code_id, promo_code_snapshot, customer_name, customer_email, customer_phone, gift_message, delivery_instructions,
    delivery_zone_id, delivery_zone_snapshot, delivery_date, delivery_slot_snapshot, delivery_slot_allocation_id, reservation_expires_at, metadata
  ) values (
    v_order_id, v_customer_id, v_cart_id, p_idempotency_key, app.sha256_hex(v_token),
    'pending', 'unpaid', v_subtotal, v_addons, v_discount, v_fee, v_total,
    v_promo_id, v_promo ->> 'code', trim(p_input #>> '{sender,name}'), p_input #>> '{sender,email}', p_input #>> '{sender,phone}',
    nullif(trim(coalesce(p_input ->> 'gift_message', '')), ''), nullif(trim(coalesce(p_input #>> '{delivery,instructions}', '')), ''),
    v_zone.id, jsonb_build_object('name', v_zone.name, 'city', v_zone.city, 'fee_centavos', v_zone.fee_centavos),
    v_delivery_date, jsonb_build_object('slot_id', v_slot.id, 'label', v_slot.label, 'starts_at', v_slot.starts_at, 'ends_at', v_slot.ends_at),
    v_alloc_id, now() + v_hold, jsonb_build_object('payment_method', v_payment_method)
  ) returning order_number into v_order_number;

  insert into public.order_access_tokens (order_id, token) values (v_order_id, v_token);

  insert into public.order_recipients (order_id, full_name, phone, address_line1, address_line2, barangay, city, province, postal_code, landmark)
  values (v_order_id, trim(p_input #>> '{recipient,name}'), p_input #>> '{recipient,phone}', trim(p_input #>> '{recipient,address_line1}'),
    nullif(trim(coalesce(p_input #>> '{recipient,address_line2}', '')), ''), v_barangay, v_zone.city, v_zone.province,
    nullif(trim(coalesce(p_input #>> '{recipient,postal_code}', '')), ''), nullif(trim(coalesce(p_input #>> '{recipient,landmark}', '')), ''));

  -- Items (snapshots) --------------------------------------------------------
  for v_item in select * from jsonb_array_elements(v_cart -> 'items') loop
    insert into public.order_items (order_id, variant_id, product_id, product_name, variant_name, sku, image_path, unit_price_centavos, quantity, line_total_centavos)
    values (v_order_id, (v_item ->> 'variant_id')::uuid, (v_item ->> 'product_id')::uuid, v_item ->> 'product_name', v_item ->> 'variant_name', v_item ->> 'sku',
      v_item ->> 'image_path', (v_item ->> 'unit_price_centavos')::int, (v_item ->> 'quantity')::int, (v_item ->> 'line_total_centavos')::int)
    returning id into v_item_id;
    for v_addon in select * from jsonb_array_elements(v_item -> 'add_ons') loop
      insert into public.order_item_add_ons (order_item_id, add_on_id, name, sku, unit_price_centavos, quantity, line_total_centavos)
      values (v_item_id, (v_addon ->> 'add_on_id')::uuid, v_addon ->> 'name', v_addon ->> 'sku', (v_addon ->> 'unit_price_centavos')::int, (v_addon ->> 'quantity')::int, (v_addon ->> 'line_total_centavos')::int);
    end loop;
  end loop;

  -- Stock + slot reservations (atomic with the order) -------------------------
  select jsonb_agg(jsonb_build_object('variant_id', i ->> 'variant_id', 'quantity', (i ->> 'quantity')::int)) into v_lines from jsonb_array_elements(v_cart -> 'items') i;
  perform app.reserve_stock('order', v_order_id, 'order:' || v_order_id::text, v_lines, now() + v_hold);

  if v_promo_id is not null then update public.promo_codes set uses_count = uses_count + 1 where id = v_promo_id; end if;
  update public.carts set status = 'converted', converted_order_id = v_order_id where id = v_cart_id;

  return jsonb_build_object('replayed', false, 'order_id', v_order_id, 'order_number', v_order_number, 'tracking_token', v_token,
    'total_centavos', v_total, 'payment_status', 'unpaid', 'payment_method', v_payment_method, 'reservation_expires_at', now() + v_hold);
exception
  when unique_violation then
    -- Two concurrent first attempts with the same key: surface the winner.
    select * into v_existing from public.orders where idempotency_key = p_idempotency_key;
    if v_existing.id is null then raise; end if;
    select token into v_token from public.order_access_tokens where order_id = v_existing.id;
    return jsonb_build_object('replayed', true, 'order_id', v_existing.id, 'order_number', v_existing.order_number, 'tracking_token', v_token,
      'total_centavos', v_existing.total_centavos, 'payment_status', v_existing.payment_status);
end;
$$;
grant execute on function public.place_order(text, text, jsonb) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Payment attempts & transitions (server / staff only)
-- ---------------------------------------------------------------------------
create or replace function public.create_payment_attempt(p_order_id uuid, p_provider public.payment_provider, p_idempotency_key text, p_expires_at timestamptz default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_existing public.payments%rowtype;
  v_payment public.payments%rowtype;
  v_attempt integer;
begin
  perform app.assert_staff();
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then perform app.raise('ORDER_NOT_FOUND', 'Order not found.'); end if;
  if v_order.payment_status = 'paid' then perform app.raise('ALREADY_PAID', 'This order is already paid.'); end if;
  if v_order.status = 'cancelled' then perform app.raise('ORDER_CANCELLED', 'This order was cancelled.'); end if;

  select * into v_existing from public.payments where idempotency_key = p_idempotency_key;
  if v_existing.id is not null then return to_jsonb(v_existing); end if;

  -- Supersede earlier open attempts.
  update public.payments set status = 'cancelled' where order_id = p_order_id and status in ('pending', 'requires_action');

  select coalesce(max(attempt), 0) + 1 into v_attempt from public.payments where order_id = p_order_id;
  insert into public.payments (order_id, idempotency_key, provider, method, amount_centavos, status, attempt, expires_at)
  values (p_order_id, p_idempotency_key, p_provider, case when p_provider = 'bank_transfer' then 'bank_transfer'::public.payment_method else null end, v_order.total_centavos, 'pending', v_attempt, p_expires_at)
  returning * into v_payment;
  update public.orders set payment_status = 'pending' where id = p_order_id and payment_status in ('unpaid', 'failed');
  return to_jsonb(v_payment);
end;
$$;

create or replace function public.update_payment_provider_ref(p_payment_id uuid, p_provider_payment_id text, p_checkout_url text, p_provider_data jsonb default '{}'::jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform app.assert_staff();
  update public.payments set provider_payment_id = p_provider_payment_id, checkout_url = p_checkout_url, provider_data = provider_data || coalesce(p_provider_data, '{}'::jsonb)
  where id = p_payment_id;
end;
$$;

-- Idempotent webhook recording: returns {id, duplicate}.
create or replace function public.record_payment_event(p_provider public.payment_provider, p_event_id text, p_event_type text, p_payload jsonb, p_signature_verified boolean, p_payment_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform app.assert_staff();
  insert into public.payment_events (provider, provider_event_id, event_type, payload, signature_verified, payment_id)
  values (p_provider, p_event_id, p_event_type, p_payload, p_signature_verified, p_payment_id)
  on conflict (provider, provider_event_id) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.payment_events where provider = p_provider and provider_event_id = p_event_id;
    return jsonb_build_object('id', v_id, 'duplicate', true);
  end if;
  return jsonb_build_object('id', v_id, 'duplicate', false);
end;
$$;

create or replace function public.mark_payment_event_processed(p_event_id uuid, p_error text default null, p_payment_id uuid default null)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform app.assert_staff();
  update public.payment_events set processed_at = now(), processing_error = p_error, payment_id = coalesce(p_payment_id, payment_id) where id = p_event_id;
end;
$$;

-- Core success transition. Idempotent. Handles delayed payments that arrive
-- after the reservation expired (re-reserves or flags for staff).
create or replace function public.mark_order_paid(p_payment_id uuid, p_provider_payment_id text default null, p_method public.payment_method default null, p_paid_at timestamptz default now(), p_provider_data jsonb default '{}'::jsonb, p_verified_by uuid default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_order public.orders%rowtype;
  v_lines jsonb;
  v_flags jsonb := '{}'::jsonb;
  v_alloc uuid;
begin
  perform app.assert_staff();
  select * into v_payment from public.payments where id = p_payment_id for update;
  if v_payment.id is null then perform app.raise('PAYMENT_NOT_FOUND', 'Payment not found.'); end if;
  select * into v_order from public.orders where id = v_payment.order_id for update;

  if v_payment.status = 'paid' then
    return jsonb_build_object('order_id', v_order.id, 'order_number', v_order.order_number, 'already_paid', true);
  end if;

  update public.payments
    set status = 'paid', paid_at = coalesce(p_paid_at, now()), method = coalesce(p_method, method),
        provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id),
        provider_data = provider_data || coalesce(p_provider_data, '{}'::jsonb),
        verified_by = coalesce(p_verified_by, verified_by), verified_at = case when p_verified_by is not null then now() else verified_at end
    where id = p_payment_id;
  -- Any other open attempts are moot now.
  update public.payments set status = 'cancelled' where order_id = v_order.id and id <> p_payment_id and status in ('pending', 'requires_action');

  if v_order.payment_status <> 'paid' then
    -- Delayed payment after the hold expired: try to re-secure stock and slot.
    if v_order.status = 'cancelled' and v_order.cancellation_reason = 'payment_timeout' then
      select jsonb_agg(jsonb_build_object('variant_id', variant_id, 'quantity', quantity)) into v_lines from public.order_items where order_id = v_order.id and variant_id is not null;
      begin
        perform app.reserve_stock('order', v_order.id, 'order:' || v_order.id::text || ':repaid:' || p_payment_id::text, v_lines, null);
      exception when others then
        v_flags := v_flags || jsonb_build_object('stock_shortfall', sqlerrm);
      end;
      if v_order.delivery_slot_snapshot ->> 'slot_id' is not null then
        begin
          v_alloc := app.reserve_delivery_slot((v_order.delivery_slot_snapshot ->> 'slot_id')::uuid, v_order.delivery_date);
          update public.orders set delivery_slot_allocation_id = v_alloc where id = v_order.id;
        exception when others then
          v_flags := v_flags || jsonb_build_object('slot_unavailable', sqlerrm);
        end;
      end if;
      v_flags := v_flags || jsonb_build_object('paid_after_timeout', true);
    end if;

    update public.orders
      set payment_status = 'paid', status = 'confirmed', confirmed_at = coalesce(confirmed_at, now()),
          cancelled_at = null, cancellation_reason = null, reservation_expires_at = null,
          metadata = metadata || jsonb_build_object('needs_attention', v_flags <> '{}'::jsonb) || v_flags
      where id = v_order.id;
    -- Reservations now hold until fulfilment.
    update public.stock_reservations set expires_at = null where reference_type = 'order' and reference_id = v_order.id and status = 'active';

    -- Customer notification is enqueued by the orders_notify trigger (migration 1500).
  end if;

  return jsonb_build_object('order_id', v_order.id, 'order_number', v_order.order_number, 'already_paid', false, 'flags', v_flags);
end;
$$;

create or replace function public.mark_payment_failed(p_payment_id uuid, p_failure_code text default null, p_failure_message text default null, p_provider_data jsonb default '{}'::jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
begin
  perform app.assert_staff();
  select * into v_payment from public.payments where id = p_payment_id for update;
  if v_payment.id is null then perform app.raise('PAYMENT_NOT_FOUND', 'Payment not found.'); end if;
  if v_payment.status = 'paid' then
    return jsonb_build_object('ignored', true, 'reason', 'already_paid');
  end if;
  update public.payments set status = 'failed', failure_code = p_failure_code, failure_message = p_failure_message, provider_data = provider_data || coalesce(p_provider_data, '{}'::jsonb)
  where id = p_payment_id;
  update public.orders set payment_status = 'failed' where id = v_payment.order_id and payment_status <> 'paid';
  return jsonb_build_object('ignored', false, 'order_id', v_payment.order_id);
end;
$$;

-- Job: release holds on unpaid orders whose reservation window has passed.
create or replace function public.expire_unpaid_orders()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_order record;
  v_count integer := 0;
begin
  perform app.assert_staff();
  for v_order in
    select id, delivery_slot_allocation_id from public.orders
    where status = 'pending' and payment_status <> 'paid' and reservation_expires_at is not null and reservation_expires_at < now()
    for update skip locked
  loop
    perform app.release_stock_reservations('order', v_order.id, 'payment timeout');
    if v_order.delivery_slot_allocation_id is not null then perform app.release_delivery_slot(v_order.delivery_slot_allocation_id); end if;
    update public.orders set status = 'cancelled', cancelled_at = now(), cancellation_reason = 'payment_timeout',
      fulfillment_status = 'cancelled', delivery_status = 'cancelled', reservation_expires_at = null, delivery_slot_allocation_id = null
      where id = v_order.id;
    update public.payments set status = 'expired' where order_id = v_order.id and status in ('pending', 'requires_action');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Guest attaches a bank-transfer proof (token-scoped).
create or replace function public.attach_payment_proof(p_order_number text, p_token text, p_storage_path text, p_reference text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_payment public.payments%rowtype;
begin
  select * into v_order from public.orders where order_number = p_order_number and tracking_token_hash = app.sha256_hex(coalesce(p_token, ''));
  if v_order.id is null then perform app.raise('ORDER_NOT_FOUND', 'Order not found.'); end if;
  if v_order.payment_status = 'paid' then perform app.raise('ALREADY_PAID', 'This order is already paid.'); end if;
  if p_storage_path !~ ('^orders/' || v_order.id::text || '/') then perform app.raise('INVALID_PROOF', 'Invalid proof path.'); end if;
  select * into v_payment from public.payments where order_id = v_order.id and provider = 'bank_transfer' and status in ('pending', 'requires_action') order by created_at desc limit 1 for update;
  if v_payment.id is null then perform app.raise('NO_BANK_TRANSFER', 'No bank transfer is pending for this order.'); end if;
  update public.payments set proof_storage_path = p_storage_path, proof_uploaded_at = now(), status = 'requires_action',
    provider_reference = coalesce(nullif(trim(p_reference), ''), provider_reference) where id = v_payment.id;
  return jsonb_build_object('payment_id', v_payment.id, 'status', 'requires_action');
end;
$$;
grant execute on function public.attach_payment_proof(text, text, text, text) to anon, authenticated, service_role;

-- Staff verifies or rejects a bank transfer.
create or replace function public.verify_bank_transfer(p_payment_id uuid, p_approve boolean, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
begin
  perform app.assert_staff('owner', 'manager');
  select * into v_payment from public.payments where id = p_payment_id;
  if v_payment.id is null or v_payment.provider <> 'bank_transfer' then perform app.raise('PAYMENT_NOT_FOUND', 'Bank transfer not found.'); end if;
  if p_approve then
    return public.mark_order_paid(p_payment_id, null, 'bank_transfer', now(), jsonb_build_object('verification_note', p_note), auth.uid());
  end if;
  return public.mark_payment_failed(p_payment_id, 'rejected_by_staff', coalesce(p_note, 'Proof of payment could not be verified.'));
end;
$$;

-- Staff records a refund (provider call happens in the app; this keeps the books).
create or replace function public.record_refund(p_payment_id uuid, p_idempotency_key text, p_amount_centavos integer, p_reason text, p_status public.refund_status, p_provider_refund_id text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_refund public.refunds%rowtype;
  v_total_refunded integer;
begin
  perform app.assert_staff('owner', 'manager');
  select * into v_payment from public.payments where id = p_payment_id for update;
  if v_payment.id is null or v_payment.status not in ('paid', 'partially_refunded', 'refunded') then perform app.raise('NOT_REFUNDABLE', 'Only paid payments can be refunded.'); end if;

  select * into v_refund from public.refunds where idempotency_key = p_idempotency_key;
  if v_refund.id is null then
    insert into public.refunds (payment_id, idempotency_key, amount_centavos, reason, status, provider_refund_id, requested_by, processed_at)
    values (p_payment_id, p_idempotency_key, p_amount_centavos, p_reason, p_status, p_provider_refund_id, auth.uid(), case when p_status = 'succeeded' then now() end)
    returning * into v_refund;
  else
    update public.refunds set status = p_status, provider_refund_id = coalesce(p_provider_refund_id, provider_refund_id), processed_at = case when p_status = 'succeeded' then now() else processed_at end
    where id = v_refund.id returning * into v_refund;
  end if;

  select coalesce(sum(amount_centavos), 0) into v_total_refunded from public.refunds where payment_id = p_payment_id and status = 'succeeded';
  if v_total_refunded >= v_payment.amount_centavos then
    update public.payments set status = 'refunded' where id = p_payment_id;
    update public.orders set payment_status = 'refunded' where id = v_payment.order_id;
  elsif v_total_refunded > 0 then
    update public.payments set status = 'partially_refunded' where id = p_payment_id;
    update public.orders set payment_status = 'partially_refunded' where id = v_payment.order_id;
  end if;
  return to_jsonb(v_refund);
end;
$$;

-- Server-side lookup for the webhook handler.
create or replace function public.find_payment_by_provider_ref(p_provider public.payment_provider, p_provider_payment_id text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_payment public.payments%rowtype;
begin
  perform app.assert_staff();
  select * into v_payment from public.payments where provider = p_provider and provider_payment_id = p_provider_payment_id;
  if v_payment.id is null then return null; end if;
  return to_jsonb(v_payment);
end;
$$;

-- Tracking view now includes payment state.
create or replace function public.get_order_for_tracking(p_order_number text, p_token text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_items jsonb;
  v_history jsonb;
  v_recipient jsonb;
  v_payments jsonb;
  v_settings public.business_settings%rowtype;
begin
  if p_order_number is null or p_token is null or length(p_token) < 16 then return null; end if;
  select * into v_order from public.orders o where o.order_number = p_order_number and o.tracking_token_hash = app.sha256_hex(p_token);
  if v_order.id is null then return null; end if;
  select * into v_settings from public.business_settings where id = 1;

  select coalesce(jsonb_agg(jsonb_build_object(
      'product_name', oi.product_name, 'variant_name', oi.variant_name, 'image_path', oi.image_path, 'quantity', oi.quantity,
      'unit_price_centavos', oi.unit_price_centavos, 'line_total_centavos', oi.line_total_centavos,
      'add_ons', (select coalesce(jsonb_agg(jsonb_build_object('name', a.name, 'quantity', a.quantity, 'line_total_centavos', a.line_total_centavos)), '[]'::jsonb) from public.order_item_add_ons a where a.order_item_id = oi.id)
    ) order by oi.created_at), '[]'::jsonb) into v_items from public.order_items oi where oi.order_id = v_order.id;

  select coalesce(jsonb_agg(jsonb_build_object('kind', h.kind, 'to_status', h.to_status, 'at', h.created_at) order by h.created_at), '[]'::jsonb)
  into v_history from public.order_status_history h where h.order_id = v_order.id;

  select jsonb_build_object('full_name', r.full_name, 'barangay', r.barangay, 'city', r.city, 'address_line1', r.address_line1,
      'phone_masked', regexp_replace(r.phone, '^(\+639\d{2})\d{5}(\d{2})$', '\1•••••\2'))
  into v_recipient from public.order_recipients r where r.order_id = v_order.id;

  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'provider', p.provider, 'method', p.method, 'status', p.status, 'amount_centavos', p.amount_centavos,
      'attempt', p.attempt, 'checkout_url', case when p.status in ('pending', 'requires_action') then p.checkout_url end,
      'provider_reference', p.provider_reference, 'proof_uploaded_at', p.proof_uploaded_at, 'failure_message', p.failure_message,
      'paid_at', p.paid_at, 'expires_at', p.expires_at, 'created_at', p.created_at) order by p.created_at desc), '[]'::jsonb)
  into v_payments from public.payments p where p.order_id = v_order.id;

  return jsonb_build_object(
    'order_id', v_order.id, 'order_number', v_order.order_number, 'status', v_order.status, 'payment_status', v_order.payment_status,
    'fulfillment_status', v_order.fulfillment_status, 'delivery_status', v_order.delivery_status, 'placed_at', v_order.placed_at,
    'delivery_date', v_order.delivery_date, 'delivery_slot', v_order.delivery_slot_snapshot, 'delivery_zone', v_order.delivery_zone_snapshot,
    'subtotal_centavos', v_order.subtotal_centavos, 'add_ons_centavos', v_order.add_ons_centavos, 'discount_centavos', v_order.discount_centavos,
    'delivery_fee_centavos', v_order.delivery_fee_centavos, 'total_centavos', v_order.total_centavos, 'promo_code', v_order.promo_code_snapshot,
    'customer_name', v_order.customer_name, 'email_masked', regexp_replace(v_order.customer_email::text, '^(.).*(@.*)$', '\1•••\2'),
    'gift_message', v_order.gift_message, 'reservation_expires_at', v_order.reservation_expires_at,
    'cancellation_reason', v_order.cancellation_reason,
    'payment_method', v_order.metadata ->> 'payment_method',
    'can_pay', v_order.status = 'pending' and v_order.payment_status <> 'paid',
    'bank_transfer_instructions', case when v_order.payment_status <> 'paid' then v_settings.bank_transfer_instructions end,
    'items', v_items, 'recipient', v_recipient, 'history', v_history, 'payments', v_payments
  );
end;
$$;

-- Storage: guests upload proofs into orders/<order_id>/... through the server only.
-- (No anon policy: the server uses the service role after validating the token.)
