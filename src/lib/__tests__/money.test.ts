import { describe, expect, it } from "vitest";

import { formatCentavos, toCentavos } from "@/lib/money";

describe("money", () => {
  it("formats integer centavos as Philippine Peso", () => {
    expect(formatCentavos(123_450)).toBe("₱1,234.50");
    expect(formatCentavos(0)).toBe("₱0.00");
    expect(formatCentavos(5)).toBe("₱0.05");
  });

  it("rejects non-integer or negative amounts", () => {
    expect(() => formatCentavos(12.5)).toThrow(TypeError);
    expect(() => formatCentavos(-1)).toThrow(TypeError);
    expect(() => formatCentavos(Number.NaN)).toThrow(TypeError);
  });

  it("converts pesos to centavos with rounding", () => {
    expect(toCentavos(1234.5)).toBe(123_450);
    expect(toCentavos("19.999")).toBe(2000);
    expect(toCentavos(0.1 + 0.2)).toBe(30);
    expect(() => toCentavos("abc")).toThrow(TypeError);
  });
});
