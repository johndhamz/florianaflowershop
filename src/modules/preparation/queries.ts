import "server-only";

import { createClient } from "@/lib/supabase/server";

export type QueueItem = {
  order_id: string;
  order_number: string;
  delivery_date: string;
  slot_label: string | null;
  slot_starts_at: string | null;
  fulfillment_status: string;
  delivery_status: string;
  placed_at: string;
  prepared_by: string | null;
  prepared_by_name: string | null;
  preparation_started_at: string | null;
  ready_at: string | null;
  arrangement_photo_path: string | null;
  gift_message: string | null;
  delivery_instructions: string | null;
  internal_notes: string | null;
  needs_attention: boolean | null;
  zone_name: string | null;
  recipient_name: string | null;
  items: {
    product_name: string;
    variant_name: string;
    quantity: number;
    add_ons: { name: string; quantity: number }[];
  }[];
  substitutions: number;
};

export type RecipeLine = {
  material_id: string;
  sku: string;
  name: string;
  unit: string;
  per_unit: number;
  total: number;
  is_optional: boolean;
};

export type PreparationDetails = {
  order: {
    order_id: string;
    order_number: string;
    status: string;
    fulfillment_status: string;
    delivery_status: string;
    payment_status: string;
    delivery_date: string | null;
    slot_label: string | null;
    gift_message: string | null;
    delivery_instructions: string | null;
    internal_notes: string | null;
    prepared_by: string | null;
    preparation_started_at: string | null;
    ready_at: string | null;
    arrangement_photo_path: string | null;
    needs_attention: boolean | null;
    recipient_name: string | null;
    barangay: string | null;
    city: string | null;
  };
  items: {
    order_item_id: string;
    product_name: string;
    variant_name: string;
    sku: string;
    quantity: number;
    image_path: string | null;
    recipe: {
      name: string;
      instructions: string | null;
      assembly_minutes: number | null;
      lines: RecipeLine[];
    } | null;
    add_ons: { name: string; quantity: number }[];
  }[];
  reservations: {
    material_id: string;
    material: string;
    unit: string;
    batch_code: string;
    batch_id: string;
    expires_at: string | null;
    quantity: number;
    status: string;
  }[];
  substitutions: {
    id: string;
    from: string;
    to: string;
    quantity: number;
    reason: string;
    status: string;
    created_at: string;
  }[];
  movements: {
    type: string;
    material: string;
    batch_code: string;
    quantity: number;
    reason: string | null;
    at: string;
  }[];
};

export async function getPreparationQueue(includeReady = false): Promise<QueueItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("preparation_queue", {
    p_include_ready: includeReady,
  });
  if (error) throw new Error(error.message);
  return (data as QueueItem[] | null) ?? [];
}

export async function getPreparationDetails(
  orderId: string,
): Promise<PreparationDetails | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("preparation_details", {
    p_order_id: orderId,
  });
  if (error) throw new Error(error.message);
  const d = data as PreparationDetails | null;
  return d?.order ? d : null;
}

/** Signed URL for a private arrangement photo (staff only). */
export async function getArrangementPhotoUrl(
  path: string | null,
): Promise<string | null> {
  if (!path) return null;
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from("arrangement-photos")
    .createSignedUrl(path, 600);
  return data?.signedUrl ?? null;
}
