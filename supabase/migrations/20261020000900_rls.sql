-- ============================================================================
-- 0900 · Row-level security.
--
-- Principles
--   • Every table has RLS enabled. No policy = no access (service_role bypasses).
--   • Public catalog/content is readable by anyone; everything else needs staff.
--   • Guests never read orders/carts directly: they use token-scoped RPCs.
--   • Roles: owner/manager = admin; florist = fulfillment + inventory;
--     rider = delivery for assigned orders; support = read orders/customers,
--     add notes; no payments verification, no settings.
-- ============================================================================

-- Helper to shorten policy definitions.
create or replace function app.is_public_product(p_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.products p where p.id = p_product_id and p.status = 'active');
$$;
grant execute on function app.is_public_product(uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.audit_logs                enable row level security;
alter table public.staff_profiles            enable row level security;
alter table public.customers                 enable row level security;
alter table public.collections               enable row level security;
alter table public.occasions                 enable row level security;
alter table public.tags                      enable row level security;
alter table public.products                  enable row level security;
alter table public.product_variants          enable row level security;
alter table public.product_images            enable row level security;
alter table public.product_occasions         enable row level security;
alter table public.product_tags              enable row level security;
alter table public.add_ons                   enable row level security;
alter table public.product_add_ons           enable row level security;
alter table public.suppliers                 enable row level security;
alter table public.materials                 enable row level security;
alter table public.stock_batches             enable row level security;
alter table public.bouquet_recipes           enable row level security;
alter table public.recipe_items              enable row level security;
alter table public.stock_movements           enable row level security;
alter table public.stock_reservations        enable row level security;
alter table public.delivery_zones            enable row level security;
alter table public.delivery_slots            enable row level security;
alter table public.delivery_slot_allocations enable row level security;
alter table public.carts                     enable row level security;
alter table public.cart_items                enable row level security;
alter table public.cart_item_add_ons         enable row level security;
alter table public.promo_codes               enable row level security;
alter table public.orders                    enable row level security;
alter table public.order_items               enable row level security;
alter table public.order_item_add_ons        enable row level security;
alter table public.order_recipients          enable row level security;
alter table public.order_status_history      enable row level security;
alter table public.payments                  enable row level security;
alter table public.payment_events            enable row level security;
alter table public.refunds                   enable row level security;
alter table public.site_content              enable row level security;
alter table public.business_settings         enable row level security;
alter table public.notifications             enable row level security;

-- ---------------------------------------------------------------------------
-- Audit logs: owners/managers read; nobody writes through the API.
-- ---------------------------------------------------------------------------
create policy audit_logs_admin_read on public.audit_logs
  for select to authenticated using (app.is_admin());

-- ---------------------------------------------------------------------------
-- Staff profiles: self-read; admins manage. Owners cannot be demoted by managers.
-- ---------------------------------------------------------------------------
create policy staff_profiles_self_read on public.staff_profiles
  for select to authenticated using (user_id = auth.uid() or app.is_staff());
create policy staff_profiles_admin_insert on public.staff_profiles
  for insert to authenticated with check (app.is_admin() and (role <> 'owner' or app.has_role('owner')));
create policy staff_profiles_admin_update on public.staff_profiles
  for update to authenticated
  using (app.is_admin() and (role <> 'owner' or app.has_role('owner')))
  with check (app.is_admin() and (role <> 'owner' or app.has_role('owner')));
create policy staff_profiles_owner_delete on public.staff_profiles
  for delete to authenticated using (app.has_role('owner') and user_id <> auth.uid());

-- ---------------------------------------------------------------------------
-- Customers (PII): staff except riders may read; admins/support may edit;
-- a signed-in customer may read/update their own record.
-- ---------------------------------------------------------------------------
create policy customers_staff_read on public.customers
  for select to authenticated using (app.has_role('owner', 'manager', 'support', 'florist') or user_id = auth.uid());
create policy customers_staff_write on public.customers
  for update to authenticated
  using (app.has_role('owner', 'manager', 'support') or user_id = auth.uid())
  with check (app.has_role('owner', 'manager', 'support') or user_id = auth.uid());
create policy customers_admin_insert on public.customers
  for insert to authenticated with check (app.has_role('owner', 'manager', 'support'));
create policy customers_owner_delete on public.customers
  for delete to authenticated using (app.has_role('owner'));

-- ---------------------------------------------------------------------------
-- Catalog: public read of active rows; admins write.
-- ---------------------------------------------------------------------------
create policy collections_public_read on public.collections
  for select to anon, authenticated using (is_active or app.is_staff());
create policy collections_admin_write on public.collections
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

create policy occasions_public_read on public.occasions
  for select to anon, authenticated using (is_active or app.is_staff());
create policy occasions_admin_write on public.occasions
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

create policy tags_public_read on public.tags
  for select to anon, authenticated using (true);
create policy tags_admin_write on public.tags
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

create policy products_public_read on public.products
  for select to anon, authenticated using (status = 'active' or app.is_staff());
create policy products_admin_write on public.products
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

create policy product_variants_public_read on public.product_variants
  for select to anon, authenticated using ((is_active and app.is_public_product(product_id)) or app.is_staff());
create policy product_variants_admin_write on public.product_variants
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

create policy product_images_public_read on public.product_images
  for select to anon, authenticated using (app.is_public_product(product_id) or app.is_staff());
create policy product_images_admin_write on public.product_images
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

create policy product_occasions_public_read on public.product_occasions
  for select to anon, authenticated using (app.is_public_product(product_id) or app.is_staff());
create policy product_occasions_admin_write on public.product_occasions
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

create policy product_tags_public_read on public.product_tags
  for select to anon, authenticated using (app.is_public_product(product_id) or app.is_staff());
create policy product_tags_admin_write on public.product_tags
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

create policy add_ons_public_read on public.add_ons
  for select to anon, authenticated using (is_active or app.is_staff());
create policy add_ons_admin_write on public.add_ons
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

create policy product_add_ons_public_read on public.product_add_ons
  for select to anon, authenticated using (app.is_public_product(product_id) or app.is_staff());
create policy product_add_ons_admin_write on public.product_add_ons
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

-- ---------------------------------------------------------------------------
-- Inventory: florists + admins. Riders and support have no inventory access.
-- ---------------------------------------------------------------------------
create policy suppliers_inventory_read on public.suppliers
  for select to authenticated using (app.has_role('owner', 'manager', 'florist'));
create policy suppliers_admin_write on public.suppliers
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

create policy materials_inventory_read on public.materials
  for select to authenticated using (app.has_role('owner', 'manager', 'florist'));
create policy materials_admin_write on public.materials
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

create policy stock_batches_inventory_read on public.stock_batches
  for select to authenticated using (app.has_role('owner', 'manager', 'florist'));
create policy stock_batches_inventory_write on public.stock_batches
  for insert to authenticated with check (app.has_role('owner', 'manager', 'florist'));
create policy stock_batches_inventory_update on public.stock_batches
  for update to authenticated
  using (app.has_role('owner', 'manager', 'florist'))
  with check (app.has_role('owner', 'manager', 'florist'));
create policy stock_batches_admin_delete on public.stock_batches
  for delete to authenticated using (app.is_admin());

create policy bouquet_recipes_inventory_read on public.bouquet_recipes
  for select to authenticated using (app.has_role('owner', 'manager', 'florist'));
create policy bouquet_recipes_admin_write on public.bouquet_recipes
  for all to authenticated using (app.has_role('owner', 'manager', 'florist')) with check (app.has_role('owner', 'manager', 'florist'));

create policy recipe_items_inventory_read on public.recipe_items
  for select to authenticated using (app.has_role('owner', 'manager', 'florist'));
create policy recipe_items_admin_write on public.recipe_items
  for all to authenticated using (app.has_role('owner', 'manager', 'florist')) with check (app.has_role('owner', 'manager', 'florist'));

create policy stock_movements_inventory_read on public.stock_movements
  for select to authenticated using (app.has_role('owner', 'manager', 'florist'));
create policy stock_movements_inventory_insert on public.stock_movements
  for insert to authenticated with check (app.has_role('owner', 'manager', 'florist'));

create policy stock_reservations_inventory_read on public.stock_reservations
  for select to authenticated using (app.has_role('owner', 'manager', 'florist'));

-- ---------------------------------------------------------------------------
-- Delivery config: public read of active; admins write. Allocations: staff read.
-- ---------------------------------------------------------------------------
create policy delivery_zones_public_read on public.delivery_zones
  for select to anon, authenticated using (is_active or app.is_staff());
create policy delivery_zones_admin_write on public.delivery_zones
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

create policy delivery_slots_public_read on public.delivery_slots
  for select to anon, authenticated using (is_active or app.is_staff());
create policy delivery_slots_admin_write on public.delivery_slots
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

create policy delivery_slot_allocations_staff_read on public.delivery_slot_allocations
  for select to authenticated using (app.is_staff());
create policy delivery_slot_allocations_admin_write on public.delivery_slot_allocations
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

-- ---------------------------------------------------------------------------
-- Carts: no direct API access for shoppers (token RPCs in Phase 3). Staff read.
-- ---------------------------------------------------------------------------
create policy carts_staff_read on public.carts
  for select to authenticated using (app.has_role('owner', 'manager', 'support'));
create policy cart_items_staff_read on public.cart_items
  for select to authenticated using (app.has_role('owner', 'manager', 'support'));
create policy cart_item_add_ons_staff_read on public.cart_item_add_ons
  for select to authenticated using (app.has_role('owner', 'manager', 'support'));

-- ---------------------------------------------------------------------------
-- Promo codes: validation happens server-side (RPC in Phase 4); staff read, admins write.
-- ---------------------------------------------------------------------------
create policy promo_codes_staff_read on public.promo_codes
  for select to authenticated using (app.has_role('owner', 'manager', 'support'));
create policy promo_codes_admin_write on public.promo_codes
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

-- ---------------------------------------------------------------------------
-- Orders: NO anonymous access. Staff by role; riders only their assignments.
-- Signed-in customers can read their own orders.
-- ---------------------------------------------------------------------------
create policy orders_staff_read on public.orders
  for select to authenticated using (
    app.has_role('owner', 'manager', 'florist', 'support')
    or (app.has_role('rider') and assigned_rider_id = auth.uid())
    or customer_id in (select c.id from public.customers c where c.user_id = auth.uid())
  );
create policy orders_admin_insert on public.orders
  for insert to authenticated with check (app.is_admin());
create policy orders_staff_update on public.orders
  for update to authenticated
  using (
    app.has_role('owner', 'manager', 'florist', 'support')
    or (app.has_role('rider') and assigned_rider_id = auth.uid())
  )
  with check (
    app.has_role('owner', 'manager', 'florist', 'support')
    or (app.has_role('rider') and assigned_rider_id = auth.uid())
  );
create policy orders_owner_delete on public.orders
  for delete to authenticated using (app.has_role('owner'));

-- Column-level guards for non-admin staff (riders may only touch delivery
-- status; florists fulfillment; support notes). Enforced by trigger because
-- RLS cannot express per-column rules.
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
begin
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
    if to_jsonb(new) - 'fulfillment_status' - 'internal_notes' - 'updated_at'
       = to_jsonb(old) - 'fulfillment_status' - 'internal_notes' - 'updated_at' then
      return new;
    end if;
    perform app.raise('FORBIDDEN', 'Florists may only update fulfillment_status and internal_notes.');
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
create trigger orders_guard_staff_columns before update on public.orders
  for each row execute function app.orders_guard_staff_columns();

create policy order_items_staff_read on public.order_items
  for select to authenticated using (
    exists (select 1 from public.orders o where o.id = order_id) -- inherits orders RLS via subquery
  );
create policy order_items_admin_insert on public.order_items
  for insert to authenticated with check (app.is_admin());

create policy order_item_add_ons_staff_read on public.order_item_add_ons
  for select to authenticated using (
    exists (select 1 from public.order_items oi where oi.id = order_item_id)
  );
create policy order_item_add_ons_admin_insert on public.order_item_add_ons
  for insert to authenticated with check (app.is_admin());

-- Recipient PII: admins, support, florists (to label), riders for assigned orders only.
create policy order_recipients_staff_read on public.order_recipients
  for select to authenticated using (
    app.has_role('owner', 'manager', 'florist', 'support')
    or exists (select 1 from public.orders o where o.id = order_id and o.assigned_rider_id = auth.uid())
    or exists (select 1 from public.orders o join public.customers c on c.id = o.customer_id
               where o.id = order_id and c.user_id = auth.uid())
  );
create policy order_recipients_admin_write on public.order_recipients
  for all to authenticated
  using (app.has_role('owner', 'manager', 'support'))
  with check (app.has_role('owner', 'manager', 'support'));

create policy order_status_history_read on public.order_status_history
  for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id));
create policy order_status_history_staff_insert on public.order_status_history
  for insert to authenticated with check (app.is_staff());

-- ---------------------------------------------------------------------------
-- Payments: admins + support read; only admins verify/insert; webhooks are
-- server-side (service_role). Refunds: admins only.
-- ---------------------------------------------------------------------------
create policy payments_staff_read on public.payments
  for select to authenticated using (app.has_role('owner', 'manager', 'support'));
create policy payments_admin_write on public.payments
  for insert to authenticated with check (app.is_admin());
create policy payments_admin_update on public.payments
  for update to authenticated using (app.is_admin()) with check (app.is_admin());

create policy payment_events_admin_read on public.payment_events
  for select to authenticated using (app.is_admin());

create policy refunds_staff_read on public.refunds
  for select to authenticated using (app.has_role('owner', 'manager', 'support'));
create policy refunds_admin_write on public.refunds
  for insert to authenticated with check (app.is_admin());
create policy refunds_admin_update on public.refunds
  for update to authenticated using (app.is_admin()) with check (app.is_admin());

-- ---------------------------------------------------------------------------
-- Content & settings
-- ---------------------------------------------------------------------------
create policy site_content_public_read on public.site_content
  for select to anon, authenticated using (is_published or app.is_staff());
create policy site_content_admin_write on public.site_content
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

create policy business_settings_public_read on public.business_settings
  for select to anon, authenticated using (true);
create policy business_settings_owner_write on public.business_settings
  for update to authenticated using (app.is_admin()) with check (app.is_admin());

-- ---------------------------------------------------------------------------
-- Notifications: admins + support read; sending is server-side.
-- ---------------------------------------------------------------------------
create policy notifications_staff_read on public.notifications
  for select to authenticated using (app.has_role('owner', 'manager', 'support'));

-- ---------------------------------------------------------------------------
-- Table privileges: PostgREST roles get DML only where a policy can allow it.
-- (Supabase grants broad privileges by default; narrow the sensitive tables.)
-- ---------------------------------------------------------------------------
revoke insert, update, delete on public.audit_logs from anon, authenticated;
revoke insert, update, delete on public.order_status_history from anon;
revoke all on public.carts, public.cart_items, public.cart_item_add_ons from anon;
revoke all on public.orders, public.order_items, public.order_item_add_ons, public.order_recipients from anon;
revoke all on public.payments, public.payment_events, public.refunds from anon;
revoke all on public.customers, public.staff_profiles, public.notifications from anon;
revoke all on public.stock_batches, public.stock_movements, public.stock_reservations, public.materials, public.suppliers, public.bouquet_recipes, public.recipe_items from anon;
revoke all on public.promo_codes, public.delivery_slot_allocations from anon;
revoke update, delete on public.order_items, public.order_item_add_ons from authenticated;
revoke insert, update, delete on public.payment_events from authenticated;
revoke insert, update, delete on public.stock_reservations from authenticated;
revoke insert, delete on public.business_settings from authenticated;
