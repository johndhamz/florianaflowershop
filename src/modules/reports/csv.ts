/** CSV helpers: RFC 4180 quoting, centavo columns rendered as pesos with 2 decimals. */
export function toCsv(rows: Record<string, unknown>[], columns?: string[]): string {
  if (rows.length === 0) return (columns ?? []).join(",") + "\n";
  const cols = columns ?? Object.keys(rows[0]!);
  const header = cols.map((c) => csvCell(c.replace(/_centavos$/, "_pesos"))).join(",");
  const lines = rows.map((r) => cols.map((c) => csvCell(formatValue(c, r[c]))).join(","));
  return [header, ...lines].join("\n") + "\n";
}

export function formatValue(column: string, value: unknown): string {
  if (value === null || value === undefined) return "";
  if (column.endsWith("_centavos")) return (Number(value) / 100).toFixed(2);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export function csvCell(value: string): string {
  // Prevent spreadsheet formula injection and quote when needed.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Parses a from/to pair (Manila calendar dates); defaults to the last 30 days; caps at 366 days. */
export function parseDateRange(
  raw: { from?: string; to?: string },
  today: string,
): { from: string; to: string } {
  const to = raw.to && DATE_RE.test(raw.to) ? raw.to : today;
  const defaultFrom = new Date(`${to}T00:00:00Z`);
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 29);
  let from =
    raw.from && DATE_RE.test(raw.from)
      ? raw.from
      : defaultFrom.toISOString().slice(0, 10);
  if (from > to) [from] = [to];
  const span =
    (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) /
    86_400_000;
  if (span > 366) {
    const d = new Date(`${to}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 366);
    from = d.toISOString().slice(0, 10);
  }
  return { from, to };
}

export function manilaToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
}
