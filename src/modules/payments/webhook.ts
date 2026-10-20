import "server-only";

import { createAdminClient } from "@/lib/supabase/server";

import type { NormalizedEvent, PaymentProvider } from "./types";

export type WebhookOutcome = {
  eventId: string;
  duplicate: boolean;
  action: string;
  orderNumber?: string;
};

/**
 * Processes a verified provider event exactly once:
 *   1. record_payment_event (unique per provider event id) → duplicates are no-ops
 *   2. apply the transition via DB functions that are themselves idempotent
 *   3. mark the event processed (or store the error for replay from the dashboard)
 */
export async function processWebhookEvent(
  provider: PaymentProvider,
  event: NormalizedEvent,
): Promise<WebhookOutcome> {
  const admin = createAdminClient();
  const providerEnum = provider.id === "mock" ? "paymongo" : provider.id;

  const { data: rec, error: recErr } = await admin.rpc("record_payment_event", {
    p_provider: providerEnum,
    p_event_id: event.eventId,
    p_event_type: event.kind === "ignored" ? event.type : event.kind,
    p_payload: event.raw as never,
    p_signature_verified: true,
  });
  if (recErr) throw new Error(`record_payment_event: ${recErr.message}`);
  const recorded = rec as { id: string; duplicate: boolean };
  if (recorded.duplicate)
    return { eventId: event.eventId, duplicate: true, action: "skipped-duplicate" };

  try {
    let action = "ignored";
    let orderNumber: string | undefined;
    let paymentId: string | undefined;

    if (event.kind === "checkout.paid") {
      const { data: found } = await admin.rpc("find_payment_by_provider_ref", {
        p_provider: providerEnum,
        p_provider_payment_id: event.providerPaymentId,
      });
      const payment = found as { id: string } | null;
      if (!payment) {
        action = "unmatched-payment";
      } else {
        paymentId = payment.id;
        const { data, error } = await admin.rpc("mark_order_paid", {
          p_payment_id: payment.id,
          p_provider_payment_id: event.providerPaymentId,
          p_method: mapMethod(event.method) ?? undefined,
          p_paid_at: (event.paidAt ?? new Date()).toISOString(),
          p_provider_data: {
            settled_payment_id: event.settledPaymentId ?? null,
            event_id: event.eventId,
          } as never,
        });
        if (error) throw new Error(`mark_order_paid: ${error.message}`);
        const result = data as { order_number: string; already_paid: boolean };
        orderNumber = result.order_number;
        action = result.already_paid ? "already-paid" : "marked-paid";
      }
    } else if (event.kind === "payment.failed") {
      // Failed payments reference the settled payment id; our row is keyed by the
      // checkout session id, so match through the stored settled id or metadata.
      const { data: rows } = await admin
        .from("payments")
        .select("id, status")
        .eq("provider", providerEnum)
        .in("status", ["pending", "requires_action"])
        .contains("provider_data", { settled_payment_id: event.settledPaymentId })
        .limit(1);
      let target = rows?.[0];
      if (!target) {
        const raw = event.raw as {
          data?: {
            attributes?: {
              data?: { attributes?: { metadata?: { payment_id?: string } } };
            };
          };
        };
        const metaId = raw.data?.attributes?.data?.attributes?.metadata?.payment_id;
        if (metaId) {
          const { data: byMeta } = await admin
            .from("payments")
            .select("id, status")
            .eq("id", metaId)
            .maybeSingle();
          target = byMeta ?? undefined;
        }
      }
      if (!target) {
        action = "unmatched-payment";
      } else {
        paymentId = target.id;
        const { error } = await admin.rpc("mark_payment_failed", {
          p_payment_id: target.id,
          p_failure_code: event.failureCode,
          p_failure_message: event.failureMessage,
          p_provider_data: { event_id: event.eventId } as never,
        });
        if (error) throw new Error(`mark_payment_failed: ${error.message}`);
        action = "marked-failed";
      }
    } else if (event.kind === "refund.succeeded") {
      action = "refund-noted";
    }

    await admin.rpc("mark_payment_event_processed", {
      p_event_id: recorded.id,
      p_payment_id: paymentId,
    });
    return { eventId: event.eventId, duplicate: false, action, orderNumber };
  } catch (err) {
    await admin.rpc("mark_payment_event_processed", {
      p_event_id: recorded.id,
      p_error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

function mapMethod(
  source?: string,
): "card" | "gcash" | "maya" | "grab_pay" | "bank_transfer" | "cash" | "other" | null {
  switch (source) {
    case "card":
      return "card";
    case "gcash":
      return "gcash";
    case "paymaya":
    case "maya":
      return "maya";
    case "grab_pay":
      return "grab_pay";
    case undefined:
      return null;
    default:
      return "other";
  }
}

/** Reconcile a pending hosted-checkout payment by asking the provider (e.g. after redirect). */
export async function reconcilePayment(
  provider: PaymentProvider,
  payment: { id: string; provider_payment_id: string | null; status: string },
) {
  if (
    !payment.provider_payment_id ||
    !["pending", "requires_action"].includes(payment.status)
  )
    return payment.status;
  const admin = createAdminClient();
  const result = await provider.retrieveCheckout(payment.provider_payment_id);
  if (result.status === "paid") {
    await admin.rpc("mark_order_paid", {
      p_payment_id: payment.id,
      p_provider_payment_id: payment.provider_payment_id,
      p_method: mapMethod(result.method) ?? undefined,
      p_paid_at: (result.paidAt ?? new Date()).toISOString(),
      p_provider_data: {
        settled_payment_id: result.settledPaymentId ?? null,
        reconciled: true,
      } as never,
    });
    return "paid";
  }
  if (result.status === "failed") {
    await admin.rpc("mark_payment_failed", {
      p_payment_id: payment.id,
      p_failure_code: "provider_failed",
      p_failure_message: "Payment was not completed.",
      p_provider_data: { reconciled: true } as never,
    });
    return "failed";
  }
  return payment.status;
}
