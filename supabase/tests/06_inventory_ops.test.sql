begin;
create extension if not exists pgtap with schema extensions;
select plan(40);

\set florist '''a0000000-0000-4000-8000-000000000003'''
\set manager '''a0000000-0000-4000-8000-000000000002'''
\set rider   '''a0000000-0000-4000-8000-000000000004'''
\set support '''a0000000-0000-4000-8000-000000000005'''
\set sunflower '''40000000-0000-4000-8000-000000000004'''
\set mum_yellow '''40000000-0000-4000-8000-000000000005'''
\set mum_white '''40000000-0000-4000-8000-000000000006'''

-- ============ Security boundaries ============
select tests.login_as(:florist);
select is((select count(*) from public.customers), 0::bigint, 'florist cannot read customer records');
select is((select count(*) from public.payments), 0::bigint, 'florist cannot read payments');
select is((select count(*) from public.business_settings where bank_transfer_instructions is not null), 1::bigint, 'public business settings are readable (no secrets there)');
select throws_ok($$insert into public.stock_batches (material_id, batch_code, quantity_received, quantity_remaining) values ('40000000-0000-4000-8000-000000000004', 'X-1', 1, 1)$$, '42501', null, 'florist cannot insert batches directly (functions only)');
select throws_ok($$insert into public.stock_movements (batch_id, material_id, movement_type, quantity) values ('50000000-0000-4000-8000-000000000005', '40000000-0000-4000-8000-000000000004', 'adjust', 1)$$, '42501', null, 'nobody writes the movement journal directly');
select throws_ok($$select public.adjust_stock('50000000-0000-4000-8000-000000000005', 1, 'florist adjusting')$$, 'P0001', null, 'florist cannot make manual adjustments');
select tests.logout();

select tests.login_as(:rider);
select throws_ok($$select public.receive_stock('40000000-0000-4000-8000-000000000004', 5, 100)$$, 'P0001', null, 'rider cannot receive stock');
select throws_ok($$select public.record_wastage('50000000-0000-4000-8000-000000000005', 1, 'damaged')$$, 'P0001', null, 'rider cannot record wastage');
select is((select count(*) from public.stock_batches), 0::bigint, 'rider cannot read batches');
select tests.logout();

select tests.login_as(:support);
select throws_ok($$select public.start_preparation('c1000000-0000-4000-8000-000000000002')$$, 'P0001', null, 'support cannot start preparation');
select tests.logout();

-- ============ Receipts ============
select tests.login_as(:florist);
select public.receive_stock(:sunflower, 30, 2500, 'B-SUN-TEST', '30000000-0000-4000-8000-000000000001', now(), null, 'pgTAP receipt') as rcv \gset
select is((:'rcv'::jsonb ->> 'quantity_remaining')::numeric, 30::numeric, 'receipt creates a full batch');
select ok((:'rcv'::jsonb ->> 'expires_at')::timestamptz > now() + interval '5 days', 'expiry defaults from the material shelf life (6 days)');
select throws_ok(format($$select public.receive_stock(%L, 0, 100)$$, :sunflower), 'P0001', null, 'zero quantity receipt rejected');
select throws_ok(format($$select public.receive_stock(%L, 5, -1)$$, :sunflower), 'P0001', null, 'negative cost rejected');
select tests.logout();
select :'rcv'::jsonb ->> 'id' as new_batch \gset
select is((select movement_type::text || ':' || quantity::text from public.stock_movements where batch_id = :'new_batch'), 'receive:30.000', 'receipt journaled');

-- ============ Wastage & negative-stock prevention ============
select tests.login_as(:florist);
select is((public.record_wastage(:'new_batch', 5, 'damaged', 'crushed in transit') ->> 'quantity_remaining')::numeric, 25::numeric, 'wastage reduces remaining');
select throws_ok(format($$select public.record_wastage(%L, 100, 'wilted')$$, :'new_batch'), 'P0001', null, 'wastage cannot exceed available stock');
select throws_ok(format($$select public.record_wastage(%L, 1, 'because')$$, :'new_batch'), 'P0001', null, 'wastage needs a valid reason');
select tests.logout();
select is((select wastage_reason from public.stock_movements where batch_id = :'new_batch' and movement_type = 'discard'), 'damaged', 'wastage reason journaled');

-- Reserved stock is protected from wastage.
select tests.login_service();
select public.reserve_stock('order', '00000000-0000-4000-8000-0000000000b1', 'inv-test-reserve-b1', '[{"variant_id":"20000000-0000-4000-8000-000000000003","quantity":5}]'::jsonb, null);
select tests.logout();
select tests.login_as(:florist);
select throws_ok($$select public.record_wastage('50000000-0000-4000-8000-000000000005', 40, 'damaged')$$, 'P0001', null, 'cannot waste stock that is reserved for orders');
select tests.logout();
select tests.login_service();
select public.release_stock_reservations('order', '00000000-0000-4000-8000-0000000000b1', 'test cleanup');
select tests.logout();

-- ============ Preparation: start → substitution → actual consumption ============
-- Fresh paid order: FL-10003 is pending/bank transfer in seed; make FL-10002-like fixture by marking FL-10003 paid.
select tests.login_service();
select public.create_payment_attempt('c1000000-0000-4000-8000-000000000003', 'paymongo', 'inv-test-pay-0003') as pay \gset
select public.mark_order_paid((:'pay'::jsonb ->> 'id')::uuid, 'cs_inv_test', 'gcash', now(), '{}'::jsonb);
select tests.logout();
select is((select fulfillment_status::text from public.orders where id = 'c1000000-0000-4000-8000-000000000003'), 'unfulfilled', 'fixture order is paid and unfulfilled');
select (select count(*) from public.stock_reservations where reference_id = 'c1000000-0000-4000-8000-000000000003' and status = 'active') as res_before \gset
select ok(:res_before > 0, 'fixture order has active reservations');

select tests.login_as(:florist);
select is((public.start_preparation('c1000000-0000-4000-8000-000000000003') ->> 'fulfillment_status'), 'preparing', 'florist starts preparation');
select ok(jsonb_array_length(public.preparation_queue(false)) >= 1, 'florist sees the queue');
select ok(public.preparation_details('c1000000-0000-4000-8000-000000000003') -> 'items' -> 0 -> 'recipe' -> 'lines' is not null, 'details include the recipe');
select is((public.preparation_details('c1000000-0000-4000-8000-000000000003') -> 'order' ->> 'recipient_name'), 'Ana Reyes', 'details expose recipient first name for labelling only');

-- Substitute 2 white roses (reserved) with 2 white mums.
select public.apply_substitution('c1000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000002', :mum_white, 2, 'white roses bruised') as sub \gset
select is(:'sub'::jsonb ->> 'status', 'applied', 'florist substitution is applied and awaits review');
select is((select sum(quantity) from public.stock_reservations where reference_id = 'c1000000-0000-4000-8000-000000000003' and material_id = '40000000-0000-4000-8000-000000000002' and status = 'active'), 10::numeric, 'original hold reduced by the substituted quantity');
select is((select sum(quantity) from public.stock_reservations where reference_id = 'c1000000-0000-4000-8000-000000000003' and material_id = :mum_white and status = 'active'), 2::numeric, 'substitute reserved');
select throws_ok($$select public.apply_substitution('c1000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000020', '40000000-0000-4000-8000-000000000021', 1, 'x')$$, 'P0001', null, 'cannot substitute a material that is not reserved');
select tests.logout();

select tests.login_as(:manager);
select is((public.review_substitution((:'sub'::jsonb ->> 'id')::uuid, true, 'ok') ->> 'status'), 'approved', 'manager approves the substitution');
select tests.logout();

-- Actual consumption: use 9 of 10 white roses, all 2 mums, lisianthus as planned, 1 extra eucalyptus bunch; omit wax/paper lines.
select (select quantity_remaining from public.stock_batches where batch_code = 'B-ROSE-WH-1019') as rose_before \gset
select tests.login_as(:florist);
select public.complete_preparation('c1000000-0000-4000-8000-000000000003',
  ('[{"material_id":"40000000-0000-4000-8000-000000000002","quantity":9},{"material_id":"' || :mum_white || '","quantity":2},{"material_id":"40000000-0000-4000-8000-000000000011","quantity":6},{"material_id":"40000000-0000-4000-8000-000000000015","quantity":1.5}]')::jsonb,
  'orders/c1000000-0000-4000-8000-000000000003/arrangement.jpg', 'looked lovely') as done \gset
select is(:'done'::jsonb ->> 'fulfillment_status', 'ready', 'order marked ready');
select tests.logout();
select is((select fulfillment_status::text || '/' || coalesce(arrangement_photo_path, '') from public.orders where id = 'c1000000-0000-4000-8000-000000000003'), 'ready/orders/c1000000-0000-4000-8000-000000000003/arrangement.jpg', 'photo path stored');
select is((select quantity_remaining from public.stock_batches where batch_code = 'B-ROSE-WH-1019'), :rose_before - 9, 'actual consumption (9 roses) applied, 1 reserved rose released');
select is((select count(*) from public.stock_reservations where reference_id = 'c1000000-0000-4000-8000-000000000003' and status = 'active'), 0::bigint, 'no reservations remain after preparation');
select ok((select count(*) from public.stock_movements where reference_id = 'c1000000-0000-4000-8000-000000000003' and movement_type = 'consume' and reason = 'preparation (extra)') >= 1, 'extra consumption beyond the hold is journaled');
select throws_ok($$select public.complete_preparation('c1000000-0000-4000-8000-000000000003', '[]'::jsonb)$$, 'P0001', null, 'cannot complete twice');

-- ============ Cancellation release ============
-- Order FL-10001 (delivered) cannot be cancelled; a paid unprepared order releases stock.
select tests.login_as(:manager);
select throws_ok($$select public.cancel_order('c1000000-0000-4000-8000-000000000001', 'test')$$, 'P0001', null, 'delivered orders cannot be cancelled');
select tests.logout();

-- ============ Expiry + reconciliation ============
select tests.login_service();
select ok(public.expire_stock_batches() >= 1, 'expired batches are marked');
select tests.logout();
select is((select count(*) from public.inventory_reconciliation where not balanced), 0::bigint, 'every batch reconciles with its movement journal');

select * from finish();
rollback;
