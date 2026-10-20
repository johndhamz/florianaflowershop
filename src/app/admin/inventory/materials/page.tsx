import type { Metadata } from "next";
import { Suspense } from "react";

import { MaterialsManager } from "@/components/admin/inventory/materials-manager";
import { TableSkeleton } from "@/components/shared/skeletons";
import { requireStaff } from "@/modules/auth/dal";
import {
  listMaterials,
  listStockLevels,
  listSuppliers,
} from "@/modules/inventory/queries";

export const metadata: Metadata = { title: "Materials" };

async function Materials() {
  const staff = await requireStaff("inventory.read");
  const [materials, suppliers, levels] = await Promise.all([
    listMaterials(),
    listSuppliers(),
    listStockLevels(),
  ]);
  const levelByMaterial = new Map(levels.map((l) => [l.material_id, l]));
  return (
    <MaterialsManager
      canEdit={["owner", "manager", "florist"].includes(staff.role)}
      suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
      materials={materials.map((m) => ({
        id: m.id,
        sku: m.sku,
        name: m.name,
        category: m.category,
        unit: m.unit,
        is_perishable: m.is_perishable,
        default_shelf_life_days: m.default_shelf_life_days,
        low_stock_threshold: Number(m.low_stock_threshold),
        default_supplier_id: m.default_supplier_id,
        supplier_name: m.suppliers?.name ?? null,
        is_active: m.is_active,
        available: levelByMaterial.get(m.id)?.available ?? 0,
        on_hand: levelByMaterial.get(m.id)?.on_hand ?? 0,
        is_low: levelByMaterial.get(m.id)?.is_low ?? false,
      }))}
    />
  );
}

export default function MaterialsPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={8} columns={5} />}>
      <Materials />
    </Suspense>
  );
}
