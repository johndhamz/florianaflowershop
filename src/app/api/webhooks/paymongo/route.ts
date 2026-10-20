import { NextResponse } from "next/server";

import { getPaymentProvider } from "@/modules/payments/provider";
import { WebhookSignatureError } from "@/modules/payments/types";
import { processWebhookEvent } from "@/modules/payments/webhook";

/**
 * Provider webhook receiver.
 *  - Reads the RAW body (signature is computed over the exact bytes).
 *  - Rejects bad signatures with 400 (PayMongo will retry; a real event will carry a valid one).
 *  - Returns 200 quickly; the provider retries up to 12 times on non-2xx / >30 s.
 *  - Duplicates are harmless: record_payment_event is unique per provider event id.
 */
export async function POST(request: Request) {
  const provider = getPaymentProvider();
  const rawBody = await request.text();

  let event;
  try {
    event = provider.parseWebhook(rawBody, request.headers);
  } catch (err) {
    if (err instanceof WebhookSignatureError) {
      return NextResponse.json({ error: "invalid signature" }, { status: 400 });
    }
    throw err;
  }

  try {
    const outcome = await processWebhookEvent(provider, event);
    return NextResponse.json({ received: true, ...outcome }, { status: 200 });
  } catch (err) {
    console.error("webhook processing failed", err);
    // 500 → provider retries later; the event row keeps the error for inspection.
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}
