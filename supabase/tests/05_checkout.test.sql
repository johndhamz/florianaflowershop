begin;
create extension if not exists pgtap with schema extensions;
select plan(40);

\set tok '''cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'''
\set tok2 '''dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'''
select (app.manila_today() + 3)::text as d \gset
select (extract(dow from app.manila_today() + 3))::int as dow \gset
-- Afternoon slot runs Mon–Sat; if +3 is Sunday use the Sunday slot.
select case when :dow = 0 then '80000000-0000-4000-8000-000000000004' else '80000000-0000-4000-8000-000000000002' end as slot \gset

select ($${"sender":{"name":"Test Buyer","email":"buyer@example.com","phone":"+639171234999"},"recipient":{"name":"Rina Cruz","phone":"+639181234999","address_line1":"12 Juana Osmena St","barangay":"Capitol Site"},"delivery":{"zone_id":"70000000-0000-4000-8000-000000000001","date":"$$ || :'d' || $$","slot_id":"$$ || :'slot' || $$"},"gift_message":"Happy birthday!","promo_code":"LOLA10","payment_method":"bank_transfer","privacy_consent":true}$$)::text as input \gset

-- ============ Validation (anon) ============
select tests.login_anon();
select throws_ok(format($$select public.place_order(%L, 'idem-key-000000001', %L::jsonb)$$, :tok, :'input'), 'P0001', 'Your cart is empty.', 'empty cart rejected');

select public.cart_add_item(:tok, '20000000-0000-4000-8000-000000000011', 1, '[{"add_on_id":"f0000000-0000-4000-8000-000000000001","quantity":1}]');

select throws_ok(format($$select public.place_order(%L, 'idem-key-000000001', jsonb_set(%L::jsonb, '{sender,phone}', '"0917"'))$$, :tok, :'input'), 'P0001', null, 'invalid PH mobile rejected');
select throws_ok(format($$select public.place_order(%L, 'idem-key-000000001', jsonb_set(%L::jsonb, '{recipient,barangay}', '"Talamban"'))$$, :tok, :'input'), 'P0001', null, 'barangay outside zone rejected');
select throws_ok(format($$select public.place_order(%L, 'idem-key-000000001', jsonb_set(%L::jsonb, '{promo_code}', '"NOPE123"'))$$, :tok, :'input'), 'P0001', 'That promo code is not valid.', 'invalid promo rejected');
select throws_ok(format($$select public.place_order(%L, 'idem-key-000000001', jsonb_set(%L::jsonb, '{promo_code}', '"EXPIRED5"'))$$, :tok, :'input'), 'P0001', 'That promo code has expired.', 'expired promo rejected');
select throws_ok(format($$select public.place_order(%L, 'idem-key-000000001', jsonb_set(%L::jsonb, '{privacy_consent}', 'false'))$$, :tok, :'input'), 'P0001', null, 'privacy consent required');
select throws_ok(format($$select public.place_order(%L, 'idem-key-000000001', jsonb_set(%L::jsonb, '{delivery,date}', to_jsonb((app.manila_today() - 1)::text)))$$, :tok, :'input'), 'P0001', null, 'past delivery date rejected');
select throws_ok(format($$select public.place_order(%L, 'idem-key-000000001', jsonb_set(%L::jsonb, '{payment_method}', '"cash"'))$$, :tok, :'input'), 'P0001', null, 'unknown payment method rejected');
select throws_ok(format($$select public.place_order(%L, 'short', %L::jsonb)$$, :tok, :'input'), 'P0001', null, 'short idempotency key rejected');

-- ============ Happy path ============
select public.place_order(:tok, 'idem-key-000000001', :'input'::jsonb) as placed \gset
select is((:'placed'::jsonb ->> 'replayed')::boolean, false, 'first placement is not a replay');
select is((:'placed'::jsonb ->> 'total_centavos')::int, 249000 + 5000 - 25400 + 9900, 'total = goods − promo + delivery fee');
select ok(length(:'placed'::jsonb ->> 'tracking_token') >= 48, 'tracking token issued');

select is((public.place_order(:tok, 'idem-key-000000001', '{}'::jsonb) ->> 'replayed')::boolean, true, 'replay with same key returns existing order');
select is(public.place_order(:tok, 'idem-key-000000001', '{}'::jsonb) ->> 'tracking_token', :'placed'::jsonb ->> 'tracking_token', 'replay returns the same tracking token');
select is((public.cart_get(:tok) ->> 'item_count')::int, 0, 'cart converted (empty) after placement');
select throws_ok(format($$select public.place_order(%L, 'idem-key-000000002', %L::jsonb)$$, :tok, :'input'), 'P0001', 'Your cart is empty.', 'converted cart cannot be reused with a new key');

select ok(public.get_order_for_tracking(:'placed'::jsonb ->> 'order_number', :'placed'::jsonb ->> 'tracking_token') is not null, 'guest can track with token');
select is(public.get_order_for_tracking(:'placed'::jsonb ->> 'order_number', 'wrong-token-wrong-token-wrong'), null, 'wrong token cannot track (unauthorized access)');
select is((public.get_order_for_tracking(:'placed'::jsonb ->> 'order_number', :'placed'::jsonb ->> 'tracking_token') ->> 'can_pay')::boolean, true, 'unpaid order can be paid');

select tests.logout();
select :'placed'::jsonb ->> 'order_id' as oid \gset
select is((select status::text || '/' || payment_status::text from public.orders where id = :'oid'), 'pending/unpaid', 'order starts pending/unpaid');
select is((select count(*) from public.stock_reservations where reference_id = :'oid' and status = 'active'), 5::bigint, 'stock reserved for the order (roses, ruscus, wax, paper, ribbon)');
select is((select booked from public.delivery_slot_allocations a join public.orders o on o.delivery_slot_allocation_id = a.id where o.id = :'oid'), 1, 'delivery capacity booked');
select is((select uses_count from public.promo_codes where code = 'LOLA10'), 1, 'promo use counted');
select is((select count(*) from public.order_items where order_id = :'oid'), 1::bigint, 'order items snapshotted');
select is((select count(*) from public.order_item_add_ons oia join public.order_items oi on oi.id = oia.order_item_id where oi.order_id = :'oid'), 1::bigint, 'add-on snapshotted');

-- ============ Payment attempt + webhook idempotency ============
select tests.login_service();
select public.create_payment_attempt(:'oid', 'paymongo', 'pay-attempt-key-0001', now() + interval '30 minutes') as pay \gset
select is(:'pay'::jsonb ->> 'status', 'pending', 'payment attempt created pending');
select is(public.create_payment_attempt(:'oid', 'paymongo', 'pay-attempt-key-0001') ->> 'id', :'pay'::jsonb ->> 'id', 'payment attempt is idempotent per key');
select public.update_payment_provider_ref((:'pay'::jsonb ->> 'id')::uuid, 'cs_test_0001', 'https://checkout.example/cs_test_0001');

select is((public.record_payment_event('paymongo', 'evt_test_0001', 'checkout_session.payment.paid', '{}'::jsonb, true) ->> 'duplicate')::boolean, false, 'first webhook delivery recorded');
select is((public.record_payment_event('paymongo', 'evt_test_0001', 'checkout_session.payment.paid', '{}'::jsonb, true) ->> 'duplicate')::boolean, true, 'duplicate webhook delivery detected');

select is((public.mark_order_paid((:'pay'::jsonb ->> 'id')::uuid, 'cs_test_0001', 'gcash', now(), '{}'::jsonb) ->> 'already_paid')::boolean, false, 'first mark_order_paid applies');
select is((public.mark_order_paid((:'pay'::jsonb ->> 'id')::uuid, 'cs_test_0001', 'gcash', now(), '{}'::jsonb) ->> 'already_paid')::boolean, true, 'second mark_order_paid is a no-op');
select is((select status::text || '/' || payment_status::text from public.orders where id = :'oid'), 'confirmed/paid', 'order confirmed and paid');
select is((select count(*) from public.stock_reservations where reference_id = :'oid' and status = 'active' and expires_at is null), 5::bigint, 'reservations no longer expire once paid');
select is((public.mark_payment_failed((:'pay'::jsonb ->> 'id')::uuid, 'late', 'late failure') ->> 'ignored')::boolean, true, 'failure after success is ignored');

-- ============ Reservation timeout → delayed payment ============
select tests.logout();
update public.business_settings set online_payments_enabled = true;
select tests.login_anon();
select public.cart_add_item(:tok2, '20000000-0000-4000-8000-000000000003', 1);
select public.place_order(:tok2, 'idem-key-000000003', jsonb_set(:'input'::jsonb - 'promo_code', '{payment_method}', '"paymongo"')) as placed2 \gset
select tests.logout();
select :'placed2'::jsonb ->> 'order_id' as oid2 \gset
select tests.login_service();
select public.create_payment_attempt(:'oid2', 'paymongo', 'pay-attempt-key-0002') as pay2 \gset
update public.orders set reservation_expires_at = now() - interval '1 minute' where id = :'oid2';
select is(public.expire_unpaid_orders(), 1, 'expiry job cancels the timed-out order');
select is((select status::text || '/' || cancellation_reason from public.orders where id = :'oid2'), 'cancelled/payment_timeout', 'timed-out order is cancelled with reason');
select is((select count(*) from public.stock_reservations where reference_id = :'oid2' and status = 'active'), 0::bigint, 'stock released on timeout');
select is((public.mark_order_paid((:'pay2'::jsonb ->> 'id')::uuid, 'cs_late', 'gcash', now(), '{}'::jsonb) -> 'flags' ->> 'paid_after_timeout')::boolean, true, 'delayed payment is honoured and flagged');
select is((select status::text || '/' || payment_status::text from public.orders where id = :'oid2'), 'confirmed/paid', 'delayed payment re-confirms the order');
select ok((select count(*) from public.stock_reservations where reference_id = :'oid2' and status = 'active') > 0, 'stock re-reserved for the delayed payment');

select * from finish();
rollback;
