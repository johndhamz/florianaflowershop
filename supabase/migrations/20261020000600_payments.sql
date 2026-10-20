-- ============================================================================
-- 0600 · Payments, provider events (webhook idempotency), refunds.
--        No card data is ever stored: only provider references and sanitized
--        payloads.
-- ============================================================================

create table public.payments (
  id                   uuid primary key default gen_random_uuid(),
  order_id             uuid not null references public.orders (id) on delete restrict,
  idempotency_key      text not null unique check (length(idempotency_key) between 8 and 128),
  provider             public.payment_provider not null,
  method               public.payment_method,
  provider_payment_id  text,                       -- e.g. PayMongo payment intent id
  provider_reference   text,                       -- customer-facing ref (bank transfer ref no.)
  amount_centavos      integer not null check (amount_centavos > 0),
  currency             char(3) not null default 'PHP' check (currency = 'PHP'),
  status               public.payment_record_status not null default 'pending',
  failure_code         text,
  failure_message      text,
  proof_storage_path   text,                       -- bank transfer proof in private bucket
  verified_by          uuid references auth.users (id) on delete set null,
  verified_at          timestamptz,
  paid_at              timestamptz,
  expires_at           timestamptz,
  attempt              integer not null default 1 check (attempt >= 1),
  provider_data        jsonb not null default '{}'::jsonb,   -- sanitized; never PAN/CVV
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create unique index payments_provider_payment_id_key on public.payments (provider, provider_payment_id)
  where provider_payment_id is not null;
create index payments_order_idx on public.payments (order_id, created_at desc);
create index payments_status_idx on public.payments (status) where status in ('pending', 'requires_action');
create trigger payments_updated_at before update on public.payments
  for each row execute function app.set_updated_at();
create trigger payments_audit after insert or update or delete on public.payments
  for each row execute function app.audit_row();

-- Raw inbound provider events. (provider, provider_event_id) is unique so a
-- duplicated/delayed webhook is a no-op on insert conflict.
create table public.payment_events (
  id                  uuid primary key default gen_random_uuid(),
  provider            public.payment_provider not null,
  provider_event_id   text not null,
  event_type          text not null,
  payment_id          uuid references public.payments (id) on delete set null,
  signature_verified  boolean not null default false,
  payload             jsonb not null,
  processed_at        timestamptz,
  processing_error    text,
  received_at         timestamptz not null default now(),
  unique (provider, provider_event_id)
);
create index payment_events_payment_idx on public.payment_events (payment_id, received_at desc);
create index payment_events_unprocessed_idx on public.payment_events (received_at) where processed_at is null;

create table public.refunds (
  id                  uuid primary key default gen_random_uuid(),
  payment_id          uuid not null references public.payments (id) on delete restrict,
  idempotency_key     text not null unique check (length(idempotency_key) between 8 and 128),
  provider_refund_id  text,
  amount_centavos     integer not null check (amount_centavos > 0),
  reason              text not null check (length(reason) between 1 and 500),
  status              public.refund_status not null default 'pending',
  failure_message     text,
  requested_by        uuid references auth.users (id) on delete set null,
  processed_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index refunds_payment_idx on public.refunds (payment_id);
create trigger refunds_updated_at before update on public.refunds
  for each row execute function app.set_updated_at();
create trigger refunds_audit after insert or update or delete on public.refunds
  for each row execute function app.audit_row();

-- Refunds can never exceed what was paid.
create or replace function app.refunds_check_total()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_paid integer;
  v_refunded integer;
begin
  select amount_centavos into v_paid from public.payments where id = new.payment_id for update;
  select coalesce(sum(amount_centavos), 0) into v_refunded
  from public.refunds
  where payment_id = new.payment_id and status <> 'failed' and id <> new.id;
  if v_refunded + new.amount_centavos > v_paid then
    perform app.raise('REFUND_EXCEEDS_PAYMENT', 'Total refunds cannot exceed the payment amount.');
  end if;
  return new;
end;
$$;
create trigger refunds_check_total before insert or update on public.refunds
  for each row execute function app.refunds_check_total();
