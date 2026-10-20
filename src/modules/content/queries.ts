import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";

import { createPublicClient } from "@/lib/supabase/public";

export const CONTENT_TAG = "content";

async function getContentBlock(key: string): Promise<unknown> {
  "use cache";
  cacheLife("hours");
  cacheTag(CONTENT_TAG, `content:${key}`);
  const { data, error } = await createPublicClient()
    .from("site_content")
    .select("data")
    .eq("key", key)
    .eq("is_published", true)
    .maybeSingle();
  if (error) throw new Error(`site_content ${key}: ${error.message}`);
  return data?.data ?? null;
}

/** Typed, validated content read. Returns null when the block is missing or malformed. */
export async function getContent<T extends z.ZodTypeAny>(
  key: string,
  schema: T,
): Promise<z.infer<T> | null> {
  const raw = await getContentBlock(key);
  if (raw === null) return null;
  const parsed = schema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

const cta = z.object({ label: z.string(), href: z.string() });

export const heroSchema = z.object({
  eyebrow: z.string().optional(),
  title: z.string(),
  body: z.string(),
  cta_primary: cta,
  cta_secondary: cta.optional(),
  image_path: z.string().optional(),
});

export const storySchema = z.object({
  eyebrow: z.string().optional(),
  title: z.string(),
  body: z.string(),
  image_path: z.string().optional(),
  cta: cta.optional(),
});

export const aboutSchema = z.object({
  title: z.string(),
  paragraphs: z.array(z.string()),
});
export const deliveryInfoSchema = z.object({ title: z.string(), body: z.string() });
export const faqsSchema = z.object({
  items: z.array(z.object({ q: z.string(), a: z.string() })),
});
export const contactSchema = z.object({
  email: z.string(),
  phone: z.string(),
  hours: z.string(),
  address: z.string(),
});

export type BusinessSettings = {
  shop_name: string;
  tagline: string;
  contact_email: string;
  contact_phone: string;
  address: string | null;
  same_day_cutoff: string;
  social: Record<string, string>;
};

export async function getBusinessSettings(): Promise<BusinessSettings> {
  "use cache";
  cacheLife("hours");
  cacheTag(CONTENT_TAG, "settings");
  const { data, error } = await createPublicClient()
    .from("business_settings")
    .select(
      "shop_name, tagline, contact_email, contact_phone, address, same_day_cutoff, social",
    )
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(`business_settings: ${error.message}`);
  return {
    shop_name: data?.shop_name ?? "Floriana Flowers",
    tagline: data?.tagline ?? "Love, in every bloom.",
    contact_email: data?.contact_email ?? "hello@florianaflowers.ph",
    contact_phone: data?.contact_phone ?? "+639170000000",
    address: data?.address ?? null,
    same_day_cutoff: data?.same_day_cutoff ?? "14:00",
    social: (data?.social as Record<string, string> | null) ?? {},
  };
}
