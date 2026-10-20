import type { Metadata } from "next";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CalendarClockIcon,
  PackageIcon,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { Qty } from "@/components/admin/inventory/qty";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { TableSkeleton } from "@/components/shared/skeletons";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatManila } from "@/lib/datetime";
import { requireStaff } from "@/modules/auth/dal";
import {
  listStockLevels,
  listUpcomingRequirements,
  type StockLevel,
} from "@/modules/inventory/queries";

export const metadata: Metadata = { title: "Inventory" };

type Req = Awaited<ReturnType<typeof listUpcomingRequirements>>[number];

async function Overview() {
  await requireStaff("inventory.read");
  const [levels, requirements] = await Promise.all([
    listStockLevels(),
    listUpcomingRequirements(7),
  ]);
  const low = levels.filter((l) => l.is_active && l.is_low);
  const expiring = levels.filter((l) => l.expiring_soon > 0);
  const shortfalls = requirements.filter((r) => r.shortfall > 0);

  const lowColumns: DataTableColumn<StockLevel>[] = [
    {
      id: "name",
      header: "Material",
      cell: (r) => (
        <Link
          href={`/admin/inventory/batches?material=${r.material_id}`}
          className="font-medium hover:underline"
        >
          {r.name}
        </Link>
      ),
    },
    {
      id: "available",
      header: "Available",
      align: "right",
      cell: (r) => <Qty value={r.available} unit={r.unit} />,
    },
    {
      id: "threshold",
      header: "Threshold",
      align: "right",
      hideBelow: "sm",
      cell: (r) => <Qty value={r.low_stock_threshold} unit={r.unit} />,
    },
    {
      id: "expiry",
      header: "Next expiry",
      hideBelow: "md",
      cell: (r) => (
        <span className="text-muted-foreground">
          {r.next_expiry ? formatManila(r.next_expiry, { dateStyle: "medium" }) : "—"}
        </span>
      ),
    },
  ];
  const reqColumns: DataTableColumn<Req>[] = [
    {
      id: "name",
      header: "Material",
      cell: (r) => <span className="font-medium">{r.name}</span>,
    },
    {
      id: "required",
      header: "Needed (7d)",
      align: "right",
      cell: (r) => <Qty value={r.required} unit={r.unit} />,
    },
    {
      id: "reserved",
      header: "Reserved",
      align: "right",
      hideBelow: "sm",
      cell: (r) => <Qty value={r.reserved} unit={r.unit} />,
    },
    {
      id: "available",
      header: "Available",
      align: "right",
      hideBelow: "sm",
      cell: (r) => <Qty value={r.available} unit={r.unit} />,
    },
    {
      id: "shortfall",
      header: "Shortfall",
      align: "right",
      cell: (r) =>
        r.shortfall > 0 ? (
          <StatusBadge tone="danger" dot={false}>
            <Qty value={r.shortfall} unit={r.unit} />
          </StatusBadge>
        ) : (
          <StatusBadge tone="success" dot={false}>
            Covered
          </StatusBadge>
        ),
    },
    {
      id: "orders",
      header: "Orders",
      align: "right",
      hideBelow: "md",
      cell: (r) => r.orders,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Inventory summary" className="grid gap-4 sm:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <CardDescription>Low-stock materials</CardDescription>
            <CardTitle className="font-sans text-2xl tabular-nums">
              {low.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            At or below their threshold
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Expiring within 2 days</CardDescription>
            <CardTitle className="font-sans text-2xl tabular-nums">
              {expiring.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Materials with perishable batches
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Shortfalls for the next 7 days</CardDescription>
            <CardTitle className="font-sans text-2xl tabular-nums">
              {shortfalls.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Confirmed orders vs available stock
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="low-heading" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2
            id="low-heading"
            className="flex items-center gap-2 font-sans text-base font-semibold"
          >
            <AlertTriangleIcon aria-hidden className="size-4 text-warning" />
            Low-stock alerts
          </h2>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/inventory/receive">
              Receive stock
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </Button>
        </div>
        {low.length ? (
          <DataTable
            columns={lowColumns}
            rows={low}
            getRowId={(r) => r.material_id}
            caption="Low-stock materials"
          />
        ) : (
          <EmptyState
            size="sm"
            icon={PackageIcon}
            title="Nothing is low"
            description="Every active material is above its threshold."
          />
        )}
      </section>

      <section aria-labelledby="req-heading" className="flex flex-col gap-3">
        <h2
          id="req-heading"
          className="flex items-center gap-2 font-sans text-base font-semibold"
        >
          <CalendarClockIcon aria-hidden className="size-4 text-info" />
          Upcoming material requirements (next 7 days)
        </h2>
        {requirements.length ? (
          <DataTable
            columns={reqColumns}
            rows={requirements}
            getRowId={(r) => r.material_id!}
            caption="Upcoming requirements"
          />
        ) : (
          <EmptyState
            size="sm"
            icon={CalendarClockIcon}
            title="No confirmed orders to prepare"
            description="Requirements appear once paid orders are scheduled."
          />
        )}
      </section>
    </div>
  );
}

export default function InventoryOverviewPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={5} columns={4} />}>
      <Overview />
    </Suspense>
  );
}
