-- ============================================================================
-- Seed 05 · Customers and example orders (guest checkout, various states)
-- Tracking tokens (dev only): token = 'track-' || lower(order_number) || '-dev'.
-- ============================================================================

insert into public.customers (id, email, full_name, phone, privacy_consent_at, marketing_opt_in) values
  ('b0000000-0000-4000-8000-000000000001', 'maria.santos@example.com', 'Maria Santos',   '+639171234501', now() - interval '20 days', true),
  ('b0000000-0000-4000-8000-000000000002', 'jose.delacruz@example.com','Jose Dela Cruz', '+639171234502', now() - interval '10 days', false),
  ('b0000000-0000-4000-8000-000000000003', 'ana.reyes@example.com',    'Ana Reyes',      '+639171234503', now() - interval '2 days',  false),
  ('b0000000-0000-4000-8000-000000000004', 'liza.uy@example.com',      'Liza Uy',        '+639171234504', now() - interval '5 days',  true);

-- Helper: build orders with explicit numbers so tokens are predictable.
with o as (
  insert into public.orders (
    id, order_number, customer_id, idempotency_key, tracking_token_hash,
    status, payment_status, fulfillment_status, delivery_status,
    subtotal_centavos, add_ons_centavos, discount_centavos, delivery_fee_centavos, total_centavos,
    promo_code_id, promo_code_snapshot,
    customer_name, customer_email, customer_phone, gift_message, delivery_instructions,
    delivery_zone_id, delivery_zone_snapshot, delivery_date, delivery_slot_snapshot, assigned_rider_id,
    placed_at, confirmed_at, completed_at, cancelled_at, cancellation_reason
  ) values
  -- 1. Delivered, paid online.
  ('c1000000-0000-4000-8000-000000000001', 'FL-10001', 'b0000000-0000-4000-8000-000000000001', 'seed-checkout-0001', app.sha256_hex('track-fl-10001-dev'),
   'completed', 'paid', 'fulfilled', 'delivered',
   249000, 5000, 0, 9900, 263900, null, null,
   'Maria Santos', 'maria.santos@example.com', '+639171234501', 'Happy anniversary, love. — M', 'Leave with the guard at the lobby if no answer.',
   '70000000-0000-4000-8000-000000000001', '{"name":"Cebu City · Central","fee_centavos":9900}', current_date - 3, '{"label":"Afternoon (1 PM – 5 PM)","starts_at":"13:00","ends_at":"17:00"}', 'a0000000-0000-4000-8000-000000000004',
   now() - interval '4 days', now() - interval '4 days', now() - interval '3 days', null, null),
  -- 2. Paid, being prepared for today.
  ('c1000000-0000-4000-8000-000000000002', 'FL-10002', 'b0000000-0000-4000-8000-000000000002', 'seed-checkout-0002', app.sha256_hex('track-fl-10002-dev'),
   'confirmed', 'paid', 'preparing', 'scheduled',
   65000, 0, 0, 14900, 79900, null, null,
   'Jose Dela Cruz', 'jose.delacruz@example.com', '+639171234502', 'Get well soon, Tita!', null,
   '70000000-0000-4000-8000-000000000003', '{"name":"Mandaue City","fee_centavos":14900}', current_date, '{"label":"Morning (9 AM – 12 NN)","starts_at":"09:00","ends_at":"12:00"}', 'a0000000-0000-4000-8000-000000000004',
   now() - interval '18 hours', now() - interval '17 hours', null, null, null),
  -- 3. Pending bank transfer, unpaid, stock reserved (expires in 30 min).
  ('c1000000-0000-4000-8000-000000000003', 'FL-10003', 'b0000000-0000-4000-8000-000000000003', 'seed-checkout-0003', app.sha256_hex('track-fl-10003-dev'),
   'pending', 'pending', 'unfulfilled', 'pending',
   395000, 35000, 30000, 9900, 409900, '90000000-0000-4000-8000-000000000001', 'LOLA10',
   'Ana Reyes', 'ana.reyes@example.com', '+639171234503', null, 'Call before delivery.',
   '70000000-0000-4000-8000-000000000001', '{"name":"Cebu City · Central","fee_centavos":9900}', current_date + 1, '{"label":"Morning (9 AM – 12 NN)","starts_at":"09:00","ends_at":"12:00"}', null,
   now() - interval '25 minutes', null, null, null, null),
  -- 4. Cancelled and refunded.
  ('c1000000-0000-4000-8000-000000000004', 'FL-10004', 'b0000000-0000-4000-8000-000000000004', 'seed-checkout-0004', app.sha256_hex('track-fl-10004-dev'),
   'cancelled', 'refunded', 'cancelled', 'cancelled',
   189000, 0, 0, 19900, 208900, null, null,
   'Liza Uy', 'liza.uy@example.com', '+639171234504', 'Congratulations on the new office!', null,
   '70000000-0000-4000-8000-000000000004', '{"name":"Lapu-Lapu City (Mactan)","fee_centavos":19900}', current_date - 1, '{"label":"Afternoon (1 PM – 5 PM)","starts_at":"13:00","ends_at":"17:00"}', null,
   now() - interval '2 days', now() - interval '2 days', null, now() - interval '1 day', 'Recipient travelling; customer requested cancellation.')
  returning id
)
select count(*) from o;

-- Keep the sequence ahead of the explicit numbers above.
select setval('public.order_number_seq', 10004, true);

insert into public.order_items (id, order_id, variant_id, product_id, product_name, variant_name, sku, image_path, unit_price_centavos, quantity, line_total_centavos)
select
  ('c2000000-0000-4000-8000-' || lpad(x.n::text, 12, '0'))::uuid, x.order_id, v.id, p.id, p.name, v.name, v.sku, 'products/' || p.slug || '/01.jpg', v.price_centavos, x.qty, v.price_centavos * x.qty
from (values
  (1, 'c1000000-0000-4000-8000-000000000001'::uuid, 'PB-BLUSH-12', 1),
  (2, 'c1000000-0000-4000-8000-000000000002'::uuid, 'EV-CEBU-STD', 1),
  (3, 'c1000000-0000-4000-8000-000000000003'::uuid, 'PB-IVORY-STD', 1),
  (4, 'c1000000-0000-4000-8000-000000000004'::uuid, 'OR-PHAL-WHITE-2', 1)
) as x(n, order_id, sku, qty)
join public.product_variants v on v.sku = x.sku
join public.products p on p.id = v.product_id;

insert into public.order_item_add_ons (order_item_id, add_on_id, name, sku, unit_price_centavos, quantity, line_total_centavos)
select oi.id, a.id, a.name, a.sku, a.price_centavos, 1, a.price_centavos
from public.order_items oi, public.add_ons a
where (oi.id, a.sku) in (
  ('c2000000-0000-4000-8000-000000000001'::uuid, 'ADD-CARD'),
  ('c2000000-0000-4000-8000-000000000003'::uuid, 'ADD-VASE')
);

insert into public.order_recipients (order_id, full_name, phone, address_line1, barangay, city, province, postal_code, landmark) values
  ('c1000000-0000-4000-8000-000000000001', 'Paolo Santos',   '+639181234601', 'Unit 12B, Avalon Condominium, Cebu Business Park', 'Luz', 'Cebu City', 'Cebu', '6000', 'Across Ayala Center'),
  ('c1000000-0000-4000-8000-000000000002', 'Rosario Dela Cruz', '+639181234602', 'Room 304, Chong Hua Hospital Mandaue', 'Centro', 'Mandaue City', 'Cebu', '6014', 'Ask for the nurses'' station'),
  ('c1000000-0000-4000-8000-000000000003', 'Ana Reyes',      '+639171234503', '45 Gorordo Avenue', 'Lahug', 'Cebu City', 'Cebu', '6000', 'Beside the bakery'),
  ('c1000000-0000-4000-8000-000000000004', 'Daniel Uy',      '+639181234604', '3F, Mactan Marina Mall', 'Ibo', 'Lapu-Lapu City', 'Cebu', '6015', null);

-- Payments -------------------------------------------------------------------
insert into public.payments (id, order_id, idempotency_key, provider, method, provider_payment_id, amount_centavos, status, paid_at, provider_data) values
  ('c3000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'seed-pay-0001', 'paymongo', 'gcash', 'pi_seed_0001', 263900, 'paid', now() - interval '4 days', '{"source":"seed"}'),
  ('c3000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000002', 'seed-pay-0002', 'paymongo', 'card',  'pi_seed_0002', 79900,  'paid', now() - interval '17 hours', '{"source":"seed","card_last4":"4242"}'),
  ('c3000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000004', 'seed-pay-0004', 'paymongo', 'gcash', 'pi_seed_0004', 208900, 'refunded', now() - interval '2 days', '{"source":"seed"}');

insert into public.payments (id, order_id, idempotency_key, provider, method, provider_reference, amount_centavos, status, expires_at) values
  ('c3000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000003', 'seed-pay-0003', 'bank_transfer', 'bank_transfer', null, 409900, 'pending', now() + interval '24 hours');

insert into public.payment_events (provider, provider_event_id, event_type, payment_id, signature_verified, payload, processed_at) values
  ('paymongo', 'evt_seed_0001', 'payment.paid', 'c3000000-0000-4000-8000-000000000001', true, '{"data":{"id":"evt_seed_0001","attributes":{"type":"payment.paid"}}}', now() - interval '4 days'),
  ('paymongo', 'evt_seed_0002', 'payment.paid', 'c3000000-0000-4000-8000-000000000002', true, '{"data":{"id":"evt_seed_0002","attributes":{"type":"payment.paid"}}}', now() - interval '17 hours'),
  ('paymongo', 'evt_seed_0004', 'payment.paid', 'c3000000-0000-4000-8000-000000000004', true, '{"data":{"id":"evt_seed_0004","attributes":{"type":"payment.paid"}}}', now() - interval '2 days');

insert into public.refunds (payment_id, idempotency_key, provider_refund_id, amount_centavos, reason, status, requested_by, processed_at) values
  ('c3000000-0000-4000-8000-000000000004', 'seed-refund-0004', 'ref_seed_0004', 208900, 'Customer cancelled before preparation.', 'succeeded', 'a0000000-0000-4000-8000-000000000002', now() - interval '1 day');

-- Stock: reserve for the pending order, consume for the preparing one.
select public.reserve_stock('order', 'c1000000-0000-4000-8000-000000000003', 'seed-checkout-0003',
  '[{"variant_id":"20000000-0000-4000-8000-000000000013","quantity":1}]'::jsonb, now() + interval '30 minutes');
select public.reserve_stock('order', 'c1000000-0000-4000-8000-000000000002', 'seed-checkout-0002',
  '[{"variant_id":"20000000-0000-4000-8000-000000000003","quantity":1}]'::jsonb, now() + interval '1 day');
select public.consume_stock_reservations('order', 'c1000000-0000-4000-8000-000000000002');

-- Delivery capacity for the two live orders.
update public.orders set delivery_slot_allocation_id = public.reserve_delivery_slot('80000000-0000-4000-8000-000000000001', current_date)
  where id = 'c1000000-0000-4000-8000-000000000002';
update public.orders set delivery_slot_allocation_id = public.reserve_delivery_slot('80000000-0000-4000-8000-000000000001', current_date + 1)
  where id = 'c1000000-0000-4000-8000-000000000003';

insert into public.notifications (order_id, customer_id, channel, template, recipient, subject, status, sent_at) values
  ('c1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'email', 'order.confirmed', 'maria.santos@example.com', 'Your Floriana order FL-10001 is confirmed', 'sent', now() - interval '4 days'),
  ('c1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'email', 'order.delivered', 'maria.santos@example.com', 'Delivered: FL-10001', 'sent', now() - interval '3 days'),
  ('c1000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'email', 'order.confirmed', 'jose.delacruz@example.com', 'Your Floriana order FL-10002 is confirmed', 'sent', now() - interval '17 hours'),
  ('c1000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000003', 'email', 'payment.instructions', 'ana.reyes@example.com', 'How to pay for FL-10003', 'queued', null);
