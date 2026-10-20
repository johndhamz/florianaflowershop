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

export async function startPreparation(orderId: string): Promise<ActionResult> {
  try {
    await requireStaff("preparation.work");
    const supabase = await createClient();
    const { error } = await supabase.rpc("start_preparation", { p_order_id: orderId });
    if (error) return fail(error);
    revalidatePath("/admin/prep", "layout");
    return { ok: true, message: "Preparation started." };
  } catch (e) {
    return fail(e);
  }
}

const consumptionSchema = z.object({
  orderId: z.uuid(),
  lines: z.array(z.object({ material_id: z.uuid(), quantity: z.coerce.number().min(0) })),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  photoPath: z.string().optional().nullable(),
});

export async function completePreparation(
  input: z.input<typeof consumptionSchema>,
): Promise<ActionResult> {
  try {
    await requireStaff("preparation.work");
    const parsed = consumptionSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Check the quantities." };
    const supabase = await createClient();
    const { error } = await supabase.rpc("complete_preparation", {
      p_order_id: parsed.data.orderId,
      p_actual: parsed.data.lines.filter((l) => l.quantity > 0) as never,
      p_photo_path: parsed.data.photoPath ?? undefined,
      p_notes: parsed.data.notes || undefined,
    });
    if (error) return fail(error);
    revalidatePath("/admin/prep", "layout");
    revalidatePath("/admin/inventory", "layout");
    return { ok: true, message: "Marked ready for dispatch." };
  } catch (e) {
    return fail(e);
  }
}

const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Uploads an arrangement photo to the private bucket; returns its storage path. */
export async function uploadArrangementPhoto(
  formData: FormData,
): Promise<ActionResult<{ path: string }>> {
  try {
    await requireStaff("preparation.work");
    const orderId = String(formData.get("orderId") ?? "");
    const file = formData.get("photo");
    if (!z.uuid().safeParse(orderId).success)
      return { ok: false, error: "Invalid order." };
    if (!(file instanceof File) || file.size === 0)
      return { ok: false, error: "Choose a photo." };
    if (!PHOTO_TYPES.has(file.type))
      return { ok: false, error: "Use a JPG, PNG or WebP image." };
    if (file.size > 8 * 1024 * 1024)
      return { ok: false, error: "Photo must be under 8 MB." };
    const ext = file.type.split("/")[1]!.replace("jpeg", "jpg");
    const path = `orders/${orderId}/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
    const supabase = await createClient();
    const { error } = await supabase.storage
      .from("arrangement-photos")
      .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type });
    if (error) return fail(error);
    return { ok: true, data: { path }, message: "Photo uploaded." };
  } catch (e) {
    return fail(e);
  }
}

export async function applySubstitution(input: {
  orderId: string;
  fromMaterialId: string;
  toMaterialId: string;
  quantity: number;
  reason: string;
}): Promise<ActionResult> {
  try {
    await requireStaff("preparation.work");
    const schema = z.object({
      orderId: z.uuid(),
      fromMaterialId: z.uuid(),
      toMaterialId: z.uuid(),
      quantity: z.coerce.number().positive(),
      reason: z.string().trim().min(3).max(300),
    });
    const parsed = schema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Give a quantity and a reason." };
    const supabase = await createClient();
    const { error } = await supabase.rpc("apply_substitution", {
      p_order_id: parsed.data.orderId,
      p_from_material_id: parsed.data.fromMaterialId,
      p_to_material_id: parsed.data.toMaterialId,
      p_quantity: parsed.data.quantity,
      p_reason: parsed.data.reason,
    });
    if (error) return fail(error);
    revalidatePath("/admin/prep", "layout");
    return { ok: true, message: "Substitution applied." };
  } catch (e) {
    return fail(e);
  }
}

export async function cancelOrder(
  orderId: string,
  reason: string,
): Promise<ActionResult> {
  try {
    await requireStaff("orders.cancel");
    const supabase = await createClient();
    const { error } = await supabase.rpc("cancel_order", {
      p_order_id: orderId,
      p_reason: reason,
    });
    if (error) return fail(error);
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Order cancelled; unused stock released." };
  } catch (e) {
    return fail(e);
  }
}
