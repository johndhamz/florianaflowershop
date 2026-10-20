-- ============================================================================
-- 0100 · Foundation: extensions, app schema, enums, helper functions
-- ============================================================================

create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "citext" with schema extensions;
create extension if not exists "btree_gist" with schema extensions;

-- Internal helpers live in `app`. Nothing here is exposed through PostgREST.
create schema if not exists app;
grant usage on schema app to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.staff_role as enum ('owner', 'manager', 'florist', 'rider', 'support');

create type public.product_status as enum ('draft', 'active', 'archived');
create type public.inventory_mode as enum ('recipe', 'untracked');

create type public.material_unit as enum ('stem', 'bunch', 'piece', 'gram', 'millilitre', 'metre');
create type public.stock_batch_status as enum ('active', 'depleted', 'expired', 'discarded');
create type public.stock_movement_type as enum ('receive', 'reserve', 'release', 'consume', 'adjust', 'discard', 'expire');
create type public.stock_reservation_status as enum ('active', 'consumed', 'released', 'expired');

create type public.cart_status as enum ('active', 'converted', 'abandoned', 'merged');

create type public.order_status as enum ('pending', 'confirmed', 'completed', 'cancelled');
create type public.payment_status as enum ('unpaid', 'pending', 'paid', 'failed', 'refunded', 'partially_refunded');
create type public.fulfillment_status as enum ('unfulfilled', 'preparing', 'ready', 'fulfilled', 'cancelled');
create type public.delivery_status as enum ('pending', 'scheduled', 'out_for_delivery', 'delivered', 'failed', 'cancelled');
create type public.status_kind as enum ('order', 'payment', 'fulfillment', 'delivery');

create type public.payment_provider as enum ('paymongo', 'bank_transfer', 'manual');
create type public.payment_method as enum ('card', 'gcash', 'maya', 'grab_pay', 'bank_transfer', 'cash', 'other');
create type public.payment_record_status as enum ('pending', 'requires_action', 'paid', 'failed', 'cancelled', 'expired', 'refunded', 'partially_refunded');
create type public.refund_status as enum ('pending', 'succeeded', 'failed');

create type public.promo_type as enum ('percent', 'fixed');

create type public.notification_channel as enum ('email', 'sms');
create type public.notification_status as enum ('queued', 'sent', 'failed', 'skipped');

-- ---------------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------------
create or replace function app.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Slug check used by products, collections, occasions, tags.
create or replace function app.is_slug(value text)
returns boolean
language sql
immutable
as $$
  select value ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and length(value) between 1 and 120;
$$;

-- Philippine mobile numbers in E.164 (+639XXXXXXXXX).
create or replace function app.is_ph_mobile(value text)
returns boolean
language sql
immutable
as $$
  select value ~ '^\+639\d{9}$';
$$;

-- ---------------------------------------------------------------------------
-- Audit log + generic row-audit trigger
-- TG_ARGV[0] (optional): comma-separated list of columns to redact (PII).
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references auth.users (id) on delete set null,
  actor_role  public.staff_role,
  action      text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  entity_type text not null,
  entity_id   text,
  before      jsonb,
  after       jsonb,
  changed_columns text[],
  created_at  timestamptz not null default now()
);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);

create or replace function app.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  redact   text[] := case when tg_nargs > 0 then string_to_array(tg_argv[0], ',') else '{}' end;
  before_j jsonb;
  after_j  jsonb;
  changed  text[];
  col      text;
  ent_id   text;
begin
  if tg_op in ('UPDATE', 'DELETE') then before_j := to_jsonb(old); end if;
  if tg_op in ('INSERT', 'UPDATE') then after_j  := to_jsonb(new); end if;

  foreach col in array redact loop
    if before_j ? col then before_j := jsonb_set(before_j, array[col], '"[redacted]"'); end if;
    if after_j  ? col then after_j  := jsonb_set(after_j,  array[col], '"[redacted]"'); end if;
  end loop;

  if tg_op = 'UPDATE' then
    select array_agg(key) into changed
    from jsonb_each(to_jsonb(new)) n
    where to_jsonb(old) -> n.key is distinct from n.value;
    -- Skip no-op updates (only updated_at changed).
    if changed is null or changed = array['updated_at'] then
      return new;
    end if;
  end if;

  ent_id := coalesce(after_j ->> 'id', before_j ->> 'id', after_j ->> 'key', before_j ->> 'key');

  insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, before, after, changed_columns)
  values (auth.uid(), app.current_staff_role(), tg_op, tg_table_name, ent_id, before_j, after_j, changed);

  return coalesce(new, old);
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.staff_profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  role         public.staff_role not null,
  display_name text not null check (length(display_name) between 1 and 120),
  phone        text check (phone is null or app.is_ph_mobile(phone)),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index staff_profiles_role_idx on public.staff_profiles (role) where is_active;
create trigger staff_profiles_updated_at before update on public.staff_profiles
  for each row execute function app.set_updated_at();
create trigger staff_profiles_audit after insert or update or delete on public.staff_profiles
  for each row execute function app.audit_row('phone');

-- Customers: created on checkout. `user_id` stays null for guests.
create table public.customers (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid unique references auth.users (id) on delete set null,
  email               extensions.citext not null,
  full_name           text not null check (length(full_name) between 1 and 160),
  phone               text check (phone is null or app.is_ph_mobile(phone)),
  privacy_consent_at  timestamptz not null,
  marketing_opt_in    boolean not null default false,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create unique index customers_email_key on public.customers (email);
create index customers_phone_idx on public.customers (phone);
create trigger customers_updated_at before update on public.customers
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Authorization helpers (security definer so they can read staff_profiles
-- regardless of the caller's own RLS visibility).
-- ---------------------------------------------------------------------------
create or replace function app.current_staff_role()
returns public.staff_role
language sql
stable
security definer
set search_path = ''
as $$
  select sp.role
  from public.staff_profiles sp
  where sp.user_id = auth.uid()
    and sp.is_active;
$$;

create or replace function app.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.current_staff_role() is not null;
$$;

create or replace function app.has_role(variadic roles public.staff_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(app.current_staff_role() = any(roles), false);
$$;

-- Owner + manager can do almost everything; keep the pair in one place.
create or replace function app.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.has_role('owner', 'manager');
$$;

-- Raise a consistent, catchable error from plpgsql.
create or replace function app.raise(code text, message text)
returns void
language plpgsql
as $$
begin
  raise exception using message = message, errcode = 'P0001', detail = code;
end;
$$;

-- NOTE: functions in `app` keep the default EXECUTE grant. The schema is not
-- exposed through PostgREST, and triggers/check constraints/RLS policies run
-- these helpers as the API caller, so they must stay executable.
