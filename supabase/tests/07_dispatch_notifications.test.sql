begin;
create extension if not exists pgtap with schema extensions;
select plan(40);

\set manager '''a0000000-0000-4000-8000-000000000002'''
\set florist '''a0000000-0000-4000-8000-000000000003'''
\set rider   '''a0000000-0000-4000-8000-000000000004'''
\set support '''a0000000-0000-4000-8000-000000000005'''
\set o2 '''c1000000-0000-4000-8000-000000000002'''

-- ============ Zone validation ============
select tests.login_as(:manager);
select throws_ok($$insert into public.delivery_zones (slug, name, city, fee_centavos) values ('bad zone', 'Bad', 'X', 100)$$, '23514', null, 'zone slug format enforced');
select throws_ok($$insert into public.delivery_zones (slug, name, city, fee_centavos) values ('neg', 'Neg', 'X', -1)$$, '23514', null, 'negative delivery fee rejected');
select lives_ok($$insert into public.delivery_zones (slug, name, city, barangays, fee_centavos, same_day_cutoff) values ('bogo', 'Bogo City', 'Bogo', array['Gairan','Cogon'], 35000, null)$$, 'manager can add a zone');
select tests.logout();
select tests.login_as(:support);
select throws_ok($$insert into public.delivery_zones (slug, name, city, fee_centavos) values ('s-zone', 'S', 'X', 100)$$, '42501', null, 'support cannot create zones');
select tests.logout();
-- Checkout refuses a barangay outside the chosen zone (covered in suite 05) and an inactive zone:
update public.delivery_zones set is_active = false where slug = 'bogo';
select tests.login_anon();
select is((public.list_delivery_options((select id from public.delivery_zones where slug = 'bogo'), app.manila_today() + 2) ->> 'ok')::boolean, false, 'inactive zones are not deliverable');
select tests.logout();

-- ============ Slot capacity ============
select tests.login_as(:manager);
-- next Wednesday at least a week out
select (app.manila_today() + 7 - extract(dow from app.manila_today() + 7)::int + 3)::date as wed \gset
select is((public.set_slot_capacity('80000000-0000-4000-8000-000000000001', :'wed', 1) ->> 'capacity')::int, 1, 'manager overrides a slot capacity for a date');
select tests.logout();
select tests.login_service();
select lives_ok(format($$select public.reserve_delivery_slot('80000000-0000-4000-8000-000000000001', %L)$$, :'wed'), 'first booking fits');
select throws_ok(format($$select public.reserve_delivery_slot('80000000-0000-4000-8000-000000000001', %L)$$, :'wed'), 'P0001', 'This delivery slot is fully booked.', 'second booking is refused (no overbooking)');
select tests.logout();
select tests.login_as(:manager);
select throws_ok(format($$select public.set_slot_capacity('80000000-0000-4000-8000-000000000001', %L, 0)$$, :'wed'), null, null, 'capacity cannot drop below bookings');
select lives_ok(format($$select public.set_slot_capacity('80000000-0000-4000-8000-000000000002', %L, 5, true)$$, :'wed'), 'a slot can be blocked for a date');
select tests.logout();
select tests.login_anon();
select is((select (s ->> 'available')::boolean from jsonb_array_elements(public.list_delivery_options('70000000-0000-4000-8000-000000000001', :'wed') -> 'slots') s where s ->> 'slot_id' = '80000000-0000-4000-8000-000000000002'), false, 'blocked slot is not offered at checkout');
select tests.logout();

-- ============ Rider authorization & dispatch ============
-- Fixture: FL-10002 is paid; make it ready.
select tests.login_as(:florist);
select public.complete_preparation(:o2, '[]'::jsonb);
select tests.logout();

select tests.login_as(:rider);
select is((select count(*) from public.orders), 2::bigint, 'rider sees only assigned orders');
select throws_ok($$select public.assign_rider('c1000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000004')$$, 'P0001', null, 'rider cannot assign deliveries');
select throws_ok($$select public.start_delivery('c1000000-0000-4000-8000-000000000003')$$, 'P0001', null, 'rider cannot start a delivery not assigned to them');
select tests.logout();

select tests.login_as(:manager);
select throws_ok(format($$select public.assign_rider(%L, 'a0000000-0000-4000-8000-000000000003')$$, :o2), 'P0001', null, 'only active riders can be assigned');
select is((public.assign_rider(:o2, 'a0000000-0000-4000-8000-000000000004') ->> 'assigned_rider_id'), 'a0000000-0000-4000-8000-000000000004', 'manager assigns a rider');
select ok(jsonb_array_length(public.dispatch_board(null)) >= 1, 'dispatch board lists open deliveries');
select ok((select (e ->> 'address_line1') is not null from jsonb_array_elements(public.dispatch_board(null)) e where e ->> 'order_id' = :o2), 'admins see the exact address on the board');
select tests.logout();

select tests.login_as(:support);
select ok((select (e ->> 'address_line1') is null from jsonb_array_elements(public.dispatch_board(null)) e where e ->> 'order_id' = :o2), 'support sees barangay/city only, not the exact address');
select tests.logout();

select tests.login_as(:rider);
select ok((select count(*) from jsonb_array_elements(public.rider_deliveries(false)) e where e ->> 'order_id' = :o2) = 1, 'assigned delivery appears on the rider dashboard with the address');
select ok((select e ->> 'address' is not null from jsonb_array_elements(public.rider_deliveries(false)) e where e ->> 'order_id' = :o2), 'rider gets the exact address for the assigned delivery');
select is((public.start_delivery(:o2) ->> 'delivery_status'), 'out_for_delivery', 'rider starts the delivery');
select throws_ok(format($$select public.complete_delivery(%L, null)$$, :o2), 'P0001', null, 'completion requires a proof photo');
select throws_ok(format($$select public.fail_delivery(%L, 'recipient_unavailable', 'no')$$, :o2), 'P0001', null, 'failure requires a meaningful note');
select is((public.fail_delivery(:o2, 'recipient_unavailable', 'Nobody home, phone unanswered after three calls.') ->> 'delivery_status'), 'failed', 'rider records a failed attempt with a note');
select throws_ok(format($$select public.authorize_delivery_retry(%L)$$, :o2), 'P0001', null, 'rider cannot authorize a retry');
select throws_ok(format($$select public.start_delivery(%L)$$, :o2), 'P0001', null, 'failed delivery cannot restart without authorization');
select tests.logout();

select tests.login_as(:manager);
select is((public.authorize_delivery_retry(:o2, 'Customer called back') ->> 'delivery_status'), 'scheduled', 'manager authorizes a retry');
select tests.logout();
select tests.login_as(:rider);
select is((public.start_delivery(:o2) ->> 'attempt')::int, 2, 'second attempt counted');
select is((public.complete_delivery(:o2, 'orders/' || :o2 || '/pod.jpg', 'Rosario Dela Cruz', 'Handed to recipient') ->> 'delivery_status'), 'delivered', 'rider completes with proof');
select tests.logout();
select is((select status::text || '/' || delivery_status::text from public.orders where id = :o2), 'completed/delivered', 'order completed on delivery');
select is((select count(*) from public.delivery_events where order_id = :o2), 6::bigint, 'full delivery audit trail (assign, out, failed, retry, out, delivered)');

-- Reschedule requires a manager and respects capacity.
select tests.login_as(:rider);
select throws_ok($$select public.reschedule_delivery('c1000000-0000-4000-8000-000000000003', app.manila_today() + 3, '80000000-0000-4000-8000-000000000002')$$, 'P0001', null, 'rider cannot reschedule');
select tests.logout();

-- ============ Notifications: dedupe + retry ============
select is((select count(*) from public.notifications where order_id = :o2 and template = 'delivery.delivered'), 1::bigint, 'delivered notification enqueued once');
select is((select count(*) from public.notifications where order_id = :o2 and template = 'delivery.out'), 1::bigint, 'out-for-delivery enqueued once despite two attempts (dedupe key)');
select is((select count(*) from public.notifications where order_id = :o2 and template = 'delivery.failed'), 1::bigint, 'one failed-delivery message per attempt');
select is(app.enqueue_notification('delivery.delivered', 'email', 'x@example.com', 's', '{}'::jsonb, 'order:' || :o2 || ':delivery.delivered:email', :o2), null, 'duplicate enqueue is a no-op');
select is((select count(*) from public.notifications where channel = 'sms'), 0::bigint, 'SMS is disabled by default');

select tests.login_service();
select (select id from public.notifications where order_id = :o2 and template = 'delivery.delivered') as nid \gset
select public.mark_notification_result(:'nid', false, 'resend', null, 'boom');
select is((select status::text from public.notifications where id = :'nid'), 'queued', 'failed send is re-queued with backoff');
select ok((select next_attempt_at > now() from public.notifications where id = :'nid'), 'backoff pushes the next attempt into the future');
select tests.logout();

select * from finish();
rollback;
