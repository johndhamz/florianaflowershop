import type { Metadata } from "next";
import { AlertTriangleIcon, PackageIcon, PlusIcon, TruckIcon } from "lucide-react";
import Link from "next/link";

import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
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
import { formatCentavos } from "@/lib/money";
import {
  ORDER_STATUS_META,
  PAYMENT_STATUS_META,
  type OrderStatus,
  type PaymentStatus,
} from "@/modules/orders";

export const metadata: Metadata = { title: "Dashboard" };

/** Placeholder read model. Real queries + Suspense streaming arrive with the orders phase. */
type RecentOrderRow = {
  id: string;
  reference: string;
  customer: string;
  totalCentavos: number;
  status: OrderStatus;
  payment: PaymentStatus;
  deliverAt: string;
};

const sampleOrders: RecentOrderRow[] = [
  {
    id: "o1",
    reference: "FL-10231",
    customer: "Maria Santos",
    totalCentavos: 249_000,
    status: "preparing",
    payment: "paid",
    deliverAt: "2026-10-20T06:00:00Z",
  },
  {
    id: "o2",
    reference: "FL-10230",
    customer: "Jose Dela Cruz",
    totalCentavos: 45_000,
    status: "out_for_delivery",
    payment: "paid",
    deliverAt: "2026-10-20T05:00:00Z",
  },
  {
    id: "o3",
    reference: "FL-10229",
    customer: "Ana Reyes",
    totalCentavos: 395_000,
    status: "pending",
    payment: "unpaid",
    deliverAt: "2026-10-21T02:00:00Z",
  },
  {
    id: "o4",
    reference: "FL-10228",
    customer: "Liza Uy",
    totalCentavos: 189_000,
    status: "delivered",
    payment: "paid",
    deliverAt: "2026-10-19T08:00:00Z",
  },
  {
    id: "o5",
    reference: "FL-10227",
    customer: "Carlo Tan",
    totalCentavos: 65_000,
    status: "cancelled",
    payment: "refunded",
    deliverAt: "2026-10-19T03:00:00Z",
  },
];

const stats = [
  { label: "Orders today", value: "12", hint: "+3 vs yesterday" },
  { label: "Revenue today", value: formatCentavos(1_842_000), hint: "Paid orders only" },
  { label: "Pending deliveries", value: "5", hint: "2 due before noon" },
  { label: "Low-stock items", value: "3", hint: "Batch expiring in 48h" },
] as const;

const columns: readonly DataTableColumn<RecentOrderRow>[] = [
  {
    id: "reference",
    header: "Order",
    cell: (row) => (
      <Link
        href={`/admin/orders/${row.id}`}
        className="font-medium text-foreground hover:underline"
      >
        {row.reference}
      </Link>
    ),
  },
  { id: "customer", header: "Customer", cell: (row) => row.customer, hideBelow: "md" },
  {
    id: "deliverAt",
    header: "Delivery",
    cell: (row) => (
      <span className="text-muted-foreground">{formatManila(row.deliverAt)}</span>
    ),
    hideBelow: "lg",
  },
  {
    id: "status",
    header: "Status",
    cell: (row) => (
      <StatusBadge tone={ORDER_STATUS_META[row.status].tone}>
        {ORDER_STATUS_META[row.status].label}
      </StatusBadge>
    ),
  },
  {
    id: "payment",
    header: "Payment",
    cell: (row) => (
      <StatusBadge tone={PAYMENT_STATUS_META[row.payment].tone} dot={false}>
        {PAYMENT_STATUS_META[row.payment].label}
      </StatusBadge>
    ),
    hideBelow: "sm",
  },
  {
    id: "total",
    header: "Total",
    align: "right",
    cell: (row) => (
      <span className="tabular-nums">{formatCentavos(row.totalCentavos)}</span>
    ),
  },
];

export default function AdminDashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        variant="admin"
        title="Dashboard"
        description="Today at a glance. Figures are placeholders until the orders module ships."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/admin/deliveries">
                <TruckIcon data-icon="inline-start" />
                Delivery board
              </Link>
            </Button>
            <Button asChild>
              <Link href="/admin/orders/new">
                <PlusIcon data-icon="inline-start" />
                New order
              </Link>
            </Button>
          </>
        }
      />

      <section
        aria-label="Key metrics"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {stats.map((stat) => (
          <Card key={stat.label} size="sm">
            <CardHeader>
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="font-sans text-2xl font-semibold tabular-nums">
                {stat.value}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {stat.hint}
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <section aria-labelledby="recent-orders-heading" className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 id="recent-orders-heading" className="font-sans text-base font-semibold">
              Recent orders
            </h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/orders">View all</Link>
            </Button>
          </div>
          <DataTable
            columns={columns}
            rows={sampleOrders}
            getRowId={(row) => row.id}
            caption="Recent orders"
          />
        </section>

        <div className="flex flex-col gap-6">
          <section aria-labelledby="attention-heading" className="flex flex-col gap-3">
            <h2 id="attention-heading" className="font-sans text-base font-semibold">
              Needs attention
            </h2>
            <Card size="sm">
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-warning/10 text-warning">
                    <AlertTriangleIcon aria-hidden className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">3 products running low</p>
                    <p className="text-xs text-muted-foreground">
                      Phalaenopsis batch #B-204 expires in 2 days.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-info/10 text-info">
                    <PackageIcon aria-hidden className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">1 unpaid order older than 2h</p>
                    <p className="text-xs text-muted-foreground">
                      FL-10229 · Ana Reyes · ₱3,950.00
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <section aria-labelledby="deliveries-heading" className="flex flex-col gap-3">
            <h2 id="deliveries-heading" className="font-sans text-base font-semibold">
              Tomorrow&apos;s deliveries
            </h2>
            <EmptyState
              size="sm"
              icon={TruckIcon}
              title="No deliveries scheduled"
              description="Orders with a delivery slot for tomorrow will appear here."
              action={
                <Button variant="outline" size="sm" asChild>
                  <Link href="/admin/deliveries">Open delivery board</Link>
                </Button>
              }
            />
          </section>
        </div>
      </div>
    </div>
  );
}
