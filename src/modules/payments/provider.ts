import "server-only";

import { getServerEnv } from "@/lib/env";

import { createMockProvider } from "./providers/mock";
import { createPaymongoProvider } from "./providers/paymongo";
import type { PaymentProvider, ProviderId } from "./types";

let cached: PaymentProvider | undefined;

/** Resolves the configured gateway. Never falls back to mock in production. */
export function getPaymentProvider(): PaymentProvider {
  if (cached) return cached;
  const env = getServerEnv();
  const id = env.PAYMENT_PROVIDER as ProviderId;
  if (id === "paymongo") {
    if (!env.PAYMONGO_SECRET_KEY || !env.PAYMONGO_WEBHOOK_SECRET) {
      throw new Error(
        "PAYMENT_PROVIDER=paymongo requires PAYMONGO_SECRET_KEY and PAYMONGO_WEBHOOK_SECRET.",
      );
    }
    cached = createPaymongoProvider({
      secretKey: env.PAYMONGO_SECRET_KEY,
      webhookSecret: env.PAYMONGO_WEBHOOK_SECRET,
    });
    return cached;
  }
  if (env.NODE_ENV === "production" && !env.ALLOW_MOCK_PAYMENTS) {
    throw new Error(
      "Mock payments are disabled in production. Set PAYMENT_PROVIDER=paymongo.",
    );
  }
  cached = createMockProvider();
  return cached;
}
