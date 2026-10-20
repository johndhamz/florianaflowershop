-- ============================================================================
-- 1400 · Inventory operations & florist preparation
--   receiving, wastage, adjustments, substitutions, preparation lifecycle with
--   actual consumption, eligible-cancellation release, stock levels, upcoming
--   requirements, reconciliation. Florist access narrowed (no customer PII).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Schema additions
-- ---------------------------------------------------------------------------
alter table public.orders
  add column prepared_by uuid references public.staff_profiles (user_id) on delete set null,
  add column preparation_started_at timestamptz,
  add column ready_at timestamptz,
  add column arrangement_photo_path text;
create index orders_prep_queue_idx on public.orders (delivery_date, fulfillment_status)
  where status = 'confirmed' and fulfillment_status in ('unfulfilled', 'preparing');

-- Wastage reasons live on the movement.
alter table public.stock_movements
  add column wastage_reason text check (wastage_reason is null or wastage_reason in ('damaged', 'expired', 'wilted', 'lost', 'other'));

-- Substitutions: swap a recipe material for another on a specific order.
create type public.substitution_status as enum ('applied', 'approved', 'rejected');
create table public.order_substitutions (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references public.orders (id) on delete cascade,
  from_material_id   uuid not null references public.materials (id) on delete restrict,
  to_material_id     uuid not null references public.materials (id) on delete restrict,
  quantity           numeric(12,3) not null check (quantity > 0),
  reason             text not null check (length(reason) between 1 and 300),
  status             public.substitution_status not null default 'applied',
  requested_by       uuid references auth.users (id) on delete set null,
  reviewed_by        uuid references auth.users (id) on delete set null,
  reviewed_at        timestamptz,
  review_note        text,
  created_at         timestamptz not null default now(),
  constraint order_substitutions_distinct check (from_material_id <> to_material_id)
);
create index order_substitutions_order_idx on public.order_substitutions (order_id);
create index order_substitutions_pending_idx on public.order_substitutions (created_at) where status = 'applied';
alter table public.order_substitutions enable row level security;
create policy order_substitutions_staff_read on public.order_substitutions
  for select to authenticated using (app.has_role('owner', 'manager', 'florist'));
revoke all on public.order_substitutions from anon;
revoke insert, update, delete on public.order_substitutions from authenticated;
create trigger order_substitutions_audit after insert or update on public.order_substitutions
  for each row execute function app.audit_row();

-- Arrangement photos: private bucket, staff only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('arrangement-photos', 'arrangement-photos', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
create policy "arrangement photos staff read" on storage.objects
  for select to authenticated using (bucket_id = 'arrangement-photos' and app.is_staff());
create policy "arrangement photos florist write" on storage.objects
  for insert to authenticated with check (bucket_id = 'arrangement-photos' and app.has_role('owner', 'manager', 'florist'));

-- ---------------------------------------------------------------------------
-- Security: florists prepare orders but must not browse customer records or
-- payments. Replace the customers read policy without the florist role.
-- ---------------------------------------------------------------------------
drop policy customers_staff_read on public.customers;
create policy customers_staff_read on public.customers
  for select to authenticated using (app.has_role('owner', 'manager', 'support') or user_id = auth.uid());

-- Florists may create/adjust batches only through the functions below.
drop policy stock_batches_inventory_write on public.stock_batches;
drop policy stock_batches_inventory_update on public.stock_batches;
create policy stock_batches_admin_write on public.stock_batches
  for insert to authenticated with check (app.is_admin());
create policy stock_batches_admin_update on public.stock_batches
  for update to authenticated using (app.is_admin()) with check (app.is_admin());
drop policy stock_movements_inventory_insert on public.stock_movements;
-- Movements are written only by functions (journal integrity).
revoke insert, update, delete on public.stock_movements from authenticated;

-- ---------------------------------------------------------------------------
-- Trusted updates: SECURITY DEFINER workflow functions below set a
-- transaction-local flag so the per-column staff guard lets them through.
-- Florists may also touch the preparation columns directly.
-- ---------------------------------------------------------------------------
create or replace function app.orders_guard_staff_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.staff_role := app.current_staff_role();
  v_api_role text := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
  );
  v_prep text[] := array['fulfillment_status', 'internal_notes', 'prepared_by', 'preparation_started_at', 'ready_at', 'arrangement_photo_path', 'updated_at'];
begin
  if current_setting('app.trusted', true) = 'on' then return new; end if;
  if v_api_role is null or v_api_role = 'service_role' or v_role in ('owner', 'manager') then
    return new;
  end if;

  if v_role = 'rider' then
    if new.delivery_status is distinct from old.delivery_status
       and to_jsonb(new) - 'delivery_status' - 'updated_at' = to_jsonb(old) - 'delivery_status' - 'updated_at' then
      return new;
    end if;
    perform app.raise('FORBIDDEN', 'Riders may only update delivery_status.');
  elsif v_role = 'florist' then
    if to_jsonb(new) - v_prep = to_jsonb(old) - v_prep then
      return new;
    end if;
    perform app.raise('FORBIDDEN', 'Florists may only update preparation columns.');
  elsif v_role = 'support' then
    if to_jsonb(new) - 'internal_notes' - 'status' - 'cancelled_at' - 'cancellation_reason' - 'updated_at'
       = to_jsonb(old) - 'internal_notes' - 'status' - 'cancelled_at' - 'cancellation_reason' - 'updated_at' then
      return new;
    end if;
    perform app.raise('FORBIDDEN', 'Support may only update notes and cancel orders.');
  end if;

  perform app.raise('FORBIDDEN', 'Not allowed.');
  return null;
end;
$$;

create or replace function app.begin_trusted() returns void language sql as $$ select set_config('app.trusted', 'on', true); $$;
create or replace function app.end_trusted() returns void language sql as $$ select set_config('app.trusted', 'off', true); $$;

-- ---------------------------------------------------------------------------
-- Receiving
-- ---------------------------------------------------------------------------
create or replace function public.receive_stock(
  p_material_id uuid, p_quantity numeric, p_unit_cost_centavos integer,
  p_batch_code text default null, p_supplier_id uuid default null,
  p_received_at timestamptz default now(), p_expires_at timestamptz default null, p_notes text default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_material public.materials%rowtype;
  v_batch public.stock_batches%rowtype;
  v_code text;
  v_expires timestamptz;
begin
  perform app.assert_staff('owner', 'manager', 'florist');
  select * into v_material from public.materials where id = p_material_id and is_active;
  if v_material.id is null then perform app.raise('MATERIAL_NOT_FOUND', 'Material not found.'); end if;
  if p_quantity is null or p_quantity <= 0 then perform app.raise('INVALID_QUANTITY', 'Quantity must be greater than zero.'); end if;
  if p_unit_cost_centavos is null or p_unit_cost_centavos < 0 then perform app.raise('INVALID_COST', 'Unit cost cannot be negative.'); end if;

  v_code := coalesce(nullif(trim(p_batch_code), ''), 'B-' || v_material.sku || '-' || to_char(p_received_at at time zone 'Asia/Manila', 'YYMMDD-HH24MI'));
  v_expires := coalesce(p_expires_at, case when v_material.is_perishable and v_material.default_shelf_life_days is not null
                                             then p_received_at + make_interval(days => v_material.default_shelf_life_days) end);
  if v_expires is not null and v_expires <= p_received_at then perform app.raise('INVALID_EXPIRY', 'Expiry must be after the receipt date.'); end if;

  insert into public.stock_batches (material_id, supplier_id, batch_code, quantity_received, quantity_remaining, unit_cost_centavos, received_at, expires_at, notes, created_by)
  values (p_material_id, coalesce(p_supplier_id, v_material.default_supplier_id), v_code, p_quantity, p_quantity, p_unit_cost_centavos, p_received_at, v_expires, p_notes, auth.uid())
  returning * into v_batch;
  insert into public.stock_movements (batch_id, material_id, movement_type, quantity, reason, created_by)
  values (v_batch.id, p_material_id, 'receive', p_quantity, coalesce(p_notes, 'Received'), auth.uid());
  return to_jsonb(v_batch);
end;
$$;

-- ---------------------------------------------------------------------------
-- Wastage & adjustments (never below reserved; never negative)
-- ---------------------------------------------------------------------------
create or replace function public.record_wastage(p_batch_id uuid, p_quantity numeric, p_reason text, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_batch public.stock_batches%rowtype;
begin
  perform app.assert_staff('owner', 'manager', 'florist');
  if p_reason not in ('damaged', 'expired', 'wilted', 'lost', 'other') then perform app.raise('INVALID_REASON', 'Choose a wastage reason.'); end if;
  if p_quantity is null or p_quantity <= 0 then perform app.raise('INVALID_QUANTITY', 'Quantity must be greater than zero.'); end if;
  select * into v_batch from public.stock_batches where id = p_batch_id for update;
  if v_batch.id is null then perform app.raise('BATCH_NOT_FOUND', 'Batch not found.'); end if;
  if p_quantity > v_batch.quantity_remaining - v_batch.quantity_reserved then
    perform app.raise('INSUFFICIENT_AVAILABLE', format('Only %s available on this batch (the rest is reserved for orders).', v_batch.quantity_remaining - v_batch.quantity_reserved));
  end if;
  update public.stock_batches
    set quantity_remaining = quantity_remaining - p_quantity,
        status = case when quantity_remaining - p_quantity <= 0 then 'depleted'::public.stock_batch_status else status end
    where id = p_batch_id returning * into v_batch;
  insert into public.stock_movements (batch_id, material_id, movement_type, quantity, reason, wastage_reason, created_by)
  values (p_batch_id, v_batch.material_id, case when p_reason = 'expired' then 'expire'::public.stock_movement_type else 'discard'::public.stock_movement_type end, -p_quantity, p_note, p_reason, auth.uid());
  return to_jsonb(v_batch);
end;
$$;

create or replace function public.adjust_stock(p_batch_id uuid, p_delta numeric, p_reason text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_batch public.stock_batches%rowtype;
begin
  perform app.assert_staff('owner', 'manager');
  if p_delta is null or p_delta = 0 then perform app.raise('INVALID_QUANTITY', 'Adjustment cannot be zero.'); end if;
  if coalesce(length(trim(p_reason)), 0) < 3 then perform app.raise('REASON_REQUIRED', 'Give a reason for the adjustment.'); end if;
  select * into v_batch from public.stock_batches where id = p_batch_id for update;
  if v_batch.id is null then perform app.raise('BATCH_NOT_FOUND', 'Batch not found.'); end if;
  if v_batch.quantity_remaining + p_delta < v_batch.quantity_reserved then
    perform app.raise('INSUFFICIENT_AVAILABLE', 'Adjustment would go below the quantity reserved for orders.');
  end if;
  if v_batch.quantity_remaining + p_delta > v_batch.quantity_received then
    -- Counting more than received: treat as a correction to the receipt.
    update public.stock_batches set quantity_received = quantity_remaining + p_delta where id = p_batch_id;
  end if;
  update public.stock_batches
    set quantity_remaining = quantity_remaining + p_delta,
        status = case when quantity_remaining + p_delta <= 0 then 'depleted'::public.stock_batch_status
                      when status = 'depleted' then 'active'::public.stock_batch_status else status end
    where id = p_batch_id returning * into v_batch;
  insert into public.stock_movements (batch_id, material_id, movement_type, quantity, reason, created_by)
  values (p_batch_id, v_batch.material_id, 'adjust', p_delta, p_reason, auth.uid());
  return to_jsonb(v_batch);
end;
$$;

-- ---------------------------------------------------------------------------
-- Substitutions: release the original material hold and reserve the substitute
-- (FEFO). Florists apply immediately (flowers can't wait); managers review.
-- ---------------------------------------------------------------------------
create or replace function public.apply_substitution(p_order_id uuid, p_from_material_id uuid, p_to_material_id uuid, p_quantity numeric, p_reason text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_res record;
  v_left numeric := p_quantity;
  v_take numeric;
  v_sub public.order_substitutions%rowtype;
  v_is_admin boolean := app.is_admin();
begin
  perform app.assert_staff('owner', 'manager', 'florist');
  perform app.begin_trusted();
  if p_quantity is null or p_quantity <= 0 then perform app.raise('INVALID_QUANTITY', 'Quantity must be greater than zero.'); end if;
  if p_from_material_id = p_to_material_id then perform app.raise('INVALID_SUBSTITUTION', 'Choose a different material.'); end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then perform app.raise('ORDER_NOT_FOUND', 'Order not found.'); end if;
  if v_order.fulfillment_status not in ('unfulfilled', 'preparing') then perform app.raise('NOT_EDITABLE', 'This order is no longer being prepared.'); end if;

  -- Release part of the original hold.
  for v_res in
    select r.id, r.batch_id, r.quantity from public.stock_reservations r
    where r.reference_type = 'order' and r.reference_id = p_order_id and r.material_id = p_from_material_id and r.status = 'active'
    order by r.created_at for update
  loop
    exit when v_left <= 0;
    v_take := least(v_left, v_res.quantity);
    update public.stock_batches set quantity_reserved = quantity_reserved - v_take where id = v_res.batch_id;
    if v_take = v_res.quantity then
      update public.stock_reservations set status = 'released' where id = v_res.id;
    else
      update public.stock_reservations set quantity = quantity - v_take where id = v_res.id;
    end if;
    insert into public.stock_movements (batch_id, material_id, movement_type, quantity, reference_type, reference_id, reason, created_by)
    values (v_res.batch_id, p_from_material_id, 'release', v_take, 'order', p_order_id, 'substitution: ' || p_reason, auth.uid());
    v_left := v_left - v_take;
  end loop;
  if v_left > 0 then perform app.raise('NOTHING_TO_SUBSTITUTE', format('Only %s of that material is reserved for this order.', p_quantity - v_left)); end if;

  -- Reserve the substitute (FEFO, atomic; raises INSUFFICIENT_STOCK and rolls everything back).
  perform app.reserve_material('order', p_order_id, p_to_material_id, p_quantity, null);

  insert into public.order_substitutions (order_id, from_material_id, to_material_id, quantity, reason, status, requested_by, reviewed_by, reviewed_at)
  values (p_order_id, p_from_material_id, p_to_material_id, p_quantity, p_reason, case when v_is_admin then 'approved'::public.substitution_status else 'applied'::public.substitution_status end, auth.uid(),
          case when v_is_admin then auth.uid() end, case when v_is_admin then now() end)
  returning * into v_sub;
  perform app.end_trusted();
  return to_jsonb(v_sub);
end;
$$;

-- Reserve a single material (not via recipe) — used by substitutions and extra consumption.
create or replace function app.reserve_material(p_reference_type text, p_reference_id uuid, p_material_id uuid, p_quantity numeric, p_expires_at timestamptz)
returns numeric
language plpgsql security definer set search_path = ''
as $$
declare
  v_batch record;
  v_left numeric := p_quantity;
  v_take numeric;
  v_key text := p_reference_type || ':' || p_reference_id::text || ':material:' || p_material_id::text || ':' || gen_random_uuid()::text;
begin
  perform 1 from public.stock_batches b where b.material_id = p_material_id and b.status = 'active' order by b.expires_at nulls last, b.id for update;
  for v_batch in
    select b.id, (b.quantity_remaining - b.quantity_reserved) as available from public.stock_batches b
    where b.material_id = p_material_id and b.status = 'active' and (b.expires_at is null or b.expires_at > now()) and (b.quantity_remaining - b.quantity_reserved) > 0
    order by b.expires_at nulls last, b.id
  loop
    exit when v_left <= 0;
    v_take := least(v_left, v_batch.available);
    update public.stock_batches set quantity_reserved = quantity_reserved + v_take where id = v_batch.id;
    insert into public.stock_reservations (idempotency_key, reference_type, reference_id, material_id, batch_id, quantity, status, expires_at)
    values (v_key, p_reference_type, p_reference_id, p_material_id, v_batch.id, v_take, 'active', p_expires_at);
    insert into public.stock_movements (batch_id, material_id, movement_type, quantity, reference_type, reference_id, created_by)
    values (v_batch.id, p_material_id, 'reserve', -v_take, p_reference_type, p_reference_id, auth.uid());
    v_left := v_left - v_take;
  end loop;
  if v_left > 0 then
    perform app.raise('INSUFFICIENT_STOCK', format('Insufficient stock for %s: short by %s', (select name from public.materials where id = p_material_id), v_left));
  end if;
  return p_quantity;
end;
$$;

create or replace function public.review_substitution(p_substitution_id uuid, p_approve boolean, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_sub public.order_substitutions%rowtype;
begin
  perform app.assert_staff('owner', 'manager');
  update public.order_substitutions
    set status = case when p_approve then 'approved'::public.substitution_status else 'rejected'::public.substitution_status end,
        reviewed_by = auth.uid(), reviewed_at = now(), review_note = p_note
    where id = p_substitution_id returning * into v_sub;
  if v_sub.id is null then perform app.raise('NOT_FOUND', 'Substitution not found.'); end if;
  return to_jsonb(v_sub);
end;
$$;

-- ---------------------------------------------------------------------------
-- Preparation lifecycle
-- ---------------------------------------------------------------------------
create or replace function public.start_preparation(p_order_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_order public.orders%rowtype;
begin
  perform app.assert_staff('owner', 'manager', 'florist');
  perform app.begin_trusted();
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then perform app.raise('ORDER_NOT_FOUND', 'Order not found.'); end if;
  if v_order.status <> 'confirmed' or v_order.payment_status not in ('paid') then perform app.raise('NOT_READY', 'Only confirmed, paid orders can be prepared.'); end if;
  if v_order.fulfillment_status not in ('unfulfilled', 'preparing') then perform app.raise('NOT_EDITABLE', 'This order is already prepared.'); end if;
  update public.orders set fulfillment_status = 'preparing', prepared_by = coalesce(prepared_by, auth.uid()), preparation_started_at = coalesce(preparation_started_at, now())
    where id = p_order_id returning * into v_order;
  perform app.end_trusted();
  return jsonb_build_object('order_id', v_order.id, 'fulfillment_status', v_order.fulfillment_status, 'prepared_by', v_order.prepared_by);
end;
$$;

-- Complete preparation with ACTUAL consumption.
--   p_actual: [{"material_id": uuid, "quantity": numeric}] — everything used,
--   including extras. Reserved-but-unused stock is released; extras beyond the
--   hold are consumed from available FEFO batches (never below zero).
create or replace function public.complete_preparation(p_order_id uuid, p_actual jsonb, p_photo_path text default null, p_notes text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_line record;
  v_res record;
  v_need numeric;
  v_take numeric;
  v_batch record;
  v_consumed jsonb := '[]'::jsonb;
  v_actual_total numeric;
begin
  perform app.assert_staff('owner', 'manager', 'florist');
  perform app.begin_trusted();
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then perform app.raise('ORDER_NOT_FOUND', 'Order not found.'); end if;
  if v_order.fulfillment_status not in ('unfulfilled', 'preparing') then perform app.raise('NOT_EDITABLE', 'This order is already prepared.'); end if;
  if v_order.status <> 'confirmed' then perform app.raise('NOT_READY', 'Only confirmed orders can be completed.'); end if;
  if p_actual is null or jsonb_typeof(p_actual) <> 'array' then perform app.raise('INVALID_INPUT', 'Actual consumption must be a list.'); end if;

  -- Lock all batches involved (reserved + candidate) in a stable order.
  perform 1 from public.stock_batches b
  where b.material_id in (select (e ->> 'material_id')::uuid from jsonb_array_elements(p_actual) e)
     or b.id in (select batch_id from public.stock_reservations where reference_type = 'order' and reference_id = p_order_id and status = 'active')
  order by b.material_id, b.expires_at nulls last, b.id for update;

  -- 1) Materials listed in actual consumption.
  for v_line in
    select (e ->> 'material_id')::uuid as material_id, sum((e ->> 'quantity')::numeric) as quantity
    from jsonb_array_elements(p_actual) e group by 1 order by 1
  loop
    if v_line.quantity is null or v_line.quantity < 0 then perform app.raise('INVALID_QUANTITY', 'Quantities cannot be negative.'); end if;
    v_need := v_line.quantity;

    -- Consume from this order's reservations first.
    for v_res in
      select r.id, r.batch_id, r.quantity from public.stock_reservations r
      where r.reference_type = 'order' and r.reference_id = p_order_id and r.material_id = v_line.material_id and r.status = 'active'
      order by r.created_at for update
    loop
      v_take := least(v_need, v_res.quantity);
      if v_take > 0 then
        update public.stock_batches set quantity_reserved = quantity_reserved - v_take, quantity_remaining = quantity_remaining - v_take where id = v_res.batch_id;
        insert into public.stock_movements (batch_id, material_id, movement_type, quantity, reference_type, reference_id, reason, created_by)
        values (v_res.batch_id, v_line.material_id, 'consume', -v_take, 'order', p_order_id, 'preparation', auth.uid());
      end if;
      if v_res.quantity - v_take > 0 then
        -- Unused remainder of this reservation goes back to available.
        update public.stock_batches set quantity_reserved = quantity_reserved - (v_res.quantity - v_take) where id = v_res.batch_id;
        insert into public.stock_movements (batch_id, material_id, movement_type, quantity, reference_type, reference_id, reason, created_by)
        values (v_res.batch_id, v_line.material_id, 'release', v_res.quantity - v_take, 'order', p_order_id, 'unused after preparation', auth.uid());
      end if;
      update public.stock_reservations set status = 'consumed', quantity = v_take where id = v_res.id;
      v_need := v_need - v_take;
    end loop;

    -- Extra beyond the hold: take from available FEFO stock.
    if v_need > 0 then
      for v_batch in
        select b.id, (b.quantity_remaining - b.quantity_reserved) as available from public.stock_batches b
        where b.material_id = v_line.material_id and b.status = 'active' and (b.expires_at is null or b.expires_at > now()) and (b.quantity_remaining - b.quantity_reserved) > 0
        order by b.expires_at nulls last, b.id
      loop
        exit when v_need <= 0;
        v_take := least(v_need, v_batch.available);
        update public.stock_batches set quantity_remaining = quantity_remaining - v_take where id = v_batch.id;
        insert into public.stock_movements (batch_id, material_id, movement_type, quantity, reference_type, reference_id, reason, created_by)
        values (v_batch.id, v_line.material_id, 'consume', -v_take, 'order', p_order_id, 'preparation (extra)', auth.uid());
        v_need := v_need - v_take;
      end loop;
      if v_need > 0 then
        perform app.raise('INSUFFICIENT_STOCK', format('Not enough %s available to record that consumption (short by %s).', (select name from public.materials where id = v_line.material_id), v_need));
      end if;
    end if;
    v_consumed := v_consumed || jsonb_build_object('material_id', v_line.material_id, 'quantity', v_line.quantity);
  end loop;

  -- 2) Reserved materials not mentioned at all: release them.
  for v_res in
    select r.id, r.batch_id, r.material_id, r.quantity from public.stock_reservations r
    where r.reference_type = 'order' and r.reference_id = p_order_id and r.status = 'active' for update
  loop
    update public.stock_batches set quantity_reserved = quantity_reserved - v_res.quantity where id = v_res.batch_id;
    update public.stock_reservations set status = 'released' where id = v_res.id;
    insert into public.stock_movements (batch_id, material_id, movement_type, quantity, reference_type, reference_id, reason, created_by)
    values (v_res.batch_id, v_res.material_id, 'release', v_res.quantity, 'order', p_order_id, 'not used in preparation', auth.uid());
  end loop;

  update public.stock_batches set status = 'depleted' where quantity_remaining <= 0 and status = 'active';

  update public.orders
    set fulfillment_status = 'ready', ready_at = now(), prepared_by = coalesce(prepared_by, auth.uid()),
        preparation_started_at = coalesce(preparation_started_at, now()),
        arrangement_photo_path = coalesce(p_photo_path, arrangement_photo_path),
        internal_notes = case when p_notes is not null then concat_ws(E'\n', internal_notes, 'Prep: ' || p_notes) else internal_notes end
    where id = p_order_id;

  select coalesce(sum((e ->> 'quantity')::numeric), 0) into v_actual_total from jsonb_array_elements(p_actual) e;
  perform app.end_trusted();
  return jsonb_build_object('order_id', p_order_id, 'fulfillment_status', 'ready', 'consumed', v_consumed, 'total_units', v_actual_total);
end;
$$;

-- Eligible cancellation: release holds + slot; nothing to reclaim once consumed.
create or replace function public.cancel_order(p_order_id uuid, p_reason text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_released integer;
begin
  perform app.assert_staff('owner', 'manager', 'support');
  perform app.begin_trusted();
  if coalesce(length(trim(p_reason)), 0) < 3 then perform app.raise('REASON_REQUIRED', 'Give a cancellation reason.'); end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then perform app.raise('ORDER_NOT_FOUND', 'Order not found.'); end if;
  if v_order.status = 'cancelled' then return jsonb_build_object('order_id', p_order_id, 'already_cancelled', true); end if;
  if v_order.fulfillment_status in ('ready', 'fulfilled') and v_order.delivery_status in ('out_for_delivery', 'delivered') then
    perform app.raise('NOT_CANCELLABLE', 'This order has already left the shop.');
  end if;
  v_released := app.release_stock_reservations('order', p_order_id, 'cancelled: ' || p_reason);
  if v_order.delivery_slot_allocation_id is not null then perform app.release_delivery_slot(v_order.delivery_slot_allocation_id); end if;
  update public.orders
    set status = 'cancelled', cancelled_at = now(), cancellation_reason = p_reason,
        fulfillment_status = 'cancelled', delivery_status = 'cancelled', reservation_expires_at = null, delivery_slot_allocation_id = null
    where id = p_order_id;
  perform app.end_trusted();
  return jsonb_build_object('order_id', p_order_id, 'released_reservations', v_released, 'stock_already_consumed', v_order.fulfillment_status in ('ready', 'fulfilled'));
end;
$$;

-- ---------------------------------------------------------------------------
-- Views: stock levels (low-stock alerts), movement history, preparation queue
-- ---------------------------------------------------------------------------
create or replace view public.material_stock_levels
with (security_invoker = true)
as
select
  m.id as material_id, m.sku, m.name, m.category, m.unit, m.is_perishable, m.low_stock_threshold, m.is_active,
  coalesce(sum(b.quantity_remaining) filter (where b.status = 'active'), 0) as on_hand,
  coalesce(sum(b.quantity_reserved) filter (where b.status = 'active'), 0) as reserved,
  coalesce(sum(b.quantity_remaining - b.quantity_reserved) filter (where b.status = 'active' and (b.expires_at is null or b.expires_at > now())), 0) as available,
  coalesce(sum(b.quantity_remaining) filter (where b.status = 'active' and b.expires_at is not null and b.expires_at <= now() + interval '2 days'), 0) as expiring_soon,
  min(b.expires_at) filter (where b.status = 'active' and b.quantity_remaining > 0) as next_expiry,
  (coalesce(sum(b.quantity_remaining - b.quantity_reserved) filter (where b.status = 'active' and (b.expires_at is null or b.expires_at > now())), 0) <= m.low_stock_threshold) as is_low
from public.materials m
left join public.stock_batches b on b.material_id = m.id
group by m.id;
grant select on public.material_stock_levels to authenticated, service_role;

-- Upcoming requirements: recipe needs for confirmed, unprepared orders in the next N days.
create or replace function public.upcoming_material_requirements(p_days integer default 7)
returns table (material_id uuid, sku text, name text, unit public.material_unit, required numeric, reserved numeric, available numeric, shortfall numeric, orders integer)
language sql stable security definer set search_path = ''
as $$
  with needs as (
    select ri.material_id, sum(ri.quantity * oi.quantity) as required, count(distinct o.id) as orders
    from public.orders o
    join public.order_items oi on oi.order_id = o.id
    join public.bouquet_recipes r on r.variant_id = oi.variant_id
    join public.recipe_items ri on ri.recipe_id = r.id and not ri.is_optional
    where o.status = 'confirmed' and o.fulfillment_status in ('unfulfilled', 'preparing')
      and o.delivery_date between app.manila_today() and app.manila_today() + greatest(p_days, 0)
    group by ri.material_id
  )
  select m.id, m.sku, m.name, m.unit, n.required,
         coalesce((select sum(quantity) from public.stock_reservations sr where sr.material_id = m.id and sr.status = 'active'), 0) as reserved,
         l.available, greatest(n.required - l.available - coalesce((select sum(quantity) from public.stock_reservations sr where sr.material_id = m.id and sr.status = 'active'), 0), 0) as shortfall,
         n.orders::integer
  from needs n
  join public.materials m on m.id = n.material_id
  join public.material_stock_levels l on l.material_id = m.id
  where app.has_role('owner', 'manager', 'florist')
  order by shortfall desc, n.required desc;
$$;

-- Florist queue: everything a florist needs, without customer contact details.
create or replace function public.preparation_queue(p_include_ready boolean default false)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(row_to_json(q)::jsonb order by q.delivery_date, q.slot_starts_at nulls last, q.placed_at), '[]'::jsonb)
  from (
    select o.id as order_id, o.order_number, o.delivery_date, (o.delivery_slot_snapshot ->> 'label') as slot_label,
           (o.delivery_slot_snapshot ->> 'starts_at')::time as slot_starts_at, o.fulfillment_status, o.delivery_status, o.placed_at,
           o.prepared_by, sp.display_name as prepared_by_name, o.preparation_started_at, o.ready_at, o.arrangement_photo_path,
           o.gift_message, o.delivery_instructions, o.internal_notes, (o.metadata ->> 'needs_attention')::boolean as needs_attention,
           (o.delivery_zone_snapshot ->> 'name') as zone_name, rc.full_name as recipient_name,
           (select jsonb_agg(jsonb_build_object('product_name', oi.product_name, 'variant_name', oi.variant_name, 'quantity', oi.quantity,
                 'add_ons', (select coalesce(jsonb_agg(jsonb_build_object('name', a.name, 'quantity', a.quantity)), '[]'::jsonb) from public.order_item_add_ons a where a.order_item_id = oi.id))
              order by oi.created_at) from public.order_items oi where oi.order_id = o.id) as items,
           (select count(*) from public.order_substitutions s where s.order_id = o.id) as substitutions
    from public.orders o
    left join public.staff_profiles sp on sp.user_id = o.prepared_by
    left join public.order_recipients rc on rc.order_id = o.id
    where app.has_role('owner', 'manager', 'florist')
      and o.status = 'confirmed' and o.payment_status = 'paid'
      and (o.fulfillment_status in ('unfulfilled', 'preparing') or (p_include_ready and o.fulfillment_status = 'ready' and o.delivery_status not in ('delivered')))
  ) q;
$$;

-- Everything for one order's preparation screen: recipe lines (with reserved batches), actuals, substitutions.
create or replace function public.preparation_details(p_order_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select case when app.has_role('owner', 'manager', 'florist') then jsonb_build_object(
    'order', (select to_jsonb(q) from (
        select o.id as order_id, o.order_number, o.status, o.fulfillment_status, o.delivery_status, o.payment_status, o.delivery_date,
               o.delivery_slot_snapshot ->> 'label' as slot_label, o.gift_message, o.delivery_instructions, o.internal_notes,
               o.prepared_by, o.preparation_started_at, o.ready_at, o.arrangement_photo_path, (o.metadata ->> 'needs_attention')::boolean as needs_attention,
               rc.full_name as recipient_name, rc.barangay, rc.city
        from public.orders o left join public.order_recipients rc on rc.order_id = o.id where o.id = p_order_id) q),
    'items', (select coalesce(jsonb_agg(jsonb_build_object(
        'order_item_id', oi.id, 'product_name', oi.product_name, 'variant_name', oi.variant_name, 'sku', oi.sku, 'quantity', oi.quantity, 'image_path', oi.image_path,
        'recipe', (select jsonb_build_object('name', r.name, 'instructions', r.instructions, 'assembly_minutes', r.assembly_minutes,
                     'lines', (select coalesce(jsonb_agg(jsonb_build_object('material_id', m.id, 'sku', m.sku, 'name', m.name, 'unit', m.unit,
                                  'per_unit', ri.quantity, 'total', ri.quantity * oi.quantity, 'is_optional', ri.is_optional) order by m.name), '[]'::jsonb)
                               from public.recipe_items ri join public.materials m on m.id = ri.material_id where ri.recipe_id = r.id))
                   from public.bouquet_recipes r where r.variant_id = oi.variant_id),
        'add_ons', (select coalesce(jsonb_agg(jsonb_build_object('name', a.name, 'quantity', a.quantity)), '[]'::jsonb) from public.order_item_add_ons a where a.order_item_id = oi.id)
      ) order by oi.created_at), '[]'::jsonb) from public.order_items oi where oi.order_id = p_order_id),
    'reservations', (select coalesce(jsonb_agg(jsonb_build_object('material_id', m.id, 'material', m.name, 'unit', m.unit, 'batch_code', b.batch_code,
                        'batch_id', b.id, 'expires_at', b.expires_at, 'quantity', sr.quantity, 'status', sr.status) order by m.name, b.expires_at), '[]'::jsonb)
                     from public.stock_reservations sr join public.materials m on m.id = sr.material_id join public.stock_batches b on b.id = sr.batch_id
                     where sr.reference_type = 'order' and sr.reference_id = p_order_id and sr.status in ('active', 'consumed')),
    'substitutions', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'from', fm.name, 'to', tm.name, 'quantity', s.quantity, 'reason', s.reason, 'status', s.status, 'created_at', s.created_at) order by s.created_at), '[]'::jsonb)
                      from public.order_substitutions s join public.materials fm on fm.id = s.from_material_id join public.materials tm on tm.id = s.to_material_id where s.order_id = p_order_id),
    'movements', (select coalesce(jsonb_agg(jsonb_build_object('type', mv.movement_type, 'material', m.name, 'batch_code', b.batch_code, 'quantity', mv.quantity, 'reason', mv.reason, 'at', mv.created_at) order by mv.created_at), '[]'::jsonb)
                  from public.stock_movements mv join public.materials m on m.id = mv.material_id join public.stock_batches b on b.id = mv.batch_id
                  where mv.reference_type = 'order' and mv.reference_id = p_order_id)
  ) end;
$$;

-- ---------------------------------------------------------------------------
-- Reconciliation: every batch's journal must explain its balances.
--   remaining = received + Σ(consume, discard, expire, adjust)      (receipts counted in quantity_received)
--   reserved  = −Σ(reserve) − Σ(release)  (reserve is negative, release positive)
-- ---------------------------------------------------------------------------
create or replace view public.inventory_reconciliation
with (security_invoker = true)
as
select
  b.id as batch_id, b.batch_code, m.sku, m.name as material, b.status,
  b.quantity_received, b.quantity_remaining, b.quantity_reserved,
  coalesce((select sum(mv.quantity) from public.stock_movements mv where mv.batch_id = b.id and mv.movement_type = 'receive'), 0) as journal_received,
  coalesce((select sum(mv.quantity) from public.stock_movements mv where mv.batch_id = b.id and mv.movement_type in ('consume', 'discard', 'expire', 'adjust')), 0) as journal_out_and_adjust,
  coalesce((select sum(sr.quantity) from public.stock_reservations sr where sr.batch_id = b.id and sr.status = 'active'), 0) as active_reservations,
  b.quantity_received + coalesce((select sum(mv.quantity) from public.stock_movements mv where mv.batch_id = b.id and mv.movement_type in ('consume', 'discard', 'expire', 'adjust')), 0) as expected_remaining,
  (b.quantity_remaining = b.quantity_received + coalesce((select sum(mv.quantity) from public.stock_movements mv where mv.batch_id = b.id and mv.movement_type in ('consume', 'discard', 'expire', 'adjust')), 0))
    and (b.quantity_reserved = coalesce((select sum(sr.quantity) from public.stock_reservations sr where sr.batch_id = b.id and sr.status = 'active'), 0))
    and b.quantity_reserved >= 0 and b.quantity_remaining >= 0 and b.quantity_reserved <= b.quantity_remaining as balanced
from public.stock_batches b
join public.materials m on m.id = b.material_id;
grant select on public.inventory_reconciliation to authenticated, service_role;

-- Grants (functions default to PUBLIC execute; role checks happen inside).
revoke all on function public.receive_stock(uuid, numeric, integer, text, uuid, timestamptz, timestamptz, text) from anon;
revoke all on function public.record_wastage(uuid, numeric, text, text) from anon;
revoke all on function public.adjust_stock(uuid, numeric, text) from anon;
revoke all on function public.apply_substitution(uuid, uuid, uuid, numeric, text) from anon;
revoke all on function public.review_substitution(uuid, boolean, text) from anon;
revoke all on function public.start_preparation(uuid) from anon;
revoke all on function public.complete_preparation(uuid, jsonb, text, text) from anon;
revoke all on function public.cancel_order(uuid, text) from anon;
revoke all on function public.upcoming_material_requirements(integer) from anon;
revoke all on function public.preparation_queue(boolean) from anon;
revoke all on function public.preparation_details(uuid) from anon;

-- ---------------------------------------------------------------------------
-- Batch expiry now zeroes the batch (expired stock is gone) and releases any
-- holds still sitting on it, so the journal always explains the balances.
-- ---------------------------------------------------------------------------
create or replace function public.expire_stock_batches()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_batch record;
  v_res record;
  v_count integer := 0;
begin
  for v_batch in
    select id, material_id, quantity_remaining from public.stock_batches
    where status = 'active' and expires_at is not null and expires_at <= now()
    for update
  loop
    for v_res in
      select id, reference_type, reference_id, quantity from public.stock_reservations
      where batch_id = v_batch.id and status = 'active' for update
    loop
      update public.stock_reservations set status = 'expired' where id = v_res.id;
      insert into public.stock_movements (batch_id, material_id, movement_type, quantity, reference_type, reference_id, reason)
      values (v_batch.id, v_batch.material_id, 'release', v_res.quantity, v_res.reference_type, v_res.reference_id, 'batch expired');
    end loop;
    if v_batch.quantity_remaining > 0 then
      insert into public.stock_movements (batch_id, material_id, movement_type, quantity, reason, wastage_reason)
      values (v_batch.id, v_batch.material_id, 'expire', -v_batch.quantity_remaining, 'Batch expired', 'expired');
    end if;
    update public.stock_batches set status = 'expired', quantity_remaining = 0, quantity_reserved = 0 where id = v_batch.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
