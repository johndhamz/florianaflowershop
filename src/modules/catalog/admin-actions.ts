"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/modules/auth/dal";
import type { ActionResult } from "@/modules/inventory/actions";

import { CATALOG_TAG } from "./queries";

const productSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(2).max(120),
  short_description: z.string().trim().max(300).optional(),
  description: z.string().trim().max(4000).optional(),
  care_instructions: z.string().trim().max(2000).optional(),
  status: z.enum(["draft", "active", "archived"]),
  is_featured: z.boolean(),
  is_best_seller: z.boolean(),
  seo_title: z.string().trim().max(70).optional(),
  seo_description: z.string().trim().max(160).optional(),
  position: z.coerce.number().int().min(0).max(10000),
});

export async function updateProduct(
  input: z.input<typeof productSchema>,
): Promise<ActionResult> {
  try {
    await requireStaff("catalog.manage");
    const parsed = productSchema.safeParse(input);
    if (!parsed.success)
      return {
        ok: false,
        error: `${parsed.error.issues[0]?.path.join(".")}: ${parsed.error.issues[0]?.message}`,
      };
    const { id, ...v } = parsed.data;
    const supabase = await createClient();
    const { error, count } = await supabase
      .from("products")
      .update(
        {
          name: v.name,
          short_description: v.short_description || null,
          description: v.description || null,
          care_instructions: v.care_instructions || null,
          status: v.status,
          is_featured: v.is_featured,
          is_best_seller: v.is_best_seller,
          seo_title: v.seo_title || null,
          seo_description: v.seo_description || null,
          position: v.position,
          published_at: v.status === "active" ? new Date().toISOString() : undefined,
        },
        { count: "exact" },
      )
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    if (!count) return { ok: false, error: "Product not found or not editable." };
    updateTag(CATALOG_TAG);
    revalidatePath("/admin/products");
    revalidatePath(`/admin/products/${id}`);
    return { ok: true, message: "Product saved." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

const variantSchema = z.object({
  id: z.uuid(),
  productId: z.uuid(),
  name: z.string().trim().min(1).max(80),
  price_pesos: z.coerce.number().min(1, "Price must be at least ₱1.").max(1_000_000),
  compare_at_pesos: z.coerce.number().min(0).max(1_000_000).nullable(),
  is_active: z.boolean(),
});

/** Prices are integer centavos; existing orders keep their snapshot so history never changes. */
export async function updateVariant(
  input: z.input<typeof variantSchema>,
): Promise<ActionResult> {
  try {
    await requireStaff("catalog.manage");
    const parsed = variantSchema.safeParse(input);
    if (!parsed.success)
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the fields." };
    const v = parsed.data;
    const price = Math.round(v.price_pesos * 100);
    const compare = v.compare_at_pesos ? Math.round(v.compare_at_pesos * 100) : null;
    if (compare !== null && compare <= price)
      return { ok: false, error: "Compare-at price must be higher than the price." };
    const supabase = await createClient();
    const { error, count } = await supabase
      .from("product_variants")
      .update(
        {
          name: v.name,
          price_centavos: price,
          compare_at_price_centavos: compare,
          is_active: v.is_active,
        },
        { count: "exact" },
      )
      .eq("id", v.id)
      .eq("product_id", v.productId);
    if (error) return { ok: false, error: error.message };
    if (!count) return { ok: false, error: "Variant not found." };
    updateTag(CATALOG_TAG);
    revalidatePath(`/admin/products/${v.productId}`);
    return { ok: true, message: "Variant saved." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}
