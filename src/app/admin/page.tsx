import type { Metadata } from "next";
import {
  AlertTriangleIcon,
  BoxesIcon,
  CreditCardIcon,
  FlowerIcon,
  TruckIcon,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { PageHeader } from "@/components/shared/page-header";
import { StatCardSkeleton } from "@/components/shared/skeletons";
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
import { requireStaff } from "@/modules/auth/dal";
import { getDashboardSummary } from "@/modules/reports/queries";

export const metadata: Metadata = { title: "Dashboard" };

export async function Dashboard() {
  const staff = await requireStaff();
  const s = await getDashboardSummary();
  const tiles: { label: string; value: string; hint: string; href: string }[] = [
    {
      label: "Orders today",
      value: String(s.orders_today),
      hint: `Placed on ${s.today}`,
      href: "/admin/dispatch?date=all",
    },
    ...(s.sales_today_centavos !== null
      ? [
          {
            label: "Sales today",
            value: formatCentavos(s.sales_today_centavos),
            hint: "Paid orders only",
            href: "/admin/reports",
          },
        ]
      : []),
    {
      label: "Pending payments",
      value: String(s.pending_payments),
      hint: `${s.pending_payment_proofs} proof${s.pending_payment_proofs === 1 ? "" : "s"} to verify`,
      href: "/admin/payments",
    },
    {
      label: "Orders to prepare",
      value: String(s.to_prepare),
      hint: `${s.to_prepare_today} due today or overdue`,
      href: "/admin/prep",
    },
    {
      label: "Scheduled deliveries today",
      value: String(s.scheduled_deliveries_today),
      hint: `${s.unassigned_today} unassigned`,
      href: "/admin/dispatch",
    },
    {
      label: "Low-stock materials",
      value: String(s.low_stock),
      hint: "At or below threshold",
      href: "/admin/inventory",
    },
    {
      label: "Failed deliveries",
      value: String(s.failed_deliveries),
      hint: "Need retry or reschedule",
      href: "/admin/dispatch?date=all",
    },
  ];
  return (
    <div className="flex flex-col gap-6">
      <section
        aria-label="Key metrics"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {tiles.map((t) => (
          <Link
            key={t.label}
            href={t.href}
            className="rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Card size="sm" className="h-full transition-shadow hover:shadow-md">
              <CardHeader>
                <CardDescription>{t.label}</CardDescription>
                <CardTitle
                  className="font-sans text-2xl font-semibold tabular-nums"
                  data-testid={`tile-${t.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {t.value}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {t.hint}
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <section aria-labelledby="activity-heading" className="flex flex-col gap-3">
          <h2 id="activity-heading" className="font-sans text-base font-semibold">
            Recent activity
          </h2>
          <ol className="divide-y rounded-xl bg-card ring-1 ring-foreground/10">
            {s.recent_activity.slice(0, 15).map((a, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
              >
                <span className="flex items-center gap-2">
                  {a.kind === "delivery" ? (
                    <TruckIcon aria-hidden className="size-4 text-sage-600" />
                  ) : a.kind === "payment" ? (
                    <CreditCardIcon aria-hidden className="size-4 text-info" />
                  ) : (
                    <FlowerIcon aria-hidden className="size-4 text-blush-700" />
                  )}
                  <span className="font-medium">{a.ref}</span>
                  <span className="text-muted-foreground">
                    {a.action.replaceAll("_", " ")}
                  </span>
                </span>
                <time className="text-xs text-muted-foreground">
                  {formatManila(a.at)}
                </time>
              </li>
            ))}
            {s.recent_activity.length === 0 ? (
              <li className="px-4 py-6 text-sm text-muted-foreground">
                No activity yet.
              </li>
            ) : null}
          </ol>
        </section>

        <div className="flex flex-col gap-6">
          <section aria-labelledby="failed-heading" className="flex flex-col gap-3">
            <h2
              id="failed-heading"
              className="flex items-center gap-2 font-sans text-base font-semibold"
            >
              <AlertTriangleIcon aria-hidden className="size-4 text-warning" />
              Failed deliveries
            </h2>
            {s.failed_list.length ? (
              <ul className="divide-y rounded-xl bg-card ring-1 ring-foreground/10">
                {s.failed_list.map((f) => (
                  <li
                    key={f.order_id}
                    className="flex items-center justify-between px-4 py-2.5 text-sm"
                  >
                    <span className="font-medium">{f.order_number}</span>
                    <StatusBadge tone="danger" dot={false}>
                      {(f.exception ?? "failed").replaceAll("_", " ")}
                    </StatusBadge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl bg-card px-4 py-6 text-sm text-muted-foreground ring-1 ring-foreground/10">
                None. Nice.
              </p>
            )}
            <Button variant="outline" size="sm" className="self-start" asChild>
              <Link href="/admin/dispatch?date=all">Open dispatch board</Link>
            </Button>
          </section>
          <section aria-label="Quick links" className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/prep">
                <FlowerIcon data-icon="inline-start" />
                Preparation queue
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/inventory">
                <BoxesIcon data-icon="inline-start" />
                Inventory
              </Link>
            </Button>
            {staff.role === "owner" || staff.role === "manager" ? (
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin/reports">Reports</Link>
              </Button>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        variant="admin"
        title="Dashboard"
        description="Today at a glance, Asia/Manila."
      />
      <Suspense
        fallback={
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <StatCardSkeleton key={i} />
            ))}
          </div>
        }
      >
        <Dashboard />
      </Suspense>
    </div>
  );
}
