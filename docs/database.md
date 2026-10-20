# Database schema

Floriana Flowers runs on Supabase Postgres. The schema lives in
`supabase/migrations/` (apply in order) and realistic seed data in `supabase/seeds/`.
Everything below is enforced by the database itself: UUID keys, integer centavos,
numeric stock quantities, check constraints, immutable order snapshots, and
row-level security on every table.

```
npx supabase start            # local stack (ports 556xx, see supabase/config.toml)
npx supabase db reset         # drop, migrate, seed — proves reproducibility
npm run test:db               # pgTAP suites + concurrency tests
npm run db:types              # regenerate src/lib/supabase/database.types.ts
```

## Conventions

| Rule                     | How it is enforced                                                         |
| ------------------------ | -------------------------------------------------------------------------- |
| UUID primary keys        | `gen_random_uuid()` defaults; pgTAP asserts every `id` is uuid             |
| Money = integer centavos | `integer … check (>= 0)`; `orders_total_math` and `line_math` checks       |
| Inventory = numeric      | `numeric(12,3)` stems/bunches/grams; `reserved <= remaining <= received`   |
| Slugs / SKUs unique      | `unique` + regex checks (`app.is_slug`, `^[A-Z0-9-]+$`)                    |
| PH mobile numbers        | `app.is_ph_mobile` → `+639XXXXXXXXX`                                       |
| Timestamps               | `created_at` / `updated_at` with `app.set_updated_at()` triggers           |
| Immutable order pricing  | `orders_lock_pricing` trigger; `order_items*` reject any UPDATE            |
| Idempotency              | unique `idempotency_key` on orders, payments, refunds, stock reservations; |
|                          | unique `(provider, provider_event_id)` on payment_events                   |
| Audit                    | `app.audit_row()` trigger on sensitive tables, PII columns redacted        |

## Domains

### Identity

- **staff_profiles** (`user_id` → `auth.users`): `role` ∈ owner · manager · florist · rider · support, `is_active`.
- **customers**: guest-first. `user_id` is null for guests. Holds `privacy_consent_at` (DPA 2012) and `marketing_opt_in`.

### Catalog

- **collections**, **occasions**, **tags** — slugged taxonomies.
- **products** → **product_variants** (price, SKU, `inventory_mode` recipe|untracked, one `is_default` per product) → **product_images**.
- **product_occasions**, **product_tags** — tagging joins.
- **add_ons** + **product_add_ons** — configured extras with `max_quantity`.

### Inventory (perishable, batch-based)

- **suppliers**, **materials** (unit, perishable, shelf life, low-stock threshold).
- **stock_batches** — one receipt of one material: `quantity_received / remaining / reserved`, `expires_at`, status.
- **bouquet_recipes** → **recipe_items** — bill of materials per variant.
- **stock_movements** — signed journal (receive / reserve / release / consume / adjust / discard / expire).
- **stock_reservations** — holds against batches for an order or cart, with `expires_at`.
- Availability: `material_available_quantity(material)` and `variant_available_quantity(variant)` (min over recipe lines).

### Delivery

- **delivery_zones** — city + barangay list, fee, free-delivery threshold, same-day cutoff, lead time.
- **delivery_slots** — time-window templates with `days_of_week` and `default_capacity`.
- **delivery_slot_allocations** — per-date capacity rows created lazily; `booked <= capacity`.

### Commerce

- **carts** (secret token stored as SHA-256 `token_hash`) → **cart_items** → **cart_item_add_ons**.
- **promo_codes** — percent|fixed, min subtotal, cap, window, max uses.
- **orders** — four independent state machines: `status`, `payment_status`, `fulfillment_status`, `delivery_status`. Pricing columns, customer snapshot, zone/slot snapshots, `tracking_token_hash` for guest tracking, `reservation_expires_at`.
- **order_items** → **order_item_add_ons** — immutable snapshots (name, SKU, unit price, line total).
- **order_recipients** — recipient + address (PII), one per order.
- **order_status_history** — written automatically by trigger on every transition.

### Payments

- **payments** — provider (paymongo | bank_transfer | manual), method, amount, status, `proof_storage_path`, `verified_by/at`, sanitized `provider_data` (never card numbers).
- **payment_events** — raw inbound webhooks; unique per provider event id (duplicates are no-ops).
- **refunds** — never exceed the payment (`refunds_check_total` trigger).

### Content & operations

- **site_content** — keyed JSON blocks with `is_published`.
- **business_settings** — single row (`id = 1`), public-safe only.
- **notifications** — outbound email/SMS queue with provider ids.
- **audit_logs** — actor, role, action, entity, before/after (redacted), changed columns.

## Transactional functions (`SECURITY DEFINER`, staff or service_role only)

| Function                                                              | Guarantees                                                                                                                                                                                         |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reserve_stock(ref_type, ref_id, idempotency_key, lines, expires_at)` | Idempotent per key; aggregates recipe needs; locks candidate batches `FOR UPDATE` in a stable order; FEFO picking; raises `INSUFFICIENT_STOCK` and rolls back everything if any material is short. |
| `release_stock_reservations(ref_type, ref_id, reason)`                | Returns holds to batches, journals `release` movements.                                                                                                                                            |
| `consume_stock_reservations(ref_type, ref_id)`                        | Decrements `quantity_remaining`, marks batches depleted.                                                                                                                                           |
| `expire_stock_reservations()` / `expire_stock_batches()`              | Cron jobs: release stale holds; mark perished batches.                                                                                                                                             |
| `reserve_delivery_slot(slot_id, date)` / `release_delivery_slot(id)`  | Lazily creates the allocation, locks it, enforces capacity (`SLOT_FULL`).                                                                                                                          |
| `get_order_for_tracking(order_number, token)` (anon OK)               | Constant-shape sanitized JSON for guests; phone/email masked; null on any mismatch.                                                                                                                |

## Row-level security summary

| Table group                                                        | anon                  | customer (own) | support             | florist                  | rider                                       | manager/owner                    |
| ------------------------------------------------------------------ | --------------------- | -------------- | ------------------- | ------------------------ | ------------------------------------------- | -------------------------------- |
| collections/occasions/tags/products/variants/images/add-ons        | read active           | read           | read                | read                     | read                                        | all                              |
| delivery_zones / delivery_slots / site_content / business_settings | read active/published | read           | read                | read                     | read                                        | all                              |
| customers                                                          | —                     | read/update    | read/update         | read                     | —                                           | all (owner deletes)              |
| orders                                                             | — (RPC only)          | read           | read, cancel, notes | read, fulfillment, notes | read + delivery_status on **assigned** only | all                              |
| order_items / add-ons / history                                    | —                     | read           | read                | read                     | read (assigned)                             | all                              |
| order_recipients (PII)                                             | —                     | read           | read/write          | read                     | read (assigned)                             | all                              |
| carts                                                              | — (RPC only)          | —              | read                | —                        | —                                           | read                             |
| inventory (materials, batches, recipes, movements, reservations)   | —                     | —              | —                   | read/write               | —                                           | all                              |
| payments / refunds                                                 | —                     | —              | read                | —                        | —                                           | all                              |
| payment_events / audit_logs                                        | —                     | —              | —                   | —                        | —                                           | read                             |
| staff_profiles                                                     | —                     | —              | self                | self                     | self                                        | manage (only owner grants owner) |
| promo_codes                                                        | —                     | —              | read                | —                        | —                                           | all                              |

Per-column rules for non-admin staff on `orders` are enforced by the
`orders_guard_staff_columns` trigger, since RLS cannot express them.

## Storage buckets

| Bucket           | Public | Write                      | Read                  |
| ---------------- | ------ | -------------------------- | --------------------- |
| `product-images` | yes    | owner/manager              | everyone              |
| `content-media`  | yes    | owner/manager              | everyone              |
| `payment-proofs` | no     | server only (service role) | owner/manager/support |

## Seed accounts (local only)

All seeded staff use the password `Floriana!2026`:
`owner@floriana.local`, `manager@floriana.local`, `florist@floriana.local`,
`rider@floriana.local`, `support@floriana.local`.

Guest tracking tokens for seeded orders are `track-<order number, lowercase>-dev`,
e.g. `FL-10001` + `track-fl-10001-dev`.

## Tests

- `supabase/tests/01_schema_integrity.test.sql` — tables, RLS on, uuid keys, unique/check constraints, FK restrict/cascade, immutable snapshots, idempotency keys, history + audit + redaction, refund cap, duplicate webhook rejection.
- `supabase/tests/02_rls_permissions.test.sql` — anon isolation, guest tracking, florist / rider / support / manager / owner boundaries.
- `supabase/tests/03_inventory_functions.test.sql` — reserve/replay/insufficient rollback, FEFO, expired batches skipped, release, consume, expiry jobs, slot capacity.
- `src/test/db/concurrency.db.test.ts` — 20 parallel sessions racing for 2 units of stock and for a 6-capacity slot.

## Local stack notes

- Ports are shifted to `556xx` (`supabase/config.toml`) because other local stacks and
  SSH tunnels on this machine occupy the defaults. Studio and the mail catcher are
  disabled to keep memory low when several stacks run side by side; re-enable them in
  `config.toml` if you want the dashboard at `http://127.0.0.1:55623`.
- After `supabase db reset`, GoTrue can keep stale connections to the recreated database
  container and answer with `504 request_timeout` on sign-in. If auth calls start taking
  10+ seconds, run `npx supabase stop && npx supabase start`.
- `.env.local` for the app must point at `http://127.0.0.1:55621` with the local anon key
  printed by `npx supabase status`.
