import "server-only";

import { createClient } from "@/lib/supabase/server";

export type AdminOrderRow = {
  order_id: string;
  order_number: string;
  placed_at: string;
  status: string;
  payment_status: string;
  fulfillment_status: string;
  delivery_status: string;
  delivery_date: string;
  customer_name: string;
  total_centavos: number;
  item_count: number;
  zone_name: string | null;
};

export async function listAdminOrders(filters: {
  status?: string;
  q?: string;
}): Promise<AdminOrderRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_orders_list", {
    p_status: filters.status ?? "all",
    p_query: filters.q ?? "",
    p_limit: 200,
  });
  if (error) throw new Error(error.message);
  return (data as AdminOrderRow[] | null) ?? [];
}

export async function getAdminOrder(orderId: string) {
  const supabase = await createClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, placed_at, confirmed_at, cancelled_at, cancellation_reason, status, payment_status, fulfillment_status, delivery_status, delivery_date, delivery_slot_snapshot, delivery_zone_snapshot, customer_name, customer_email, customer_phone, gift_message, delivery_instructions, internal_notes, subtotal_centavos, add_ons_centavos, discount_centavos, delivery_fee_centavos, total_centavos, promo_code_snapshot, delivery_attempts, order_items ( id, product_name, variant_name, sku, quantity, unit_price_centavos, line_total_centavos ), payments ( id, provider, method, status, amount_centavos, attempt, paid_at, created_at, refunds ( id, amount_centavos, status, reason, processed_at ) ), order_status_history ( from_status, to_status, note, created_at )",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!order) return null;
  // Recipient rows are RLS-restricted (riders only for assigned orders, no florist access to phone).
  const { data: recipient } = await supabase
    .from("order_recipients")
    .select("full_name, phone, address_line1, address_line2, barangay, city, landmark")
    .eq("order_id", orderId)
    .maybeSingle();
  return { ...order, recipient: recipient ?? null };
}
