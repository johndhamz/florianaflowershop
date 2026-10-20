import type { Metadata } from "next";
import { Suspense } from "react";

import { SuppliersManager } from "@/components/admin/inventory/suppliers-manager";
import { TableSkeleton } from "@/components/shared/skeletons";
import { requireStaff } from "@/modules/auth/dal";
import { listSuppliers } from "@/modules/inventory/queries";

export const metadata: Metadata = { title: "Suppliers" };

async function Suppliers() {
  const staff = await requireStaff("inventory.read");
  const suppliers = await listSuppliers();
  return (
    <SuppliersManager
      canEdit={staff.role === "owner" || staff.role === "manager"}
      suppliers={suppliers}
    />
  );
}

export default function SuppliersPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={4} columns={4} />}>
      <Suppliers />
    </Suspense>
  );
}
