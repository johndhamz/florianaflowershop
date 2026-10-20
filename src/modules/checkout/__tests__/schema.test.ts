import { describe, expect, it } from "vitest";

import { checkoutSchema, flattenIssues, phMobileSchema } from "@/modules/checkout/schema";

describe("phMobileSchema", () => {
  it("normalises common Philippine formats to E.164", () => {
    expect(phMobileSchema.parse("0917 123 4567")).toBe("+639171234567");
    expect(phMobileSchema.parse("639171234567")).toBe("+639171234567");
    expect(phMobileSchema.parse("+63-917-123-4567")).toBe("+639171234567");
  });
  it("rejects landlines and foreign numbers", () => {
    expect(phMobileSchema.safeParse("032 123 4567").success).toBe(false);
    expect(phMobileSchema.safeParse("+14155551234").success).toBe(false);
  });
});

describe("checkoutSchema", () => {
  const valid = {
    sender: { name: "Maria", email: "m@example.com", phone: "09171234567" },
    recipient: {
      name: "Paolo",
      phone: "09181234567",
      address_line1: "12 Juana Osmeña St",
      barangay: "Lahug",
    },
    delivery: {
      zone_id: "70000000-0000-4000-8000-000000000001",
      date: "2026-11-01",
      slot_id: "80000000-0000-4000-8000-000000000001",
    },
    payment_method: "bank_transfer",
    privacy_consent: true,
  };
  it("accepts a valid payload", () => {
    const r = checkoutSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.sender.phone).toBe("+639171234567");
  });
  it("reports field-level errors", () => {
    const r = checkoutSchema.safeParse({
      ...valid,
      privacy_consent: false,
      gift_message: "x".repeat(301),
      payment_method: "cash",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const errs = flattenIssues(r.error);
      expect(errs["privacy_consent"]).toMatch(/privacy/);
      expect(errs["gift_message"]).toMatch(/300/);
      expect(errs["payment_method"]).toBeTruthy();
    }
  });
});
