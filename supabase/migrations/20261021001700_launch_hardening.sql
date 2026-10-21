-- ============================================================================
-- 1700 · Launch hardening: data retention job, admin catalogue/settings guards
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Retention. Runs from a scheduled job (service role) or by the owner.
-- Keeps financial records (orders, payments, refunds, payment_events, audit_logs)
-- indefinitely; prunes operational data that carries personal data past its use.
-- ---------------------------------------------------------------------------
create or replace function public.run_retention(
  p_cart_days integer default 30,
  p_notification_days integer default 90,
  p_delivery_proof_days integer default 180
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_api_role text := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
  );
  v_carts integer; v_notifications integer; v_tokens integer; v_proofs integer;
begin
  if not (v_api_role is null or v_api_role = 'service_role' or app.has_role('owner')) then
    perform app.raise('FORBIDDEN', 'Insufficient role.');
  end if;
  if least(p_cart_days, p_notification_days, p_delivery_proof_days) < 7 then
    perform app.raise('RETENTION_TOO_SHORT', 'Retention windows must be at least 7 days.');
  end if;

  -- Abandoned carts (never converted) and their items.
  with d as (
    delete from public.carts
    where converted_order_id is null and updated_at < now() - make_interval(days => p_cart_days)
    returning 1
  ) select count(*) into v_carts from d;

  -- Delivered notifications: keep the fact that it was sent, drop the rendered payload/recipient.
  with d as (
    update public.notifications
    set payload = '{}'::jsonb, recipient = '[redacted]', subject = null, error = null, last_error = null
    where status in ('sent', 'skipped', 'failed')
      and coalesce(sent_at, updated_at) < now() - make_interval(days => p_notification_days)
      and recipient <> '[redacted]'
    returning 1
  ) select count(*) into v_notifications from d;

  -- Stale one-time order access tokens.
  with d as (
    delete from public.order_access_tokens
    where created_at < now() - make_interval(days => p_notification_days)
    returning 1
  ) select count(*) into v_tokens from d;

  -- Proof-of-delivery photos and recipient names past the dispute window.
  with d as (
    update public.delivery_events
    set proof_photo_path = null, received_by = null, latitude = null, longitude = null
    where created_at < now() - make_interval(days => p_delivery_proof_days)
      and (proof_photo_path is not null or received_by is not null or latitude is not null)
    returning 1
  ) select count(*) into v_proofs from d;

  return jsonb_build_object(
    'carts_deleted', v_carts,
    'notifications_redacted', v_notifications,
    'access_tokens_deleted', v_tokens,
    'delivery_proofs_redacted', v_proofs,
    'ran_at', now()
  );
end;
$$;
revoke all on function public.run_retention(integer, integer, integer) from public, anon;
grant execute on function public.run_retention(integer, integer, integer) to authenticated, service_role;

-- Orders listing helper for the admin (role-aware: riders only see their own via RLS).
create or replace function public.admin_orders_list(
  p_status text default null,
  p_query text default null,
  p_limit integer default 100
) returns table (
  order_id uuid, order_number text, placed_at timestamptz, status public.order_status,
  payment_status public.payment_status, fulfillment_status public.fulfillment_status,
  delivery_status public.delivery_status, delivery_date date, customer_name text,
  total_centavos integer, item_count bigint, zone_name text
)
language sql security invoker set search_path = '' as $$
  select o.id, o.order_number, o.placed_at, o.status, o.payment_status, o.fulfillment_status,
         o.delivery_status, o.delivery_date, o.customer_name, o.total_centavos,
         (select count(*) from public.order_items i where i.order_id = o.id),
         o.delivery_zone_snapshot ->> 'name'
  from public.orders o
  where (p_status is null or p_status = 'all' or o.status::text = p_status)
    and (p_query is null or p_query = '' or o.order_number ilike '%' || p_query || '%'
         or o.customer_name ilike '%' || p_query || '%' or o.customer_email::text ilike '%' || p_query || '%')
  order by o.placed_at desc
  limit greatest(1, least(p_limit, 500));
$$;
grant execute on function public.admin_orders_list(text, text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Least privilege for trusted-path functions. Postgres grants EXECUTE to PUBLIC
-- on creation; these are only ever called with the service-role key (webhooks,
-- scheduled jobs, checkout's payment attempt). Their bodies already refuse
-- non-trusted JWTs, but the grant is removed as well so a bug in one check can
-- never expose a payment mutation to anon/authenticated API callers.
-- ---------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = any (array[
        'mark_order_paid', 'mark_payment_failed', 'record_payment_event', 'mark_payment_event_processed',
        'update_payment_provider_ref', 'find_payment_by_provider_ref', 'create_payment_attempt',
        'expire_unpaid_orders', 'expire_stock_reservations', 'expire_stock_batches',
        'claim_due_notifications', 'mark_notification_result', 'enqueue_low_stock_digest',
        'consume_stock_reservations', 'run_retention'
      ])
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;
