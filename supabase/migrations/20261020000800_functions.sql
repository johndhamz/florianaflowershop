-- ============================================================================
-- 0800 · Transactional functions: atomic stock reservations (FEFO), delivery
--        capacity, guest order tracking. All run as SECURITY DEFINER and are
--        only executable by service_role / staff unless stated otherwise.
-- ============================================================================

create or replace function app.sha256_hex(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(value, 'sha256'), 'hex');
$$;


-- Trusted callers: the server (service_role) or any active staff member.
-- Inside SECURITY DEFINER functions current_user is the owner, so the JWT
-- role claim is what identifies the API caller; a null claim means a direct
-- database session (migrations, tests, cron).
create or replace function app.assert_staff(variadic p_roles public.staff_role[] default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_api_role text := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
  );
begin
  if v_api_role is null or v_api_role = 'service_role' then
    return;
  end if;
  if p_roles is null then
    if not app.is_staff() then perform app.raise('FORBIDDEN', 'Staff access required.'); end if;
  elsif not app.has_role(variadic p_roles) then
    perform app.raise('FORBIDDEN', 'Insufficient role.');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- reserve_stock
--   p_lines: [{"variant_id": uuid, "quantity": int}, ...]
--   Idempotent on p_idempotency_key: a repeat call returns the existing rows.
--   Atomic: either every material is fully reserved or nothing is.
--   Concurrency: batches of the involved materials are locked FOR UPDATE in a
--   deterministic order, so parallel callers serialize and cannot both take
--   the last stem.
-- ---------------------------------------------------------------------------
create or replace function public.reserve_stock(
  p_reference_type  text,
  p_reference_id    uuid,
  p_idempotency_key text,
  p_lines           jsonb,
  p_expires_at      timestamptz default (now() + interval '30 minutes')
)
returns setof public.stock_reservations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_need   record;
  v_batch  record;
  v_take   numeric(12,3);
  v_left   numeric(12,3);
  v_material_ids uuid[];
begin
  perform app.assert_staff();
  if p_reference_type not in ('order', 'cart') then
    perform app.raise('INVALID_REFERENCE', 'reference_type must be order or cart');
  end if;
  if length(coalesce(p_idempotency_key, '')) < 8 then
    perform app.raise('INVALID_IDEMPOTENCY_KEY', 'idempotency_key must be at least 8 characters');
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    perform app.raise('INVALID_LINES', 'lines must be a non-empty JSON array');
  end if;

  -- Idempotent replay.
  if exists (select 1 from public.stock_reservations r where r.idempotency_key = p_idempotency_key) then
    return query select * from public.stock_reservations r where r.idempotency_key = p_idempotency_key;
    return;
  end if;

  -- Serialize concurrent reservations with an advisory lock scoped to the key.
  perform pg_advisory_xact_lock(hashtext('reserve_stock'), hashtext(p_idempotency_key));

  -- Recipe-mode variants with no recipe can never be fulfilled.
  if exists (
    select 1
    from jsonb_to_recordset(p_lines) as l(variant_id uuid, quantity integer)
    join public.product_variants pv on pv.id = l.variant_id
    left join public.bouquet_recipes br on br.variant_id = pv.id
    where pv.inventory_mode = 'recipe' and br.id is null
  ) then
    perform app.raise('MISSING_RECIPE', 'A recipe-tracked variant has no bouquet recipe.');
  end if;

  if exists (
    select 1 from jsonb_to_recordset(p_lines) as l(variant_id uuid, quantity integer)
    where l.quantity is null or l.quantity < 1
  ) then
    perform app.raise('INVALID_QUANTITY', 'Line quantities must be >= 1.');
  end if;

  -- Materials touched by this reservation (recipe variants only).
  select coalesce(array_agg(x.material_id order by x.material_id), '{}')
  into v_material_ids
  from (
    select distinct ri.material_id
    from jsonb_to_recordset(p_lines) as l(variant_id uuid, quantity integer)
    join public.product_variants pv on pv.id = l.variant_id
    join public.bouquet_recipes br on br.variant_id = pv.id
    join public.recipe_items ri on ri.recipe_id = br.id and not ri.is_optional
    where pv.inventory_mode = 'recipe'
  ) x;

  -- Lock every candidate batch in a stable order (prevents deadlocks).
  perform 1
  from public.stock_batches b
  where b.material_id = any (v_material_ids)
    and b.status = 'active'
  order by b.material_id, b.expires_at nulls last, b.id
  for update;

  for v_need in
    select ri.material_id, sum(ri.quantity * l.quantity::numeric) as quantity
    from jsonb_to_recordset(p_lines) as l(variant_id uuid, quantity integer)
    join public.product_variants pv on pv.id = l.variant_id
    join public.bouquet_recipes br on br.variant_id = pv.id
    join public.recipe_items ri on ri.recipe_id = br.id and not ri.is_optional
    where pv.inventory_mode = 'recipe'
    group by ri.material_id
    order by ri.material_id
  loop
    v_left := v_need.quantity;

    for v_batch in
      select b.id, (b.quantity_remaining - b.quantity_reserved) as available
      from public.stock_batches b
      where b.material_id = v_need.material_id
        and b.status = 'active'
        and (b.expires_at is null or b.expires_at > now())
        and (b.quantity_remaining - b.quantity_reserved) > 0
      order by b.expires_at nulls last, b.id
    loop
      exit when v_left <= 0;
      v_take := least(v_left, v_batch.available);

      update public.stock_batches
        set quantity_reserved = quantity_reserved + v_take
        where id = v_batch.id;

      insert into public.stock_reservations
        (idempotency_key, reference_type, reference_id, material_id, batch_id, quantity, status, expires_at)
      values
        (p_idempotency_key, p_reference_type, p_reference_id, v_need.material_id, v_batch.id, v_take, 'active', p_expires_at);

      insert into public.stock_movements (batch_id, material_id, movement_type, quantity, reference_type, reference_id, created_by)
      values (v_batch.id, v_need.material_id, 'reserve', -v_take, p_reference_type, p_reference_id, auth.uid());

      v_left := v_left - v_take;
    end loop;

    if v_left > 0 then
      perform app.raise(
        'INSUFFICIENT_STOCK',
        format('Insufficient stock for material %s: short by %s', v_need.material_id, v_left)
      );
    end if;
  end loop;

  return query select * from public.stock_reservations r where r.idempotency_key = p_idempotency_key;
end;
$$;

-- Release every active reservation for a reference (cart abandoned, payment failed, expired).
create or replace function public.release_stock_reservations(
  p_reference_type text,
  p_reference_id   uuid,
  p_reason         text default 'released'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_count integer := 0;
begin
  perform app.assert_staff();
  for v_row in
    select r.id, r.batch_id, r.material_id, r.quantity
    from public.stock_reservations r
    where r.reference_type = p_reference_type
      and r.reference_id = p_reference_id
      and r.status = 'active'
    order by r.batch_id
    for update
  loop
    update public.stock_batches
      set quantity_reserved = quantity_reserved - v_row.quantity
      where id = v_row.batch_id;
    update public.stock_reservations set status = 'released' where id = v_row.id;
    insert into public.stock_movements (batch_id, material_id, movement_type, quantity, reference_type, reference_id, reason, created_by)
    values (v_row.batch_id, v_row.material_id, 'release', v_row.quantity, p_reference_type, p_reference_id, p_reason, auth.uid());
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Consume reservations when the bouquet is actually assembled (stock leaves the shop).
create or replace function public.consume_stock_reservations(
  p_reference_type text,
  p_reference_id   uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_count integer := 0;
begin
  perform app.assert_staff();
  for v_row in
    select r.id, r.batch_id, r.material_id, r.quantity
    from public.stock_reservations r
    where r.reference_type = p_reference_type
      and r.reference_id = p_reference_id
      and r.status = 'active'
    order by r.batch_id
    for update
  loop
    update public.stock_batches
      set quantity_reserved  = quantity_reserved - v_row.quantity,
          quantity_remaining = quantity_remaining - v_row.quantity,
          status = case when quantity_remaining - v_row.quantity <= 0 then 'depleted'::public.stock_batch_status else status end
      where id = v_row.batch_id;
    update public.stock_reservations set status = 'consumed' where id = v_row.id;
    insert into public.stock_movements (batch_id, material_id, movement_type, quantity, reference_type, reference_id, created_by)
    values (v_row.batch_id, v_row.material_id, 'consume', -v_row.quantity, p_reference_type, p_reference_id, auth.uid());
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Scheduled job: release reservations past their expiry.
create or replace function public.expire_stock_reservations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ref record;
  v_total integer := 0;
begin
  for v_ref in
    select distinct reference_type, reference_id
    from public.stock_reservations
    where status = 'active' and expires_at is not null and expires_at < now()
  loop
    v_total := v_total + public.release_stock_reservations(v_ref.reference_type, v_ref.reference_id, 'expired');
  end loop;
  update public.stock_reservations set status = 'expired'
    where status = 'released' and expires_at is not null and expires_at < now() and updated_at >= now() - interval '1 second';
  return v_total;
end;
$$;

-- Scheduled job: mark perished batches and release anything still reserved on them.
create or replace function public.expire_stock_batches()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch record;
  v_count integer := 0;
begin
  for v_batch in
    select id, material_id, quantity_remaining
    from public.stock_batches
    where status = 'active' and expires_at is not null and expires_at <= now()
    for update
  loop
    update public.stock_batches set status = 'expired' where id = v_batch.id;
    if v_batch.quantity_remaining > 0 then
      insert into public.stock_movements (batch_id, material_id, movement_type, quantity, reason)
      values (v_batch.id, v_batch.material_id, 'expire', -v_batch.quantity_remaining, 'Batch expired');
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Delivery capacity
-- ---------------------------------------------------------------------------
create or replace function public.reserve_delivery_slot(p_slot_id uuid, p_delivery_date date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slot   public.delivery_slots%rowtype;
  v_alloc  public.delivery_slot_allocations%rowtype;
begin
  perform app.assert_staff();
  select * into v_slot from public.delivery_slots where id = p_slot_id and is_active;
  if v_slot.id is null then
    perform app.raise('SLOT_NOT_FOUND', 'Delivery slot is not available.');
  end if;
  if not (extract(dow from p_delivery_date)::smallint = any (v_slot.days_of_week)) then
    perform app.raise('SLOT_NOT_OFFERED', 'This slot is not offered on the chosen day.');
  end if;

  insert into public.delivery_slot_allocations (slot_id, delivery_date, capacity)
  values (p_slot_id, p_delivery_date, v_slot.default_capacity)
  on conflict (slot_id, delivery_date) do nothing;

  select * into v_alloc
  from public.delivery_slot_allocations
  where slot_id = p_slot_id and delivery_date = p_delivery_date
  for update;

  if v_alloc.is_blocked or v_alloc.booked >= v_alloc.capacity then
    perform app.raise('SLOT_FULL', 'This delivery slot is fully booked.');
  end if;

  update public.delivery_slot_allocations set booked = booked + 1 where id = v_alloc.id;
  return v_alloc.id;
end;
$$;

create or replace function public.release_delivery_slot(p_allocation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.assert_staff();
  update public.delivery_slot_allocations
    set booked = greatest(booked - 1, 0)
    where id = p_allocation_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Guest order tracking: order number + secret token → sanitized view.
-- Callable by anon; never returns full PII (phone/email are masked).
-- ---------------------------------------------------------------------------
create or replace function public.get_order_for_tracking(p_order_number text, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_items jsonb;
  v_history jsonb;
  v_recipient jsonb;
begin
  if p_order_number is null or p_token is null or length(p_token) < 16 then
    return null;
  end if;

  select * into v_order
  from public.orders o
  where o.order_number = p_order_number
    and o.tracking_token_hash = app.sha256_hex(p_token);

  if v_order.id is null then
    -- Constant-ish response for unknown combos; callers rate-limit at the edge.
    return null;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'product_name', oi.product_name,
      'variant_name', oi.variant_name,
      'image_path', oi.image_path,
      'quantity', oi.quantity,
      'unit_price_centavos', oi.unit_price_centavos,
      'line_total_centavos', oi.line_total_centavos,
      'add_ons', (
        select coalesce(jsonb_agg(jsonb_build_object('name', a.name, 'quantity', a.quantity, 'line_total_centavos', a.line_total_centavos)), '[]'::jsonb)
        from public.order_item_add_ons a where a.order_item_id = oi.id
      )
    ) order by oi.created_at), '[]'::jsonb)
  into v_items
  from public.order_items oi where oi.order_id = v_order.id;

  select coalesce(jsonb_agg(jsonb_build_object('kind', h.kind, 'to_status', h.to_status, 'at', h.created_at) order by h.created_at), '[]'::jsonb)
  into v_history
  from public.order_status_history h where h.order_id = v_order.id;

  select jsonb_build_object(
      'full_name', r.full_name,
      'barangay', r.barangay,
      'city', r.city,
      'phone_masked', regexp_replace(r.phone, '^(\+639\d{2})\d{5}(\d{2})$', '\1•••••\2')
    )
  into v_recipient
  from public.order_recipients r where r.order_id = v_order.id;

  return jsonb_build_object(
    'order_number', v_order.order_number,
    'status', v_order.status,
    'payment_status', v_order.payment_status,
    'fulfillment_status', v_order.fulfillment_status,
    'delivery_status', v_order.delivery_status,
    'placed_at', v_order.placed_at,
    'delivery_date', v_order.delivery_date,
    'delivery_slot', v_order.delivery_slot_snapshot,
    'subtotal_centavos', v_order.subtotal_centavos,
    'add_ons_centavos', v_order.add_ons_centavos,
    'discount_centavos', v_order.discount_centavos,
    'delivery_fee_centavos', v_order.delivery_fee_centavos,
    'total_centavos', v_order.total_centavos,
    'customer_name', v_order.customer_name,
    'email_masked', regexp_replace(v_order.customer_email::text, '^(.).*(@.*)$', '\1•••\2'),
    'gift_message', v_order.gift_message,
    'items', v_items,
    'recipient', v_recipient,
    'history', v_history
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants: transactional functions are server-only (service_role) or staff.
-- ---------------------------------------------------------------------------
revoke all on function public.reserve_stock(text, uuid, text, jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.release_stock_reservations(text, uuid, text) from public, anon, authenticated;
revoke all on function public.consume_stock_reservations(text, uuid) from public, anon, authenticated;
revoke all on function public.expire_stock_reservations() from public, anon, authenticated;
revoke all on function public.expire_stock_batches() from public, anon, authenticated;
revoke all on function public.reserve_delivery_slot(uuid, date) from public, anon, authenticated;
revoke all on function public.release_delivery_slot(uuid) from public, anon, authenticated;

grant execute on function public.reserve_stock(text, uuid, text, jsonb, timestamptz) to service_role, authenticated;
grant execute on function public.release_stock_reservations(text, uuid, text) to service_role, authenticated;
grant execute on function public.consume_stock_reservations(text, uuid) to service_role, authenticated;
grant execute on function public.expire_stock_reservations() to service_role;
grant execute on function public.expire_stock_batches() to service_role;
grant execute on function public.reserve_delivery_slot(uuid, date) to service_role, authenticated;
grant execute on function public.release_delivery_slot(uuid) to service_role, authenticated;

grant execute on function public.get_order_for_tracking(text, text) to anon, authenticated, service_role;
grant execute on function public.material_available_quantity(uuid) to anon, authenticated, service_role;
grant execute on function public.variant_available_quantity(uuid) to anon, authenticated, service_role;
