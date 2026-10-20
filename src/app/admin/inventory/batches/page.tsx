import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Qty } from "@/components/admin/inventory/qty";
import { BatchActions } from "@/components/admin/inventory/batch-actions";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { TableSkeleton } from "@/components/shared/skeletons";
import { StatusBadge, type StatusTone } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { formatManila } from "@/lib/datetime";
import { formatCentavos } from "@/lib/money";
import { requireStaff } from "@/modules/auth/dal";
import { listBatches, listMaterials } from "@/modules/inventory/queries";

export const metadata: Metadata = { title: "Stock batches" };

type Batch = Awaited<ReturnType<typeof listBatches>>[number];
const tone: Record<string, StatusTone> = {
  active: "success",
  depleted: "neutral",
  expired: "danger",
  discarded: "neutral",
};

async function Batches({
  searchParams,
}: {
  searchParams: PageProps<"/admin/inventory/batches">["searchParams"];
}) {
  const staff = await requireStaff("inventory.read");
  const sp = await searchParams;
  const status = sp.status === "all" ? "all" : "active";
  const materialId = typeof sp.material === "string" ? sp.material : undefined;
  const [batches, materials] = await Promise.all([
    listBatches({ status, materialId }),
    listMaterials(),
  ]);
  const canAdjust = staff.role === "owner" || staff.role === "manager";

  const columns: DataTableColumn<Batch>[] = [
    {
      id: "batch",
      header: "Batch",
      cell: (b) => (
        <div>
          <p className="font-medium">{b.batch_code}</p>
          <p className="text-xs text-muted-foreground">{b.materials?.name}</p>
        </div>
      ),
    },
    {
      id: "remaining",
      header: "Remaining",
      align: "right",
      cell: (b) => <Qty value={b.quantity_remaining} unit={b.materials?.unit} />,
    },
    {
      id: "reserved",
      header: "Reserved",
      align: "right",
      hideBelow: "sm",
      cell: (b) => <Qty value={b.quantity_reserved} unit={b.materials?.unit} />,
    },
    {
      id: "cost",
      header: "Unit cost",
      align: "right",
      hideBelow: "md",
      cell: (b) => (
        <span className="tabular-nums">{formatCentavos(b.unit_cost_centavos)}</span>
      ),
    },
    {
      id: "expires",
      header: "Expires",
      hideBelow: "md",
      cell: (b) => {
        if (!b.expires_at) return <span className="text-muted-foreground">—</span>;
        const soon = new Date(b.expires_at).getTime() - Date.now() < 2 * 86_400_000;
        return (
          <span className={soon ? "font-medium text-warning" : "text-muted-foreground"}>
            {formatManila(b.expires_at, { dateStyle: "medium" })}
          </span>
        );
      },
    },
    {
      id: "supplier",
      header: "Supplier",
      hideBelow: "lg",
      cell: (b) => (
        <span className="text-muted-foreground">{b.suppliers?.name ?? "—"}</span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (b) => (
        <StatusBadge tone={tone[b.status] ?? "neutral"} dot={false}>
          {b.status}
        </StatusBadge>
      ),
    },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (b) =>
        b.status === "active" ? (
          <BatchActions
            batch={{
              id: b.id,
              code: b.batch_code,
              remaining: Number(b.quantity_remaining),
              reserved: Number(b.quantity_reserved),
              unit: b.materials?.unit ?? "",
            }}
            canAdjust={canAdjust}
          />
        ) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <form className="flex flex-wrap items-end gap-2" method="get">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Material
          <select
            name="material"
            defaultValue={materialId ?? ""}
            className="h-9 min-w-48 rounded-lg border border-input bg-card px-2 text-sm text-foreground"
          >
            <option value="">All materials</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Status
          <select
            name="status"
            defaultValue={status}
            className="h-9 rounded-lg border border-input bg-card px-2 text-sm text-foreground"
          >
            <option value="active">Active</option>
            <option value="all">All</option>
          </select>
        </label>
        <Button type="submit" variant="outline">
          Filter
        </Button>
        <Button asChild className="ml-auto">
          <Link href="/admin/inventory/receive">Receive stock</Link>
        </Button>
      </form>
      <DataTable
        columns={columns}
        rows={batches}
        getRowId={(b) => b.id}
        caption="Stock batches"
      />
    </div>
  );
}

export default function BatchesPage(props: PageProps<"/admin/inventory/batches">) {
  return (
    <Suspense fallback={<TableSkeleton rows={8} columns={6} />}>
      <Batches searchParams={props.searchParams} />
    </Suspense>
  );
}
