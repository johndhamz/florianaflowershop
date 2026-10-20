-- ============================================================================
-- 0200 · Catalog: collections, occasions, tags, products, variants, images, add-ons
-- ============================================================================

create table public.collections (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (app.is_slug(slug)),
  name        text not null check (length(name) between 1 and 120),
  tagline     text,
  description text,
  image_path  text,
  position    integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index collections_position_idx on public.collections (position) where is_active;
create trigger collections_updated_at before update on public.collections
  for each row execute function app.set_updated_at();

create table public.occasions (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (app.is_slug(slug)),
  name        text not null check (length(name) between 1 and 120),
  description text,
  image_path  text,
  position    integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger occasions_updated_at before update on public.occasions
  for each row execute function app.set_updated_at();

create table public.tags (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique check (app.is_slug(slug)),
  name       text not null check (length(name) between 1 and 60),
  created_at timestamptz not null default now()
);

create table public.products (
  id                 uuid primary key default gen_random_uuid(),
  collection_id      uuid references public.collections (id) on delete set null,
  slug               text not null unique check (app.is_slug(slug)),
  name               text not null check (length(name) between 1 and 160),
  short_description  text,
  description        text,
  care_instructions  text,
  status             public.product_status not null default 'draft',
  is_featured        boolean not null default false,
  is_best_seller     boolean not null default false,
  seo_title          text,
  seo_description    text,
  attributes         jsonb not null default '{}'::jsonb,
  position           integer not null default 0,
  published_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index products_collection_idx on public.products (collection_id) where status = 'active';
create index products_status_idx on public.products (status, position);
create index products_featured_idx on public.products (is_featured) where status = 'active';
create index products_search_idx on public.products
  using gin (to_tsvector('english', coalesce(name, '') || ' ' || coalesce(short_description, '') || ' ' || coalesce(description, '')));
create trigger products_updated_at before update on public.products
  for each row execute function app.set_updated_at();
create trigger products_audit after insert or update or delete on public.products
  for each row execute function app.audit_row();

create table public.product_variants (
  id                        uuid primary key default gen_random_uuid(),
  product_id                uuid not null references public.products (id) on delete cascade,
  sku                       text not null unique check (sku ~ '^[A-Z0-9]+(?:-[A-Z0-9]+)*$'),
  name                      text not null check (length(name) between 1 and 120),
  price_centavos            integer not null check (price_centavos >= 0),
  compare_at_price_centavos integer check (compare_at_price_centavos is null or compare_at_price_centavos > price_centavos),
  inventory_mode            public.inventory_mode not null default 'recipe',
  is_default                boolean not null default false,
  is_active                 boolean not null default true,
  position                  integer not null default 0,
  attributes                jsonb not null default '{}'::jsonb,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create index product_variants_product_idx on public.product_variants (product_id, position);
-- Exactly one default variant per product.
create unique index product_variants_one_default_idx on public.product_variants (product_id) where is_default;
create trigger product_variants_updated_at before update on public.product_variants
  for each row execute function app.set_updated_at();
create trigger product_variants_audit after insert or update or delete on public.product_variants
  for each row execute function app.audit_row();

create table public.product_images (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products (id) on delete cascade,
  variant_id   uuid references public.product_variants (id) on delete set null,
  storage_path text not null,
  alt_text     text not null check (length(alt_text) between 1 and 250),
  width        integer check (width is null or width > 0),
  height       integer check (height is null or height > 0),
  position     integer not null default 0,
  created_at   timestamptz not null default now()
);
create index product_images_product_idx on public.product_images (product_id, position);

create table public.product_occasions (
  product_id  uuid not null references public.products (id) on delete cascade,
  occasion_id uuid not null references public.occasions (id) on delete cascade,
  primary key (product_id, occasion_id)
);
create index product_occasions_occasion_idx on public.product_occasions (occasion_id);

create table public.product_tags (
  product_id uuid not null references public.products (id) on delete cascade,
  tag_id     uuid not null references public.tags (id) on delete cascade,
  primary key (product_id, tag_id)
);
create index product_tags_tag_idx on public.product_tags (tag_id);

-- Add-ons: configured extras (vase, chocolates, card) offered on specific products.
create table public.add_ons (
  id             uuid primary key default gen_random_uuid(),
  sku            text not null unique check (sku ~ '^[A-Z0-9]+(?:-[A-Z0-9]+)*$'),
  name           text not null check (length(name) between 1 and 120),
  description    text,
  price_centavos integer not null check (price_centavos >= 0),
  image_path     text,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger add_ons_updated_at before update on public.add_ons
  for each row execute function app.set_updated_at();

create table public.product_add_ons (
  product_id   uuid not null references public.products (id) on delete cascade,
  add_on_id    uuid not null references public.add_ons (id) on delete cascade,
  max_quantity integer not null default 1 check (max_quantity between 1 and 20),
  position     integer not null default 0,
  primary key (product_id, add_on_id)
);
