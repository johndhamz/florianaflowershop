import "server-only";

import { createClient } from "@/lib/supabase/server";

export type BoardRow = {
  order_id: string;
  order_number: string;
  delivery_date: string;
  slot_label: string | null;
  slot_starts_at: string | null;
  zone_name: string | null;
  fulfillment_status: string;
  delivery_status: string;
  delivery_attempts: number;
  assigned_rider_id: string | null;
  rider_name: string | null;
  exception: string | null;
  needs_attention: boolean | null;
  recipient_name: string | null;
  barangay: string | null;
  city: string | null;
  address_line1: string | null;
  recipient_phone: string | null;
  item_count: number;
  delivery_instructions: string | null;
};

export type RiderDelivery = {
  order_id: string;
  order_number: string;
  delivery_date: string;
  slot_label: string | null;
  slot_starts_at: string | null;
  zone_name: string | null;
  fulfillment_status: string;
  delivery_status: string;
  delivery_attempts: number;
  delivery_instructions: string | null;
  has_card: boolean;
  recipient_name: string | null;
  recipient_phone: string | null;
  address: string | null;
  barangay: string | null;
  city: string | null;
  landmark: string | null;
  items: { product_name: string; quantity: number }[] | null;
  events:
    { type: string; note: string | null; exception: string | null; at: string }[] | null;
};

export async function getDispatchBoard(date: string | null): Promise<BoardRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dispatch_board", {
    p_date: date ?? undefined,
  });
  if (error) throw new Error(error.message);
  return (data as BoardRow[] | null) ?? [];
}

export async function listRiders() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff_profiles")
    .select("user_id, display_name, phone, is_active")
    .eq("role", "rider")
    .order("display_name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getRiderDeliveries(includeDone = false): Promise<RiderDelivery[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rider_deliveries", {
    p_include_done: includeDone,
  });
  if (error) throw new Error(error.message);
  return (data as RiderDelivery[] | null) ?? [];
}

export async function listZonesAdmin() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("delivery_zones")
    .select("*")
    .order("position");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listSlotsAdmin() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("delivery_slots")
    .select("*")
    .order("position");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listAllocations(fromDate: string, toDate: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("delivery_slot_allocations")
    .select("*, delivery_slots ( label )")
    .gte("delivery_date", fromDate)
    .lte("delivery_date", toDate)
    .order("delivery_date");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getProofUrl(path: string | null) {
  if (!path) return null;
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from("delivery-proofs")
    .createSignedUrl(path, 600);
  return data?.signedUrl ?? null;
}

export async function listDeliveryEvents(orderId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("delivery_events")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at");
  if (error) throw new Error(error.message);
  return data ?? [];
}
