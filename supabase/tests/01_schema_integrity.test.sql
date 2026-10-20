begin;
create extension if not exists pgtap with schema extensions;
select plan(29);

-- Tables exist -------------------------------------------------------------
select has_table('public', t, 'table ' || t || ' exists')
from unnest(array[
  'staff_profiles','customers','collections','occasions','tags','products','product_variants','product_images',
  'product_occasions','product_tags','add_ons','product_add_ons','suppliers','materials','stock_batches',
  'bouquet_recipes','recipe_items','stock_movements','stock_reservations','delivery_zones','delivery_slots',
  'delivery_slot_allocations','carts','cart_items','cart_item_add_ons','promo_codes','orders','order_items',
  'order_item_add_ons','order_recipients','order_status_history','payments','payment_events','refunds',
  'site_content','business_settings','notifications','audit_logs'
]) as t
limit 1;  -- (one representative assertion; the loop below checks all)

select is(
  (select count(*) from pg_tables where schemaname = 'public' and tablename in (
    'staff_profiles','customers','collections','occasions','tags','products','product_variants','product_images',
    'product_occasions','product_tags','add_ons','product_add_ons','suppliers','materials','stock_batches',
    'bouquet_recipes','recipe_items','stock_movements','stock_reservations','delivery_zones','delivery_slots',
    'delivery_slot_allocations','carts','cart_items','cart_item_add_ons','promo_codes','orders','order_items',
    'order_item_add_ons','order_recipients','order_status_history','payments','payment_events','refunds',
    'site_content','business_settings','notifications','audit_logs')),
  38::bigint, 'all 38 domain tables exist');

-- RLS enabled on every public table ---------------------------------------
select is(
  (select count(*) from pg_tables where schemaname = 'public' and not rowsecurity),
  0::bigint, 'every public table has RLS enabled');

-- UUID primary keys on entity tables ---------------------------------------
select is(
  (select count(*) from information_schema.columns c
   join information_schema.table_constraints tc on tc.table_schema = c.table_schema and tc.table_name = c.table_name and tc.constraint_type = 'PRIMARY KEY'
   join information_schema.key_column_usage k on k.constraint_name = tc.constraint_name and k.column_name = c.column_name
   where c.table_schema = 'public' and c.column_name = 'id' and c.data_type <> 'uuid' and c.table_name <> 'business_settings'),
  0::bigint, 'all `id` primary keys are uuid (business_settings is the single-row exception)');

-- Unique slugs / SKUs --------------------------------------------------------
select throws_ok(
  $$insert into public.products (slug, name) values ('blush-romance', 'Dup')$$,
  '23505', null, 'product slugs are unique');
select throws_ok(
  $$insert into public.product_variants (product_id, sku, name, price_centavos) values ('10000000-0000-4000-8000-000000000011', 'PB-BLUSH-12', 'Dup', 100)$$,
  '23505', null, 'variant SKUs are unique');
select throws_ok(
  $$insert into public.products (slug, name) values ('Bad Slug!', 'X')$$,
  '23514', null, 'slug format is enforced');

-- Money & quantity checks ---------------------------------------------------
select throws_ok(
  $$insert into public.product_variants (product_id, sku, name, price_centavos) values ('10000000-0000-4000-8000-000000000011', 'NEG-1', 'Neg', -1)$$,
  '23514', null, 'negative prices are rejected');
select throws_ok(
  $$update public.product_variants set compare_at_price_centavos = 100 where sku = 'PB-BLUSH-12'$$,
  '23514', null, 'compare-at must exceed price');
select is((select data_type from information_schema.columns where table_name = 'orders' and column_name = 'total_centavos'), 'integer', 'money columns are integer centavos');
select is((select data_type from information_schema.columns where table_name = 'stock_batches' and column_name = 'quantity_remaining'), 'numeric', 'inventory quantities are numeric');
select throws_ok(
  $$update public.stock_batches set quantity_reserved = quantity_remaining + 1 where batch_code = 'B-SUN-1020'$$,
  '23514', null, 'reserved stock can never exceed remaining stock');

-- Referential integrity ------------------------------------------------------
select throws_ok(
  $$insert into public.order_items (order_id, product_name, variant_name, sku, unit_price_centavos, quantity, line_total_centavos)
    values ('00000000-0000-4000-8000-00000000dead', 'x', 'x', 'X', 100, 1, 100)$$,
  '23503', null, 'order_items require an existing order');
select throws_ok(
  $$delete from public.materials where sku = 'FL-SUNFLOWER'$$,
  '23503', null, 'materials with batches cannot be deleted (restrict)');
select throws_ok(
  $$delete from public.customers where id = 'b0000000-0000-4000-8000-000000000001'$$,
  '23503', null, 'customers with orders cannot be deleted (restrict)');
select lives_ok(
  $$delete from public.products where slug = 'valentines-preview'$$,
  'deleting a product cascades to its variants/images');
select is((select count(*) from public.product_variants where sku = 'PB-VAL-DRAFT'), 0::bigint, 'variant removed by cascade');

-- Immutable order snapshots ------------------------------------------------
select throws_ok(
  $$update public.order_items set unit_price_centavos = 1 where id = 'c2000000-0000-4000-8000-000000000001'$$,
  'P0001', null, 'order_items are immutable');
select throws_ok(
  $$update public.orders set total_centavos = total_centavos + 1 where order_number = 'FL-10001'$$,
  'P0001', null, 'order pricing is locked after placement');
select throws_ok(
  $$update public.orders set customer_id = 'b0000000-0000-4000-8000-000000000002' where order_number = 'FL-10001'$$,
  'P0001', null, 'order identity is locked after placement');
select lives_ok(
  $$update public.orders set internal_notes = 'ok' where order_number = 'FL-10001'$$,
  'non-pricing columns remain editable');
select throws_ok(
  $$insert into public.orders (customer_id, idempotency_key, tracking_token_hash, subtotal_centavos, total_centavos, customer_name, customer_email, customer_phone)
    values ('b0000000-0000-4000-8000-000000000001', 'test-key-00001', repeat('a', 64), 100, 999, 'T', 't@t.com', '+639171234567')$$,
  '23514', null, 'order totals must add up');
select throws_ok(
  $$insert into public.orders (customer_id, idempotency_key, tracking_token_hash, subtotal_centavos, total_centavos, customer_name, customer_email, customer_phone)
    values ('b0000000-0000-4000-8000-000000000001', 'seed-checkout-0001', repeat('b', 64), 100, 100, 'T', 't@t.com', '+639171234567')$$,
  '23505', null, 'checkout idempotency keys are unique');

-- Status history + audit ----------------------------------------------------
select is((select count(*) from public.order_status_history where order_id = 'c1000000-0000-4000-8000-000000000001'), 4::bigint, 'placement writes one history row per state machine');
update public.orders set delivery_status = 'failed' where order_number = 'FL-10002';
select is((select to_status from public.order_status_history where order_id = 'c1000000-0000-4000-8000-000000000002' and kind = 'delivery' order by created_at desc limit 1), 'failed', 'status changes are recorded');
select ok((select count(*) from public.audit_logs where entity_type = 'orders' and entity_id = 'c1000000-0000-4000-8000-000000000002' and action = 'UPDATE') >= 1, 'order updates are audited');
select is((select after ->> 'customer_phone' from public.audit_logs where entity_type = 'orders' order by created_at desc limit 1), '[redacted]', 'audit rows redact PII');

-- Refund guard ---------------------------------------------------------------
select throws_ok(
  $$insert into public.refunds (payment_id, idempotency_key, amount_centavos, reason) values ('c3000000-0000-4000-8000-000000000001', 'refund-test-1', 999999, 'too much')$$,
  'P0001', null, 'refunds cannot exceed the payment');
select throws_ok(
  $$insert into public.payment_events (provider, provider_event_id, event_type, payload) values ('paymongo', 'evt_seed_0001', 'payment.paid', '{}')$$,
  '23505', null, 'duplicate provider events are rejected (webhook idempotency)');

select * from finish();
rollback;
