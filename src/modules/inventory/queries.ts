import "server-only";

import { createClient } from "@/lib/supabase/server";

export type StockLevel = {
  material_id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  is_perishable: boolean;
  low_stock_threshold: number;
  is_active: boolean;
  on_hand: number;
  reserved: number;
  available: number;
  expiring_soon: number;
  next_expiry: string | null;
  is_low: boolean;
};

function num(v: unknown) {
  return typeof v === "number" ? v : Number(v ?? 0);
}

/** Stock per material with low-stock flags (RLS: florists and admins). */
export async function listStockLevels(): Promise<StockLevel[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("material_stock_levels")
    .select("*")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    material_id: r.material_id!,
    sku: r.sku!,
    name: r.name!,
    category: r.category!,
    unit: r.unit!,
    is_perishable: r.is_perishable!,
    low_stock_threshold: num(r.low_stock_threshold),
    is_active: r.is_active!,
    on_hand: num(r.on_hand),
    reserved: num(r.reserved),
    available: num(r.available),
    expiring_soon: num(r.expiring_soon),
    next_expiry: r.next_expiry,
    is_low: !!r.is_low,
  }));
}

export async function listUpcomingRequirements(days = 7) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("upcoming_material_requirements", {
    p_days: days,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    ...r,
    required: num(r.required),
    reserved: num(r.reserved),
    available: num(r.available),
    shortfall: num(r.shortfall),
  }));
}

export async function listMaterials() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("materials")
    .select("*, suppliers ( name )")
    .order("category")
    .order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listSuppliers() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("suppliers").select("*").order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listBatches(
  opts: { status?: "active" | "all"; materialId?: string } = {},
) {
  const supabase = await createClient();
  let q = supabase
    .from("stock_batches")
    .select("*, materials ( sku, name, unit ), suppliers ( name )")
    .order("expires_at", { ascending: true, nullsFirst: false })
    .order("received_at", { ascending: false })
    .limit(300);
  if (opts.status !== "all") q = q.eq("status", "active");
  if (opts.materialId) q = q.eq("material_id", opts.materialId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listMovements(
  opts: { limit?: number; type?: string; materialId?: string } = {},
) {
  const supabase = await createClient();
  let q = supabase
    .from("stock_movements")
    .select("*, materials ( sku, name, unit ), stock_batches ( batch_code )")
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 200);
  if (opts.type) q = q.eq("movement_type", opts.type as never);
  if (opts.materialId) q = q.eq("material_id", opts.materialId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  // created_by references auth.users; resolve staff display names separately.
  const ids = [...new Set(rows.map((r) => r.created_by).filter((v): v is string => !!v))];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: staff } = await supabase
      .from("staff_profiles")
      .select("user_id, display_name")
      .in("user_id", ids);
    for (const st of staff ?? []) names.set(st.user_id, st.display_name);
  }
  return rows.map((r) => ({
    ...r,
    created_by_name: r.created_by ? (names.get(r.created_by) ?? null) : null,
  }));
}

export async function listRecipes() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_variants")
    .select(
      "id, sku, name, inventory_mode, is_active, products ( name, status ), bouquet_recipes ( id, name, assembly_minutes, recipe_items ( material_id, quantity, is_optional, materials ( name, unit ) ) )",
    )
    .order("sku");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getRecipeForVariant(variantId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_variants")
    .select(
      "id, sku, name, inventory_mode, products ( name ), bouquet_recipes ( id, name, instructions, assembly_minutes, recipe_items ( material_id, quantity, is_optional ) )",
    )
    .eq("id", variantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function listReconciliation() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inventory_reconciliation")
    .select("*")
    .order("batch_code");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ ...r, balanced: !!r.balanced }));
}

export async function listPendingSubstitutions() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("order_substitutions")
    .select(
      "*, orders ( order_number ), from_material:materials!order_substitutions_from_material_id_fkey ( name ), to_material:materials!order_substitutions_to_material_id_fkey ( name )",
    )
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return data ?? [];
}
