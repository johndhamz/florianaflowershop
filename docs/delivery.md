# Delivery dispatch & notifications — operations guide

All times are **Asia/Manila**. Delivery is a separate state machine from payment and
preparation: `pending → scheduled → out_for_delivery → delivered | failed`, with
`failed → scheduled` only after a manager authorizes a retry or reschedules.

## Roles

| Role            | Can                                                                                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner / Manager | manage zones, slots, cutoffs and per-date capacity; assign riders; authorize retries; reschedule; see exact addresses and phones                     |
| Support         | view the dispatch board (barangay/city only, no exact address or phone); cancel orders                                                               |
| Rider           | see **only assigned** deliveries for yesterday/today/tomorrow with exact address and phone; start, deliver (photo required), or fail (note required) |
| Florist         | no delivery access                                                                                                                                   |

## Daily flow

1. **Settings** (`/admin/delivery-settings`): zones with their barangay lists, fees, free-delivery thresholds, same-day cutoffs; slot templates with days and capacity; per-date capacity overrides or blocks (e.g. holidays). Checkout only offers active zones, barangays in the zone, slots with remaining capacity, and respects lead time and the cutoff.
2. **Preparation** marks orders _ready_. Riders can't start a delivery before that.
3. **Dispatch board** (`/admin/dispatch`): pick a date (default today) or _All open_. Assign a rider from the dropdown; the delivery becomes _scheduled_. Exceptions (failed attempts) are highlighted with the reason.
4. **Rider** (`/admin/rider`, phone-friendly): Call / Navigate buttons, _Start delivery_ → _Delivered_ (take a proof photo, optional "received by") or _Could not deliver_ (reason + required note, optional photo).
5. **Exceptions**: a failed delivery sits on the board flagged _needs attention_. A manager either **authorizes a retry** (same date, same rider) or **reschedules** (new date/slot, capacity checked, old slot released). Riders cannot restart a failed delivery on their own.
6. Every transition writes a `delivery_events` row (assigned, out_for_delivery, delivered with proof path and GPS when available, failed with reason, retry_authorized, rescheduled). Proof photos live in the private `delivery-proofs` bucket (signed URLs, staff only).

## Notifications

An outbox (`notifications`) is filled by a database trigger on order changes and drained
by the cron job `/api/jobs/notifications` (every minute on Vercel, `Authorization: Bearer
CRON_SECRET`).

| Event                | Template                            | Channel                                            |
| -------------------- | ----------------------------------- | -------------------------------------------------- |
| Order placed         | `order.placed`                      | email                                              |
| Payment confirmed    | `payment.confirmed`                 | email                                              |
| Preparation complete | `preparation.complete`              | email                                              |
| Out for delivery     | `delivery.out`                      | email (+ SMS if enabled)                           |
| Delivered            | `delivery.delivered`                | email (+ SMS if enabled)                           |
| Delivery failed      | `delivery.failed` (one per attempt) | email (+ SMS if enabled)                           |
| Low stock            | `inventory.low_stock` daily digest  | email to `business_settings.low_stock_alert_email` |

Guarantees:

- **No duplicates**: every row has a `dedupe_key` (`order:<id>:<event>:<channel>`, or
  `low_stock:<date>`) with a unique index; a second enqueue is a no-op. Re-running the job
  never re-sends: rows are claimed with `FOR UPDATE SKIP LOCKED` and marked `sent`.
- **Retry with backoff**: failures re-queue at 1, 2, 4, 8 minutes; after 5 attempts the row is
  `failed` with `last_error`. Permanent provider errors (4xx) fail immediately.
- **Email provider**: Resend (`RESEND_API_KEY`); without a key the log provider records sends
  in memory (dev/CI). Sender address and shop name come from `business_settings`.
- **SMS**: optional, **off by default** (`business_settings.sms_enabled = false`). No gateway
  is wired; enabling it without a provider fails the SMS rows permanently and never blocks email.

## Tests

- `supabase/tests/07_dispatch_notifications.test.sql` (36 assertions): zone validation and
  permissions, slot capacity override/no overbooking/blocks, rider authorization, address
  restriction, delivery completion requires proof, failure requires a note, retry
  authorization, rescheduling permission, notification dedupe and backoff, SMS disabled.
- `e2e/dispatch.spec.ts`: assign → rider delivers with proof → customer sees delivered;
  failed attempt → manager authorizes retry; support/rider restrictions; zone/slot settings;
  the notification job delivers once and refuses unauthenticated calls.
