-- ============================================================================
-- 1600 · Reports, dashboard, promotions eligibility, CMS/SEO fields
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Manila date boundaries: [from 00:00, to 24:00) in Asia/Manila.
-- ---------------------------------------------------------------------------
create or replace function app.manila_range(p_from date, p_to date)
returns table (range_start timestamptz, range_end timestamptz)
language sql immutable
as $$
  select (p_from::timestamp at time zone 'Asia/Manila'), ((p_to + 1)::timestamp at time zone 'Asia/Manila');
$$;

create or replace function app.assert_reports_access()
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform app.assert_staff('owner', 'manager');
end;
$$;

-- Paid orders: revenue is recognised on the payment date (confirmed_at), from
-- immutable snapshots. Unpaid/pending/failed orders never count.
create or replace view app.paid_orders as
select o.*, coalesce(o.confirmed_at, o.placed_at) as paid_at_ts
from public.orders o
where o.payment_status in ('paid', 'partially_refunded', 'refunded');

-- ---------------------------------------------------------------------------
-- Sales summary
-- ---------------------------------------------------------------------------
create or replace function public.report_sales_summary(p_from date, p_to date)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  r record;
  v_start timestamptz; v_end timestamptz;
  v_refunds integer;
begin
  perform app.assert_reports_access();
  select range_start, range_end into v_start, v_end from app.manila_range(p_from, p_to);
  select count(*) as orders, coalesce(sum(subtotal_centavos + add_ons_centavos), 0) as gross, coalesce(sum(discount_centavos), 0) as discounts,
         coalesce(sum(delivery_fee_centavos), 0) as delivery_fees, coalesce(sum(total_centavos), 0) as collected
  into r from app.paid_orders where paid_at_ts >= v_start and paid_at_ts < v_end;
  select coalesce(sum(amount_centavos), 0) into v_refunds from public.refunds where status = 'succeeded' and processed_at >= v_start and processed_at < v_end;
  return jsonb_build_object(
    'from', p_from, 'to', p_to, 'timezone', 'Asia/Manila',
    'paid_orders', r.orders,
    'gross_sales_centavos', r.gross,
    'discounts_centavos', r.discounts,
    'refunds_centavos', v_refunds,
    'net_sales_centavos', r.gross - r.discounts - v_refunds,
    'delivery_fees_centavos', r.delivery_fees,
    'collected_centavos', r.collected - v_refunds,
    'unpaid_orders', (select count(*) from public.orders where placed_at >= v_start and placed_at < v_end and payment_status not in ('paid', 'partially_refunded', 'refunded'))
  );
end;
$$;

create or replace function public.report_orders_by_date(p_from date, p_to date)
returns table (day date, paid_orders bigint, gross_centavos bigint, discounts_centavos bigint, delivery_fees_centavos bigint, refunds_centavos bigint, net_centavos bigint)
language plpgsql security definer set search_path = ''
as $$
begin
  perform app.assert_reports_access();
  return query
  with days as (select d::date as day from generate_series(p_from, p_to, interval '1 day') d),
  paid as (
    select (paid_at_ts at time zone 'Asia/Manila')::date as day, count(*) as n, sum(subtotal_centavos + add_ons_centavos) as gross, sum(discount_centavos) as disc, sum(delivery_fee_centavos) as fees
    from app.paid_orders where (paid_at_ts at time zone 'Asia/Manila')::date between p_from and p_to group by 1),
  ref as (
    select (processed_at at time zone 'Asia/Manila')::date as day, sum(amount_centavos) as refunds
    from public.refunds where status = 'succeeded' and (processed_at at time zone 'Asia/Manila')::date between p_from and p_to group by 1)
  select days.day, coalesce(paid.n, 0), coalesce(paid.gross, 0)::bigint, coalesce(paid.disc, 0)::bigint, coalesce(paid.fees, 0)::bigint, coalesce(ref.refunds, 0)::bigint,
         (coalesce(paid.gross, 0) - coalesce(paid.disc, 0) - coalesce(ref.refunds, 0))::bigint
  from days left join paid on paid.day = days.day left join ref on ref.day = days.day
  order by days.day;
end;
$$;

create or replace function public.report_best_sellers(p_from date, p_to date, p_limit integer default 10)
returns table (product_name text, variant_name text, sku text, units bigint, revenue_centavos bigint, orders bigint)
language plpgsql security definer set search_path = ''
as $$
declare v_start timestamptz; v_end timestamptz;
begin
  perform app.assert_reports_access();
  select range_start, range_end into v_start, v_end from app.manila_range(p_from, p_to);
  return query
  select oi.product_name, oi.variant_name, oi.sku, sum(oi.quantity)::bigint, sum(oi.line_total_centavos)::bigint, count(distinct oi.order_id)::bigint
  from public.order_items oi join app.paid_orders o on o.id = oi.order_id
  where o.paid_at_ts >= v_start and o.paid_at_ts < v_end
  group by oi.product_name, oi.variant_name, oi.sku
  order by sum(oi.quantity) desc, sum(oi.line_total_centavos) desc
  limit greatest(p_limit, 1);
end;
$$;

create or replace function public.report_sales_by_collection(p_from date, p_to date)
returns table (collection text, units bigint, revenue_centavos bigint, orders bigint)
language plpgsql security definer set search_path = ''
as $$
declare v_start timestamptz; v_end timestamptz;
begin
  perform app.assert_reports_access();
  select range_start, range_end into v_start, v_end from app.manila_range(p_from, p_to);
  return query
  select coalesce(c.name, 'Uncategorised'), sum(oi.quantity)::bigint, sum(oi.line_total_centavos)::bigint, count(distinct oi.order_id)::bigint
  from public.order_items oi
  join app.paid_orders o on o.id = oi.order_id
  left join public.products p on p.id = oi.product_id
  left join public.collections c on c.id = p.collection_id
  where o.paid_at_ts >= v_start and o.paid_at_ts < v_end
  group by coalesce(c.name, 'Uncategorised')
  order by sum(oi.line_total_centavos) desc;
end;
$$;

create or replace function public.report_payment_methods(p_from date, p_to date)
returns table (provider text, method text, payments bigint, amount_centavos bigint, refunded_centavos bigint)
language plpgsql security definer set search_path = ''
as $$
declare v_start timestamptz; v_end timestamptz;
begin
  perform app.assert_reports_access();
  select range_start, range_end into v_start, v_end from app.manila_range(p_from, p_to);
  return query
  select pm.provider::text, coalesce(pm.method::text, 'unknown'), count(*)::bigint, sum(pm.amount_centavos)::bigint,
         coalesce((select sum(r.amount_centavos) from public.refunds r where r.payment_id = any(array_agg(pm.id)) and r.status = 'succeeded'), 0)::bigint
  from public.payments pm
  where pm.status in ('paid', 'partially_refunded', 'refunded') and pm.paid_at >= v_start and pm.paid_at < v_end
  group by pm.provider, pm.method
  order by sum(pm.amount_centavos) desc;
end;
$$;

create or replace function public.report_wastage(p_from date, p_to date)
returns table (material text, sku text, unit text, reason text, quantity numeric, estimated_cost_centavos bigint, events bigint)
language plpgsql security definer set search_path = ''
as $$
declare v_start timestamptz; v_end timestamptz;
begin
  perform app.assert_reports_access();
  select range_start, range_end into v_start, v_end from app.manila_range(p_from, p_to);
  return query
  select m.name, m.sku, m.unit::text, coalesce(mv.wastage_reason, mv.movement_type::text), sum(-mv.quantity), sum(-mv.quantity * b.unit_cost_centavos)::bigint, count(*)::bigint
  from public.stock_movements mv join public.stock_batches b on b.id = mv.batch_id join public.materials m on m.id = mv.material_id
  where mv.movement_type in ('discard', 'expire') and mv.created_at >= v_start and mv.created_at < v_end
  group by m.name, m.sku, m.unit, coalesce(mv.wastage_reason, mv.movement_type::text)
  order by sum(-mv.quantity * b.unit_cost_centavos) desc;
end;
$$;

-- Estimated cost = recipe lines × weighted-average unit cost of batches received
-- in the last 90 days (fallback: all batches). Clearly an estimate.
create or replace function public.report_product_margin(p_from date, p_to date)
returns table (product_name text, variant_name text, sku text, units bigint, revenue_centavos bigint, estimated_cost_centavos bigint, estimated_margin_centavos bigint, estimated_margin_pct numeric, is_estimate boolean)
language plpgsql security definer set search_path = ''
as $$
declare v_start timestamptz; v_end timestamptz;
begin
  perform app.assert_reports_access();
  select range_start, range_end into v_start, v_end from app.manila_range(p_from, p_to);
  return query
  with cost as (
    select b.material_id,
           coalesce(sum(b.unit_cost_centavos * b.quantity_received) filter (where b.received_at >= now() - interval '90 days') / nullif(sum(b.quantity_received) filter (where b.received_at >= now() - interval '90 days'), 0),
                    sum(b.unit_cost_centavos * b.quantity_received) / nullif(sum(b.quantity_received), 0), 0) as unit_cost
    from public.stock_batches b group by b.material_id),
  variant_cost as (
    select r.variant_id, sum(ri.quantity * c.unit_cost) as unit_cost
    from public.bouquet_recipes r join public.recipe_items ri on ri.recipe_id = r.id and not ri.is_optional left join cost c on c.material_id = ri.material_id
    group by r.variant_id),
  sold as (
    select oi.product_name, oi.variant_name, oi.sku, oi.variant_id, sum(oi.quantity) as units, sum(oi.line_total_centavos) as revenue
    from public.order_items oi join app.paid_orders o on o.id = oi.order_id
    where o.paid_at_ts >= v_start and o.paid_at_ts < v_end
    group by oi.product_name, oi.variant_name, oi.sku, oi.variant_id)
  select s.product_name, s.variant_name, s.sku, s.units::bigint, s.revenue::bigint,
         round(s.units * coalesce(vc.unit_cost, 0))::bigint,
         (s.revenue - round(s.units * coalesce(vc.unit_cost, 0)))::bigint,
         case when s.revenue > 0 then round((s.revenue - s.units * coalesce(vc.unit_cost, 0)) * 100.0 / s.revenue, 1) else null end,
         true
  from sold s left join variant_cost vc on vc.variant_id = s.variant_id
  order by s.revenue desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- Dashboard summary (staff; financial figures only for owner/manager)
-- ---------------------------------------------------------------------------
create or replace function public.dashboard_summary()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_today date := app.manila_today();
  v_start timestamptz; v_end timestamptz;
  v_fin boolean := app.has_role('owner', 'manager');
begin
  perform app.assert_staff();
  select range_start, range_end into v_start, v_end from app.manila_range(v_today, v_today);
  return jsonb_build_object(
    'today', v_today,
    'orders_today', (select count(*) from public.orders where placed_at >= v_start and placed_at < v_end),
    'sales_today_centavos', case when v_fin then (select coalesce(sum(total_centavos), 0) from app.paid_orders where paid_at_ts >= v_start and paid_at_ts < v_end) end,
    'pending_payments', (select count(*) from public.orders where status = 'pending' and payment_status in ('unpaid', 'pending', 'failed')),
    'pending_payment_proofs', (select count(*) from public.payments where provider = 'bank_transfer' and status = 'requires_action'),
    'to_prepare', (select count(*) from public.orders where status = 'confirmed' and fulfillment_status in ('unfulfilled', 'preparing')),
    'to_prepare_today', (select count(*) from public.orders where status = 'confirmed' and fulfillment_status in ('unfulfilled', 'preparing') and delivery_date <= v_today),
    'scheduled_deliveries_today', (select count(*) from public.orders where delivery_date = v_today and status in ('confirmed', 'completed') and delivery_status in ('pending', 'scheduled', 'out_for_delivery')),
    'unassigned_today', (select count(*) from public.orders where delivery_date = v_today and status = 'confirmed' and assigned_rider_id is null and delivery_status not in ('delivered', 'cancelled')),
    'failed_deliveries', (select count(*) from public.orders where delivery_status = 'failed'),
    'low_stock', (select count(*) from public.material_stock_levels where is_active and is_low),
    'recent_activity', (
      select coalesce(jsonb_agg(a order by a.at desc), '[]'::jsonb) from (
        (select 'order' as kind, o.order_number as ref, 'placed' as action, o.placed_at as at from public.orders o order by o.placed_at desc limit 8)
        union all
        (select 'delivery', o.order_number, e.event_type::text, e.created_at from public.delivery_events e join public.orders o on o.id = e.order_id order by e.created_at desc limit 8)
        union all
        (select 'payment', o.order_number, p.status::text, coalesce(p.paid_at, p.updated_at) from public.payments p join public.orders o on o.id = p.order_id where p.status in ('paid', 'failed', 'refunded') order by coalesce(p.paid_at, p.updated_at) desc limit 8)
      ) a
    ),
    'failed_list', (select coalesce(jsonb_agg(jsonb_build_object('order_id', id, 'order_number', order_number, 'exception', metadata ->> 'delivery_exception') order by delivery_failed_at desc), '[]'::jsonb) from public.orders where delivery_status = 'failed')
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Promotions: eligibility rules + redemptions
-- ---------------------------------------------------------------------------
alter table public.promo_codes
  add column per_customer_limit integer check (per_customer_limit is null or per_customer_limit > 0),
  add column first_order_only boolean not null default false,
  add column eligible_collection_ids uuid[] not null default '{}',
  add column applies_to text not null default 'goods' check (applies_to in ('goods', 'delivery'));

create table public.promo_redemptions (
  id             uuid primary key default gen_random_uuid(),
  promo_id       uuid not null references public.promo_codes (id) on delete cascade,
  order_id       uuid not null unique references public.orders (id) on delete cascade,
  customer_email extensions.citext not null,
  discount_centavos integer not null check (discount_centavos >= 0),
  created_at     timestamptz not null default now()
);
create index promo_redemptions_promo_idx on public.promo_redemptions (promo_id, customer_email);
alter table public.promo_redemptions enable row level security;
create policy promo_redemptions_staff_read on public.promo_redemptions for select to authenticated using (app.has_role('owner', 'manager', 'support'));
revoke all on public.promo_redemptions from anon;
revoke insert, update, delete on public.promo_redemptions from authenticated;

-- Validation now takes the shopper's email (eligibility) and the cart (collection restriction).
create or replace function public.validate_promo_code(p_code text, p_goods_centavos integer, p_email text default null, p_cart_token text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_promo public.promo_codes%rowtype;
  v_base integer := p_goods_centavos;
  v_discount integer;
  v_cart_id uuid;
begin
  if p_code is null or length(trim(p_code)) < 3 then return jsonb_build_object('valid', false, 'message', 'Enter a promo code.'); end if;
  select * into v_promo from public.promo_codes where code = trim(p_code)::extensions.citext;
  if v_promo.id is null or not v_promo.is_active then return jsonb_build_object('valid', false, 'message', 'That promo code is not valid.'); end if;
  if (v_promo.starts_at is not null and v_promo.starts_at > now()) or (v_promo.ends_at is not null and v_promo.ends_at < now()) then
    return jsonb_build_object('valid', false, 'message', 'That promo code has expired.');
  end if;
  if v_promo.max_uses is not null and v_promo.uses_count >= v_promo.max_uses then
    return jsonb_build_object('valid', false, 'message', 'That promo code has been fully redeemed.');
  end if;
  if p_email is not null then
    if v_promo.per_customer_limit is not null and (select count(*) from public.promo_redemptions r where r.promo_id = v_promo.id and r.customer_email = p_email::extensions.citext) >= v_promo.per_customer_limit then
      return jsonb_build_object('valid', false, 'message', 'You have already used this promo code.');
    end if;
    if v_promo.first_order_only and exists (select 1 from public.orders o where o.customer_email = p_email::extensions.citext and o.payment_status in ('paid', 'partially_refunded', 'refunded')) then
      return jsonb_build_object('valid', false, 'message', 'This code is for first orders only.');
    end if;
  end if;
  -- Collection-restricted codes discount only matching items.
  if array_length(v_promo.eligible_collection_ids, 1) > 0 then
    if p_cart_token is null then return jsonb_build_object('valid', false, 'message', 'This code applies to specific collections; add eligible items first.'); end if;
    v_cart_id := app.cart_id_for_token(p_cart_token);
    select coalesce(sum(v.price_centavos * ci.quantity), 0) into v_base
    from public.cart_items ci join public.product_variants v on v.id = ci.variant_id join public.products p on p.id = v.product_id
    where ci.cart_id = v_cart_id and p.collection_id = any (v_promo.eligible_collection_ids);
    if v_base = 0 then return jsonb_build_object('valid', false, 'message', 'This code only applies to selected collections.'); end if;
  end if;
  if p_goods_centavos < v_promo.min_subtotal_centavos then
    return jsonb_build_object('valid', false, 'message', format('Add %s more to use this code.', to_char((v_promo.min_subtotal_centavos - p_goods_centavos) / 100.0, 'FM₱999,999,990.00')));
  end if;
  v_discount := case v_promo.promo_type when 'percent' then floor(v_base * v_promo.value / 100.0)::integer else v_promo.value end;
  if v_promo.max_discount_centavos is not null then v_discount := least(v_discount, v_promo.max_discount_centavos); end if;
  v_discount := least(v_discount, v_base);
  return jsonb_build_object('valid', true, 'promo_id', v_promo.id, 'code', v_promo.code, 'description', v_promo.description, 'discount_centavos', v_discount, 'applies_to', v_promo.applies_to);
end;
$$;
grant execute on function public.validate_promo_code(text, integer, text, text) to anon, authenticated, service_role;
drop function if exists public.validate_promo_code(text, integer);

-- place_order: use eligibility-aware validation and record the redemption.
create or replace function app.record_promo_redemption(p_promo_id uuid, p_order_id uuid, p_email text, p_discount integer)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.promo_redemptions (promo_id, order_id, customer_email, discount_centavos) values (p_promo_id, p_order_id, p_email, p_discount);
  update public.promo_codes set uses_count = uses_count + 1 where id = p_promo_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- CMS / SEO
-- ---------------------------------------------------------------------------
alter table public.collections add column seo_title text, add column seo_description text;
alter table public.site_content add column schema_hint text;
create trigger site_content_audit after insert or update or delete on public.site_content for each row execute function app.audit_row();
create trigger collections_audit after insert or update or delete on public.collections for each row execute function app.audit_row();

-- Published content snapshots: keep the last published version alongside drafts.
alter table public.site_content add column published_data jsonb, add column published_at timestamptz;
update public.site_content set published_data = data, published_at = now() where is_published;

-- Rows inserted as published without an explicit published snapshot (seeds, legacy writers)
-- publish their draft so the storefront always reads `published_data`.
create or replace function app.site_content_publish_defaults()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.is_published and new.published_data is null then
    new.published_data := new.data;
    new.published_at := coalesce(new.published_at, now());
  end if;
  return new;
end;
$$;
create trigger site_content_publish_defaults before insert or update on public.site_content
  for each row execute function app.site_content_publish_defaults();
