import type { Centavos } from "@/lib/money";

/** Which gateway an order uses. "mock" exists only for local dev and E2E. */
export type ProviderId = "paymongo" | "mock";

export type CheckoutLineItem = {
  name: string;
  description?: string;
  amountCentavos: Centavos;
  quantity: number;
  imageUrl?: string;
};

export type CreateCheckoutInput = {
  /** Our payment attempt id — round-trips through provider metadata. */
  paymentId: string;
  orderId: string;
  orderNumber: string;
  amountCentavos: Centavos;
  lineItems: CheckoutLineItem[];
  successUrl: string;
  cancelUrl: string;
  customer: { name: string; email: string; phone: string };
  description: string;
};

export type CreateCheckoutResult = {
  /** Provider's session/intent id, stored as payments.provider_payment_id. */
  providerPaymentId: string;
  checkoutUrl: string;
  raw: Record<string, unknown>;
};

export type ProviderPaymentStatus = "pending" | "paid" | "failed" | "expired" | "unknown";

export type RetrieveCheckoutResult = {
  status: ProviderPaymentStatus;
  /** The settled payment id on the provider side (pay_… for PayMongo). */
  settledPaymentId?: string;
  method?: string;
  paidAt?: Date;
  raw: Record<string, unknown>;
};

export type RefundInput = {
  providerPaymentId: string;
  amountCentavos: Centavos;
  reason: "duplicate" | "fraudulent" | "requested_by_customer" | "others";
  notes?: string;
};
export type RefundResult = {
  providerRefundId: string;
  status: "pending" | "processing" | "succeeded" | "failed";
  raw: Record<string, unknown>;
};

/** Normalised webhook event after signature verification. */
export type NormalizedEvent =
  | {
      kind: "checkout.paid";
      eventId: string;
      providerPaymentId: string;
      settledPaymentId?: string;
      method?: string;
      paidAt?: Date;
      livemode: boolean;
      raw: unknown;
    }
  | {
      kind: "payment.failed";
      eventId: string;
      settledPaymentId: string;
      failureCode?: string;
      failureMessage?: string;
      livemode: boolean;
      raw: unknown;
    }
  | {
      kind: "refund.succeeded";
      eventId: string;
      providerRefundId: string;
      settledPaymentId: string;
      amountCentavos: Centavos;
      livemode: boolean;
      raw: unknown;
    }
  | { kind: "ignored"; eventId: string; type: string; livemode: boolean; raw: unknown };

export class WebhookSignatureError extends Error {
  constructor(message = "Invalid webhook signature.") {
    super(message);
    this.name = "WebhookSignatureError";
  }
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export interface PaymentProvider {
  readonly id: ProviderId;
  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
  retrieveCheckout(providerPaymentId: string): Promise<RetrieveCheckoutResult>;
  expireCheckout(providerPaymentId: string): Promise<void>;
  createRefund(input: RefundInput): Promise<RefundResult>;
  /** Verifies the signature and parses the raw body. Throws WebhookSignatureError. */
  parseWebhook(rawBody: string, headers: Headers): NormalizedEvent;
}
