"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/modules/auth/dal";
import type { ActionResult } from "@/modules/inventory/actions";

const cancelSchema = z.object({
  orderId: z.uuid(),
  reason: z
    .string()
    .trim()
    .min(3, "Give a cancellation reason (at least 3 characters).")
    .max(300),
});

/** Cancels an order: releases stock reservations and the delivery slot atomically (cancel_order). */
export async function cancelOrder(
  input: z.input<typeof cancelSchema>,
): Promise<
  ActionResult<{ releasedReservations: number; stockAlreadyConsumed: boolean }>
> {
  try {
    await requireStaff("orders.cancel");
    const parsed = cancelSchema.safeParse(input);
    if (!parsed.success)
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the fields." };
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("cancel_order", {
      p_order_id: parsed.data.orderId,
      p_reason: parsed.data.reason,
    });
    if (error) return { ok: false, error: error.message };
    const result = data as {
      released_reservations?: number;
      stock_already_consumed?: boolean;
      already_cancelled?: boolean;
    };
    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${parsed.data.orderId}`);
    if (result.already_cancelled)
      return { ok: true, message: "Order was already cancelled." };
    return {
      ok: true,
      message: result.stock_already_consumed
        ? "Order cancelled. Stock was already consumed; record wastage if the arrangement cannot be resold."
        : "Order cancelled. Stock and delivery slot released.",
      data: {
        releasedReservations: result.released_reservations ?? 0,
        stockAlreadyConsumed: !!result.stock_already_consumed,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

const notesSchema = z.object({ orderId: z.uuid(), notes: z.string().trim().max(2000) });

export async function updateInternalNotes(
  input: z.input<typeof notesSchema>,
): Promise<ActionResult> {
  try {
    await requireStaff("orders.notes.update");
    const parsed = notesSchema.safeParse(input);
    if (!parsed.success)
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the fields." };
    const supabase = await createClient();
    const { error } = await supabase
      .from("orders")
      .update({ internal_notes: parsed.data.notes || null })
      .eq("id", parsed.data.orderId);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/admin/orders/${parsed.data.orderId}`);
    return { ok: true, message: "Notes saved." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}
