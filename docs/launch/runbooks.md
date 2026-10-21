# Operational runbooks

Each runbook: _symptom → check → action_. Staff roles: **owner** (everything), **manager**,
**support**, **florist**, **rider**. Times are Asia/Manila.

## R1 · Site down or slow

- Check `https://<domain>/api/health`. `503` or `database: "error"` → Supabase. `200` but pages
  fail → Vercel.
- Vercel status page and deployment logs; Supabase status page and project health (CPU, connections).
- Action: if a deploy caused it, **rollback** (`docs/launch/deployment.md` §3). If the database is
  saturated, check `pg_stat_activity` for long transactions; the FEFO reservation path uses
  `FOR UPDATE` and can queue behind a stuck session — terminate it.

## R2 · Customer paid but order still shows "Payment: Pending"

1. Admin → Payments: find the order. If the payment row is `paid`, the order is fine; refresh.
2. If `pending`: PayMongo dashboard → Payments → search the reference. If PayMongo shows paid,
   the webhook was missed. Check Vercel logs for `/api/webhooks/paymongo` 4xx/5xx.
3. Action: open the customer's confirmation link (`/orders/FL-…?t=…`); the page reconciles
   pending payments against the gateway on load. If still pending, check `payment_events` for a
   `processing_error` and fix the cause; PayMongo retries for ~24 h. As a last resort an owner can
   call `select public.mark_order_paid(<payment_id>, …)` in the SQL editor with the PayMongo id.
4. Never mark paid without a matching PayMongo payment id.

## R3 · Bank transfer proofs piling up

- Dashboard tile "Pending payments" → Payments → Approve/Reject with a note. Rejected orders stay
  payable until the hold (`bank_transfer_hold_hours`, default 24 h) expires; the 5-minute
  `expire-reservations` job then cancels them and releases stock.

## R4 · Refund request

- Payments → **Refund {order}** → amount (partial allowed), reason, note. Online payments go
  through PayMongo (idempotent key per refund); bank transfers are recorded as manual refunds
  that you settle by hand. The order shows `refunded`/`partially_refunded`, the customer tracking
  page shows "Refunded", and reports deduct it by refund date.

## R5 · Stock looks wrong

- Inventory → Reconciliation shows on-hand vs reserved vs expected per material. Differences come
  from unrecorded wastage or receipts. Record wastage/adjustments (manager); batches past their
  best-before are auto-expired by the 5-minute job.
- A cancelled order releases its reservations; an order cancelled after preparation has already
  consumed stock (the cancel toast says so) → record wastage if the arrangement is not resold.

## R6 · Delivery failed

- Rider marks **Failed** with a reason and note. Dashboard tile "Failed deliveries" → Dispatch
  board → **Authorize retry** (manager) or **Reschedule** to another date/slot. The customer is
  notified automatically; call them first for a new slot.

## R7 · Notifications not sending

- `/api/jobs/notifications` runs every minute. Check Vercel cron logs; `notifications.status`
  `failed` rows show `last_error`. Resend 4xx = bad address or key (fix and requeue by setting
  `status='queued', next_attempt_at=now()`); 429/5xx retry automatically with back-off.
- Without `RESEND_API_KEY` the app logs instead of sending: production must have the key.

## R8 · Staff account changes

- Owner creates the user in Supabase Auth (invite by email) and inserts `staff_profiles`
  (`role`, `display_name`). Deactivate by `is_active=false`; the proxy refreshes sessions, and
  `requireStaff` refuses inactive profiles on the next request. Roles are read from the profile
  table, never from user metadata.

## R9 · Suspected data breach or leaked key

1. Rotate: Supabase service-role key (dashboard → API → reset), `CRON_SECRET`, `PAYMONGO_*`,
   `RESEND_API_KEY`; update Vercel env and redeploy.
2. Review `audit_logs` (owner/manager) for the window; PII is redacted there, but row ids,
   actors and actions are complete.
3. NPC (National Privacy Commission) notification within 72 h if personal data of customers was
   exposed (RA 10173 / NPC Circular 16-03). Draft from the audit timeline.

## R10 · Backup & restore rehearsal (quarterly)

Rehearsed on 2026-10-21 locally (`docs/launch/test-report.md`). Procedure on a scratch project:

```
npx supabase db dump --linked -f schema.sql            # record
npx supabase db dump --linked -f data.sql --data-only --use-copy
# new/empty project:
npx supabase link --project-ref <scratch> && npx supabase db push   # schema from migrations
psql "$SCRATCH_DB_URL" -v ON_ERROR_STOP=0 -f data.sql                 # data (bucket rows already exist → ignore that error)
```

Then compare counts of `orders`, `payments`, `products`, `auth.users` and sign in as staff.
Storage **files** are not in the SQL dump: copy buckets with the Supabase storage API or keep
object versioning on; proof-of-delivery photos are redacted after 180 days anyway.

## R11 · Retention job

Weekly cron `/api/jobs/retention` → `public.run_retention()`: deletes abandoned carts (> 30 d),
redacts delivered notification payloads/recipients (> 90 d), deletes stale order access tokens
(> 90 d), clears proof-of-delivery photos/receiver names/coordinates (> 180 d). Orders, payments,
refunds, payment events and audit logs are kept (financial records, BIR 10-year retention). A
customer erasure request: owner anonymises `customers` + `orders.customer_*` +
`order_recipients` for that email in the SQL editor and notes it in `audit_logs` via the update.

## R12 · Launch-day watch

Owner + one engineer online 09:00–20:00. Every hour: `/api/health`, dashboard tiles, Vercel error
count, PayMongo dashboard. Alert webhook messages go to the ops channel.
