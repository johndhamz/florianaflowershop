-- ============================================================================
-- 1200 · Storefront: product search, catalog view, reviews, cart RPCs.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Full-text search vector (stored generated column; GIN indexed).
-- ---------------------------------------------------------------------------
drop index if exists public.products_search_idx;
alter table public.products
  add column search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(short_description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'C')
  ) stored;
create index products_search_idx on public.products using gin (search_vector);

-- ---------------------------------------------------------------------------
-- Availability helpers become SECURITY DEFINER: the public may learn *how many*
-- of a variant can be made, but never read batches or recipes directly.
-- ---------------------------------------------------------------------------
alter function public.material_available_quantity(uuid) security definer set search_path = '';
alter function public.variant_available_quantity(uuid) security definer set search_path = '';

-- ---------------------------------------------------------------------------
-- Availability label for a variant (null when untracked).
-- ---------------------------------------------------------------------------
create or replace function public.variant_availability(p_variant_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_qty integer;
begin
  v_qty := public.variant_available_quantity(p_variant_id);
  if v_qty is null then return 'untracked'; end if;
  if v_qty <= 0 then return 'out_of_stock'; end if;
  if v_qty <= 3 then return 'low_stock'; end if;
  return 'in_stock';
end;
$$;
grant execute on function public.variant_availability(uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Catalog view: one row per product with its default variant pricing,
-- primary image, collection, occasion/tag slugs and live availability.
-- security_invoker → the products RLS (active only for the public) applies.
-- ---------------------------------------------------------------------------
create or replace view public.catalog_products
with (security_invoker = true)
as
select
  p.id,
  p.slug,
  p.name,
  p.short_description,
  p.collection_id,
  c.slug  as collection_slug,
  c.name  as collection_name,
  p.is_featured,
  p.is_best_seller,
  p.position,
  p.published_at,
  p.status,
  -- Product text plus collection and tag names, so "orchid" also finds tagged items.
  (p.search_vector
    || setweight(to_tsvector('english', coalesce(c.name, '')), 'B')
    || setweight(to_tsvector('english', coalesce((select string_agg(t.name, ' ') from public.product_tags pt join public.tags t on t.id = pt.tag_id where pt.product_id = p.id), '')), 'B')
  ) as search_vector,
  dv.id   as default_variant_id,
  dv.price_centavos,
  dv.compare_at_price_centavos,
  (select min(v.price_centavos) from public.product_variants v where v.product_id = p.id and v.is_active) as min_price_centavos,
  (select max(v.price_centavos) from public.product_variants v where v.product_id = p.id and v.is_active) as max_price_centavos,
  (select count(*) from public.product_variants v where v.product_id = p.id and v.is_active) as variant_count,
  img.storage_path as image_path,
  img.alt_text     as image_alt,
  public.variant_availability(dv.id) as availability,
  coalesce((select array_agg(o.slug order by o.slug) from public.product_occasions po join public.occasions o on o.id = po.occasion_id where po.product_id = p.id), '{}') as occasion_slugs,
  coalesce((select array_agg(t.slug order by t.slug) from public.product_tags pt join public.tags t on t.id = pt.tag_id where pt.product_id = p.id), '{}') as tag_slugs
from public.products p
left join public.collections c on c.id = p.collection_id
left join lateral (
  select v.* from public.product_variants v
  where v.product_id = p.id and v.is_active
  order by v.is_default desc, v.position, v.created_at
  limit 1
) dv on true
left join lateral (
  select i.storage_path, i.alt_text from public.product_images i
  where i.product_id = p.id
  order by i.position, i.created_at
  limit 1
) img on true;

grant select on public.catalog_products to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Product reviews: only real, approved reviews are ever shown.
-- ---------------------------------------------------------------------------
create table public.product_reviews (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products (id) on delete cascade,
  order_id      uuid references public.orders (id) on delete set null,
  customer_id   uuid references public.customers (id) on delete set null,
  reviewer_name text not null check (length(reviewer_name) between 1 and 80),
  rating        smallint not null check (rating between 1 and 5),
  title         text check (title is null or length(title) <= 120),
  body          text not null check (length(body) between 1 and 2000),
  is_approved   boolean not null default false,
  approved_by   uuid references auth.users (id) on delete set null,
  approved_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index product_reviews_product_idx on public.product_reviews (product_id, created_at desc) where is_approved;
create trigger product_reviews_updated_at before update on public.product_reviews
  for each row execute function app.set_updated_at();

alter table public.product_reviews enable row level security;
create policy product_reviews_public_read on public.product_reviews
  for select to anon, authenticated using ((is_approved and app.is_public_product(product_id)) or app.has_role('owner', 'manager', 'support'));
create policy product_reviews_admin_write on public.product_reviews
  for all to authenticated using (app.has_role('owner', 'manager', 'support')) with check (app.has_role('owner', 'manager', 'support'));
revoke insert, update, delete on public.product_reviews from anon;

-- ---------------------------------------------------------------------------
-- Cart RPCs. The shopper holds a random 64-hex token in an httpOnly cookie;
-- only its SHA-256 is stored. Every RPC is SECURITY DEFINER, keyed by token,
-- and returns live, server-computed prices so the client can never set them.
-- ---------------------------------------------------------------------------
create or replace function app.cart_token_hash(p_token text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_token ~ '^[a-f0-9]{64}$' then app.sha256_hex(p_token) end;
$$;

-- Lookup (never creates). Returns null when there is no active cart.
create or replace function app.cart_id_for_token(p_token text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id
  from public.carts c
  where c.token_hash = app.cart_token_hash(p_token)
    and c.status = 'active'
    and c.expires_at > now();
$$;

-- Materialised cart with live prices and validity flags.
create or replace function public.cart_get(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_cart_id uuid := app.cart_id_for_token(p_token);
  v_items jsonb;
  v_subtotal integer;
  v_add_ons integer;
  v_count integer;
begin
  if v_cart_id is null then
    return jsonb_build_object('id', null, 'items', '[]'::jsonb, 'item_count', 0, 'subtotal_centavos', 0, 'add_ons_centavos', 0, 'total_centavos', 0, 'has_issues', false);
  end if;

  select
    coalesce(jsonb_agg(item order by item ->> 'created_at'), '[]'::jsonb),
    coalesce(sum((item ->> 'line_total_centavos')::integer) filter (where (item ->> 'is_available')::boolean), 0),
    coalesce(sum((item ->> 'add_ons_total_centavos')::integer) filter (where (item ->> 'is_available')::boolean), 0),
    coalesce(sum((item ->> 'quantity')::integer) filter (where (item ->> 'is_available')::boolean), 0)
  into v_items, v_subtotal, v_add_ons, v_count
  from (
    select jsonb_build_object(
      'id', ci.id,
      'variant_id', ci.variant_id,
      'product_id', p.id,
      'product_slug', p.slug,
      'product_name', p.name,
      'variant_name', v.name,
      'sku', v.sku,
      'image_path', img.storage_path,
      'image_alt', img.alt_text,
      'quantity', ci.quantity,
      'unit_price_centavos', v.price_centavos,
      'unit_price_at_add_centavos', ci.unit_price_centavos_at_add,
      'price_changed', v.price_centavos <> ci.unit_price_centavos_at_add,
      'line_total_centavos', v.price_centavos * ci.quantity,
      'availability', public.variant_availability(v.id),
      'available_quantity', public.variant_available_quantity(v.id),
      'is_available', (p.status = 'active' and v.is_active
                       and coalesce(public.variant_available_quantity(v.id) >= ci.quantity, true)),
      'add_ons', coalesce((
        select jsonb_agg(jsonb_build_object(
          'add_on_id', a.id, 'name', a.name, 'sku', a.sku,
          'quantity', cia.quantity, 'unit_price_centavos', a.price_centavos,
          'line_total_centavos', a.price_centavos * cia.quantity,
          'is_available', a.is_active) order by a.name)
        from public.cart_item_add_ons cia join public.add_ons a on a.id = cia.add_on_id
        where cia.cart_item_id = ci.id), '[]'::jsonb),
      'add_ons_total_centavos', coalesce((
        select sum(a.price_centavos * cia.quantity)
        from public.cart_item_add_ons cia join public.add_ons a on a.id = cia.add_on_id
        where cia.cart_item_id = ci.id and a.is_active), 0),
      'created_at', ci.created_at
    ) as item
    from public.cart_items ci
    join public.product_variants v on v.id = ci.variant_id
    join public.products p on p.id = v.product_id
    left join lateral (
      select i.storage_path, i.alt_text from public.product_images i
      where i.product_id = p.id order by i.position, i.created_at limit 1
    ) img on true
    where ci.cart_id = v_cart_id
  ) items;

  return jsonb_build_object(
    'id', v_cart_id,
    'items', v_items,
    'item_count', v_count,
    'subtotal_centavos', v_subtotal,
    'add_ons_centavos', v_add_ons,
    'total_centavos', v_subtotal + v_add_ons,
    'has_issues', exists (
      select 1 from jsonb_array_elements(v_items) e
      where not (e ->> 'is_available')::boolean or (e ->> 'price_changed')::boolean
    )
  );
end;
$$;

-- Add (or merge) a line. p_add_ons: [{"add_on_id": uuid, "quantity": int}]
create or replace function public.cart_add_item(
  p_token      text,
  p_variant_id uuid,
  p_quantity   integer default 1,
  p_add_ons    jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text := app.cart_token_hash(p_token);
  v_cart_id uuid;
  v_variant record;
  v_item_id uuid;
  v_new_qty integer;
  v_available integer;
  v_add record;
begin
  if v_hash is null then perform app.raise('INVALID_TOKEN', 'Cart token is invalid.'); end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 50 then
    perform app.raise('INVALID_QUANTITY', 'Quantity must be between 1 and 50.');
  end if;

  select v.id, v.price_centavos, v.product_id, p.status as product_status, v.is_active
  into v_variant
  from public.product_variants v join public.products p on p.id = v.product_id
  where v.id = p_variant_id;
  if v_variant.id is null or v_variant.product_status <> 'active' or not v_variant.is_active then
    perform app.raise('PRODUCT_UNAVAILABLE', 'This product is not available.');
  end if;

  -- Find or create the cart (and revive expired ones under the same token).
  select id into v_cart_id from public.carts where token_hash = v_hash and status = 'active' and expires_at > now();
  if v_cart_id is null then
    insert into public.carts (token_hash) values (v_hash)
    on conflict (token_hash) do update set status = 'active', expires_at = now() + interval '30 days', converted_order_id = null
    returning id into v_cart_id;
  end if;

  select id, quantity into v_item_id, v_new_qty from public.cart_items where cart_id = v_cart_id and variant_id = p_variant_id;
  v_new_qty := coalesce(v_new_qty, 0) + p_quantity;
  if v_new_qty > 50 then perform app.raise('INVALID_QUANTITY', 'You can order up to 50 of one item.'); end if;

  v_available := public.variant_available_quantity(p_variant_id);
  if v_available is not null and v_available < v_new_qty then
    perform app.raise('INSUFFICIENT_STOCK', format('Only %s left in stock.', greatest(v_available, 0)));
  end if;

  if v_item_id is null then
    insert into public.cart_items (cart_id, variant_id, quantity, unit_price_centavos_at_add)
    values (v_cart_id, p_variant_id, v_new_qty, v_variant.price_centavos)
    returning id into v_item_id;
  else
    update public.cart_items set quantity = v_new_qty where id = v_item_id;
  end if;

  -- Replace add-ons with the submitted set (validated against product_add_ons).
  delete from public.cart_item_add_ons where cart_item_id = v_item_id;
  for v_add in
    select (e ->> 'add_on_id')::uuid as add_on_id, coalesce((e ->> 'quantity')::integer, 1) as quantity
    from jsonb_array_elements(coalesce(p_add_ons, '[]'::jsonb)) e
  loop
    if not exists (
      select 1 from public.product_add_ons pa join public.add_ons a on a.id = pa.add_on_id
      where pa.product_id = v_variant.product_id and pa.add_on_id = v_add.add_on_id and a.is_active
        and v_add.quantity between 1 and pa.max_quantity
    ) then
      perform app.raise('INVALID_ADD_ON', 'An add-on is not available for this product.');
    end if;
    insert into public.cart_item_add_ons (cart_item_id, add_on_id, quantity) values (v_item_id, v_add.add_on_id, v_add.quantity);
  end loop;

  update public.carts set expires_at = now() + interval '30 days' where id = v_cart_id;
  return public.cart_get(p_token);
end;
$$;

create or replace function public.cart_update_item(p_token text, p_item_id uuid, p_quantity integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cart_id uuid := app.cart_id_for_token(p_token);
  v_variant_id uuid;
  v_available integer;
begin
  if v_cart_id is null then perform app.raise('CART_NOT_FOUND', 'Cart not found.'); end if;
  if p_quantity is null or p_quantity < 0 or p_quantity > 50 then
    perform app.raise('INVALID_QUANTITY', 'Quantity must be between 0 and 50.');
  end if;

  select variant_id into v_variant_id from public.cart_items where id = p_item_id and cart_id = v_cart_id;
  if v_variant_id is null then perform app.raise('ITEM_NOT_FOUND', 'Item not found in this cart.'); end if;

  if p_quantity = 0 then
    delete from public.cart_items where id = p_item_id;
  else
    v_available := public.variant_available_quantity(v_variant_id);
    if v_available is not null and v_available < p_quantity then
      perform app.raise('INSUFFICIENT_STOCK', format('Only %s left in stock.', greatest(v_available, 0)));
    end if;
    update public.cart_items set quantity = p_quantity where id = p_item_id;
  end if;

  update public.carts set expires_at = now() + interval '30 days' where id = v_cart_id;
  return public.cart_get(p_token);
end;
$$;

create or replace function public.cart_remove_item(p_token text, p_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cart_id uuid := app.cart_id_for_token(p_token);
begin
  if v_cart_id is null then perform app.raise('CART_NOT_FOUND', 'Cart not found.'); end if;
  delete from public.cart_items where id = p_item_id and cart_id = v_cart_id;
  return public.cart_get(p_token);
end;
$$;

-- Drop unavailable lines so checkout can proceed with what is left.
create or replace function public.cart_remove_unavailable(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cart_id uuid := app.cart_id_for_token(p_token);
begin
  if v_cart_id is null then return public.cart_get(p_token); end if;
  delete from public.cart_items ci
  using public.product_variants v, public.products p
  where ci.cart_id = v_cart_id and v.id = ci.variant_id and p.id = v.product_id
    and (p.status <> 'active' or not v.is_active
         or coalesce(public.variant_available_quantity(v.id) < ci.quantity, false));
  -- Re-price what remains so "price changed" notices clear once acknowledged.
  update public.cart_items ci set unit_price_centavos_at_add = v.price_centavos
  from public.product_variants v where v.id = ci.variant_id and ci.cart_id = v_cart_id;
  return public.cart_get(p_token);
end;
$$;

grant execute on function public.cart_get(text) to anon, authenticated, service_role;
grant execute on function public.cart_add_item(text, uuid, integer, jsonb) to anon, authenticated, service_role;
grant execute on function public.cart_update_item(text, uuid, integer) to anon, authenticated, service_role;
grant execute on function public.cart_remove_item(text, uuid) to anon, authenticated, service_role;
grant execute on function public.cart_remove_unavailable(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Delivery coverage lookup for the storefront checker (barangay or city text).
-- ---------------------------------------------------------------------------
create or replace function public.find_delivery_zone(p_query text)
returns table (
  zone_id uuid, zone_name text, city text, matched_barangay text,
  fee_centavos integer, free_delivery_threshold_centavos integer,
  same_day_cutoff time, lead_time_hours integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with q as (select lower(trim(coalesce(p_query, ''))) as needle)
  select z.id, z.name, z.city, b.barangay, z.fee_centavos, z.free_delivery_threshold_centavos, z.same_day_cutoff, z.lead_time_hours
  from public.delivery_zones z
  cross join q
  left join lateral (
    select bar as barangay from unnest(z.barangays) bar
    where length(q.needle) >= 3 and (lower(bar) = q.needle or lower(bar) like q.needle || '%')
    order by (lower(bar) = q.needle) desc, bar
    limit 1
  ) b on true
  where z.is_active
    and length(q.needle) >= 3
    and (b.barangay is not null or lower(z.city) like q.needle || '%' or lower(z.name) like '%' || q.needle || '%')
  order by (b.barangay is not null) desc, z.position
  limit 5;
$$;
grant execute on function public.find_delivery_zone(text) to anon, authenticated, service_role;
