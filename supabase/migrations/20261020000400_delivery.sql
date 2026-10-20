-- ============================================================================
-- 0400 · Delivery: zones (barangay coverage + fee), slot templates, and per-date
--        capacity allocations that checkout reserves atomically.
-- ============================================================================

create table public.delivery_zones (
  id                     uuid primary key default gen_random_uuid(),
  slug                   text not null unique check (app.is_slug(slug)),
  name                   text not null check (length(name) between 1 and 120),
  city                   text not null,
  province               text not null default 'Cebu',
  barangays              text[] not null default '{}',
  fee_centavos           integer not null check (fee_centavos >= 0),
  free_delivery_threshold_centavos integer check (free_delivery_threshold_centavos is null or free_delivery_threshold_centavos >= 0),
  min_order_centavos     integer not null default 0 check (min_order_centavos >= 0),
  same_day_cutoff        time,                    -- local (Asia/Manila) time; null = no same-day
  lead_time_hours        integer not null default 24 check (lead_time_hours >= 0),
  is_active              boolean not null default true,
  position               integer not null default 0,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index delivery_zones_barangays_idx on public.delivery_zones using gin (barangays);
create trigger delivery_zones_updated_at before update on public.delivery_zones
  for each row execute function app.set_updated_at();
create trigger delivery_zones_audit after insert or update or delete on public.delivery_zones
  for each row execute function app.audit_row();

-- Slot templates: "Morning 9–12", every weekday, default capacity 12.
create table public.delivery_slots (
  id               uuid primary key default gen_random_uuid(),
  label            text not null check (length(label) between 1 and 60),
  starts_at        time not null,
  ends_at          time not null,
  days_of_week     smallint[] not null default '{0,1,2,3,4,5,6}', -- 0 = Sunday
  default_capacity integer not null check (default_capacity >= 0),
  is_active        boolean not null default true,
  position         integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint delivery_slots_window check (ends_at > starts_at)
);
create trigger delivery_slots_updated_at before update on public.delivery_slots
  for each row execute function app.set_updated_at();
create trigger delivery_slots_audit after insert or update or delete on public.delivery_slots
  for each row execute function app.audit_row();

-- Capacity for one slot on one date. Rows are created lazily on first booking
-- (or ahead of time by staff to override capacity, e.g. Valentine's).
create table public.delivery_slot_allocations (
  id            uuid primary key default gen_random_uuid(),
  slot_id       uuid not null references public.delivery_slots (id) on delete cascade,
  delivery_date date not null,
  capacity      integer not null check (capacity >= 0),
  booked        integer not null default 0 check (booked >= 0),
  is_blocked    boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (slot_id, delivery_date),
  constraint delivery_slot_allocations_capacity check (booked <= capacity)
);
create index delivery_slot_allocations_date_idx on public.delivery_slot_allocations (delivery_date);
create trigger delivery_slot_allocations_updated_at before update on public.delivery_slot_allocations
  for each row execute function app.set_updated_at();
