import { describe, expect, it } from "vitest";

import {
  buildSignatureHeader,
  computeSignature,
  parseSignatureHeader,
  verifyPaymongoSignature,
} from "@/modules/payments/providers/signature";

const secret = "whsk_test_secret";
const body = JSON.stringify({
  data: { id: "evt_1", attributes: { type: "payment.paid", livemode: false } },
});

describe("PayMongo signature", () => {
  it("parses the t/te/li header", () => {
    expect(parseSignatureHeader("t=1700000000,te=abc,li=")).toEqual({
      t: "1700000000",
      te: "abc",
      li: "",
    });
    expect(parseSignatureHeader(null)).toBeNull();
    expect(parseSignatureHeader("garbage")).toBeNull();
  });

  it("signs `timestamp.rawBody` with HMAC-SHA256 and verifies test vs live", () => {
    const now = 1_700_000_000;
    const header = buildSignatureHeader(secret, body, false, now);
    expect(header).toBe(`t=${now},te=${computeSignature(secret, String(now), body)},li=`);
    expect(
      verifyPaymongoSignature({ header, rawBody: body, secret, livemode: false, now }),
    ).toBe(true);
    // A test signature must not satisfy a live event, and vice versa.
    expect(
      verifyPaymongoSignature({ header, rawBody: body, secret, livemode: true, now }),
    ).toBe(false);
    const live = buildSignatureHeader(secret, body, true, now);
    expect(
      verifyPaymongoSignature({
        header: live,
        rawBody: body,
        secret,
        livemode: true,
        now,
      }),
    ).toBe(true);
  });

  it("rejects tampered bodies, wrong secrets and stale timestamps", () => {
    const now = 1_700_000_000;
    const header = buildSignatureHeader(secret, body, false, now);
    expect(
      verifyPaymongoSignature({
        header,
        rawBody: body + " ",
        secret,
        livemode: false,
        now,
      }),
    ).toBe(false);
    expect(
      verifyPaymongoSignature({
        header,
        rawBody: body,
        secret: "other",
        livemode: false,
        now,
      }),
    ).toBe(false);
    expect(
      verifyPaymongoSignature({
        header,
        rawBody: body,
        secret,
        livemode: false,
        now: now + 600,
      }),
    ).toBe(false);
    expect(
      verifyPaymongoSignature({
        header,
        rawBody: body,
        secret,
        livemode: false,
        now: now + 200,
      }),
    ).toBe(true);
  });
});
