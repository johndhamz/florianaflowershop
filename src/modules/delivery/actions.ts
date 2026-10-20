"use server";

import { z } from "zod";

import { createPublicClient } from "@/lib/supabase/public";

export type CoverageMatch = {
  zoneId: string;
  zoneName: string;
  city: string;
  matchedBarangay: string | null;
  feeCentavos: number;
  freeDeliveryThresholdCentavos: number | null;
  sameDayCutoff: string | null;
  leadTimeHours: number;
};

export type CoverageResult =
  { ok: true; query: string; matches: CoverageMatch[] } | { ok: false; error: string };

const querySchema = z.string().trim().min(3, "Type at least 3 letters.").max(60);

/** Delivery coverage checker: matches a barangay or city against active zones. */
export async function checkCoverage(
  _prev: CoverageResult | null,
  formData: FormData,
): Promise<CoverageResult> {
  const parsed = querySchema.safeParse(formData.get("q"));
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Enter a barangay or city.",
    };

  const { data, error } = await createPublicClient().rpc("find_delivery_zone", {
    p_query: parsed.data,
  });
  if (error)
    return {
      ok: false,
      error: "We could not check coverage right now. Please try again.",
    };

  return {
    ok: true,
    query: parsed.data,
    matches: (data ?? []).map((row) => ({
      zoneId: row.zone_id,
      zoneName: row.zone_name,
      city: row.city,
      matchedBarangay: row.matched_barangay,
      feeCentavos: row.fee_centavos,
      freeDeliveryThresholdCentavos: row.free_delivery_threshold_centavos,
      sameDayCutoff: row.same_day_cutoff,
      leadTimeHours: row.lead_time_hours,
    })),
  };
}
