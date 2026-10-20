import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { createPublicClient } from "@/lib/supabase/public";

export type DeliveryZone = {
  id: string;
  slug: string;
  name: string;
  city: string;
  barangays: string[];
  feeCentavos: number;
  freeDeliveryThresholdCentavos: number | null;
  minOrderCentavos: number;
  sameDayCutoff: string | null;
  leadTimeHours: number;
};

export type DeliverySlot = {
  id: string;
  label: string;
  startsAt: string;
  endsAt: string;
  daysOfWeek: number[];
};

export async function listDeliveryZones(): Promise<DeliveryZone[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("delivery");
  const { data, error } = await createPublicClient()
    .from("delivery_zones")
    .select(
      "id, slug, name, city, barangays, fee_centavos, free_delivery_threshold_centavos, min_order_centavos, same_day_cutoff, lead_time_hours",
    )
    .eq("is_active", true)
    .order("position");
  if (error) throw new Error(`delivery_zones: ${error.message}`);
  return (data ?? []).map((z) => ({
    id: z.id,
    slug: z.slug,
    name: z.name,
    city: z.city,
    barangays: z.barangays,
    feeCentavos: z.fee_centavos,
    freeDeliveryThresholdCentavos: z.free_delivery_threshold_centavos,
    minOrderCentavos: z.min_order_centavos,
    sameDayCutoff: z.same_day_cutoff,
    leadTimeHours: z.lead_time_hours,
  }));
}

export async function listDeliverySlots(): Promise<DeliverySlot[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("delivery");
  const { data, error } = await createPublicClient()
    .from("delivery_slots")
    .select("id, label, starts_at, ends_at, days_of_week")
    .eq("is_active", true)
    .order("position");
  if (error) throw new Error(`delivery_slots: ${error.message}`);
  return (data ?? []).map((s) => ({
    id: s.id,
    label: s.label,
    startsAt: s.starts_at,
    endsAt: s.ends_at,
    daysOfWeek: s.days_of_week,
  }));
}
