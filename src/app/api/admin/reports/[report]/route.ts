import { NextResponse } from "next/server";

import { requireStaff } from "@/modules/auth/dal";
import { UnauthorizedError } from "@/modules/auth/types";
import { manilaToday, parseDateRange, toCsv } from "@/modules/reports/csv";
import {
  getReportRows,
  getSalesSummary,
  type ReportId,
  REPORTS,
} from "@/modules/reports/queries";

/** CSV export: GET /api/admin/reports/{report}?from=YYYY-MM-DD&to=YYYY-MM-DD (owner/manager). */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ report: string }> },
) {
  const { report: raw } = await params;
  const report = raw.replace(/\.csv$/, "") as ReportId;
  if (!REPORTS.includes(report))
    return NextResponse.json({ error: "unknown report" }, { status: 404 });
  try {
    await requireStaff("reports.read");
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof UnauthorizedError ? "unauthorized" : "forbidden" },
      { status: err instanceof UnauthorizedError ? 401 : 403 },
    );
  }
  const url = new URL(request.url);
  const range = parseDateRange(
    {
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    },
    manilaToday(),
  );
  const rows =
    report === "sales-summary"
      ? [await getSalesSummary(range)]
      : await getReportRows(report, range);
  const csv = toCsv(rows as Record<string, unknown>[]);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="floriana-${report}-${range.from}-to-${range.to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
