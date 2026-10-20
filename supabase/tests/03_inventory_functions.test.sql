begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

-- Baseline: triple-spike phalaenopsis has exactly 2 available.
select is(public.variant_available_quantity('20000000-0000-4000-8000-000000000022'), 2, 'baseline availability for OR-PHAL-WHITE-3 is 2');

-- Reserve 1 → availability 1
select is(
  (select count(*) from public.reserve_stock('order', '00000000-0000-4000-8000-0000000000a1', 'test-reserve-a1',
     '[{"variant_id":"20000000-0000-4000-8000-000000000022","quantity":1}]'::jsonb)),
  2::bigint, 'reserve_stock returns one reservation row per material (plant + pot)');
select is(public.variant_available_quantity('20000000-0000-4000-8000-000000000022'), 1, 'availability drops after reservation');

-- Idempotent replay: same key, no extra reservations.
select is(
  (select count(*) from public.reserve_stock('order', '00000000-0000-4000-8000-0000000000a1', 'test-reserve-a1',
     '[{"variant_id":"20000000-0000-4000-8000-000000000022","quantity":1}]'::jsonb)),
  2::bigint, 'replaying the same idempotency key returns the existing rows');
select is(public.variant_available_quantity('20000000-0000-4000-8000-000000000022'), 1, 'replay does not double-reserve');

-- Insufficient stock: atomic rollback (pot would succeed, plant would not).
select throws_ok(
  $$select public.reserve_stock('order', '00000000-0000-4000-8000-0000000000a2', 'test-reserve-a2',
     '[{"variant_id":"20000000-0000-4000-8000-000000000022","quantity":2}]'::jsonb)$$,
  'P0001', null, 'reserving more than available raises');
select is((select count(*) from public.stock_reservations where idempotency_key = 'test-reserve-a2'), 0::bigint, 'failed reservation leaves no partial rows');
select is((select quantity_reserved from public.stock_batches where batch_code = 'B-POT-0901'), 1::numeric, 'failed reservation did not touch the pot batch');

-- FEFO: blush roses have a fresh batch (B-ROSE-BL-1020) and an older one (B-ROSE-BL-1018); older expires first.
select public.reserve_stock('order', '00000000-0000-4000-8000-0000000000a3', 'test-reserve-a3',
  '[{"variant_id":"20000000-0000-4000-8000-000000000011","quantity":1}]'::jsonb);
select is((select batch_code from public.stock_reservations r join public.stock_batches b on b.id = r.batch_id
           where r.idempotency_key = 'test-reserve-a3' and b.material_id = '40000000-0000-4000-8000-000000000001'),
  'B-ROSE-BL-1018', 'reservation picks the soonest-expiring batch first (FEFO)');
select is((select count(*) from public.stock_reservations r join public.stock_batches b on b.id = r.batch_id
           where r.idempotency_key = 'test-reserve-a3' and b.batch_code = 'B-ROSE-BL-1008'), 0::bigint, 'expired batches are never reserved');

-- Release restores availability and journals a movement.
select is(public.release_stock_reservations('order', '00000000-0000-4000-8000-0000000000a1'), 2, 'release returns the number of reservations released');
select is(public.variant_available_quantity('20000000-0000-4000-8000-000000000022'), 2, 'availability restored after release');
select is((select count(*) from public.stock_movements where reference_id = '00000000-0000-4000-8000-0000000000a1' and movement_type = 'release'), 2::bigint, 'release movements journaled');

-- Consume decrements remaining stock.
select public.reserve_stock('order', '00000000-0000-4000-8000-0000000000a4', 'test-reserve-a4',
  '[{"variant_id":"20000000-0000-4000-8000-000000000024","quantity":1}]'::jsonb);
select is(public.consume_stock_reservations('order', '00000000-0000-4000-8000-0000000000a4'), 2, 'consume processes each reservation');
select is((select quantity_remaining from public.stock_batches where batch_code = 'B-DEND-1005'), 3::numeric, 'consume reduces remaining stock');
select is((select quantity_reserved from public.stock_batches where batch_code = 'B-DEND-1005'), 0::numeric, 'consume clears the reservation hold');

-- Expiry jobs.
update public.stock_reservations set expires_at = now() - interval '1 minute' where idempotency_key = 'test-reserve-a3';
select ok(public.expire_stock_reservations() >= 1, 'expired reservations are released by the job');
select ok(public.expire_stock_batches() >= 1, 'expired batches are marked by the job');
select is((select status::text from public.stock_batches where batch_code = 'B-ROSE-BL-1008'), 'expired', 'the stale rose batch is now expired');

-- Delivery capacity (call first, then inspect: the outer query snapshot predates the insert).
create temp table _alloc on commit drop as
  select public.reserve_delivery_slot('80000000-0000-4000-8000-000000000003', (current_date + 14) - extract(dow from current_date + 14)::int + 1) as id;
select is((select booked from public.delivery_slot_allocations where id = (select id from _alloc)), 1, 'reserving a delivery slot creates the allocation and books one unit');
select is((select booked from public.delivery_slot_allocations where id = (select id from _alloc)), 1, 'allocation persists');

select * from finish();
rollback;
