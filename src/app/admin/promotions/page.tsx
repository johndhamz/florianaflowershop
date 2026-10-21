import type { Metadata } from "next";
import { Suspense } from "react";

import { PromotionsManager } from "@/components/admin/promotions/promotions-manager";
import { PageHeader } from "@/components/shared/page-header";
import { TableSkeleton } from "@/components/shared/skeletons";
import { requireStaff } from "@/modules/auth/dal";
import { listCollections } from "@/modules/catalog/queries";
import { listPromos } from "@/modules/promotions/queries";

export const metadata: Metadata = { title: "Promotions" };

async function Promotions() {
  const staff = await requireStaff("promos.manage");
  const [promos, collections] = await Promise.all([listPromos(), listCollections()]);
  return (
    <PromotionsManager
      promos={promos.map((p) => ({
        id: p.id,
        code: p.code,
        description: p.description,
        promo_type: p.promo_type,
        value: p.value,
        min_subtotal_centavos: p.min_subtotal_centavos,
        max_discount_centavos: p.max_discount_centavos,
        starts_at: p.starts_at,
        ends_at: p.ends_at,
        max_uses: p.max_uses,
        uses_count: p.uses_count,
        per_customer_limit: p.per_customer_limit,
        first_order_only: p.first_order_only,
        eligible_collection_ids: p.eligible_collection_ids,
        is_active: p.is_active,
        redemptions: p.redemptions,
        discount_given_centavos: p.discount_given_centavos,
      }))}
      collections={collections.map((c) => ({ id: c.id, name: c.name }))}
      canEdit={staff.role === "owner" || staff.role === "manager"}
    />
  );
}

export default function PromotionsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        variant="admin"
        title="Promotions"
        description="Coupon codes with fixed or percentage discounts, validity windows, usage limits and eligibility rules. Validation happens server-side at checkout."
      />
      <Suspense fallback={<TableSkeleton rows={4} columns={5} />}>
        <Promotions />
      </Suspense>
    </div>
  );
}
