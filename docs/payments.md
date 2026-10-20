# Payments

Floriana Flowers accepts **online payment through PayMongo** (GCash, Maya, cards,
GrabPay via the hosted checkout page) and **manual bank transfer** (customer uploads
a proof, staff verifies). Both paths share one order lifecycle; payment, fulfilment and
delivery states are independent columns on `orders`.

> **Status of verification.** The PayMongo adapter is built strictly from the official
> reference (links below) and is exercised by unit tests with documented payload shapes,
> plus full end-to-end tests against a **mock gateway** that mirrors the same request,
> redirect and signed-webhook flow. It has **not** been run against PayMongo's sandbox
> from this environment because no API keys were available. Before going live, run the
> sandbox checklist at the bottom of this page.

## Flow

```
cart ──► /checkout (form) ──► place_order() [atomic: validate · snapshot · reserve stock · book slot]
                                   │
               ┌───────────────────┴───────────────────┐
         PayMongo (online)                        Bank transfer
   create_payment_attempt()                 create_payment_attempt()
   POST /v1/checkout_sessions               order page shows instructions
   redirect → checkout_url                  customer uploads proof (private bucket)
   customer pays on hosted page             staff verifies in /admin/payments
   webhook checkout_session.payment.paid    verify_bank_transfer() → mark_order_paid()
   → mark_order_paid()
   (confirmation page also reconciles via GET /v1/checkout_sessions/{id})
```

### Transaction safety

| Concern                      | Mechanism                                                                                                                                                      |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Totals                       | Recomputed inside `place_order` from live prices; client values are ignored                                                                                    |
| Stock + slot                 | Reserved in the same transaction as the order (`app.reserve_stock`, `app.reserve_delivery_slot`); FEFO batches locked `FOR UPDATE`                             |
| Duplicate orders             | `orders.idempotency_key` (server-minted checkout key in an httpOnly cookie); replay returns the same order + token                                             |
| Concurrent first attempts    | advisory lock on the key + `unique_violation` handler returns the winner                                                                                       |
| Duplicate / delayed webhooks | `payment_events (provider, provider_event_id)` unique; `mark_order_paid` is idempotent                                                                         |
| Abandoned payments           | `orders.reservation_expires_at` (30 min online / 24 h bank transfer); `/api/jobs/expire-reservations` releases stock + slot and cancels with `payment_timeout` |
| Payment after timeout        | `mark_order_paid` re-reserves stock and re-books the slot; if either fails the order is confirmed with `metadata.needs_attention = true` for staff             |
| Retry                        | `create_payment_attempt` supersedes open attempts; old hosted sessions are expired via `POST /v1/checkout_sessions/{id}/expire`                                |
| Refunds                      | `record_refund` keeps the ledger; provider call via `createRefund` (`POST /v1/refunds`); total refunds can never exceed the payment                            |
| Order access                 | Tracking requires order number + secret token (hash stored); PII masked in the tracking view                                                                   |

## PayMongo adapter (`src/modules/payments/providers/paymongo.ts`)

Everything below is taken from the official docs; nothing is inferred.

| Item                  | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Source                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Auth                  | HTTP Basic, secret key as username, empty password (`-u sk_…:`)                                                                                                                                                                                                                                                                                                                                                                                               | [Make your first API call](https://developers.paymongo.com/docs/make-your-first-api-call)   |
| Create session        | `POST https://api.paymongo.com/v1/checkout_sessions`, body `data.attributes` with `line_items[]{name, amount, currency:"PHP", quantity, description, images}`, `payment_method_types` (`card`, `gcash`, `grab_pay`, `paymaya`, `qrph`, …), `success_url`, `cancel_url`, `reference_number`, `description`, `send_email_receipt`, `show_description`, `show_line_items`, `billing{name,email,phone,address}`, `metadata` (string values; `PYM_` keys reserved) | [Create a Checkout](https://docs.paymongo.com/reference/create-a-checkout)                  |
| Session object        | `id` (`cs_…`), `attributes.checkout_url`, `status` (`active` \| `expired`), `payments[]` (`id` `pay_…`, `attributes.status`, `amount`, `paid_at`, `source.type`), `payment_intent`, `reference_number`, `metadata`, `livemode`                                                                                                                                                                                                                                | [Checkout Session resource](https://docs.paymongo.com/reference/checkout-session-resource)  |
| Retrieve              | `GET /v1/checkout_sessions/{id}` (secret key)                                                                                                                                                                                                                                                                                                                                                                                                                 | [Retrieve a Checkout](https://docs.paymongo.com/reference/retrieve-a-checkout)              |
| Expire                | `POST /v1/checkout_sessions/{id}/expire`; `400` if already expired / paid / payment ongoing                                                                                                                                                                                                                                                                                                                                                                   | [Expire a Checkout](https://docs.paymongo.com/reference/create_checkout_sessions_id_expire) |
| Payment status values | `pending`, `failed`, `paid`                                                                                                                                                                                                                                                                                                                                                                                                                                   | [Payment resource](https://docs.paymongo.com/reference/payments)                            |
| Refund                | `POST /v1/refunds`, `data.attributes{amount, payment_id, reason ∈ duplicate\|fraudulent\|requested_by_customer\|others, notes, metadata}`; status `pending\|processing\|succeeded\|failed`                                                                                                                                                                                                                                                                    | [Refund resource](https://docs.paymongo.com/reference/refund-resource)                      |
| Webhook create        | `POST /v1/webhooks` with `data.attributes.url`, `events[]`; response `attributes.secret_key` (store as `PAYMONGO_WEBHOOK_SECRET`)                                                                                                                                                                                                                                                                                                                             | [Create a Webhook](https://docs.paymongo.com/reference/create-a-webhook)                    |
| Events used           | `checkout_session.payment.paid`, `payment.failed`, `refund.succeeded`                                                                                                                                                                                                                                                                                                                                                                                         | [Webhook events](https://docs.paymongo.com/docs/developer-tools-webhooks-events)            |
| Event envelope        | `data.id` (`evt_…`), `data.attributes.type`, `data.attributes.livemode`, `data.attributes.data` (resource snapshot), `created_at`                                                                                                                                                                                                                                                                                                                             | same                                                                                        |
| Signature             | header `Paymongo-Signature: t=…,te=…,li=…`; compute `HMAC-SHA256(secret_key, "<t>.<raw body>")` (hex) and compare with `li` (live) or `te` (test); reject stale timestamps                                                                                                                                                                                                                                                                                    | [Securing a webhook](https://developers.paymongo.com/docs/securing-webhook)                 |
| Delivery rules        | respond `200–209` within 30 s; otherwise retried up to 12 times with backoff; dedupe by event id                                                                                                                                                                                                                                                                                                                                                              | [Retry logic](https://docs.paymongo.com/docs/developer-tools-retry-logic)                   |
| Test mode             | `sk_test_…` keys; test cards e.g. `4343434343434345` (success), `4120000000000007` (3DS), `5100000000000198` (insufficient funds); e-wallets show an **Authorize / Fail** test page                                                                                                                                                                                                                                                                           | [Testing](https://docs.paymongo.com/docs/payment-acceptance-testing)                        |

Notes:

- PayMongo also documents `POST /v2/checkout_sessions` (creates the Payment Intent only at
  payment time). The adapter uses v1 because create, retrieve and expire are all documented
  on v1 paths; switching is a one-line path change once v2 retrieval is confirmed in sandbox.
- A checkout session never expires on its own. The app expires superseded sessions explicitly.
- Hosted checkout line items cannot be negative; when a promo applies, the order is sent as a
  single line with the discounted total.

## Mock gateway (`PAYMENT_PROVIDER=mock`)

For local development and E2E only. `createCheckout` returns `/mock-pay/{id}`, a page with
**Authorize** and **Fail** buttons like PayMongo's test page. Settling a session POSTs a
PayMongo-shaped event to `/api/webhooks/paymongo`, signed with the real header scheme, so
the entire webhook path (signature check, idempotency, state transitions) is exercised. It
refuses to run in production unless `ALLOW_MOCK_PAYMENTS=true`.

## Environment

| Variable                  | Purpose                                                                     |
| ------------------------- | --------------------------------------------------------------------------- |
| `PAYMENT_PROVIDER`        | `paymongo` or `mock`                                                        |
| `PAYMONGO_SECRET_KEY`     | `sk_test_…` / `sk_live_…` (server only)                                     |
| `PAYMONGO_WEBHOOK_SECRET` | `secret_key` from the webhook you created                                   |
| `CRON_SECRET`             | Bearer token for `/api/jobs/expire-reservations` (Vercel Cron, every 5 min) |

## Sandbox checklist (run before launch)

1. Create a webhook: `POST /v1/webhooks` with `url = https://<host>/api/webhooks/paymongo`,
   `events = ["checkout_session.payment.paid","payment.failed","refund.succeeded"]`. Save `secret_key`.
2. Set `PAYMENT_PROVIDER=paymongo`, the test secret key and the webhook secret; enable online
   payments in `business_settings.online_payments_enabled`.
3. Place an order with GCash on the hosted page → **Authorize**. Confirm the webhook row in
   `payment_events`, the order flips to `confirmed/paid`, and the confirmation page shows paid.
4. Repeat with **Fail**; the order stays pending with `payment_status = failed` and "Pay again" works.
5. Pay with test card `4120000000000007` (3DS) and `5100000000000198` (declined).
6. Close the browser right after authorizing: the webhook alone must confirm the order.
7. Resend the same event from the PayMongo dashboard: `payment_events` reports a duplicate and nothing changes.
8. Issue a refund from `/admin/payments`; confirm `refund.succeeded` arrives and the ledger updates.
