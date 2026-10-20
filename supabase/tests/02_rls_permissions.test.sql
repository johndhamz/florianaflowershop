begin;
create extension if not exists pgtap with schema extensions;
select plan(43);

-- ===================== ANON (storefront visitor) ============================
select tests.login_anon();

select is((select count(*) from public.products), 12::bigint, 'anon sees active products only (draft hidden)');
select is((select count(*) from public.product_variants where sku = 'PB-VAL-DRAFT'), 0::bigint, 'anon cannot see variants of draft products');
select is((select count(*) from public.collections), 4::bigint, 'anon can read collections');
select is((select count(*) from public.delivery_zones), 6::bigint, 'anon can read active delivery zones');
select is((select count(*) from public.site_content), 6::bigint, 'anon sees published content only');
select throws_ok($$select count(*) from public.orders$$, '42501', null, 'anon has no privilege on orders');
select throws_ok($$select count(*) from public.customers$$, '42501', null, 'anon has no privilege on customers');
select throws_ok($$select count(*) from public.carts$$, '42501', null, 'anon has no privilege on carts');
select throws_ok($$select count(*) from public.payments$$, '42501', null, 'anon has no privilege on payments');
select throws_ok($$select count(*) from public.stock_batches$$, '42501', null, 'anon has no privilege on inventory');
select throws_ok($$insert into public.products (slug, name) values ('anon-product', 'x')$$, '42501', null, 'anon cannot insert products');
select throws_ok(
  $$select public.reserve_stock('order', gen_random_uuid(), 'anon-reserve-01', '[]'::jsonb)$$,
  '42501', null, 'anon cannot execute reserve_stock');

select ok(public.get_order_for_tracking('FL-10001', 'track-fl-10001-dev') is not null, 'guest tracking works with the right token');
select is(public.get_order_for_tracking('FL-10001', 'track-fl-10001-dev') ->> 'order_number', 'FL-10001', 'tracking returns the order');
select is(public.get_order_for_tracking('FL-10001', 'track-fl-10001-dev') -> 'recipient' ->> 'phone_masked', '+63918•••••01', 'tracking masks recipient phone');
select is(public.get_order_for_tracking('FL-10001', 'wrong-token-wrong-token'), null, 'wrong token yields nothing');
select is(public.get_order_for_tracking('FL-10001', 'track-fl-10002-dev'), null, 'token from another order yields nothing');

select tests.logout();

-- ===================== FLORIST ===============================================
select tests.login_as('a0000000-0000-4000-8000-000000000003');
select is(app.current_staff_role()::text, 'florist', 'florist role resolves from JWT');
select is((select count(*) from public.orders), 4::bigint, 'florist can read all orders');
select is((select count(*) from public.stock_batches), 32::bigint, 'florist can read stock batches');
select is((select count(*) from public.payments), 0::bigint, 'florist cannot see payments');
select lives_ok($$update public.orders set fulfillment_status = 'ready' where order_number = 'FL-10002'$$, 'florist can update fulfillment status');
select throws_ok($$update public.orders set payment_status = 'paid' where order_number = 'FL-10003'$$, 'P0001', null, 'florist cannot change payment status');
select throws_ok($$insert into public.products (slug, name) values ('florist-product', 'x')$$, '42501', null, 'florist cannot create products');
select lives_ok($$update public.business_settings set shop_name = 'florist-edit'$$, 'florist update on settings is silently filtered by RLS');
select tests.logout();
select isnt((select shop_name from public.business_settings), 'florist-edit', 'florist cannot change business settings');
select tests.login_as('a0000000-0000-4000-8000-000000000003');
select is((select count(*) from public.customers), 4::bigint, 'florist can read customers (to label orders)');
select tests.logout();

-- ===================== RIDER =================================================
select tests.login_as('a0000000-0000-4000-8000-000000000004');
select is((select count(*) from public.orders), 2::bigint, 'rider sees only assigned orders');
select is((select count(*) from public.order_recipients), 2::bigint, 'rider sees recipients of assigned orders only');
select is((select count(*) from public.customers), 0::bigint, 'rider cannot read customers');
select lives_ok($$update public.orders set delivery_status = 'out_for_delivery' where order_number = 'FL-10002'$$, 'rider can update delivery status on assigned order');
select throws_ok($$update public.orders set internal_notes = 'hi' where order_number = 'FL-10002'$$, 'P0001', null, 'rider cannot edit other order columns');
select lives_ok($$update public.orders set delivery_status = 'delivered' where order_number = 'FL-10003'$$, 'rider update on unassigned order is filtered, not errored');
select tests.logout();
select is((select delivery_status::text from public.orders where order_number = 'FL-10003'), 'pending', 'rider cannot touch unassigned orders');

-- ===================== SUPPORT ===============================================
select tests.login_as('a0000000-0000-4000-8000-000000000005');
select is((select count(*) from public.payments), 4::bigint, 'support can read payments');
select lives_ok($$update public.payments set status = 'paid' where id = 'c3000000-0000-4000-8000-000000000003'$$, 'support update on payments is filtered by RLS');
select tests.logout();
select is((select status::text from public.payments where id = 'c3000000-0000-4000-8000-000000000003'), 'pending', 'support cannot verify payments');
select tests.login_as('a0000000-0000-4000-8000-000000000005');
select is((select count(*) from public.stock_batches), 0::bigint, 'support cannot read inventory');
select lives_ok($$update public.orders set status = 'cancelled', cancelled_at = now(), cancellation_reason = 'test' where order_number = 'FL-10003'$$, 'support can cancel an order');
select tests.logout();

-- ===================== MANAGER / OWNER =======================================
select tests.login_as('a0000000-0000-4000-8000-000000000002');
select lives_ok($$insert into public.products (slug, name) values ('manager-product', 'Manager Product')$$, 'manager can create products');
select throws_ok($$insert into public.staff_profiles (user_id, role, display_name) values ('a0000000-0000-4000-8000-000000000005', 'owner', 'x')$$, null, null, 'manager cannot grant owner role');
select ok((select count(*) from public.audit_logs) > 0, 'manager can read audit logs (policy allows admins)');
select tests.logout();

select tests.login_as('a0000000-0000-4000-8000-000000000001');
select ok((select count(*) from public.audit_logs) > 0, 'owner can read audit logs');
select tests.logout();

select * from finish();
rollback;
