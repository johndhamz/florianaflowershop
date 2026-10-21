begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

\set manager '''a0000000-0000-4000-8000-000000000002'''
\set support '''a0000000-0000-4000-8000-000000000005'''
\set florist '''a0000000-0000-4000-8000-000000000003'''

-- ============ Permissions ============
select tests.login_as(:support);
select throws_ok($$select public.report_sales_summary(current_date, current_date)$$, 'P0001', null, 'support cannot read financial reports');
select throws_ok($$select * from public.report_product_margin(current_date, current_date)$$, 'P0001', null, 'support cannot read margins');
select ok((public.dashboard_summary() ->> 'sales_today_centavos') is null, 'dashboard hides sales figures from support');
select tests.logout();
select tests.login_as(:florist);
select throws_ok($$select * from public.report_orders_by_date(current_date, current_date)$$, 'P0001', null, 'florist cannot read reports');
select tests.logout();

-- ============ Financial reconciliation ============
-- Fixture: seed has FL-10001 (paid 263900, confirmed 4 days ago), FL-10002 (paid 79900, 17h ago),
-- FL-10003 (pending, unpaid), FL-10004 (refunded 208900, confirmed 2 days ago, refund 1 day ago).
select tests.login_as(:manager);
select public.report_sales_summary(current_date - 10, current_date + 1) as s \gset
select is((:'s'::jsonb ->> 'paid_orders')::int, 3, 'only paid/refunded orders count (unpaid excluded)');
select is((:'s'::jsonb ->> 'gross_sales_centavos')::int, 249000 + 5000 + 65000 + 189000, 'gross = Σ(items + add-ons) from snapshots');
select is((:'s'::jsonb ->> 'discounts_centavos')::int, 0, 'discounts summed from snapshots');
select is((:'s'::jsonb ->> 'refunds_centavos')::int, 208900, 'refunds summed by processed date');
select is((:'s'::jsonb ->> 'net_sales_centavos')::int, 249000 + 5000 + 65000 + 189000 - 208900, 'net = gross − discounts − refunds');
select is((:'s'::jsonb ->> 'delivery_fees_centavos')::int, 9900 + 14900 + 19900, 'delivery fees reported separately');
select is((:'s'::jsonb ->> 'collected_centavos')::int, 263900 + 79900 + 208900 - 208900, 'collected = totals − refunds');
select is((:'s'::jsonb ->> 'unpaid_orders')::int, 1, 'unpaid orders reported, not counted as revenue');

-- Daily rows reconcile to the summary.
select is((select sum(net_centavos)::bigint from public.report_orders_by_date(current_date - 10, current_date + 1)), (:'s'::jsonb ->> 'net_sales_centavos')::bigint, 'daily net rows sum to the summary net');
select is((select count(*) from public.report_orders_by_date(current_date - 2, current_date)), 3::bigint, 'one row per day in range');

-- Partial refund reconciles.
select tests.logout();
select tests.login_service();
select public.record_refund('c3000000-0000-4000-8000-000000000001', 'test-partial-refund-1', 50000, 'requested_by_customer: damaged stem', 'succeeded', 'ref_test_1');
select tests.logout();
select tests.login_as(:manager);
select is((select payment_status::text from public.orders where id = 'c1000000-0000-4000-8000-000000000001'), 'partially_refunded', 'partial refund marks the order partially refunded');
select is((public.report_sales_summary(current_date - 10, current_date + 1) ->> 'refunds_centavos')::int, 208900 + 50000, 'partial refunds are reconciled into the report');
select is((public.report_sales_summary(current_date - 10, current_date + 1) ->> 'paid_orders')::int, 3, 'partially refunded orders still count as paid orders');

-- Manila date boundaries: an order confirmed at 23:30 Manila belongs to that Manila day, not the UTC day.
select tests.logout();
update public.orders set confirmed_at = ((current_date - 1)::timestamp + interval '23 hours 30 minutes') at time zone 'Asia/Manila' where id = 'c1000000-0000-4000-8000-000000000002';
select tests.login_as(:manager);
select is((select paid_orders from public.report_orders_by_date(current_date - 1, current_date - 1)), 1::bigint, 'order at 23:30 Manila falls on that Manila date');
select is((select paid_orders from public.report_orders_by_date(current_date - 1, current_date - 1) where day = current_date - 1), 1::bigint, 'and not on the next day');

-- Other reports run and label estimates.
select ok((select count(*) from public.report_best_sellers(current_date - 30, current_date + 1, 5)) >= 1, 'best sellers has rows');
select ok((select count(*) from public.report_sales_by_collection(current_date - 30, current_date + 1)) >= 1, 'sales by collection has rows');
select ok((select bool_and(is_estimate) from public.report_product_margin(current_date - 30, current_date + 1)), 'margins are flagged as estimates');
select ok((select count(*) from public.report_payment_methods(current_date - 30, current_date + 1)) >= 1, 'payment method breakdown has rows');
select tests.logout();

-- ============ Coupon abuse ============
select tests.logout();
update public.promo_codes set per_customer_limit = 1, first_order_only = false where code = 'LOLA10';
insert into public.promo_codes (code, description, promo_type, value, min_subtotal_centavos, first_order_only) values ('WELCOME15', 'first order', 'percent', 15, 0, true);
insert into public.promo_codes (code, description, promo_type, value, min_subtotal_centavos, eligible_collection_ids) values ('ORCHID20', 'orchids only', 'percent', 20, 0, array['c0000000-0000-4000-8000-000000000003'::uuid]);
-- Pretend buyer@example.com already redeemed LOLA10 and has a paid order.
insert into public.promo_redemptions (promo_id, order_id, customer_email, discount_centavos) values ('90000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'maria.santos@example.com', 25400);
select tests.login_anon();
select is((public.validate_promo_code('lola10', 200000, 'maria.santos@example.com') ->> 'valid')::boolean, false, 'per-customer limit blocks a second use (case-insensitive code)');
select is((public.validate_promo_code('LOLA10', 200000, 'new.person@example.com') ->> 'valid')::boolean, true, 'another customer can still use it');
select is((public.validate_promo_code('WELCOME15', 200000, 'maria.santos@example.com') ->> 'message'), 'This code is for first orders only.', 'first-order-only rejects returning customers');
select is((public.validate_promo_code('WELCOME15', 200000, 'new.person@example.com') ->> 'valid')::boolean, true, 'first-order-only accepts new customers');
select is((public.validate_promo_code('ORCHID20', 200000, 'x@example.com', null) ->> 'valid')::boolean, false, 'collection-restricted code needs the cart');
\set tok '''eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'''
select public.cart_add_item(:tok, '20000000-0000-4000-8000-000000000011', 1); -- bouquet (not orchid)
select is((public.validate_promo_code('ORCHID20', 249000, 'x@example.com', :tok) ->> 'message'), 'This code only applies to selected collections.', 'no eligible items → rejected');
select public.cart_add_item(:tok, '20000000-0000-4000-8000-000000000021', 1); -- orchid 189000
select is((public.validate_promo_code('ORCHID20', 438000, 'x@example.com', :tok) ->> 'discount_centavos')::int, 37800, 'discount computed on eligible items only (20% of ₱1,890)');
select tests.logout();

-- ============ CMS publishing ============
select tests.login_as(:florist);
-- RLS filters rows the florist cannot write: the update touches nothing (and insert is rejected).
create temp table florist_update_result as with u as (update public.site_content set data = '{}'::jsonb where key = 'home.hero' returning 1) select count(*) as n from u;
select is((select n from florist_update_result), 0::bigint, 'florist cannot edit content');
select tests.logout();
select tests.login_as(:manager);
select lives_ok($$update public.site_content set data = jsonb_set(data, '{title}', '"Draft title"'), is_published = false where key = 'home.hero'$$, 'manager can save a draft');
select tests.logout();
select tests.login_anon();
select is((select count(*) from public.site_content where key = 'home.hero'), 0::bigint, 'unpublished drafts are invisible to the storefront');

select * from finish();
rollback;
