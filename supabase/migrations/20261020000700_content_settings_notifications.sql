-- ============================================================================
-- 0700 · Site content blocks, business settings (single row), notifications
-- ============================================================================

create table public.site_content (
  key          text primary key check (key ~ '^[a-z0-9_.-]{1,80}$'),
  data         jsonb not null default '{}'::jsonb,
  is_published boolean not null default false,
  updated_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger site_content_updated_at before update on public.site_content
  for each row execute function app.set_updated_at();

-- Exactly one row. Public-safe columns only: never store secrets here.
create table public.business_settings (
  id                        smallint primary key default 1 check (id = 1),
  shop_name                 text not null default 'Floriana Flowers',
  tagline                   text not null default 'Love, in every bloom.',
  contact_email             extensions.citext not null,
  contact_phone             text not null,
  address                   text,
  currency                  char(3) not null default 'PHP' check (currency = 'PHP'),
  timezone                  text not null default 'Asia/Manila',
  same_day_cutoff           time not null default '14:00',
  reservation_ttl_minutes   integer not null default 30 check (reservation_ttl_minutes between 5 and 1440),
  bank_transfer_instructions text,
  online_payments_enabled   boolean not null default false,
  bank_transfer_enabled     boolean not null default true,
  social                    jsonb not null default '{}'::jsonb,
  extras                    jsonb not null default '{}'::jsonb,
  updated_by                uuid references auth.users (id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create trigger business_settings_updated_at before update on public.business_settings
  for each row execute function app.set_updated_at();
create trigger business_settings_audit after insert or update or delete on public.business_settings
  for each row execute function app.audit_row();

-- Outbound transactional messages (email/SMS). Recipient is PII.
create table public.notifications (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid references public.orders (id) on delete set null,
  customer_id         uuid references public.customers (id) on delete set null,
  channel             public.notification_channel not null,
  template            text not null check (template ~ '^[a-z0-9_.-]{1,80}$'),
  recipient           text not null,
  subject             text,
  payload             jsonb not null default '{}'::jsonb,
  status              public.notification_status not null default 'queued',
  provider            text,
  provider_message_id text,
  error               text,
  attempts            integer not null default 0 check (attempts >= 0),
  scheduled_for       timestamptz not null default now(),
  sent_at             timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index notifications_order_idx on public.notifications (order_id);
create index notifications_queue_idx on public.notifications (scheduled_for) where status = 'queued';
create trigger notifications_updated_at before update on public.notifications
  for each row execute function app.set_updated_at();
