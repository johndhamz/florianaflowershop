import { z } from "zod";

import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  NormalizedEvent,
  PaymentProvider,
  RefundInput,
  RefundResult,
  RetrieveCheckoutResult,
} from "../types";
import { ProviderError, WebhookSignatureError } from "../types";
import { verifyPaymongoSignature } from "./signature";

/**
 * PayMongo adapter. Every endpoint, field and event name below comes from the
 * official reference (docs.paymongo.com), see docs/payments.md for citations.
 *
 *   Auth      : HTTP Basic, secret key as username, empty password
 *   Create    : POST /v1/checkout_sessions
 *   Retrieve  : GET  /v1/checkout_sessions/{id}
 *   Expire    : POST /v1/checkout_sessions/{id}/expire
 *   Refund    : POST /v1/refunds
 *   Webhooks  : checkout_session.payment.paid · payment.failed · refund.succeeded
 */

export type PaymongoConfig = {
  secretKey: string;
  webhookSecret: string;
  baseUrl?: string;
  /** Allowed values per docs: card, gcash, grab_pay, paymaya, qrph, dob, … */
  paymentMethodTypes?: string[];
  fetchImpl?: typeof fetch;
};

const DEFAULT_METHODS = ["gcash", "paymaya", "card", "grab_pay"];

// Shapes we read. Everything else stays in `raw`.
const paymentSchema = z.object({
  id: z.string(),
  attributes: z
    .object({
      status: z.string().optional(),
      amount: z.number().optional(),
      paid_at: z.number().nullable().optional(),
      source: z
        .object({ type: z.string().optional() })
        .passthrough()
        .nullable()
        .optional(),
      payment_intent_id: z.string().nullable().optional(),
    })
    .passthrough(),
});

const checkoutSessionSchema = z.object({
  id: z.string(),
  attributes: z
    .object({
      checkout_url: z.string().optional(),
      status: z.string().optional(),
      reference_number: z.string().nullable().optional(),
      metadata: z.record(z.string(), z.string()).nullable().optional(),
      payments: z.array(paymentSchema).optional(),
      payment_intent: z
        .object({
          id: z.string(),
          attributes: z.object({ status: z.string().optional() }).passthrough(),
        })
        .passthrough()
        .nullable()
        .optional(),
      livemode: z.boolean().optional(),
    })
    .passthrough(),
});

const eventSchema = z.object({
  data: z.object({
    id: z.string(),
    type: z.literal("event").optional(),
    attributes: z
      .object({
        type: z.string(),
        livemode: z.boolean(),
        data: z
          .object({
            id: z.string(),
            type: z.string().optional(),
            attributes: z.record(z.string(), z.unknown()),
          })
          .passthrough(),
      })
      .passthrough(),
  }),
});

export function createPaymongoProvider(config: PaymongoConfig): PaymentProvider {
  const baseUrl = (config.baseUrl ?? "https://api.paymongo.com").replace(/\/$/, "");
  const fetchImpl = config.fetchImpl ?? fetch;
  const authHeader = `Basic ${Buffer.from(`${config.secretKey}:`).toString("base64")}`;

  async function request<T>(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
  ): Promise<T> {
    const res = await fetchImpl(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
    if (!res.ok) {
      const detail =
        typeof json === "object" && json && "errors" in json
          ? JSON.stringify((json as { errors: unknown }).errors)
          : text.slice(0, 300);
      throw new ProviderError(
        `PayMongo ${method} ${path} failed (${res.status}): ${detail}`,
        res.status,
        json,
      );
    }
    return json as T;
  }

  function mapStatus(
    session: z.infer<typeof checkoutSessionSchema>,
  ): RetrieveCheckoutResult {
    const paid = session.attributes.payments?.find((p) => p.attributes.status === "paid");
    if (paid) {
      return {
        status: "paid",
        settledPaymentId: paid.id,
        method: paid.attributes.source?.type,
        paidAt: paid.attributes.paid_at
          ? new Date(paid.attributes.paid_at * 1000)
          : undefined,
        raw: session as unknown as Record<string, unknown>,
      };
    }
    if (session.attributes.status === "expired")
      return { status: "expired", raw: session as unknown as Record<string, unknown> };
    const failed = session.attributes.payments?.find(
      (p) => p.attributes.status === "failed",
    );
    if (
      failed &&
      !session.attributes.payments?.some((p) => p.attributes.status === "pending")
    ) {
      return {
        status: "failed",
        settledPaymentId: failed.id,
        raw: session as unknown as Record<string, unknown>,
      };
    }
    return { status: "pending", raw: session as unknown as Record<string, unknown> };
  }

  return {
    id: "paymongo",

    async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
      const body = {
        data: {
          attributes: {
            line_items: input.lineItems.map((li) => ({
              name: li.name.slice(0, 255),
              description: li.description?.slice(0, 255),
              amount: li.amountCentavos,
              currency: "PHP",
              quantity: li.quantity,
              ...(li.imageUrl ? { images: [li.imageUrl] } : {}),
            })),
            payment_method_types: config.paymentMethodTypes ?? DEFAULT_METHODS,
            success_url: input.successUrl,
            cancel_url: input.cancelUrl,
            reference_number: input.orderNumber,
            description: input.description.slice(0, 255),
            send_email_receipt: false,
            show_description: true,
            show_line_items: true,
            billing: {
              name: input.customer.name,
              email: input.customer.email,
              phone: input.customer.phone,
            },
            metadata: {
              payment_id: input.paymentId,
              order_id: input.orderId,
              order_number: input.orderNumber,
            },
          },
        },
      };
      const res = await request<{ data: unknown }>("POST", "/v1/checkout_sessions", body);
      const session = checkoutSessionSchema.parse(res.data);
      if (!session.attributes.checkout_url)
        throw new ProviderError("PayMongo did not return a checkout_url.");
      return {
        providerPaymentId: session.id,
        checkoutUrl: session.attributes.checkout_url,
        raw: session as unknown as Record<string, unknown>,
      };
    },

    async retrieveCheckout(providerPaymentId: string): Promise<RetrieveCheckoutResult> {
      const res = await request<{ data: unknown }>(
        "GET",
        `/v1/checkout_sessions/${encodeURIComponent(providerPaymentId)}`,
      );
      return mapStatus(checkoutSessionSchema.parse(res.data));
    },

    async expireCheckout(providerPaymentId: string): Promise<void> {
      try {
        await request(
          "POST",
          `/v1/checkout_sessions/${encodeURIComponent(providerPaymentId)}/expire`,
        );
      } catch (error) {
        // Docs: 400 when already expired / paid / payment ongoing. Not fatal for us.
        if (error instanceof ProviderError && error.status === 400) return;
        throw error;
      }
    },

    async createRefund(input: RefundInput): Promise<RefundResult> {
      const res = await request<{ data: { id: string; attributes: { status: string } } }>(
        "POST",
        "/v1/refunds",
        {
          data: {
            attributes: {
              amount: input.amountCentavos,
              payment_id: input.providerPaymentId,
              reason: input.reason,
              notes: input.notes?.slice(0, 255),
            },
          },
        },
      );
      const status = res.data.attributes.status as RefundResult["status"];
      return {
        providerRefundId: res.data.id,
        status: ["pending", "processing", "succeeded", "failed"].includes(status)
          ? status
          : "pending",
        raw: res.data as unknown as Record<string, unknown>,
      };
    },

    parseWebhook(rawBody: string, headers: Headers): NormalizedEvent {
      let parsed: z.infer<typeof eventSchema>;
      try {
        parsed = eventSchema.parse(JSON.parse(rawBody));
      } catch {
        throw new WebhookSignatureError("Malformed webhook payload.");
      }
      const livemode = parsed.data.attributes.livemode;
      const ok = verifyPaymongoSignature({
        header: headers.get("paymongo-signature"),
        rawBody,
        secret: config.webhookSecret,
        livemode,
      });
      if (!ok) throw new WebhookSignatureError();

      const type = parsed.data.attributes.type;
      const resource = parsed.data.attributes.data;
      const eventId = parsed.data.id;

      if (type === "checkout_session.payment.paid") {
        const session = checkoutSessionSchema.parse(resource);
        const paid = session.attributes.payments?.find(
          (p) => p.attributes.status === "paid",
        );
        return {
          kind: "checkout.paid",
          eventId,
          providerPaymentId: session.id,
          settledPaymentId: paid?.id,
          method: paid?.attributes.source?.type,
          paidAt: paid?.attributes.paid_at
            ? new Date(paid.attributes.paid_at * 1000)
            : undefined,
          livemode,
          raw: parsed,
        };
      }
      if (type === "payment.failed") {
        const attrs = resource.attributes as Record<string, unknown>;
        const lastError = attrs.last_payment_error as
          { code?: string; message?: string } | null | undefined;
        return {
          kind: "payment.failed",
          eventId,
          settledPaymentId: resource.id,
          failureCode: lastError?.code,
          failureMessage: lastError?.message,
          livemode,
          raw: parsed,
        };
      }
      if (type === "refund.succeeded") {
        const attrs = resource.attributes as { payment_id?: string; amount?: number };
        return {
          kind: "refund.succeeded",
          eventId,
          providerRefundId: resource.id,
          settledPaymentId: attrs.payment_id ?? "",
          amountCentavos: attrs.amount ?? 0,
          livemode,
          raw: parsed,
        };
      }
      return { kind: "ignored", eventId, type, livemode, raw: parsed };
    },
  };
}
