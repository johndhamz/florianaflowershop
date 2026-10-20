"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/modules/auth/dal";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function fail(error: unknown): ActionResult<never> {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message: unknown }).message)
        : "Something went wrong.";
  return { ok: false, error: message };
}

function flatten(err: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of err.issues) out[i.path.join(".")] ??= i.message;
  return out;
}

const sku = z
  .string()
  .trim()
  .regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/, "SKU: uppercase letters, digits and dashes.");
const materialSchema = z.object({
  id: z.uuid().optional(),
  sku,
  name: z.string().trim().min(2).max(160),
  category: z.enum([
    "flower",
    "foliage",
    "plant",
    "container",
    "wrap",
    "accessory",
    "consumable",
  ]),
  unit: z.enum(["stem", "bunch", "piece", "gram", "millilitre", "metre"]),
  is_perishable: z.boolean(),
  default_shelf_life_days: z.coerce.number().int().positive().nullable(),
  low_stock_threshold: z.coerce.number().min(0),
  default_supplier_id: z.uuid().nullable(),
  is_active: z.boolean().default(true),
});
export type MaterialInput = z.input<typeof materialSchema>;

export async function saveMaterial(
  input: MaterialInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    await requireStaff("inventory.manage");
    const parsed = materialSchema.safeParse(input);
    if (!parsed.success)
      return {
        ok: false,
        error: "Check the highlighted fields.",
        fieldErrors: flatten(parsed.error),
      };
    const supabase = await createClient();
    const { id, ...values } = parsed.data;
    const query = id
      ? supabase.from("materials").update(values).eq("id", id).select("id").single()
      : supabase.from("materials").insert(values).select("id").single();
    const { data, error } = await query;
    if (error)
      return fail(error.code === "23505" ? new Error("That SKU already exists.") : error);
    revalidatePath("/admin/inventory", "layout");
    return {
      ok: true,
      data: { id: data.id },
      message: id ? "Material updated." : "Material created.",
    };
  } catch (e) {
    return fail(e);
  }
}

const supplierSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2).max(160),
  contact_name: z
    .string()
    .trim()
    .max(120)
    .nullish()
    .transform((v) => v || null),
  phone: z
    .string()
    .trim()
    .max(40)
    .nullish()
    .transform((v) => v || null),
  email: z
    .email()
    .nullish()
    .or(z.literal(""))
    .transform((v) => v || null),
  address: z
    .string()
    .trim()
    .max(300)
    .nullish()
    .transform((v) => v || null),
  notes: z
    .string()
    .trim()
    .max(500)
    .nullish()
    .transform((v) => v || null),
  is_active: z.boolean().default(true),
});
export type SupplierInput = z.input<typeof supplierSchema>;

export async function saveSupplier(
  input: SupplierInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    await requireStaff("inventory.manage");
    const parsed = supplierSchema.safeParse(input);
    if (!parsed.success)
      return {
        ok: false,
        error: "Check the highlighted fields.",
        fieldErrors: flatten(parsed.error),
      };
    const supabase = await createClient();
    const { id, ...values } = parsed.data;
    const query = id
      ? supabase.from("suppliers").update(values).eq("id", id).select("id").single()
      : supabase.from("suppliers").insert(values).select("id").single();
    const { data, error } = await query;
    if (error) return fail(error);
    revalidatePath("/admin/inventory", "layout");
    return {
      ok: true,
      data: { id: data.id },
      message: id ? "Supplier updated." : "Supplier created.",
    };
  } catch (e) {
    return fail(e);
  }
}

const receiveSchema = z.object({
  material_id: z.uuid({ message: "Choose a material." }),
  quantity: z.coerce.number().positive("Quantity must be greater than zero."),
  unit_cost_pesos: z.coerce.number().min(0, "Cost cannot be negative."),
  batch_code: z.string().trim().max(60).optional().or(z.literal("")),
  supplier_id: z.uuid().nullable().optional().or(z.literal("")),
  received_at: z.string().optional().or(z.literal("")),
  expires_at: z.string().optional().or(z.literal("")),
  notes: z.string().trim().max(300).optional().or(z.literal("")),
});
export type ReceiveInput = z.input<typeof receiveSchema>;

export async function receiveStock(
  input: ReceiveInput,
): Promise<ActionResult<{ batch_code: string }>> {
  try {
    await requireStaff("inventory.manage");
    const parsed = receiveSchema.safeParse(input);
    if (!parsed.success)
      return {
        ok: false,
        error: "Check the highlighted fields.",
        fieldErrors: flatten(parsed.error),
      };
    const v = parsed.data;
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("receive_stock", {
      p_material_id: v.material_id,
      p_quantity: v.quantity,
      p_unit_cost_centavos: Math.round(v.unit_cost_pesos * 100),
      p_batch_code: v.batch_code || undefined,
      p_supplier_id: v.supplier_id || undefined,
      p_received_at: v.received_at ? new Date(v.received_at).toISOString() : undefined,
      p_expires_at: v.expires_at ? new Date(v.expires_at).toISOString() : undefined,
      p_notes: v.notes || undefined,
    });
    if (error)
      return fail(
        error.code === "23505" ? new Error("That batch code already exists.") : error,
      );
    revalidatePath("/admin/inventory", "layout");
    const batch = data as { batch_code: string };
    return {
      ok: true,
      data: { batch_code: batch.batch_code },
      message: `Received into batch ${batch.batch_code}.`,
    };
  } catch (e) {
    return fail(e);
  }
}

const wastageSchema = z.object({
  batch_id: z.uuid({ message: "Choose a batch." }),
  quantity: z.coerce.number().positive("Quantity must be greater than zero."),
  reason: z.enum(["damaged", "expired", "wilted", "lost", "other"], {
    message: "Choose a reason.",
  }),
  note: z.string().trim().max(300).optional().or(z.literal("")),
});
export type WastageInput = z.input<typeof wastageSchema>;

export async function recordWastage(input: WastageInput): Promise<ActionResult> {
  try {
    await requireStaff("inventory.manage");
    const parsed = wastageSchema.safeParse(input);
    if (!parsed.success)
      return {
        ok: false,
        error: "Check the highlighted fields.",
        fieldErrors: flatten(parsed.error),
      };
    const supabase = await createClient();
    const { error } = await supabase.rpc("record_wastage", {
      p_batch_id: parsed.data.batch_id,
      p_quantity: parsed.data.quantity,
      p_reason: parsed.data.reason,
      p_note: parsed.data.note || undefined,
    });
    if (error) return fail(error);
    revalidatePath("/admin/inventory", "layout");
    return { ok: true, message: "Wastage recorded." };
  } catch (e) {
    return fail(e);
  }
}

export async function adjustStock(
  batchId: string,
  delta: number,
  reason: string,
): Promise<ActionResult> {
  try {
    await requireStaff("inventory.adjust");
    const supabase = await createClient();
    const { error } = await supabase.rpc("adjust_stock", {
      p_batch_id: batchId,
      p_delta: delta,
      p_reason: reason,
    });
    if (error) return fail(error);
    revalidatePath("/admin/inventory", "layout");
    return { ok: true, message: "Stock adjusted." };
  } catch (e) {
    return fail(e);
  }
}

const recipeSchema = z.object({
  variant_id: z.uuid(),
  name: z.string().trim().min(2).max(160),
  instructions: z.string().trim().max(2000).optional().or(z.literal("")),
  assembly_minutes: z.coerce.number().int().positive().nullable().optional(),
  items: z
    .array(
      z.object({
        material_id: z.uuid(),
        quantity: z.coerce.number().positive(),
        is_optional: z.boolean().default(false),
      }),
    )
    .min(1, "Add at least one material."),
});
export type RecipeInput = z.input<typeof recipeSchema>;

export async function saveRecipe(input: RecipeInput): Promise<ActionResult> {
  try {
    await requireStaff("inventory.manage");
    const parsed = recipeSchema.safeParse(input);
    if (!parsed.success)
      return {
        ok: false,
        error: "Check the highlighted fields.",
        fieldErrors: flatten(parsed.error),
      };
    const v = parsed.data;
    // De-duplicate materials (last wins).
    const items = [...new Map(v.items.map((i) => [i.material_id, i])).values()];
    const supabase = await createClient();
    const { data: recipe, error: rErr } = await supabase
      .from("bouquet_recipes")
      .upsert(
        {
          variant_id: v.variant_id,
          name: v.name,
          instructions: v.instructions || null,
          assembly_minutes: v.assembly_minutes ?? null,
        },
        { onConflict: "variant_id" },
      )
      .select("id")
      .single();
    if (rErr) return fail(rErr);
    const { error: dErr } = await supabase
      .from("recipe_items")
      .delete()
      .eq("recipe_id", recipe.id);
    if (dErr) return fail(dErr);
    const { error: iErr } = await supabase.from("recipe_items").insert(
      items.map((i) => ({
        recipe_id: recipe.id,
        material_id: i.material_id,
        quantity: i.quantity,
        is_optional: i.is_optional,
      })),
    );
    if (iErr) return fail(iErr);
    revalidatePath("/admin/inventory", "layout");
    return { ok: true, message: "Recipe saved." };
  } catch (e) {
    return fail(e);
  }
}

export async function reviewSubstitution(
  id: string,
  approve: boolean,
  note?: string,
): Promise<ActionResult> {
  try {
    await requireStaff("inventory.adjust");
    const supabase = await createClient();
    const { error } = await supabase.rpc("review_substitution", {
      p_substitution_id: id,
      p_approve: approve,
      p_note: note,
    });
    if (error) return fail(error);
    revalidatePath("/admin/inventory", "layout");
    return {
      ok: true,
      message: approve ? "Substitution approved." : "Substitution rejected.",
    };
  } catch (e) {
    return fail(e);
  }
}
