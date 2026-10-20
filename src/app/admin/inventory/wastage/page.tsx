import type { Metadata } from "next";
import { Suspense } from "react";

import { Qty } from "@/components/admin/inventory/qty";
import { WastageForm } from "@/components/admin/inventory/wastage-form";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { TableSkeleton } from "@/components/shared/skeletons";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatManila } from "@/lib/datetime";
import { requireStaff } from "@/modules/auth/dal";
import { listBatches, listMovements } from "@/modules/inventory/queries";

export const metadata: Metadata = { title: "Wastage" };
type Movement = Awaited<ReturnType<typeof listMovements>>[number];

async function Wastage() {
  await requireStaff("inventory.manage");
  const [batches, discards, expiries] = await Promise.all([
    listBatches({ status: "active" }),
    listMovements({ type: "discard", limit: 100 }),
    listMovements({ type: "expire", limit: 100 }),
  ]);
  const rows = [...discards, ...expiries]
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, 100);
  const columns: DataTableColumn<Movement>[] = [
    {
      id: "when",
      header: "When",
      cell: (m) => (
        <span className="text-muted-foreground">{formatManila(m.created_at)}</span>
      ),
    },
    {
      id: "material",
      header: "Material",
      cell: (m) => (
        <div>
          <p className="font-medium">{m.materials?.name}</p>
          <p className="text-xs text-muted-foreground">{m.stock_batches?.batch_code}</p>
        </div>
      ),
    },
    {
      id: "qty",
      header: "Quantity",
      align: "right",
      cell: (m) => <Qty value={-Number(m.quantity)} unit={m.materials?.unit} />,
    },
    {
      id: "reason",
      header: "Reason",
      cell: (m) => (
        <StatusBadge
          tone={m.wastage_reason === "expired" ? "danger" : "warning"}
          dot={false}
        >
          {m.wastage_reason ?? m.movement_type}
        </StatusBadge>
      ),
    },
    {
      id: "note",
      header: "Note",
      hideBelow: "md",
      cell: (m) => <span className="text-muted-foreground">{m.reason ?? "—"}</span>,
    },
    {
      id: "by",
      header: "By",
      hideBelow: "lg",
      cell: (m) => (
        <span className="text-muted-foreground">{m.created_by_name ?? "system"}</span>
      ),
    },
  ];
  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr] lg:items-start">
      <WastageForm
        batches={batches.map((b) => ({
          id: b.id,
          code: b.batch_code,
          material: b.materials?.name ?? "",
          unit: b.materials?.unit ?? "",
          available: Number(b.quantity_remaining) - Number(b.quantity_reserved),
        }))}
      />
      <section aria-labelledby="wastage-log" className="flex flex-col gap-3">
        <h2 id="wastage-log" className="font-sans text-base font-semibold">
          Wastage log
        </h2>
        <DataTable
          columns={columns}
          rows={rows}
          getRowId={(m) => m.id}
          caption="Wastage log"
          emptyState={
            <p className="text-sm text-muted-foreground">No wastage recorded yet.</p>
          }
        />
      </section>
    </div>
  );
}

export default function WastagePage() {
  return (
    <Suspense fallback={<TableSkeleton rows={6} columns={5} />}>
      <Wastage />
    </Suspense>
  );
}
