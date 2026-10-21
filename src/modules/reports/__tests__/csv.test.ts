import { describe, expect, it } from "vitest";

import { csvCell, parseDateRange, toCsv } from "../csv";

describe("toCsv", () => {
  it("renders centavo columns as pesos and renames headers", () => {
    const csv = toCsv([{ day: "2026-10-01", net_centavos: 123456, paid_orders: 2 }]);
    expect(csv).toBe("day,net_pesos,paid_orders\n2026-10-01,1234.56,2\n");
  });
  it("quotes commas, quotes and newlines", () => {
    expect(csvCell('Lola\'s "Phalaenopsis", white')).toBe(
      '"Lola\'s ""Phalaenopsis"", white"',
    );
    expect(csvCell("a\nb")).toBe('"a\nb"');
  });
  it("neutralises spreadsheet formulas", () => {
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell("+639170000000")).toBe("'+639170000000");
  });
  it("emits only a header for empty rows with known columns", () => {
    expect(toCsv([], ["a", "b"])).toBe("a,b\n");
  });
  it("renders nulls as blanks and booleans as text", () => {
    expect(toCsv([{ x: null, is_estimate: true }])).toBe("x,is_estimate\n,true\n");
  });
});

describe("parseDateRange", () => {
  const today = "2026-10-21";
  it("defaults to the last 30 days ending today", () => {
    expect(parseDateRange({}, today)).toEqual({ from: "2026-09-22", to: "2026-10-21" });
  });
  it("rejects malformed dates", () => {
    expect(parseDateRange({ from: "yesterday", to: "2026-10-05" }, today)).toEqual({
      from: "2026-09-06",
      to: "2026-10-05",
    });
  });
  it("swaps from > to by clamping from to to", () => {
    expect(parseDateRange({ from: "2026-10-30", to: "2026-10-05" }, today)).toEqual({
      from: "2026-10-05",
      to: "2026-10-05",
    });
  });
  it("caps the span at 366 days", () => {
    expect(parseDateRange({ from: "2020-01-01", to: today }, today).from).toBe(
      "2025-10-20",
    );
  });
});
