"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";

import type { Json, TablesInsert } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/modules/auth/dal";
import { CONTENT_TAG } from "@/modules/content/queries";
import type { ActionResult } from "@/modules/inventory/actions";

import { CONTENT_BLOCKS, type ContentKey } from "./schemas";

/** Save a draft (validated) and optionally publish it. */
export async function saveContent(
  key: ContentKey,
  json: string,
  publish: boolean,
): Promise<ActionResult> {
  try {
    await requireStaff("content.manage");
    const block = CONTENT_BLOCKS[key];
    if (!block) return { ok: false, error: "Unknown content block." };
    let data: unknown;
    try {
      data = JSON.parse(json);
    } catch {
      return { ok: false, error: "The content is not valid JSON." };
    }
    const parsed = block.schema.safeParse(data);
    if (!parsed.success)
      return {
        ok: false,
        error: `Invalid content: ${parsed.error.issues[0]?.path.join(".")} ${parsed.error.issues[0]?.message}`,
      };
    const supabase = await createClient();
    const payload = parsed.data as NonNullable<Json>;
    const row: TablesInsert<"site_content"> = publish
      ? {
          key,
          data: payload,
          is_published: true,
          published_data: payload,
          published_at: new Date().toISOString(),
        }
      : { key, data: payload };
    const { error } = await supabase
      .from("site_content")
      .upsert(row, { onConflict: "key" });
    if (error) return { ok: false, error: error.message };
    if (publish) {
      revalidateTag(CONTENT_TAG, "max");
      revalidatePath("/", "layout");
    }
    revalidatePath("/admin/content");
    return { ok: true, message: publish ? "Published." : "Draft saved." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function unpublishContent(key: ContentKey): Promise<ActionResult> {
  try {
    await requireStaff("content.manage");
    const supabase = await createClient();
    const { error } = await supabase
      .from("site_content")
      .update({ is_published: false })
      .eq("key", key);
    if (error) return { ok: false, error: error.message };
    revalidateTag(CONTENT_TAG, "max");
    revalidatePath("/", "layout");
    revalidatePath("/admin/content");
    return { ok: true, message: "Unpublished. The storefront falls back to defaults." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

const collectionSeo = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(120),
  tagline: z.string().trim().max(200).optional(),
  description: z.string().trim().max(1000).optional(),
  seo_title: z.string().trim().max(70).optional(),
  seo_description: z.string().trim().max(160).optional(),
  is_active: z.boolean(),
  position: z.coerce.number().int(),
});

export async function saveCollectionSeo(
  input: z.input<typeof collectionSeo>,
): Promise<ActionResult> {
  try {
    await requireStaff("content.manage");
    const parsed = collectionSeo.safeParse(input);
    if (!parsed.success)
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the fields." };
    const { id, ...v } = parsed.data;
    const supabase = await createClient();
    const { error } = await supabase
      .from("collections")
      .update({
        name: v.name,
        tagline: v.tagline || null,
        description: v.description || null,
        seo_title: v.seo_title || null,
        seo_description: v.seo_description || null,
        is_active: v.is_active,
        position: v.position,
      })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidateTag("catalog", "max");
    revalidatePath("/", "layout");
    revalidatePath("/admin/content");
    return { ok: true, message: "Collection updated." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}
