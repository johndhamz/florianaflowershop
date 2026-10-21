import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function listPromos() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("promo_codes")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const { data: redemptions } = await supabase
    .from("promo_redemptions")
    .select("promo_id, discount_centavos");
  const totals = new Map<string, { count: number; discount: number }>();
  for (const r of redemptions ?? []) {
    const t = totals.get(r.promo_id) ?? { count: 0, discount: 0 };
    t.count += 1;
    t.discount += r.discount_centavos;
    totals.set(r.promo_id, t);
  }
  return (data ?? []).map((p) => ({
    ...p,
    redemptions: totals.get(p.id)?.count ?? 0,
    discount_given_centavos: totals.get(p.id)?.discount ?? 0,
  }));
}
