import { describe, expect, it, vi } from "vitest";

import { createPaymongoProvider } from "@/modules/payments/providers/paymongo";
import { buildSignatureHeader } from "@/modules/payments/providers/signature";
import { ProviderError, WebhookSignatureError } from "@/modules/payments/types";

const secretKey = "sk_test_abc";
const webhookSecret = "whsk_abc";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("PayMongo adapter", () => {
  it("creates a checkout session with documented fields and Basic auth", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe("https://api.paymongo.com/v1/checkout_sessions");
      expect(init?.method).toBe("POST");
      expect((init?.headers as Record<string, string>).Authorization).toBe(
        `Basic ${Buffer.from("sk_test_abc:").toString("base64")}`,
      );
      const body = JSON.parse(String(init?.body));
      expect(body.data.attributes.line_items[0]).toMatchObject({
        name: "Blush Romance · A dozen",
        amount: 249000,
        currency: "PHP",
        quantity: 1,
      });
      expect(body.data.attributes.payment_method_types).toEqual([
        "gcash",
        "paymaya",
        "card",
        "grab_pay",
      ]);
      expect(body.data.attributes.reference_number).toBe("FL-10010");
      expect(body.data.attributes.metadata).toEqual({
        payment_id: "pay-1",
        order_id: "ord-1",
        order_number: "FL-10010",
      });
      return jsonResponse(200, {
        data: {
          id: "cs_123",
          type: "checkout_session",
          attributes: {
            checkout_url: "https://checkout.paymongo.com/cs_123#pk",
            status: "active",
          },
        },
      });
    });
    const provider = createPaymongoProvider({
      secretKey,
      webhookSecret,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const res = await provider.createCheckout({
      paymentId: "pay-1",
      orderId: "ord-1",
      orderNumber: "FL-10010",
      amountCentavos: 249000,
      lineItems: [
        { name: "Blush Romance · A dozen", amountCentavos: 249000, quantity: 1 },
      ],
      successUrl: "https://shop/ok",
      cancelUrl: "https://shop/cancel",
      customer: { name: "A", email: "a@b.c", phone: "+639171234567" },
      description: "Order FL-10010",
    });
    expect(res).toMatchObject({
      providerPaymentId: "cs_123",
      checkoutUrl: "https://checkout.paymongo.com/cs_123#pk",
    });
  });

  it("maps a retrieved session with a paid payment", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, {
        data: {
          id: "cs_123",
          attributes: {
            status: "active",
            payments: [
              {
                id: "pay_9",
                attributes: {
                  status: "paid",
                  amount: 249000,
                  paid_at: 1700000000,
                  source: { type: "gcash" },
                },
              },
            ],
          },
        },
      }),
    );
    const provider = createPaymongoProvider({
      secretKey,
      webhookSecret,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const res = await provider.retrieveCheckout("cs_123");
    expect(res).toMatchObject({
      status: "paid",
      settledPaymentId: "pay_9",
      method: "gcash",
    });
    expect(res.paidAt?.toISOString()).toBe("2023-11-14T22:13:20.000Z");
  });

  it("surfaces provider errors with status and body", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(400, {
        errors: [{ code: "parameter_required", detail: "line_items is required" }],
      }),
    );
    const provider = createPaymongoProvider({
      secretKey,
      webhookSecret,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await expect(provider.retrieveCheckout("cs_x")).rejects.toBeInstanceOf(ProviderError);
  });

  it("treats expire 400 as non-fatal (already expired/paid)", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(400, { errors: [{ code: "checkout_session_expired" }] }),
    );
    const provider = createPaymongoProvider({
      secretKey,
      webhookSecret,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await expect(provider.expireCheckout("cs_x")).resolves.toBeUndefined();
  });

  it("verifies and normalises a checkout_session.payment.paid webhook", () => {
    const provider = createPaymongoProvider({ secretKey, webhookSecret });
    const event = {
      data: {
        id: "evt_1",
        type: "event",
        attributes: {
          type: "checkout_session.payment.paid",
          livemode: false,
          data: {
            id: "cs_123",
            type: "checkout_session",
            attributes: {
              payments: [
                {
                  id: "pay_9",
                  attributes: {
                    status: "paid",
                    paid_at: 1700000000,
                    source: { type: "card" },
                  },
                },
              ],
            },
          },
          created_at: 1700000000,
        },
      },
    };
    const rawBody = JSON.stringify(event);
    const headers = new Headers({
      "Paymongo-Signature": buildSignatureHeader(webhookSecret, rawBody, false),
    });
    const parsed = provider.parseWebhook(rawBody, headers);
    expect(parsed).toMatchObject({
      kind: "checkout.paid",
      eventId: "evt_1",
      providerPaymentId: "cs_123",
      settledPaymentId: "pay_9",
      method: "card",
    });
  });

  it("rejects an invalid signature and malformed payloads", () => {
    const provider = createPaymongoProvider({ secretKey, webhookSecret });
    const rawBody = JSON.stringify({
      data: {
        id: "evt_2",
        attributes: {
          type: "payment.failed",
          livemode: false,
          data: { id: "pay_1", attributes: {} },
        },
      },
    });
    expect(() =>
      provider.parseWebhook(
        rawBody,
        new Headers({ "Paymongo-Signature": "t=1,te=bad,li=" }),
      ),
    ).toThrow(WebhookSignatureError);
    expect(() => provider.parseWebhook("not json", new Headers())).toThrow(
      WebhookSignatureError,
    );
  });

  it("passes through unknown event types as ignored", () => {
    const provider = createPaymongoProvider({ secretKey, webhookSecret });
    const rawBody = JSON.stringify({
      data: {
        id: "evt_3",
        attributes: {
          type: "payout.deposited",
          livemode: true,
          data: { id: "po_1", attributes: {} },
        },
      },
    });
    const headers = new Headers({
      "Paymongo-Signature": buildSignatureHeader(webhookSecret, rawBody, true),
    });
    expect(provider.parseWebhook(rawBody, headers)).toMatchObject({
      kind: "ignored",
      type: "payout.deposited",
    });
  });
});
