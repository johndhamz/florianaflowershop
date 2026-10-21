"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/modules/auth/dal";
import type { ActionResult } from "@/modules/inventory/actions";

function fail(error: unknown): ActionResult<never> {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message: unknown }).message)
        : "Something went wrong.";
  return { ok: false, error: message };
}

export async function assignRider(
  orderId: string,
  riderId: string | null,
): Promise<ActionResult> {
  try {
    await requireStaff("delivery.dispatch");
    const supabase = await createClient();
    const { error } = await supabase.rpc("assign_rider", {
      p_order_id: orderId,
      p_rider_id: riderId ?? undefined,
    });
    if (error) return fail(error);
    revalidatePath("/admin/dispatch");
    return { ok: true, message: riderId ? "Rider assigned." : "Rider unassigned." };
  } catch (e) {
    return fail(e);
  }
}

export async function startDelivery(orderId: string): Promise<ActionResult> {
  try {
    await requireStaff("delivery.ride");
    const supabase = await createClient();
    const { error } = await supabase.rpc("start_delivery", { p_order_id: orderId });
    if (error) return fail(error);
    revalidatePath("/admin/rider");
    revalidatePath("/admin/dispatch");
    return { ok: true, message: "Marked out for delivery." };
  } catch (e) {
    return fail(e);
  }
}

const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function uploadProof(
  formData: FormData,
): Promise<ActionResult<{ path: string }>> {
  try {
    await requireStaff("delivery.ride");
    const orderId = String(formData.get("orderId") ?? "");
    const file = formData.get("photo");
    if (!z.uuid().safeParse(orderId).success)
      return { ok: false, error: "Invalid order." };
    if (!(file instanceof File) || file.size === 0)
      return { ok: false, error: "Take a photo of the delivered flowers." };
    if (!PHOTO_TYPES.has(file.type))
      return { ok: false, error: "Use a JPG, PNG or WebP image." };
    if (file.size > 8 * 1024 * 1024)
      return { ok: false, error: "Photo must be under 8 MB." };
    const path = `orders/${orderId}/${Date.now()}-${randomUUID().slice(0, 8)}.${file.type.split("/")[1]!.replace("jpeg", "jpg")}`;
    const supabase = await createClient();
    const { error } = await supabase.storage
      .from("delivery-proofs")
      .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type });
    if (error) return fail(error);
    return { ok: true, data: { path } };
  } catch (e) {
    return fail(e);
  }
}

export async function completeDelivery(input: {
  orderId: string;
  proofPath: string;
  receivedBy?: string;
  note?: string;
  latitude?: number;
  longitude?: number;
}): Promise<ActionResult> {
  try {
    await requireStaff("delivery.ride");
    const supabase = await createClient();
    const { error } = await supabase.rpc("complete_delivery", {
      p_order_id: input.orderId,
      p_proof_photo_path: input.proofPath,
      p_received_by: input.receivedBy || undefined,
      p_note: input.note || undefined,
      p_latitude: input.latitude,
      p_longitude: input.longitude,
    });
    if (error) return fail(error);
    revalidatePath("/admin/rider");
    revalidatePath("/admin/dispatch");
    return { ok: true, message: "Delivered. Thank you!" };
  } catch (e) {
    return fail(e);
  }
}

export async function failDelivery(input: {
  orderId: string;
  exception:
    | "recipient_unavailable"
    | "wrong_address"
    | "refused"
    | "weather"
    | "vehicle"
    | "other";
  note: string;
  photoPath?: string | null;
}): Promise<ActionResult> {
  try {
    await requireStaff("delivery.ride");
    const supabase = await createClient();
    const { error } = await supabase.rpc("fail_delivery", {
      p_order_id: input.orderId,
      p_exception: input.exception,
      p_note: input.note,
      p_photo_path: input.photoPath ?? undefined,
    });
    if (error) return fail(error);
    revalidatePath("/admin/rider");
    revalidatePath("/admin/dispatch");
    return { ok: true, message: "Failed attempt recorded. Dispatch will follow up." };
  } catch (e) {
    return fail(e);
  }
}

export async function authorizeRetry(
  orderId: string,
  note?: string,
): Promise<ActionResult> {
  try {
    await requireStaff("delivery.dispatch");
    const supabase = await createClient();
    const { error } = await supabase.rpc("authorize_delivery_retry", {
      p_order_id: orderId,
      p_note: note,
    });
    if (error) return fail(error);
    revalidatePath("/admin/dispatch");
    return { ok: true, message: "Retry authorized." };
  } catch (e) {
    return fail(e);
  }
}

export async function rescheduleDelivery(input: {
  orderId: string;
  date: string;
  slotId: string;
  note?: string;
}): Promise<ActionResult> {
  try {
    await requireStaff("delivery.dispatch");
    const supabase = await createClient();
    const { error } = await supabase.rpc("reschedule_delivery", {
      p_order_id: input.orderId,
      p_delivery_date: input.date,
      p_slot_id: input.slotId,
      p_note: input.note,
    });
    if (error) return fail(error);
    revalidatePath("/admin/dispatch");
    return { ok: true, message: "Delivery rescheduled." };
  } catch (e) {
    return fail(e);
  }
}

const zoneSchema = z.object({
  id: z.uuid().optional(),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, digits and dashes."),
  name: z.string().trim().min(2).max(120),
  city: z.string().trim().min(2).max(120),
  province: z.string().trim().min(2).max(120).default("Cebu"),
  barangays: z.array(z.string().trim().min(1)).min(1, "List at least one barangay."),
  fee_pesos: z.coerce.number().min(0),
  free_delivery_threshold_pesos: z.coerce.number().min(0).nullable(),
  min_order_pesos: z.coerce.number().min(0).default(0),
  same_day_cutoff: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable(),
  lead_time_hours: z.coerce.number().int().min(0).max(168),
  is_active: z.boolean().default(true),
  position: z.coerce.number().int().default(0),
});
export type ZoneInput = z.input<typeof zoneSchema>;

export async function saveZone(input: ZoneInput): Promise<ActionResult> {
  try {
    await requireStaff("delivery.manage");
    const parsed = zoneSchema.safeParse(input);
    if (!parsed.success)
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the fields." };
    const v = parsed.data;
    const row = {
      slug: v.slug,
      name: v.name,
      city: v.city,
      province: v.province,
      barangays: v.barangays,
      fee_centavos: Math.round(v.fee_pesos * 100),
      free_delivery_threshold_centavos:
        v.free_delivery_threshold_pesos === null
          ? null
          : Math.round(v.free_delivery_threshold_pesos * 100),
      min_order_centavos: Math.round(v.min_order_pesos * 100),
      same_day_cutoff: v.same_day_cutoff,
      lead_time_hours: v.lead_time_hours,
      is_active: v.is_active,
      position: v.position,
    };
    const supabase = await createClient();
    const { error } = v.id
      ? await supabase.from("delivery_zones").update(row).eq("id", v.id)
      : await supabase.from("delivery_zones").insert(row);
    if (error)
      return fail(
        error.code === "23505" ? new Error("That slug already exists.") : error,
      );
    revalidatePath("/admin/delivery-settings");
    revalidatePath("/delivery");
    return { ok: true, message: v.id ? "Zone updated." : "Zone created." };
  } catch (e) {
    return fail(e);
  }
}

const slotSchema = z.object({
  id: z.uuid().optional(),
  label: z.string().trim().min(2).max(60),
  starts_at: z.string().regex(/^\d{2}:\d{2}$/),
  ends_at: z.string().regex(/^\d{2}:\d{2}$/),
  days_of_week: z
    .array(z.coerce.number().int().min(0).max(6))
    .min(1, "Pick at least one day."),
  default_capacity: z.coerce.number().int().min(0),
  is_active: z.boolean().default(true),
  position: z.coerce.number().int().default(0),
});
export type SlotInput = z.input<typeof slotSchema>;

export async function saveSlot(input: SlotInput): Promise<ActionResult> {
  try {
    await requireStaff("delivery.manage");
    const parsed = slotSchema.safeParse(input);
    if (!parsed.success)
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the fields." };
    const v = parsed.data;
    if (v.ends_at <= v.starts_at)
      return { ok: false, error: "End time must be after start time." };
    const supabase = await createClient();
    const row = {
      label: v.label,
      starts_at: v.starts_at,
      ends_at: v.ends_at,
      days_of_week: v.days_of_week,
      default_capacity: v.default_capacity,
      is_active: v.is_active,
      position: v.position,
    };
    const { error } = v.id
      ? await supabase.from("delivery_slots").update(row).eq("id", v.id)
      : await supabase.from("delivery_slots").insert(row);
    if (error) return fail(error);
    revalidatePath("/admin/delivery-settings");
    return { ok: true, message: v.id ? "Slot updated." : "Slot created." };
  } catch (e) {
    return fail(e);
  }
}

export async function setSlotCapacity(input: {
  slotId: string;
  date: string;
  capacity: number;
  blocked: boolean;
}): Promise<ActionResult> {
  try {
    await requireStaff("delivery.manage");
    const supabase = await createClient();
    const { error } = await supabase.rpc("set_slot_capacity", {
      p_slot_id: input.slotId,
      p_delivery_date: input.date,
      p_capacity: input.capacity,
      p_blocked: input.blocked,
    });
    if (error) return fail(error);
    revalidatePath("/admin/delivery-settings");
    return { ok: true, message: "Capacity updated." };
  } catch (e) {
    return fail(e);
  }
}

export async function saveSameDayCutoff(cutoff: string): Promise<ActionResult> {
  try {
    await requireStaff("settings.manage");
    if (!/^\d{2}:\d{2}$/.test(cutoff)) return { ok: false, error: "Use HH:MM." };
    const supabase = await createClient();
    const { error } = await supabase
      .from("business_settings")
      .update({ same_day_cutoff: cutoff })
      .eq("id", 1);
    if (error) return fail(error);
    revalidatePath("/admin/delivery-settings");
    return { ok: true, message: "Default cutoff saved." };
  } catch (e) {
    return fail(e);
  }
}
