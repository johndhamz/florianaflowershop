import "server-only";

import { createClient } from "@/lib/supabase/server";

export type DateRange = { from: string; to: string };

export const REPORTS = [
  "sales-summary",
  "orders-by-date",
  "best-sellers",
  "sales-by-collection",
  "payment-methods",
  "wastage",
  "product-margin",
] as const;
export type ReportId = (typeof REPORTS)[number];

export type SalesSummary = {
  from: string;
  to: string;
  timezone: string;
  paid_orders: number;
  gross_sales_centavos: number;
  discounts_centavos: number;
  refunds_centavos: number;
  net_sales_centavos: number;
  delivery_fees_centavos: number;
  collected_centavos: number;
  unpaid_orders: number;
};

export async function getSalesSummary(range: DateRange): Promise<SalesSummary> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("report_sales_summary", {
    p_from: range.from,
    p_to: range.to,
  });
  if (error) throw new Error(error.message);
  return data as SalesSummary;
}

function rows<T>(res: { data: T[] | null; error: { message: string } | null }): T[] {
  if (res.error) throw new Error(res.error.message);
  return res.data ?? [];
}

export async function getReportRows(
  report: Exclude<ReportId, "sales-summary">,
  range: DateRange,
): Promise<Record<string, unknown>[]> {
  const supabase = await createClient();
  const args = { p_from: range.from, p_to: range.to };
  switch (report) {
    case "orders-by-date":
      return rows(await supabase.rpc("report_orders_by_date", args));
    case "best-sellers":
      return rows(await supabase.rpc("report_best_sellers", { ...args, p_limit: 20 }));
    case "sales-by-collection":
      return rows(await supabase.rpc("report_sales_by_collection", args));
    case "payment-methods":
      return rows(await supabase.rpc("report_payment_methods", args));
    case "wastage":
      return rows(await supabase.rpc("report_wastage", args));
    case "product-margin":
      return rows(await supabase.rpc("report_product_margin", args));
  }
}

export type DashboardSummary = {
  today: string;
  orders_today: number;
  sales_today_centavos: number | null;
  pending_payments: number;
  pending_payment_proofs: number;
  to_prepare: number;
  to_prepare_today: number;
  scheduled_deliveries_today: number;
  unassigned_today: number;
  failed_deliveries: number;
  low_stock: number;
  recent_activity: { kind: string; ref: string; action: string; at: string }[];
  failed_list: { order_id: string; order_number: string; exception: string | null }[];
};

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_summary");
  if (error) throw new Error(error.message);
  return data as DashboardSummary;
}
