import { describe, expect, it } from "vitest";

import { redactSensitive, toErrorReport } from "../observability";

describe("redactSensitive", () => {
  it("strips API keys, JWTs and email addresses", () => {
    const text =
      "key sk_live_abc123DEF user maria@example.com token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.x";
    const out = redactSensitive(text);
    expect(out).not.toContain("sk_live_");
    expect(out).not.toContain("maria@example.com");
    expect(out).not.toContain("eyJhbGci");
    expect(out).toContain("[redacted]");
    expect(out).toContain("[email]");
  });
});

describe("toErrorReport", () => {
  it("captures digest, route context and a trimmed, redacted stack", () => {
    const err = Object.assign(new Error("Resend re_secretKEY123 failed for a@b.co"), {
      digest: "abc",
    });
    const report = toErrorReport(
      err,
      { path: "/checkout", method: "POST" },
      { routerKind: "App Router", routeType: "action" },
    );
    expect(report.digest).toBe("abc");
    expect(report.path).toBe("/checkout");
    expect(report.routeType).toBe("action");
    expect(report.message).toBe("Resend [redacted] failed for [email]");
    expect(report.stack?.split("\n").length).toBeLessThanOrEqual(8);
  });
  it("wraps non-Error throwables", () => {
    expect(toErrorReport("boom").message).toBe("boom");
  });
});
