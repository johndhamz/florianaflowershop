"use server";

import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";

import { getRequestOrigin } from "@/lib/request-origin";
import { createPublicClient } from "@/lib/supabase/public";
import { createAdminClient } from "@/lib/supabase/server";
import { readCartToken } from "@/modules/cart/token";
import { getPaymentProvider } from "@/modules/payments/provider";

import { checkoutSchema, flattenIssues } from "./schema";
import type { DeliveryOptions, PlaceOrderResult, PromoCheck } from "./types";

const CHECKOUT_KEY_COOKIE = "ff_checkout_key";

/**
 * One idempotency key per checkout attempt, minted server-side and held in a
 * short-lived httpOnly cookie. Double submits, retries after a network drop and
 * browser back/forward all replay to the same order instead of creating twins.
 */
async function getCheckoutKey(): Promise<string> {
  const store = await cookies();
  const existing = store.get(CHECKOUT_KEY_COOKIE)?.value;
  if (existing && /^[a-f0-9-]{36}$/.test(existing)) return existing;
  const key = randomUUID();
  store.set(CHECKOUT_KEY_COOKIE, key, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/checkout",
    maxAge: 60 * 30,
  });
  return key;
}

async function rotateCheckoutKey() {
  const store = await cookies();
  store.set(CHECKOUT_KEY_COOKIE, "", { path: "/checkout", maxAge: 0 });
}

export async function getDeliveryOptions(
  zoneId: string,
  date: string,
): Promise<DeliveryOptions> {
  const { data, error } = await createPublicClient().rpc("list_delivery_options", {
    p_zone_id: zoneId,
    p_delivery_date: date,
  });
  if (error) return { ok: false, message: "Could not load delivery slots." };
  return data as DeliveryOptions;
}

export async function checkPromoCode(
  code: string,
  goodsCentavos: number,
): Promise<PromoCheck> {
  const { data, error } = await createPublicClient().rpc("validate_promo_code", {
    p_code: code,
    p_goods_centavos: goodsCentavos,
  });
  if (error) return { valid: false, message: "Could not check the promo code." };
  return data as PromoCheck;
}

function dbMessage(error: { message: string; details?: string | null }) {
  // app.raise() puts the human message in `message` and the code in `details`.
  return { message: error.message, code: error.details ?? undefined };
}

export async function placeOrder(input: unknown): Promise<PlaceOrderResult> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    console.warn("placeOrder validation failed", JSON.stringify(parsed.error.issues));
    return {
      ok: false,
      error: "Please check the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: flattenIssues(parsed.error),
    };
  }

  const cartToken = await readCartToken();
  if (!cartToken) return { ok: false, error: "Your cart is empty.", code: "CART_EMPTY" };
  const idempotencyKey = await getCheckoutKey();

  // 1) Atomic order placement (stock + slot + snapshot) as the shopper.
  const { data, error } = await createPublicClient().rpc("place_order", {
    p_cart_token: cartToken,
    p_idempotency_key: idempotencyKey,
    p_input: parsed.data,
  });
  if (error) {
    const { message, code } = dbMessage(error);
    if (code === "CART_CHANGED" || code === "CART_EMPTY")
      return { ok: false, error: message, code };
    const fieldErrors: Record<string, string> = {};
    if (code === "INVALID_PROMO") fieldErrors["promo_code"] = message;
    if (code === "BARANGAY_NOT_COVERED") fieldErrors["recipient.barangay"] = message;
    if (code === "SLOT_UNAVAILABLE" || code === "INVALID_SLOT")
      fieldErrors["delivery.slot_id"] = message;
    if (code === "INVALID_DATE") fieldErrors["delivery.date"] = message;
    return {
      ok: false,
      error: message,
      code,
      fieldErrors: Object.keys(fieldErrors).length ? fieldErrors : undefined,
    };
  }
  const placed = data as {
    order_id: string;
    order_number: string;
    tracking_token: string;
    total_centavos: number;
    payment_status: string;
    payment_method?: string;
    replayed: boolean;
  };

  if (placed.payment_status === "paid") {
    await rotateCheckoutKey();
    return {
      ok: true,
      orderNumber: placed.order_number,
      trackingToken: placed.tracking_token,
      next: { kind: "instructions" },
    };
  }

  // 2) Payment attempt (trusted server path).
  const admin = createAdminClient();
  const method = parsed.data.payment_method;
  const attemptKey = `${idempotencyKey}:attempt:1`;
  const { data: payment, error: payErr } = await admin.rpc("create_payment_attempt", {
    p_order_id: placed.order_id,
    p_provider: method,
    p_idempotency_key: attemptKey,
    p_expires_at:
      method === "paymongo"
        ? new Date(Date.now() + 30 * 60_000).toISOString()
        : undefined,
  });
  if (payErr)
    return {
      ok: false,
      error:
        "We saved your order but could not start payment. Open your order page to pay.",
      code: "PAYMENT_INIT_FAILED",
    };
  const attempt = payment as {
    id: string;
    provider_payment_id: string | null;
    checkout_url: string | null;
  };

  const origin = await getRequestOrigin();
  const tracking = `${origin}/orders/${placed.order_number}?t=${placed.tracking_token}`;
  if (method === "bank_transfer") {
    await rotateCheckoutKey();
    return {
      ok: true,
      orderNumber: placed.order_number,
      trackingToken: placed.tracking_token,
      next: { kind: "instructions" },
    };
  }

  // Replayed attempt that already has a hosted checkout → reuse it.
  if (attempt.checkout_url) {
    return {
      ok: true,
      orderNumber: placed.order_number,
      trackingToken: placed.tracking_token,
      next: { kind: "redirect", url: attempt.checkout_url },
    };
  }

  const { data: items } = await admin
    .from("order_items")
    .select("product_name, variant_name, unit_price_centavos, quantity")
    .eq("order_id", placed.order_id);
  const { data: order } = await admin
    .from("orders")
    .select(
      "delivery_fee_centavos, discount_centavos, add_ons_centavos, customer_name, customer_email, customer_phone",
    )
    .eq("id", placed.order_id)
    .single();

  const lineItems = (items ?? []).map((i) => ({
    name: `${i.product_name} · ${i.variant_name}`,
    amountCentavos: i.unit_price_centavos,
    quantity: i.quantity,
  }));
  if (order?.add_ons_centavos)
    lineItems.push({
      name: "Add-ons",
      amountCentavos: order.add_ons_centavos,
      quantity: 1,
    });
  if (order?.delivery_fee_centavos)
    lineItems.push({
      name: "Delivery",
      amountCentavos: order.delivery_fee_centavos,
      quantity: 1,
    });
  if (order?.discount_centavos) {
    // Hosted checkout line items cannot be negative: fold the discount into the total line.
    const goods = lineItems.reduce((s, l) => s + l.amountCentavos * l.quantity, 0);
    lineItems.length = 0;
    lineItems.push({
      name: `Order ${placed.order_number} (promo applied)`,
      amountCentavos: goods - order.discount_centavos,
      quantity: 1,
    });
  }

  try {
    const provider = getPaymentProvider();
    const session = await provider.createCheckout({
      paymentId: attempt.id,
      orderId: placed.order_id,
      orderNumber: placed.order_number,
      amountCentavos: placed.total_centavos,
      lineItems,
      successUrl: `${origin}/checkout/confirmation?order=${placed.order_number}&t=${placed.tracking_token}`,
      cancelUrl: tracking,
      customer: {
        name: order?.customer_name ?? "",
        email: order?.customer_email ?? "",
        phone: order?.customer_phone ?? "",
      },
      description: `Floriana Flowers order ${placed.order_number}`,
    });
    await admin.rpc("update_payment_provider_ref", {
      p_payment_id: attempt.id,
      p_provider_payment_id: session.providerPaymentId,
      p_checkout_url: session.checkoutUrl,
      p_provider_data: { created: session.raw } as never,
    });
    await rotateCheckoutKey();
    return {
      ok: true,
      orderNumber: placed.order_number,
      trackingToken: placed.tracking_token,
      next: { kind: "redirect", url: session.checkoutUrl },
    };
  } catch (err) {
    console.error("createCheckout failed", err);
    await rotateCheckoutKey();
    return {
      ok: false,
      error: `We saved your order (${placed.order_number}) but the payment page could not be opened. Open your order to retry.`,
      code: "PROVIDER_ERROR",
    };
  }
}

/** Retry payment from the tracking page (token-scoped). */
export async function startPaymentRetry(
  orderNumber: string,
  token: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const { data: tracking } = await createPublicClient().rpc("get_order_for_tracking", {
    p_order_number: orderNumber,
    p_token: token,
  });
  const order = tracking as {
    order_id: string;
    can_pay: boolean;
    total_centavos: number;
    customer_name: string;
    payments: {
      id: string;
      provider: string;
      status: string;
      provider_reference: string | null;
      checkout_url: string | null;
    }[];
  } | null;
  if (!order) return { ok: false, error: "Order not found." };
  if (!order.can_pay)
    return { ok: false, error: "This order can no longer be paid online." };

  const admin = createAdminClient();
  const provider = getPaymentProvider();
  const open = order.payments.find(
    (p) => p.provider !== "bank_transfer" && p.status === "pending" && p.checkout_url,
  );
  if (open) return { ok: true, url: open.checkout_url! };

  // Expire superseded hosted sessions before opening a new one.
  for (const p of order.payments.filter(
    (x) => x.provider !== "bank_transfer" && x.status === "pending",
  )) {
    const { data: full } = await admin
      .from("payments")
      .select("provider_payment_id")
      .eq("id", p.id)
      .single();
    if (full?.provider_payment_id)
      await provider.expireCheckout(full.provider_payment_id).catch(() => undefined);
  }

  const { data: payment, error } = await admin.rpc("create_payment_attempt", {
    p_order_id: order.order_id,
    p_provider: "paymongo",
    p_idempotency_key: `retry:${order.order_id}:${randomUUID()}`,
    p_expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  const attempt = payment as { id: string };
  const { data: o } = await admin
    .from("orders")
    .select("customer_name, customer_email, customer_phone")
    .eq("id", order.order_id)
    .single();
  const origin = await getRequestOrigin();
  try {
    const session = await provider.createCheckout({
      paymentId: attempt.id,
      orderId: order.order_id,
      orderNumber,
      amountCentavos: order.total_centavos,
      lineItems: [
        {
          name: `Floriana Flowers order ${orderNumber}`,
          amountCentavos: order.total_centavos,
          quantity: 1,
        },
      ],
      successUrl: `${origin}/checkout/confirmation?order=${orderNumber}&t=${token}`,
      cancelUrl: `${origin}/orders/${orderNumber}?t=${token}`,
      customer: {
        name: o?.customer_name ?? "",
        email: o?.customer_email ?? "",
        phone: o?.customer_phone ?? "",
      },
      description: `Floriana Flowers order ${orderNumber}`,
    });
    await admin.rpc("update_payment_provider_ref", {
      p_payment_id: attempt.id,
      p_provider_payment_id: session.providerPaymentId,
      p_checkout_url: session.checkoutUrl,
    });
    return { ok: true, url: session.checkoutUrl };
  } catch (err) {
    console.error("retry createCheckout failed", err);
    return {
      ok: false,
      error: "The payment page could not be opened. Please try again.",
    };
  }
}

const PROOF_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

/** Bank-transfer proof upload (token-scoped; stored in the private bucket). */
export async function uploadPaymentProof(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const orderNumber = String(formData.get("order") ?? "");
  const token = String(formData.get("t") ?? "");
  const reference = String(formData.get("reference") ?? "").slice(0, 80);
  const file = formData.get("proof");
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, error: "Attach a screenshot or PDF of the transfer." };
  if (!PROOF_TYPES.has(file.type))
    return { ok: false, error: "Use a JPG, PNG, WebP or PDF file." };
  if (file.size > 5 * 1024 * 1024)
    return { ok: false, error: "The file must be under 5 MB." };

  const { data: tracking } = await createPublicClient().rpc("get_order_for_tracking", {
    p_order_number: orderNumber,
    p_token: token,
  });
  const order = tracking as { order_id: string } | null;
  if (!order) return { ok: false, error: "Order not found." };

  const ext =
    file.type === "application/pdf"
      ? "pdf"
      : file.type.split("/")[1]!.replace("jpeg", "jpg");
  const path = `orders/${order.order_id}/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
  const admin = createAdminClient();
  const { error: upErr } = await admin.storage
    .from("payment-proofs")
    .upload(path, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type,
      upsert: false,
    });
  if (upErr) return { ok: false, error: "Upload failed. Please try again." };
  const { error } = await createPublicClient().rpc("attach_payment_proof", {
    p_order_number: orderNumber,
    p_token: token,
    p_storage_path: path,
    p_reference: reference || undefined,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
