import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function listAdminProducts() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, slug, name, status, is_featured, is_best_seller, position, updated_at, collections ( name ), product_variants ( id, name, sku, price_centavos, is_active, is_default )",
    )
    .order("position")
    .order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getAdminProduct(productId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, slug, name, short_description, description, care_instructions, status, is_featured, is_best_seller, seo_title, seo_description, position, collection_id, product_variants ( id, name, sku, price_centavos, compare_at_price_centavos, inventory_mode, is_active, is_default, position )",
    )
    .eq("id", productId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}
