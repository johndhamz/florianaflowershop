import { describe, expect, it } from "vitest";

import { formatManila } from "@/lib/datetime";

describe("formatManila", () => {
  it("renders UTC instants in Asia/Manila (UTC+8)", () => {
    // 2026-10-20T16:30Z is 00:30 on 21 Oct in Manila.
    const out = formatManila("2026-10-20T16:30:00Z", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    expect(out).toMatch(/21/);
    expect(out).toMatch(/12:30/i);
  });
});
