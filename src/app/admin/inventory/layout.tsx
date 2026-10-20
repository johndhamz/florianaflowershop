import type { ReactNode } from "react";

import { InventoryTabs } from "@/components/admin/inventory/inventory-tabs";
import { PageHeader } from "@/components/shared/page-header";

export default function InventoryLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        variant="admin"
        title="Inventory"
        description="Stems, foliage, containers, wraps and add-ons: receive, track, prepare, reconcile."
      />
      <InventoryTabs />
      {children}
    </div>
  );
}
