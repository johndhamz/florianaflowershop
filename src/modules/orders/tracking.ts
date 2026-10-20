import "server-only";

import { createPublicClient } from "@/lib/supabase/public";

export type TrackedPayment = {
  id: string;
  provider: "paymongo" | "bank_transfer" | "manual";
  method: string | null;
  status: string;
  amount_centavos: number;
  attempt: number;
  checkout_url: string | null;
  provider_reference: string | null;
  proof_uploaded_at: string | null;
  failure_message: string | null;
  paid_at: string | null;
  expires_at: string | null;
  created_at: string;
};

export type TrackedOrder = {
  order_id: string;
  order_number: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  payment_status: string;
  fulfillment_status: string;
  delivery_status: string;
  placed_at: string;
  delivery_date: string | null;
  delivery_slot: { label: string; starts_at: string; ends_at: string } | null;
  delivery_zone: { name: string; city: string } | null;
  subtotal_centavos: number;
  add_ons_centavos: number;
  discount_centavos: number;
  delivery_fee_centavos: number;
  total_centavos: number;
  promo_code: string | null;
  customer_name: string;
  email_masked: string;
  gift_message: string | null;
  reservation_expires_at: string | null;
  cancellation_reason: string | null;
  payment_method: "paymongo" | "bank_transfer" | null;
  can_pay: boolean;
  bank_transfer_instructions: string | null;
  items: {
    product_name: string;
    variant_name: string;
    image_path: string | null;
    quantity: number;
    unit_price_centavos: number;
    line_total_centavos: number;
    add_ons: { name: string; quantity: number; line_total_centavos: number }[];
  }[];
  recipient: {
    full_name: string;
    barangay: string;
    city: string;
    address_line1: string;
    phone_masked: string;
  } | null;
  history: { kind: string; to_status: string; at: string }[];
  payments: TrackedPayment[];
};

/** Guest order lookup: order number + secret token. Null on any mismatch. */
export async function getTrackedOrder(
  orderNumber: string,
  token: string | undefined,
): Promise<TrackedOrder | null> {
  if (!token || !/^[A-Z]{2}-\d+$/.test(orderNumber)) return null;
  const { data, error } = await createPublicClient().rpc("get_order_for_tracking", {
    p_order_number: orderNumber,
    p_token: token,
  });
  if (error) throw new Error(`get_order_for_tracking: ${error.message}`);
  return (data as TrackedOrder | null) ?? null;
}
