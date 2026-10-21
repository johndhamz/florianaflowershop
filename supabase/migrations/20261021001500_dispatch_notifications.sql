-- ============================================================================
-- 1500 · Delivery dispatch & notifications
--   dispatch state machine, rider scoping, proof of delivery, exceptions with
--   authorized retry/reschedule, zone/slot admin helpers, notification outbox
--   with deduplication and retry.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Schema additions
-- ---------------------------------------------------------------------------
create type public.delivery_exception as enum ('recipient_unavailable', 'wrong_address', 'refused', 'weather', 'vehicle', 'other');

alter table public.orders
  add column dispatched_at timestamptz,
  add column delivered_at timestamptz,
  add column delivery_failed_at timestamptz,
  add column delivery_attempts integer not null default 0 check (delivery_attempts >= 0),
  add column rider_assigned_at timestamptz,
  add column rider_assigned_by uuid references auth.users (id) on delete set null;

create table public.delivery_events (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders (id) on delete cascade,
  event_type      text not null check (event_type in ('assigned', 'unassigned', 'out_for_delivery', 'delivered', 'failed', 'retry_authorized', 'rescheduled')),
  rider_id        uuid references public.staff_profiles (user_id) on delete set null,
  actor_id        uuid references auth.users (id) on delete set null,
  exception       public.delivery_exception,
  note            text,
  proof_photo_path text,
  received_by     text,
  latitude        numeric(9,6),
  longitude       numeric(9,6),
  created_at      timestamptz not null default now()
);
create index delivery_events_order_idx on public.delivery_events (order_id, created_at desc);
alter table public.delivery_events enable row level security;
create policy delivery_events_staff_read on public.delivery_events
  for select to authenticated using (
    app.has_role('owner', 'manager', 'support')
    or (app.has_role('rider') and exists (select 1 from public.orders o where o.id = order_id and o.assigned_rider_id = auth.uid()))
  );
revoke all on public.delivery_events from anon;
revoke insert, update, delete on public.delivery_events from authenticated;

-- Private proof-of-delivery bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('delivery-proofs', 'delivery-proofs', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
create policy "delivery proofs staff read" on storage.objects
  for select to authenticated using (bucket_id = 'delivery-proofs' and app.has_role('owner', 'manager', 'support'));
create policy "delivery proofs rider write" on storage.objects
  for insert to authenticated with check (bucket_id = 'delivery-proofs' and app.has_role('owner', 'manager', 'rider'));

-- Notification settings (SMS optional, off by default).
alter table public.business_settings
  add column sms_enabled boolean not null default false,
  add column notifications_from_email text not null default 'Floriana Flowers <orders@florianaflowers.ph>',
  add column low_stock_alert_email extensions.citext;

-- Notification outbox: one row per (order, template, channel) thanks to the dedupe key.
alter table public.notifications
  add column dedupe_key text,
  add column next_attempt_at timestamptz not null default now(),
  add column last_error text;
create unique index notifications_dedupe_key on public.notifications (dedupe_key) where dedupe_key is not null;
create index notifications_due_idx on public.notifications (next_attempt_at) where status = 'queued';

-- ---------------------------------------------------------------------------
-- Enqueue helper (idempotent). Returns the row id or null when deduped.
-- ---------------------------------------------------------------------------
create or replace function app.enqueue_notification(
  p_template text, p_channel public.notification_channel, p_recipient text, p_subject text, p_payload jsonb,
  p_dedupe_key text, p_order_id uuid default null, p_customer_id uuid default null, p_scheduled_for timestamptz default now()
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  if p_recipient is null or length(trim(p_recipient)) = 0 then return null; end if;
  insert into public.notifications (order_id, customer_id, channel, template, recipient, subject, payload, status, dedupe_key, scheduled_for, next_attempt_at)
  values (p_order_id, p_customer_id, p_channel, p_template, p_recipient, p_subject, coalesce(p_payload, '{}'::jsonb), 'queued', p_dedupe_key, p_scheduled_for, p_scheduled_for)
  on conflict (dedupe_key) where dedupe_key is not null do nothing
  returning id into v_id;
  return v_id;
end;
$$;

-- Order lifecycle notifications (email always; SMS only when enabled and a template exists).
create or replace function app.notify_order(p_order_id uuid, p_event text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_settings public.business_settings%rowtype;
  v_subject text;
  v_payload jsonb;
  v_token text;
begin
  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then return; end if;
  select * into v_settings from public.business_settings where id = 1;
  select token into v_token from public.order_access_tokens where order_id = p_order_id;

  v_subject := case p_event
    when 'order.placed' then 'We received your order ' || v_order.order_number
    when 'payment.confirmed' then 'Payment confirmed for ' || v_order.order_number
    when 'preparation.complete' then 'Your flowers are ready: ' || v_order.order_number
    when 'delivery.out' then 'Your flowers are on the way: ' || v_order.order_number
    when 'delivery.delivered' then 'Delivered: ' || v_order.order_number
    when 'delivery.failed' then 'We could not complete your delivery: ' || v_order.order_number
    else p_event end;
  v_payload := jsonb_build_object(
    'order_number', v_order.order_number, 'customer_name', v_order.customer_name, 'total_centavos', v_order.total_centavos,
    'delivery_date', v_order.delivery_date, 'delivery_slot', v_order.delivery_slot_snapshot ->> 'label',
    'tracking_path', '/orders/' || v_order.order_number || '?t=' || coalesce(v_token, ''),
    'payment_method', v_order.metadata ->> 'payment_method', 'event', p_event
  );

  perform app.enqueue_notification(p_event, 'email', v_order.customer_email::text, v_subject, v_payload, 'order:' || p_order_id::text || ':' || p_event || ':email', p_order_id, v_order.customer_id);
  if v_settings.sms_enabled and p_event in ('delivery.out', 'delivery.delivered', 'delivery.failed') then
    perform app.enqueue_notification(p_event, 'sms', v_order.customer_phone, null, v_payload, 'order:' || p_order_id::text || ':' || p_event || ':sms', p_order_id, v_order.customer_id);
  end if;
end;
$$;

-- Hook existing transitions ----------------------------------------------
-- order placed → from place_order; payment confirmed → mark_order_paid (replace its ad-hoc insert).
create or replace function app.orders_notify_on_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform app.notify_order(new.id, 'order.placed');
    return new;
  end if;
  if new.payment_status = 'paid' and old.payment_status is distinct from 'paid' then perform app.notify_order(new.id, 'payment.confirmed'); end if;
  if new.fulfillment_status = 'ready' and old.fulfillment_status is distinct from 'ready' then perform app.notify_order(new.id, 'preparation.complete'); end if;
  if new.delivery_status = 'out_for_delivery' and old.delivery_status is distinct from 'out_for_delivery' then perform app.notify_order(new.id, 'delivery.out'); end if;
  if new.delivery_status = 'delivered' and old.delivery_status is distinct from 'delivered' then perform app.notify_order(new.id, 'delivery.delivered'); end if;
  if new.delivery_status = 'failed' and old.delivery_status is distinct from 'failed' then
    -- Each failed attempt is its own message (dedupe per attempt).
    perform app.enqueue_notification('delivery.failed', 'email', new.customer_email::text, 'We could not complete your delivery: ' || new.order_number,
      jsonb_build_object('order_number', new.order_number, 'customer_name', new.customer_name, 'attempt', new.delivery_attempts, 'event', 'delivery.failed',
        'tracking_path', '/orders/' || new.order_number || '?t=' || coalesce((select token from public.order_access_tokens where order_id = new.id), '')),
      'order:' || new.id::text || ':delivery.failed:' || new.delivery_attempts::text || ':email', new.id, new.customer_id);
  end if;
  return new;
end;
$$;
create trigger orders_notify after insert or update on public.orders
  for each row execute function app.orders_notify_on_change();


-- ---------------------------------------------------------------------------
-- Dispatch state machine
-- ---------------------------------------------------------------------------
create or replace function public.assign_rider(p_order_id uuid, p_rider_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_order public.orders%rowtype;
begin
  perform app.assert_staff('owner', 'manager');
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then perform app.raise('ORDER_NOT_FOUND', 'Order not found.'); end if;
  if v_order.status <> 'confirmed' then perform app.raise('NOT_DISPATCHABLE', 'Only confirmed orders can be assigned.'); end if;
  if v_order.delivery_status in ('delivered', 'cancelled') then perform app.raise('NOT_DISPATCHABLE', 'This delivery is already closed.'); end if;
  if p_rider_id is not null and not exists (select 1 from public.staff_profiles where user_id = p_rider_id and role = 'rider' and is_active) then
    perform app.raise('INVALID_RIDER', 'Choose an active rider.');
  end if;
  perform app.begin_trusted();
  update public.orders
    set assigned_rider_id = p_rider_id, rider_assigned_at = case when p_rider_id is null then null else now() end, rider_assigned_by = auth.uid(),
        delivery_status = case when p_rider_id is null and delivery_status = 'scheduled' then 'pending'::public.delivery_status
                               when p_rider_id is not null and delivery_status = 'pending' then 'scheduled'::public.delivery_status
                               else delivery_status end
    where id = p_order_id;
  insert into public.delivery_events (order_id, event_type, rider_id, actor_id) values (p_order_id, case when p_rider_id is null then 'unassigned' else 'assigned' end, p_rider_id, auth.uid());
  perform app.end_trusted();
  return jsonb_build_object('order_id', p_order_id, 'assigned_rider_id', p_rider_id);
end;
$$;

create or replace function public.start_delivery(p_order_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_order public.orders%rowtype;
begin
  perform app.assert_staff('owner', 'manager', 'rider');
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then perform app.raise('ORDER_NOT_FOUND', 'Order not found.'); end if;
  if app.has_role('rider') and v_order.assigned_rider_id is distinct from auth.uid() then perform app.raise('FORBIDDEN', 'This delivery is not assigned to you.'); end if;
  if v_order.assigned_rider_id is null then perform app.raise('NO_RIDER', 'Assign a rider first.'); end if;
  if v_order.fulfillment_status not in ('ready', 'fulfilled') then perform app.raise('NOT_READY', 'The order is not ready for dispatch yet.'); end if;
  if v_order.delivery_status not in ('scheduled', 'pending') then perform app.raise('INVALID_TRANSITION', 'This delivery cannot be started from its current state.'); end if;
  perform app.begin_trusted();
  update public.orders set delivery_status = 'out_for_delivery', dispatched_at = now(), delivery_attempts = delivery_attempts + 1, fulfillment_status = 'fulfilled' where id = p_order_id;
  insert into public.delivery_events (order_id, event_type, rider_id, actor_id) values (p_order_id, 'out_for_delivery', v_order.assigned_rider_id, auth.uid());
  perform app.end_trusted();
  return jsonb_build_object('order_id', p_order_id, 'delivery_status', 'out_for_delivery', 'attempt', v_order.delivery_attempts + 1);
end;
$$;

create or replace function public.complete_delivery(p_order_id uuid, p_proof_photo_path text, p_received_by text default null, p_note text default null, p_latitude numeric default null, p_longitude numeric default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_order public.orders%rowtype;
begin
  perform app.assert_staff('owner', 'manager', 'rider');
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then perform app.raise('ORDER_NOT_FOUND', 'Order not found.'); end if;
  if app.has_role('rider') and v_order.assigned_rider_id is distinct from auth.uid() then perform app.raise('FORBIDDEN', 'This delivery is not assigned to you.'); end if;
  if v_order.delivery_status <> 'out_for_delivery' then perform app.raise('INVALID_TRANSITION', 'Only deliveries that are out for delivery can be completed.'); end if;
  if p_proof_photo_path is null or p_proof_photo_path !~ ('^orders/' || p_order_id::text || '/') then perform app.raise('PROOF_REQUIRED', 'Attach a proof-of-delivery photo.'); end if;
  perform app.begin_trusted();
  update public.orders set delivery_status = 'delivered', delivered_at = now(), status = 'completed', completed_at = coalesce(completed_at, now()) where id = p_order_id;
  insert into public.delivery_events (order_id, event_type, rider_id, actor_id, note, proof_photo_path, received_by, latitude, longitude)
  values (p_order_id, 'delivered', v_order.assigned_rider_id, auth.uid(), p_note, p_proof_photo_path, p_received_by, p_latitude, p_longitude);
  perform app.end_trusted();
  return jsonb_build_object('order_id', p_order_id, 'delivery_status', 'delivered');
end;
$$;

create or replace function public.fail_delivery(p_order_id uuid, p_exception public.delivery_exception, p_note text, p_photo_path text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_order public.orders%rowtype;
begin
  perform app.assert_staff('owner', 'manager', 'rider');
  if coalesce(length(trim(p_note)), 0) < 5 then perform app.raise('NOTE_REQUIRED', 'Describe what happened (at least a few words).'); end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then perform app.raise('ORDER_NOT_FOUND', 'Order not found.'); end if;
  if app.has_role('rider') and v_order.assigned_rider_id is distinct from auth.uid() then perform app.raise('FORBIDDEN', 'This delivery is not assigned to you.'); end if;
  if v_order.delivery_status <> 'out_for_delivery' then perform app.raise('INVALID_TRANSITION', 'Only deliveries that are out for delivery can be marked failed.'); end if;
  perform app.begin_trusted();
  update public.orders set delivery_status = 'failed', delivery_failed_at = now(), metadata = metadata || jsonb_build_object('needs_attention', true, 'delivery_exception', p_exception::text) where id = p_order_id;
  insert into public.delivery_events (order_id, event_type, rider_id, actor_id, exception, note, proof_photo_path)
  values (p_order_id, 'failed', v_order.assigned_rider_id, auth.uid(), p_exception, p_note, p_photo_path);
  perform app.end_trusted();
  return jsonb_build_object('order_id', p_order_id, 'delivery_status', 'failed', 'attempt', v_order.delivery_attempts);
end;
$$;

-- Retry (same day, same rider) or reschedule (new date/slot): managers only.
create or replace function public.authorize_delivery_retry(p_order_id uuid, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_order public.orders%rowtype;
begin
  perform app.assert_staff('owner', 'manager');
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then perform app.raise('ORDER_NOT_FOUND', 'Order not found.'); end if;
  if v_order.delivery_status <> 'failed' then perform app.raise('INVALID_TRANSITION', 'Only failed deliveries can be retried.'); end if;
  perform app.begin_trusted();
  update public.orders set delivery_status = case when assigned_rider_id is null then 'pending'::public.delivery_status else 'scheduled'::public.delivery_status end,
    metadata = metadata - 'needs_attention' - 'delivery_exception' where id = p_order_id;
  insert into public.delivery_events (order_id, event_type, rider_id, actor_id, note) values (p_order_id, 'retry_authorized', v_order.assigned_rider_id, auth.uid(), p_note);
  perform app.end_trusted();
  return jsonb_build_object('order_id', p_order_id, 'delivery_status', 'scheduled');
end;
$$;

create or replace function public.reschedule_delivery(p_order_id uuid, p_delivery_date date, p_slot_id uuid, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_slot public.delivery_slots%rowtype;
  v_alloc uuid;
begin
  perform app.assert_staff('owner', 'manager');
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then perform app.raise('ORDER_NOT_FOUND', 'Order not found.'); end if;
  if v_order.status <> 'confirmed' or v_order.delivery_status in ('delivered', 'cancelled') then perform app.raise('INVALID_TRANSITION', 'This order cannot be rescheduled.'); end if;
  if p_delivery_date < app.manila_today() then perform app.raise('INVALID_DATE', 'Choose today or a later date.'); end if;
  select * into v_slot from public.delivery_slots where id = p_slot_id and is_active;
  if v_slot.id is null then perform app.raise('INVALID_SLOT', 'Choose a delivery slot.'); end if;
  if not exists (
    select 1 from jsonb_array_elements(public.list_delivery_options(v_order.delivery_zone_id, p_delivery_date) -> 'slots') s
    where (s ->> 'slot_id')::uuid = p_slot_id and (s ->> 'available')::boolean
  ) then perform app.raise('SLOT_UNAVAILABLE', 'That slot has no capacity on the chosen date.'); end if;

  perform app.begin_trusted();
  v_alloc := app.reserve_delivery_slot(p_slot_id, p_delivery_date);
  if v_order.delivery_slot_allocation_id is not null then perform app.release_delivery_slot(v_order.delivery_slot_allocation_id); end if;
  update public.orders
    set delivery_date = p_delivery_date, delivery_slot_allocation_id = v_alloc,
        delivery_slot_snapshot = jsonb_build_object('slot_id', v_slot.id, 'label', v_slot.label, 'starts_at', v_slot.starts_at, 'ends_at', v_slot.ends_at),
        delivery_status = case when assigned_rider_id is null then 'pending'::public.delivery_status else 'scheduled'::public.delivery_status end,
        metadata = metadata - 'needs_attention' - 'delivery_exception'
    where id = p_order_id;
  insert into public.delivery_events (order_id, event_type, rider_id, actor_id, note) values (p_order_id, 'rescheduled', v_order.assigned_rider_id, auth.uid(), coalesce(p_note, '') || ' → ' || p_delivery_date::text || ' ' || v_slot.label);
  perform app.end_trusted();
  return jsonb_build_object('order_id', p_order_id, 'delivery_date', p_delivery_date, 'slot', v_slot.label);
end;
$$;

-- ---------------------------------------------------------------------------
-- Dispatch board (managers/support) and rider view (assigned only).
-- Exact addresses are returned only to the assigned rider or admins.
-- ---------------------------------------------------------------------------
create or replace function public.dispatch_board(p_date date default null)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select case when app.has_role('owner', 'manager', 'support') then coalesce(jsonb_agg(row_to_json(q)::jsonb order by q.delivery_date, q.slot_starts_at nulls last, q.order_number), '[]'::jsonb) end
  from (
    select o.id as order_id, o.order_number, o.delivery_date, o.delivery_slot_snapshot ->> 'label' as slot_label,
           (o.delivery_slot_snapshot ->> 'starts_at')::time as slot_starts_at, o.delivery_zone_snapshot ->> 'name' as zone_name,
           o.fulfillment_status, o.delivery_status, o.delivery_attempts, o.assigned_rider_id, sp.display_name as rider_name,
           o.metadata ->> 'delivery_exception' as exception, (o.metadata ->> 'needs_attention')::boolean as needs_attention,
           r.full_name as recipient_name, r.barangay, r.city,
           case when app.is_admin() then r.address_line1 || coalesce(', ' || r.address_line2, '') end as address_line1,
           case when app.is_admin() then r.phone end as recipient_phone,
           (select count(*) from public.order_items oi where oi.order_id = o.id) as item_count, o.delivery_instructions
    from public.orders o
    left join public.order_recipients r on r.order_id = o.id
    left join public.staff_profiles sp on sp.user_id = o.assigned_rider_id
    where o.status in ('confirmed', 'completed')
      and (o.delivery_date = coalesce(p_date, o.delivery_date))
      and (p_date is not null or o.delivery_status not in ('delivered', 'cancelled'))
  ) q;
$$;

create or replace function public.rider_deliveries(p_include_done boolean default false)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select case when app.has_role('rider', 'owner', 'manager') then coalesce(jsonb_agg(row_to_json(q)::jsonb order by q.delivery_date, q.slot_starts_at nulls last, q.order_number), '[]'::jsonb) end
  from (
    select o.id as order_id, o.order_number, o.delivery_date, o.delivery_slot_snapshot ->> 'label' as slot_label,
           (o.delivery_slot_snapshot ->> 'starts_at')::time as slot_starts_at, o.delivery_zone_snapshot ->> 'name' as zone_name,
           o.fulfillment_status, o.delivery_status, o.delivery_attempts, o.delivery_instructions, o.gift_message is not null as has_card,
           r.full_name as recipient_name, r.phone as recipient_phone,
           r.address_line1 || coalesce(', ' || r.address_line2, '') as address, r.barangay, r.city, r.landmark,
           (select jsonb_agg(jsonb_build_object('product_name', oi.product_name, 'quantity', oi.quantity)) from public.order_items oi where oi.order_id = o.id) as items,
           (select jsonb_agg(jsonb_build_object('type', e.event_type, 'note', e.note, 'exception', e.exception, 'at', e.created_at) order by e.created_at) from public.delivery_events e where e.order_id = o.id) as events
    from public.orders o
    left join public.order_recipients r on r.order_id = o.id
    where o.assigned_rider_id = auth.uid()
      and o.status in ('confirmed', 'completed')
      -- Active assignments always show; finished ones only around today.
      and (o.delivery_status in ('scheduled', 'out_for_delivery', 'failed')
           or (p_include_done and o.delivery_date between app.manila_today() - 1 and app.manila_today() + 1))
  ) q;
$$;

-- ---------------------------------------------------------------------------
-- Slot capacity overrides (per date) for admins.
-- ---------------------------------------------------------------------------
create or replace function public.set_slot_capacity(p_slot_id uuid, p_delivery_date date, p_capacity integer, p_blocked boolean default false)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_alloc public.delivery_slot_allocations%rowtype;
begin
  perform app.assert_staff('owner', 'manager');
  if p_capacity < 0 then perform app.raise('INVALID_CAPACITY', 'Capacity cannot be negative.'); end if;
  select * into v_alloc from public.delivery_slot_allocations where slot_id = p_slot_id and delivery_date = p_delivery_date for update;
  if v_alloc.id is not null and v_alloc.booked > p_capacity then
    perform app.raise('BELOW_BOOKED', format('%s deliveries are already booked in this slot.', v_alloc.booked));
  end if;
  insert into public.delivery_slot_allocations (slot_id, delivery_date, capacity, is_blocked)
  values (p_slot_id, p_delivery_date, p_capacity, p_blocked)
  on conflict (slot_id, delivery_date) do update set capacity = excluded.capacity, is_blocked = excluded.is_blocked
  returning * into v_alloc;
  if v_alloc.booked > v_alloc.capacity then perform app.raise('BELOW_BOOKED', format('%s deliveries are already booked in this slot.', v_alloc.booked)); end if;
  return to_jsonb(v_alloc);
end;
$$;

-- Low-stock digest (daily): one email per day to the configured address.
create or replace function public.enqueue_low_stock_digest()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_settings public.business_settings%rowtype;
  v_items jsonb;
  v_count integer;
begin
  perform app.assert_staff();
  select * into v_settings from public.business_settings where id = 1;
  if v_settings.low_stock_alert_email is null then return 0; end if;
  select coalesce(jsonb_agg(jsonb_build_object('name', name, 'sku', sku, 'available', available, 'threshold', low_stock_threshold, 'unit', unit) order by available), '[]'::jsonb), count(*)
  into v_items, v_count
  from public.material_stock_levels where is_active and is_low;
  if v_count = 0 then return 0; end if;
  perform app.enqueue_notification('inventory.low_stock', 'email', v_settings.low_stock_alert_email::text,
    format('%s material%s low on stock', v_count, case when v_count = 1 then ' is' else 's are' end),
    jsonb_build_object('items', v_items, 'count', v_count), 'low_stock:' || app.manila_today()::text);
  return v_count;
end;
$$;

-- Outbox processing helpers used by the job runner.
create or replace function public.claim_due_notifications(p_limit integer default 25)
returns setof public.notifications
language plpgsql security definer set search_path = ''
as $$
begin
  perform app.assert_staff();
  return query
    update public.notifications n set attempts = attempts + 1, next_attempt_at = now() + interval '10 minutes'
    where n.id in (
      select id from public.notifications where status = 'queued' and next_attempt_at <= now() order by next_attempt_at limit greatest(p_limit, 1) for update skip locked
    )
    returning n.*;
end;
$$;

create or replace function public.mark_notification_result(p_id uuid, p_ok boolean, p_provider text default null, p_provider_message_id text default null, p_error text default null, p_max_attempts integer default 5)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_attempts integer;
begin
  perform app.assert_staff();
  select attempts into v_attempts from public.notifications where id = p_id;
  if p_ok then
    update public.notifications set status = 'sent', sent_at = now(), provider = p_provider, provider_message_id = p_provider_message_id, last_error = null where id = p_id;
  elsif v_attempts >= p_max_attempts then
    update public.notifications set status = 'failed', last_error = p_error, error = p_error where id = p_id;
  else
    -- Exponential backoff: 1, 2, 4, 8… minutes.
    update public.notifications set status = 'queued', last_error = p_error, next_attempt_at = now() + make_interval(mins => power(2, v_attempts)::integer) where id = p_id;
  end if;
end;
$$;

-- Zones: barangay list validation + admin CRUD stays on the table (RLS admin).
-- Grants
revoke all on function public.assign_rider(uuid, uuid), public.start_delivery(uuid), public.complete_delivery(uuid, text, text, text, numeric, numeric),
  public.fail_delivery(uuid, public.delivery_exception, text, text), public.authorize_delivery_retry(uuid, text), public.reschedule_delivery(uuid, date, uuid, text),
  public.dispatch_board(date), public.rider_deliveries(boolean), public.set_slot_capacity(uuid, date, integer, boolean), public.enqueue_low_stock_digest(),
  public.claim_due_notifications(integer), public.mark_notification_result(uuid, boolean, text, text, text, integer) from anon;

-- Backfill: existing seed orders get no retroactive notifications.
