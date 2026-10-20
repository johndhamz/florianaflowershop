# Inventory & preparation

Floriana tracks every physical thing that goes into an order — stems, foliage, plants,
containers, wraps, ribbons, consumables — as a **material**, received in dated, costed
**batches**. Sellable variants carry a **recipe** (bill of materials). Stock moves only
through journaled functions; nothing edits balances directly.

## Model

| Concept       | Table                              | Notes                                                                                                                            |
| ------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Material      | `materials`                        | unit (`stem`, `bunch`, `piece`, `gram`, `millilitre`, `metre`), perishable + shelf life, low-stock threshold, default supplier   |
| Batch         | `stock_batches`                    | `quantity_received / remaining / reserved`, `unit_cost_centavos`, `expires_at`, status `active · depleted · expired · discarded` |
| Recipe        | `bouquet_recipes` + `recipe_items` | per-unit quantities; `is_optional` lines don't reserve stock                                                                     |
| Journal       | `stock_movements`                  | signed quantities; types `receive · reserve · release · consume · adjust · discard · expire`; wastage reasons                    |
| Holds         | `stock_reservations`               | per order (or cart), per batch, FEFO                                                                                             |
| Substitutions | `order_substitutions`              | florist applies → manager reviews (`applied → approved/rejected`)                                                                |

Availability = Σ active, unexpired batches (`remaining − reserved`). It can never go
negative: every function locks the batches it touches and refuses to take more than is
available (`INSUFFICIENT_STOCK`, `INSUFFICIENT_AVAILABLE`).

## Lifecycle of an order's materials

```
checkout → place_order() → app.reserve_stock()        hold (FEFO) on each recipe line
florist   → start_preparation()                       fulfillment = preparing
          → apply_substitution()  (optional)          release part of a hold, reserve substitute
          → complete_preparation(actuals, photo)      consume actuals from holds; extras from FEFO;
                                                      unused holds released; fulfillment = ready
staff     → cancel_order()  (eligible: not dispatched) release remaining holds + delivery slot
cron      → expire_stock_batches()                     expired batches zeroed, holds released
          → expire_unpaid_orders()                     unpaid holds released after the payment window
```

Why "actuals": recipes are plans. A florist may use nine roses instead of ten, add a stem of
eucalyptus, or swap wax flower for gypsophila. Recording what was really used keeps costing
honest and the shelf accurate.

## Functions (all `SECURITY DEFINER`, role-checked inside)

| Function                                                                                       | Who             | Effect                                                          |
| ---------------------------------------------------------------------------------------------- | --------------- | --------------------------------------------------------------- |
| `receive_stock(material, qty, unit_cost, code?, supplier?, received_at?, expires_at?, notes?)` | florist+        | new batch + `receive` movement; expiry defaults from shelf life |
| `record_wastage(batch, qty, reason, note?)`                                                    | florist+        | `discard`/`expire` movement; never below reserved               |
| `adjust_stock(batch, ±delta, reason)`                                                          | manager+        | count corrections, audited                                      |
| `apply_substitution(order, from, to, qty, reason)`                                             | florist+        | release/reserve swap, logged for review                         |
| `review_substitution(id, approve, note?)`                                                      | manager+        | approve/reject (stock already moved)                            |
| `start_preparation(order)`                                                                     | florist+        | sets florist, timestamps                                        |
| `complete_preparation(order, actuals[], photo?, notes?)`                                       | florist+        | consumption, releases, `ready`                                  |
| `cancel_order(order, reason)`                                                                  | manager/support | releases holds + slot unless already dispatched                 |
| `preparation_queue(include_ready)` / `preparation_details(order)`                              | florist+        | queue + workspace data (no customer contact details)            |
| `upcoming_material_requirements(days)`                                                         | florist+        | recipe needs for confirmed, unprepared orders vs available      |
| views `material_stock_levels`, `inventory_reconciliation`                                      | florist+        | low-stock alerts; journal vs balances                           |

## Security

- Florists: inventory read/write through functions, preparation queue, recipes. **No**
  customer records, payments, refunds, settings or audit logs. Orders are visible but only
  the preparation columns are writable (trigger `orders_guard_staff_columns`).
- Riders: no inventory at all.
- Support: no inventory; may cancel orders.
- Batches and the movement journal cannot be inserted/updated directly by any API role.
- Arrangement photos live in the private `arrangement-photos` bucket (staff read, florist+ write).

## Reconciliation

`/admin/inventory/reconciliation` (and the `inventory_reconciliation` view) checks, per batch:

- `quantity_remaining = quantity_received + Σ journal(consume, discard, expire, adjust)`
- `quantity_reserved = Σ active reservations on the batch`
- `0 ≤ reserved ≤ remaining`

pgTAP suite `06_inventory_ops` ends by asserting every batch is balanced after receipts,
wastage, substitution, consumption with extras, releases and batch expiry. The E2E suite
asserts the same from the admin page after driving the UI.

## Screens

- `/admin/inventory` — low-stock alerts, expiring batches, 7-day requirements and shortfalls
- `/admin/inventory/materials`, `/suppliers` — CRUD (React Hook Form + Zod)
- `/admin/inventory/batches` — FEFO-ordered batches with wastage/adjust actions
- `/admin/inventory/receive` — receiving form
- `/admin/inventory/wastage` — wastage form + log
- `/admin/inventory/movements` — full journal with filters
- `/admin/inventory/recipes` → `/recipes/[variantId]` — recipe editor
- `/admin/inventory/reconciliation` — evidence page
- `/admin/prep` → `/admin/prep/[orderId]` — florist queue (mobile-first), recipe, card
  message, instructions, start, substitution, actual consumption, photo, mark ready
