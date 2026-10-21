import type { Metadata } from "next";
import { DownloadIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { TableSkeleton } from "@/components/shared/skeletons";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCentavos } from "@/lib/money";
import { requireStaff } from "@/modules/auth/dal";
import { manilaToday, parseDateRange } from "@/modules/reports/csv";
import {
  getReportRows,
  getSalesSummary,
  type ReportId,
  REPORTS,
} from "@/modules/reports/queries";

export const metadata: Metadata = { title: "Reports" };

const LABELS: Record<ReportId, string> = {
  "sales-summary": "Sales summary",
  "orders-by-date": "Orders by date",
  "best-sellers": "Best-selling products",
  "sales-by-collection": "Sales by collection",
  "payment-methods": "Payment methods",
  wastage: "Inventory wastage",
  "product-margin": "Estimated product cost & margin",
};

type Row = Record<string, unknown>;
function money(v: unknown) {
  return <span className="tabular-nums">{formatCentavos(Number(v ?? 0))}</span>;
}
function num(v: unknown) {
  return <span className="tabular-nums">{String(v ?? 0)}</span>;
}

const COLUMNS: Record<Exclude<ReportId, "sales-summary">, DataTableColumn<Row>[]> = {
  "orders-by-date": [
    { id: "day", header: "Day", cell: (r) => String(r.day) },
    {
      id: "paid_orders",
      header: "Paid orders",
      align: "right",
      cell: (r) => num(r.paid_orders),
    },
    {
      id: "gross",
      header: "Gross",
      align: "right",
      cell: (r) => money(r.gross_centavos),
    },
    {
      id: "disc",
      header: "Discounts",
      align: "right",
      hideBelow: "md",
      cell: (r) => money(r.discounts_centavos),
    },
    {
      id: "ref",
      header: "Refunds",
      align: "right",
      hideBelow: "md",
      cell: (r) => money(r.refunds_centavos),
    },
    {
      id: "fees",
      header: "Delivery fees",
      align: "right",
      hideBelow: "lg",
      cell: (r) => money(r.delivery_fees_centavos),
    },
    { id: "net", header: "Net", align: "right", cell: (r) => money(r.net_centavos) },
  ],
  "best-sellers": [
    {
      id: "p",
      header: "Product",
      cell: (r) => (
        <div>
          <p className="font-medium">{String(r.product_name)}</p>
          <p className="text-xs text-muted-foreground">
            {String(r.variant_name)} · {String(r.sku)}
          </p>
        </div>
      ),
    },
    { id: "u", header: "Units", align: "right", cell: (r) => num(r.units) },
    {
      id: "o",
      header: "Orders",
      align: "right",
      hideBelow: "sm",
      cell: (r) => num(r.orders),
    },
    {
      id: "rev",
      header: "Revenue",
      align: "right",
      cell: (r) => money(r.revenue_centavos),
    },
  ],
  "sales-by-collection": [
    { id: "c", header: "Collection", cell: (r) => String(r.collection) },
    { id: "u", header: "Units", align: "right", cell: (r) => num(r.units) },
    {
      id: "o",
      header: "Orders",
      align: "right",
      hideBelow: "sm",
      cell: (r) => num(r.orders),
    },
    {
      id: "rev",
      header: "Revenue",
      align: "right",
      cell: (r) => money(r.revenue_centavos),
    },
  ],
  "payment-methods": [
    {
      id: "p",
      header: "Provider · method",
      cell: (r) => `${String(r.provider)} · ${String(r.method)}`,
    },
    { id: "n", header: "Payments", align: "right", cell: (r) => num(r.payments) },
    { id: "a", header: "Amount", align: "right", cell: (r) => money(r.amount_centavos) },
    {
      id: "r",
      header: "Refunded",
      align: "right",
      hideBelow: "sm",
      cell: (r) => money(r.refunded_centavos),
    },
  ],
  wastage: [
    {
      id: "m",
      header: "Material",
      cell: (r) => (
        <div>
          <p className="font-medium">{String(r.material)}</p>
          <p className="text-xs text-muted-foreground">{String(r.sku)}</p>
        </div>
      ),
    },
    { id: "reason", header: "Reason", cell: (r) => String(r.reason) },
    {
      id: "q",
      header: "Quantity",
      align: "right",
      cell: (r) => `${String(r.quantity)} ${String(r.unit)}`,
    },
    {
      id: "c",
      header: "Est. cost",
      align: "right",
      cell: (r) => money(r.estimated_cost_centavos),
    },
  ],
  "product-margin": [
    {
      id: "p",
      header: "Product",
      cell: (r) => (
        <div>
          <p className="font-medium">{String(r.product_name)}</p>
          <p className="text-xs text-muted-foreground">{String(r.variant_name)}</p>
        </div>
      ),
    },
    {
      id: "u",
      header: "Units",
      align: "right",
      hideBelow: "sm",
      cell: (r) => num(r.units),
    },
    {
      id: "rev",
      header: "Revenue",
      align: "right",
      cell: (r) => money(r.revenue_centavos),
    },
    {
      id: "cost",
      header: "Est. cost",
      align: "right",
      cell: (r) => money(r.estimated_cost_centavos),
    },
    {
      id: "m",
      header: "Est. margin",
      align: "right",
      cell: (r) => (
        <span className="tabular-nums">
          {formatCentavos(Number(r.estimated_margin_centavos ?? 0))}
          {r.estimated_margin_pct != null ? (
            <span className="text-muted-foreground">
              {" "}
              ({String(r.estimated_margin_pct)}%)
            </span>
          ) : null}
        </span>
      ),
    },
  ],
};

async function Reports({
  searchParams,
}: {
  searchParams: PageProps<"/admin/reports">["searchParams"];
}) {
  await requireStaff("reports.read");
  const sp = await searchParams;
  const range = parseDateRange(
    {
      from: typeof sp.from === "string" ? sp.from : undefined,
      to: typeof sp.to === "string" ? sp.to : undefined,
    },
    manilaToday(),
  );
  const report = (
    typeof sp.report === "string" && REPORTS.includes(sp.report as ReportId)
      ? sp.report
      : "orders-by-date"
  ) as ReportId;
  const [summary, rows] = await Promise.all([
    getSalesSummary(range),
    report === "sales-summary" ? Promise.resolve([]) : getReportRows(report, range),
  ]);
  const qs = `from=${range.from}&to=${range.to}`;

  return (
    <div className="flex flex-col gap-6">
      <form method="get" className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="report" value={report} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="from">From</Label>
          <Input
            id="from"
            name="from"
            type="date"
            defaultValue={range.from}
            className="h-9 bg-card"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="to">To</Label>
          <Input
            id="to"
            name="to"
            type="date"
            defaultValue={range.to}
            className="h-9 bg-card"
          />
        </div>
        <Button type="submit" variant="outline">
          Apply
        </Button>
        <p className="text-xs text-muted-foreground">
          Dates are Asia/Manila calendar days. Revenue is recognised on the payment date
          from immutable order snapshots; unpaid orders are excluded.
        </p>
      </form>

      <section
        aria-label="Sales summary"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {[
          [
            "Gross sales",
            summary.gross_sales_centavos,
            `${summary.paid_orders} paid orders`,
          ],
          ["Discounts", summary.discounts_centavos, "Promo codes applied"],
          ["Refunds", summary.refunds_centavos, "Full and partial, by refund date"],
          ["Net sales", summary.net_sales_centavos, "Gross − discounts − refunds"],
          ["Delivery fees", summary.delivery_fees_centavos, "Reported separately"],
          ["Collected", summary.collected_centavos, "Order totals − refunds"],
          ["Unpaid orders", summary.unpaid_orders, "Placed in range, not revenue"],
        ].map(([label, value, hint]) => (
          <Card key={String(label)} size="sm">
            <CardHeader>
              <CardDescription>{String(label)}</CardDescription>
              <CardTitle
                className="font-sans text-2xl tabular-nums"
                data-testid={`summary-${String(label).toLowerCase().replace(/\s+/g, "-")}`}
              >
                {label === "Unpaid orders"
                  ? String(value)
                  : formatCentavos(Number(value))}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {String(hint)}
            </CardContent>
          </Card>
        ))}
      </section>

      <nav aria-label="Reports" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-1 rounded-xl bg-muted/60 p-1">
          {REPORTS.filter((r) => r !== "sales-summary").map((r) => (
            <li key={r}>
              <Link
                href={`/admin/reports?report=${r}&${qs}`}
                aria-current={r === report ? "page" : undefined}
                className={`inline-flex h-8 items-center rounded-lg px-3 text-sm font-medium whitespace-nowrap ${r === report ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {LABELS[r]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section aria-labelledby="report-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="report-heading" className="font-sans text-base font-semibold">
            {LABELS[report]}
            {report === "product-margin" ? (
              <span className="ml-2 text-xs font-normal text-warning">
                Estimated — costs are weighted averages of recent batch receipts
              </span>
            ) : null}
          </h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={`/api/admin/reports/sales-summary.csv?${qs}`}>
                <DownloadIcon data-icon="inline-start" />
                Summary CSV
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={`/api/admin/reports/${report}.csv?${qs}`} data-testid="export-csv">
                <DownloadIcon data-icon="inline-start" />
                Export CSV
              </a>
            </Button>
          </div>
        </div>
        {report !== "sales-summary" ? (
          <DataTable
            columns={COLUMNS[report]}
            rows={rows}
            getRowId={(r) => JSON.stringify(r)}
            caption={LABELS[report]}
            emptyState={
              <p className="text-sm text-muted-foreground">No data in this range.</p>
            }
          />
        ) : null}
      </section>
    </div>
  );
}

export default function ReportsPage(props: PageProps<"/admin/reports">) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        variant="admin"
        title="Reports"
        description="Sales, discounts, refunds, delivery fees, products, collections, payment methods, wastage and estimated margins."
      />
      <Suspense fallback={<TableSkeleton rows={6} columns={5} />}>
        <Reports searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
