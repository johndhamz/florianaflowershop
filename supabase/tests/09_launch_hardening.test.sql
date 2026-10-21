begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

\set manager '''a0000000-0000-4000-8000-000000000002'''
\set florist '''a0000000-0000-4000-8000-000000000003'''
\set rider   '''a0000000-0000-4000-8000-000000000004'''
\set owner   '''a0000000-0000-4000-8000-000000000001'''

-- ============ Retention: permissions ============
select tests.login_as(:manager);
select throws_ok($$select public.run_retention()$$, '42501', null, 'manager cannot run retention (service role only)');
select tests.logout();
select tests.login_anon();
select throws_ok($$select public.run_retention()$$, '42501', null, 'anon cannot execute retention');
select tests.logout();
select tests.login_service();
select throws_ok($$select public.run_retention(1, 90, 180)$$, 'P0001', null, 'windows under 7 days are refused');
select tests.logout();

-- ============ Retention: behaviour ============
-- Fixture: an old abandoned cart, a fresh cart, an old sent notification, a fresh one, an old delivery event with proof.
insert into public.carts (id, token_hash, status, updated_at) values
  ('d0000000-0000-4000-8000-000000000001', repeat('a', 64), 'active', now() - interval '45 days'),
  ('d0000000-0000-4000-8000-000000000002', repeat('b', 64), 'active', now() - interval '2 days');
insert into public.notifications (id, order_id, channel, template, recipient, subject, payload, status, sent_at, dedupe_key) values
  ('e0000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'email', 'order_confirmed', 'old@example.com', 'Old', '{"name":"Maria"}', 'sent', now() - interval '120 days', 'ret-old'),
  ('e0000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001', 'email', 'order_confirmed', 'new@example.com', 'New', '{"name":"Maria"}', 'sent', now() - interval '2 days', 'ret-new');
insert into public.delivery_events (id, order_id, event_type, exception, note, proof_photo_path, received_by, created_at) values
  ('f0000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'delivered', null, null, 'proofs/old.jpg', 'Paolo', now() - interval '200 days');

select tests.login_service();
select public.run_retention() as r \gset
select is((:'r'::jsonb ->> 'carts_deleted')::int, 1, 'old abandoned cart deleted, fresh cart kept');
select is((select count(*) from public.carts where id in ('d0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000002')), 1::bigint, 'exactly the fresh cart remains');
select is((select recipient from public.notifications where id = 'e0000000-0000-4000-8000-000000000001'), '[redacted]', 'old sent notification recipient redacted');
select is((select payload from public.notifications where id = 'e0000000-0000-4000-8000-000000000001'), '{}'::jsonb, 'old notification payload cleared');
select is((select recipient from public.notifications where id = 'e0000000-0000-4000-8000-000000000002'), 'new@example.com', 'recent notification untouched');
select is((select proof_photo_path from public.delivery_events where id = 'f0000000-0000-4000-8000-000000000001'), null, 'old proof photo reference cleared');
select is((select count(*) from public.orders where id = 'c1000000-0000-4000-8000-000000000001'), 1::bigint, 'orders (financial records) are never deleted');
select tests.logout();

-- ============ Catalogue writes are admin-only (RLS) ============
select tests.login_as(:florist);
create temp table florist_price_update as with u as (update public.product_variants set price_centavos = 1 where id = '20000000-0000-4000-8000-000000000001' returning 1) select count(*) as n from u;
select is((select n from florist_price_update), 0::bigint, 'florist cannot change prices');
select tests.logout();
select tests.login_as(:manager);
select lives_ok($$update public.product_variants set price_centavos = 199000 where id = '20000000-0000-4000-8000-000000000021'$$, 'manager can change prices');
select is((select price_centavos from public.product_variants where id = '20000000-0000-4000-8000-000000000021'), 199000, 'price updated');
select is((select unit_price_centavos from public.order_items where variant_id = '20000000-0000-4000-8000-000000000021' limit 1), 189000, 'existing order snapshots keep the old price');
select tests.logout();

-- ============ Trusted-path functions are not executable from the API roles ============
select tests.login_anon();
select throws_ok($$select public.mark_order_paid('00000000-0000-4000-8000-00000000dead'::uuid, 'pay_probe')$$, '42501', null, 'anon cannot execute mark_order_paid');
select throws_ok($$select public.record_payment_event('paymongo'::public.payment_provider, 'evt_probe', 'payment.paid', '{}'::jsonb, false)$$, '42501', null, 'anon cannot execute record_payment_event');
select throws_ok($$select public.expire_unpaid_orders()$$, '42501', null, 'anon cannot execute expire_unpaid_orders');
select tests.logout();
select tests.login_as(:florist);
select throws_ok($$select public.mark_order_paid('00000000-0000-4000-8000-00000000dead'::uuid, 'pay_probe')$$, '42501', null, 'staff cannot execute mark_order_paid');
select throws_ok($$select public.claim_due_notifications(1)$$, '42501', null, 'staff cannot execute claim_due_notifications');
select tests.logout();
select tests.login_service();
select lives_ok($$select public.expire_unpaid_orders()$$, 'service role can run jobs');
select tests.logout();

select * from finish();
rollback;
