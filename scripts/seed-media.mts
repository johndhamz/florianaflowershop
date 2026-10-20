/**
 * Uploads placeholder product/collection imagery into the local `product-images`
 * and `content-media` buckets so the storefront image pipeline is exercised
 * end-to-end. Run after `supabase db reset`:
 *
 *   npm run db:seed-media
 *
 * Uses the service-role key from the environment (never shipped to the browser).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const placeholders = resolve(process.cwd(), "public/images/placeholders");

const byCollection: Record<string, string> = {
  "everyday-blooms": "everyday.jpg",
  "premium-bouquets": "bouquet.jpg",
  "lolas-orchid-collection": "orchid.jpg",
  arrangements: "arrangement.jpg",
};

async function upload(bucket: string, path: string, file: string) {
  const body = readFileSync(resolve(placeholders, file));
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, body, { contentType: "image/jpeg", upsert: true });
  if (error) throw new Error(`${bucket}/${path}: ${error.message}`);
}

async function main() {
  const { data: products, error } = await supabase
    .from("products")
    .select("slug, collections(slug), product_images(storage_path)");
  if (error) throw error;

  let count = 0;
  for (const product of products ?? []) {
    const collection =
      (product.collections as unknown as { slug: string } | null)?.slug ??
      "premium-bouquets";
    const file = byCollection[collection] ?? "bouquet.jpg";
    for (const image of product.product_images ?? []) {
      await upload("product-images", image.storage_path, file);
      count += 1;
    }
  }

  const { data: collections } = await supabase
    .from("collections")
    .select("slug, image_path");
  for (const c of collections ?? []) {
    if (c.image_path) {
      await upload("product-images", c.image_path, byCollection[c.slug] ?? "bouquet.jpg");
      count += 1;
    }
  }

  await upload("content-media", "home/hero.jpg", "hero.jpg");
  await upload("content-media", "home/lola.jpg", "orchid.jpg");
  count += 2;

  const { data: addOns } = await supabase.from("add_ons").select("image_path");
  for (const a of addOns ?? []) {
    if (a.image_path) {
      await upload("product-images", a.image_path, "everyday.jpg");
      count += 1;
    }
  }

  console.log(`Uploaded ${count} placeholder objects.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
