import { randomUUID } from "node:crypto";

import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  NormalizedEvent,
  PaymentProvider,
  RefundInput,
  RefundResult,
  RetrieveCheckoutResult,
} from "../types";
import { WebhookSignatureError } from "../types";
import { buildSignatureHeader, verifyPaymongoSignature } from "./signature";

/**
 * Mock gateway for local development and E2E. Mirrors the PayMongo shapes:
 * the hosted page lives at /mock-pay/{id} with Authorize / Fail buttons (like
 * PayMongo's test e-wallet page), and completing it POSTs a webhook to our own
 * endpoint signed with the same `Paymongo-Signature` scheme.
 *
 * State is in-memory per server process; fine for tests, never for production.
 */
type MockSession = {
  id: string;
  paymentId: string;
  orderNumber: string;
  amount: number;
  status: "active" | "expired";
  paymentStatus: "pending" | "paid" | "failed";
  settledPaymentId?: string;
  successUrl: string;
  cancelUrl: string;
};

const sessions = new Map<string, MockSession>();

export const MOCK_WEBHOOK_SECRET = "whsk_mock_secret_for_local_tests";

export function getMockSession(id: string) {
  return sessions.get(id) ?? null;
}

export function settleMockSession(
  id: string,
  outcome: "paid" | "failed",
): MockSession | null {
  const s = sessions.get(id);
  if (!s || s.status === "expired" || s.paymentStatus === "paid") return s ?? null;
  s.paymentStatus = outcome;
  s.settledPaymentId = s.settledPaymentId ?? `pay_mock_${randomUUID().slice(0, 12)}`;
  return s;
}

/** Builds a PayMongo-shaped event body + signature for the mock session. */
export function buildMockWebhook(session: MockSession, outcome: "paid" | "failed") {
  const paidAt = Math.floor(Date.now() / 1000);
  const body =
    outcome === "paid"
      ? {
          data: {
            id: `evt_mock_${randomUUID().slice(0, 12)}`,
            type: "event",
            attributes: {
              type: "checkout_session.payment.paid",
              livemode: false,
              data: {
                id: session.id,
                type: "checkout_session",
                attributes: {
                  status: "active",
                  reference_number: session.orderNumber,
                  metadata: { payment_id: session.paymentId },
                  payments: [
                    {
                      id: session.settledPaymentId,
                      type: "payment",
                      attributes: {
                        status: "paid",
                        amount: session.amount,
                        paid_at: paidAt,
                        source: { type: "gcash" },
                      },
                    },
                  ],
                },
              },
              created_at: paidAt,
            },
          },
        }
      : {
          data: {
            id: `evt_mock_${randomUUID().slice(0, 12)}`,
            type: "event",
            attributes: {
              type: "payment.failed",
              livemode: false,
              data: {
                id: session.settledPaymentId,
                type: "payment",
                attributes: {
                  status: "failed",
                  amount: session.amount,
                  metadata: { payment_id: session.paymentId },
                  last_payment_error: {
                    code: "declined",
                    message: "The payment was declined (mock).",
                  },
                },
              },
              created_at: paidAt,
            },
          },
        };
  const rawBody = JSON.stringify(body);
  return {
    rawBody,
    signature: buildSignatureHeader(MOCK_WEBHOOK_SECRET, rawBody, false),
  };
}

export function createMockProvider(): PaymentProvider {
  return {
    id: "mock",
    async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
      const id = `cs_mock_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
      sessions.set(id, {
        id,
        paymentId: input.paymentId,
        orderNumber: input.orderNumber,
        amount: input.amountCentavos,
        status: "active",
        paymentStatus: "pending",
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
      });
      return {
        providerPaymentId: id,
        checkoutUrl: `/mock-pay/${id}`,
        raw: { id },
      };
    },
    async retrieveCheckout(id: string): Promise<RetrieveCheckoutResult> {
      const s = sessions.get(id);
      if (!s) return { status: "unknown", raw: {} };
      if (s.paymentStatus === "paid")
        return {
          status: "paid",
          settledPaymentId: s.settledPaymentId,
          method: "gcash",
          paidAt: new Date(),
          raw: { id },
        };
      if (s.status === "expired") return { status: "expired", raw: { id } };
      if (s.paymentStatus === "failed")
        return { status: "failed", settledPaymentId: s.settledPaymentId, raw: { id } };
      return { status: "pending", raw: { id } };
    },
    async expireCheckout(id: string) {
      const s = sessions.get(id);
      if (s && s.paymentStatus !== "paid") s.status = "expired";
    },
    async createRefund(input: RefundInput): Promise<RefundResult> {
      return {
        providerRefundId: `ref_mock_${randomUUID().slice(0, 12)}`,
        status: "succeeded",
        raw: { amount: input.amountCentavos },
      };
    },
    parseWebhook(rawBody: string, headers: Headers): NormalizedEvent {
      // Same verification code path as the real adapter.
      let parsed: {
        data: {
          id: string;
          attributes: {
            type: string;
            livemode: boolean;
            data: { id: string; attributes: Record<string, unknown> };
          };
        };
      };
      try {
        parsed = JSON.parse(rawBody);
      } catch {
        throw new WebhookSignatureError("Malformed webhook payload.");
      }
      if (
        !verifyPaymongoSignature({
          header: headers.get("paymongo-signature"),
          rawBody,
          secret: MOCK_WEBHOOK_SECRET,
          livemode: parsed.data.attributes.livemode,
        })
      ) {
        throw new WebhookSignatureError();
      }
      const { type, data } = parsed.data.attributes;
      if (type === "checkout_session.payment.paid") {
        const payments =
          (data.attributes.payments as {
            id: string;
            attributes: { status: string; paid_at?: number; source?: { type?: string } };
          }[]) ?? [];
        const paid = payments.find((p) => p.attributes.status === "paid");
        return {
          kind: "checkout.paid",
          eventId: parsed.data.id,
          providerPaymentId: data.id,
          settledPaymentId: paid?.id,
          method: paid?.attributes.source?.type,
          paidAt: paid?.attributes.paid_at
            ? new Date(paid.attributes.paid_at * 1000)
            : undefined,
          livemode: false,
          raw: parsed,
        };
      }
      if (type === "payment.failed") {
        const err = data.attributes.last_payment_error as
          { code?: string; message?: string } | undefined;
        return {
          kind: "payment.failed",
          eventId: parsed.data.id,
          settledPaymentId: data.id,
          failureCode: err?.code,
          failureMessage: err?.message,
          livemode: false,
          raw: parsed,
        };
      }
      return {
        kind: "ignored",
        eventId: parsed.data.id,
        type,
        livemode: false,
        raw: parsed,
      };
    },
  };
}
