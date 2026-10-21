"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/modules/auth/dal";
import type { ActionResult } from "@/modules/inventory/actions";

const schema = z.object({
  id: z.uuid().optional(),
  code: z
    .string()
    .trim()
    .min(3, "Code must be at least 3 characters.")
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/, "Letters, digits, dashes and underscores only."),
  description: z.string().trim().max(200).optional(),
  promo_type: z.enum(["percent", "fixed"]),
  value: z.coerce.number().positive("Value must be greater than zero."),
  min_subtotal_pesos: z.coerce.number().min(0).default(0),
  max_discount_pesos: z.coerce.number().min(0).nullable().default(null),
  starts_at: z.string().optional(),
  ends_at: z.string().optional(),
  max_uses: z.coerce.number().int().positive().nullable().default(null),
  per_customer_limit: z.coerce.number().int().positive().nullable().default(null),
  first_order_only: z.boolean().default(false),
  eligible_collection_ids: z.array(z.uuid()).default([]),
  is_active: z.boolean().default(true),
});
export type PromoInput = z.input<typeof schema>;

export async function savePromo(input: PromoInput): Promise<ActionResult> {
  try {
    await requireStaff("promos.manage");
    const parsed = schema.safeParse(input);
    if (!parsed.success)
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the fields." };
    const v = parsed.data;
    if (v.promo_type === "percent" && (v.value < 1 || v.value > 100))
      return { ok: false, error: "Percent must be between 1 and 100." };
    if (v.starts_at && v.ends_at && v.ends_at <= v.starts_at)
      return { ok: false, error: "End must be after start." };
    const row = {
      code: v.code.toUpperCase(),
      description: v.description || null,
      promo_type: v.promo_type,
      value: v.promo_type === "percent" ? Math.round(v.value) : Math.round(v.value * 100),
      min_subtotal_centavos: Math.round(v.min_subtotal_pesos * 100),
      max_discount_centavos: v.max_discount_pesos
        ? Math.round(v.max_discount_pesos * 100)
        : null,
      starts_at: v.starts_at ? new Date(v.starts_at).toISOString() : null,
      ends_at: v.ends_at ? new Date(v.ends_at).toISOString() : null,
      max_uses: v.max_uses,
      per_customer_limit: v.per_customer_limit,
      first_order_only: v.first_order_only,
      eligible_collection_ids: v.eligible_collection_ids,
      is_active: v.is_active,
    };
    const supabase = await createClient();
    const { error } = v.id
      ? await supabase.from("promo_codes").update(row).eq("id", v.id)
      : await supabase.from("promo_codes").insert(row);
    if (error)
      return {
        ok: false,
        error: error.code === "23505" ? "That code already exists." : error.message,
      };
    revalidatePath("/admin/promotions");
    return { ok: true, message: v.id ? "Promotion updated." : "Promotion created." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}
