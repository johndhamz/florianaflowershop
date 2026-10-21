import { siteConfig } from "@/config/site";

/**
 * Money is stored and computed as integer centavos (₱1.00 = 100 centavos).
 * Formatting happens only at the presentation edge.
 */
export type Centavos = number;

const formatter = new Intl.NumberFormat(siteConfig.locale, {
  style: "currency",
  currency: siteConfig.currency,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function assertCentavos(value: unknown): asserts value is Centavos {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new TypeError(
      `Expected non-negative integer centavos, received ${String(value)}`,
    );
  }
}

/** 123450 → "₱1,234.50"; negative values (net figures in reports) render as "−₱1,234.50". */
export function formatCentavos(centavos: Centavos): string {
  if (typeof centavos !== "number" || !Number.isInteger(centavos)) {
    throw new TypeError(`Expected integer centavos, received ${String(centavos)}`);
  }
  const formatted = formatter.format(Math.abs(centavos) / 100);
  return centavos < 0 ? `−${formatted}` : formatted;
}

/** "1234.5" | 1234.5 → 123450 (rounded to the nearest centavo). */
export function toCentavos(pesos: number | string): Centavos {
  const amount = typeof pesos === "string" ? Number(pesos) : pesos;
  if (!Number.isFinite(amount) || amount < 0) {
    throw new TypeError(`Cannot convert ${String(pesos)} to centavos`);
  }
  return Math.round(amount * 100);
}
