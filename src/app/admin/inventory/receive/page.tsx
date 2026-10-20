import type { Metadata } from "next";
import { Suspense } from "react";

import { ReceiveForm } from "@/components/admin/inventory/receive-form";
import { Skeleton } from "@/components/ui/skeleton";
import { requireStaff } from "@/modules/auth/dal";
import { listMaterials, listSuppliers } from "@/modules/inventory/queries";

export const metadata: Metadata = { title: "Receive inventory" };

async function Receive() {
  await requireStaff("inventory.manage");
  const [materials, suppliers] = await Promise.all([listMaterials(), listSuppliers()]);
  return (
    <ReceiveForm
      materials={materials
        .filter((m) => m.is_active)
        .map((m) => ({
          id: m.id,
          name: m.name,
          sku: m.sku,
          unit: m.unit,
          is_perishable: m.is_perishable,
          shelf_life_days: m.default_shelf_life_days,
          default_supplier_id: m.default_supplier_id,
        }))}
      suppliers={suppliers
        .filter((s) => s.is_active)
        .map((s) => ({ id: s.id, name: s.name }))}
    />
  );
}

export default function ReceivePage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full max-w-2xl rounded-2xl" />}>
      <Receive />
    </Suspense>
  );
}
