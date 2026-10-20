"use server";

import { getServerEnv } from "@/lib/env";
import { getRequestOrigin } from "@/lib/request-origin";

import { buildMockWebhook, settleMockSession } from "./providers/mock";

/**
 * Dev/E2E only: settles a mock session and delivers the signed webhook to our
 * own endpoint exactly like the provider would (over HTTP, raw body + header).
 */
export async function settleMockPayment(
  sessionId: string,
  outcome: "paid" | "failed",
): Promise<{ ok: true } | { ok: false; error: string }> {
  const env = getServerEnv();
  if (env.PAYMENT_PROVIDER !== "mock")
    return { ok: false, error: "Mock payments are disabled." };
  const session = settleMockSession(sessionId, outcome);
  if (!session) return { ok: false, error: "Unknown session." };
  const { rawBody, signature } = buildMockWebhook(session, outcome);
  const origin = await getRequestOrigin();
  const res = await fetch(`${origin}/api/webhooks/paymongo`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Paymongo-Signature": signature },
    body: rawBody,
  });
  if (!res.ok) return { ok: false, error: `Webhook delivery failed (${res.status}).` };
  // Simulate a duplicate delivery (PayMongo retries): must be a no-op.
  await fetch(`${env.NEXT_PUBLIC_SITE_URL}/api/webhooks/paymongo`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Paymongo-Signature": signature },
    body: rawBody,
  });
  return { ok: true };
}
