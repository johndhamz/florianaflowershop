"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/modules/auth/dal";
import { CONTENT_TAG } from "@/modules/content/queries";
import type { ActionResult } from "@/modules/inventory/actions";

const schema = z.object({
  shop_name: z.string().trim().min(2).max(80),
  tagline: z.string().trim().max(120).optional(),
  contact_email: z.email(),
  contact_phone: z.string().trim().min(7).max(30),
  address: z.string().trim().min(3).max(200),
  same_day_cutoff: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM."),
  reservation_ttl_minutes: z.coerce.number().int().min(5).max(240),
  bank_transfer_hold_hours: z.coerce.number().int().min(1).max(168),
  online_payments_enabled: z.boolean(),
  bank_transfer_enabled: z.boolean(),
  bank_transfer_instructions: z.string().trim().max(1000).optional(),
  low_stock_alert_email: z.email().or(z.literal("")).optional(),
  notifications_from_email: z.string().trim().max(120).optional(),
});
export type SettingsInput = z.input<typeof schema>;

export async function updateBusinessSettings(
  input: SettingsInput,
): Promise<ActionResult> {
  try {
    await requireStaff("settings.manage");
    const parsed = schema.safeParse(input);
    if (!parsed.success)
      return {
        ok: false,
        error: `${parsed.error.issues[0]?.path.join(".")}: ${parsed.error.issues[0]?.message}`,
      };
    const v = parsed.data;
    if (!v.online_payments_enabled && !v.bank_transfer_enabled)
      return { ok: false, error: "At least one payment method must stay enabled." };
    const supabase = await createClient();
    const { error, count } = await supabase
      .from("business_settings")
      .update(
        {
          ...v,
          tagline: v.tagline || undefined,
          bank_transfer_instructions: v.bank_transfer_instructions ?? null,
          low_stock_alert_email: v.low_stock_alert_email || undefined,
          notifications_from_email: v.notifications_from_email || undefined,
        },
        { count: "exact" },
      )
      .eq("id", 1);
    if (error) return { ok: false, error: error.message };
    if (!count) return { ok: false, error: "Settings row not found." };
    updateTag(CONTENT_TAG);
    updateTag("settings");
    revalidatePath("/", "layout");
    revalidatePath("/admin/settings");
    return { ok: true, message: "Settings saved." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}
