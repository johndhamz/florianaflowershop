-- ============================================================================
-- 0300 · Inventory: suppliers, materials, perishable stock batches, recipes,
--        movements and reservations. Quantities are numeric (stems, grams, …).
-- ============================================================================

create table public.suppliers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(name) between 1 and 160),
  contact_name  text,
  phone         text,
  email         extensions.citext,
  address       text,
  notes         text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger suppliers_updated_at before update on public.suppliers
  for each row execute function app.set_updated_at();

create table public.materials (
  id                  uuid primary key default gen_random_uuid(),
  sku                 text not null unique check (sku ~ '^[A-Z0-9]+(?:-[A-Z0-9]+)*$'),
  name                text not null check (length(name) between 1 and 160),
  category            text not null default 'flower' check (category in ('flower', 'foliage', 'plant', 'container', 'wrap', 'accessory', 'consumable')),
  unit                public.material_unit not null default 'stem',
  is_perishable       boolean not null default true,
  default_shelf_life_days integer check (default_shelf_life_days is null or default_shelf_life_days > 0),
  low_stock_threshold numeric(12,3) not null default 0 check (low_stock_threshold >= 0),
  default_supplier_id uuid references public.suppliers (id) on delete set null,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index materials_category_idx on public.materials (category) where is_active;
create trigger materials_updated_at before update on public.materials
  for each row execute function app.set_updated_at();

-- A batch is one delivery of one material. Perishables carry an expiry.
create table public.stock_batches (
  id                 uuid primary key default gen_random_uuid(),
  material_id        uuid not null references public.materials (id) on delete restrict,
  supplier_id        uuid references public.suppliers (id) on delete set null,
  batch_code         text not null unique check (length(batch_code) between 1 and 60),
  quantity_received  numeric(12,3) not null check (quantity_received > 0),
  quantity_remaining numeric(12,3) not null check (quantity_remaining >= 0),
  quantity_reserved  numeric(12,3) not null default 0 check (quantity_reserved >= 0),
  unit_cost_centavos integer not null default 0 check (unit_cost_centavos >= 0),
  received_at        timestamptz not null default now(),
  expires_at         timestamptz,
  status             public.stock_batch_status not null default 'active',
  notes              text,
  created_by         uuid references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint stock_batches_remaining_lte_received check (quantity_remaining <= quantity_received),
  constraint stock_batches_reserved_lte_remaining check (quantity_reserved <= quantity_remaining),
  constraint stock_batches_expiry_after_receipt check (expires_at is null or expires_at > received_at)
);
-- FEFO picking: active batches of a material ordered by soonest expiry.
create index stock_batches_fefo_idx on public.stock_batches (material_id, expires_at nulls last)
  where status = 'active';
create trigger stock_batches_updated_at before update on public.stock_batches
  for each row execute function app.set_updated_at();

-- Bouquet recipe: the bill of materials for one sellable variant.
create table public.bouquet_recipes (
  id          uuid primary key default gen_random_uuid(),
  variant_id  uuid not null unique references public.product_variants (id) on delete cascade,
  name        text not null check (length(name) between 1 and 160),
  instructions text,
  assembly_minutes integer check (assembly_minutes is null or assembly_minutes > 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger bouquet_recipes_updated_at before update on public.bouquet_recipes
  for each row execute function app.set_updated_at();

create table public.recipe_items (
  recipe_id   uuid not null references public.bouquet_recipes (id) on delete cascade,
  material_id uuid not null references public.materials (id) on delete restrict,
  quantity    numeric(12,3) not null check (quantity > 0),
  is_optional boolean not null default false,
  primary key (recipe_id, material_id)
);
create index recipe_items_material_idx on public.recipe_items (material_id);

-- Every change to a batch is journaled. Signed quantity: + in, − out.
create table public.stock_movements (
  id             uuid primary key default gen_random_uuid(),
  batch_id       uuid not null references public.stock_batches (id) on delete restrict,
  material_id    uuid not null references public.materials (id) on delete restrict,
  movement_type  public.stock_movement_type not null,
  quantity       numeric(12,3) not null check (quantity <> 0),
  reference_type text,
  reference_id   uuid,
  reason         text,
  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now()
);
create index stock_movements_batch_idx on public.stock_movements (batch_id, created_at desc);
create index stock_movements_reference_idx on public.stock_movements (reference_type, reference_id);

-- Reservations hold stock for an order (or a cart, in checkout) until consumed
-- or released. Expired reservations are released by a job.
create table public.stock_reservations (
  id              uuid primary key default gen_random_uuid(),
  idempotency_key text not null,
  reference_type  text not null check (reference_type in ('order', 'cart')),
  reference_id    uuid not null,
  material_id     uuid not null references public.materials (id) on delete restrict,
  batch_id        uuid not null references public.stock_batches (id) on delete restrict,
  quantity        numeric(12,3) not null check (quantity > 0),
  status          public.stock_reservation_status not null default 'active',
  expires_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (idempotency_key, material_id, batch_id)
);
create index stock_reservations_reference_idx on public.stock_reservations (reference_type, reference_id) where status = 'active';
create index stock_reservations_expiry_idx on public.stock_reservations (expires_at) where status = 'active';
create trigger stock_reservations_updated_at before update on public.stock_reservations
  for each row execute function app.set_updated_at();

-- Available quantity of a material (remaining − reserved across unexpired active batches).
create or replace function public.material_available_quantity(p_material_id uuid)
returns numeric
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(b.quantity_remaining - b.quantity_reserved), 0)
  from public.stock_batches b
  where b.material_id = p_material_id
    and b.status = 'active'
    and (b.expires_at is null or b.expires_at > now());
$$;

-- How many units of a variant can be assembled from current stock (null = untracked).
create or replace function public.variant_available_quantity(p_variant_id uuid)
returns integer
language plpgsql
stable
set search_path = ''
as $$
declare
  v_mode public.inventory_mode;
  v_result integer;
begin
  select inventory_mode into v_mode from public.product_variants where id = p_variant_id;
  if v_mode is null then
    return 0;
  elsif v_mode = 'untracked' then
    return null;
  end if;

  select min(floor(public.material_available_quantity(ri.material_id) / ri.quantity))::integer
  into v_result
  from public.bouquet_recipes r
  join public.recipe_items ri on ri.recipe_id = r.id
  where r.variant_id = p_variant_id
    and not ri.is_optional;

  -- A recipe variant with no recipe rows cannot be made.
  return coalesce(v_result, 0);
end;
$$;
