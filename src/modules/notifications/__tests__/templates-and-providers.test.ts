import { describe, expect, it, vi } from "vitest";

import { createResendProvider } from "@/modules/notifications/providers";
import { renderSms, renderTemplate } from "@/modules/notifications/templates";

const base = { siteUrl: "https://floriana.test", shopName: "Floriana Flowers" };

describe("notification templates", () => {
  it("renders every order event with a tracking link and escapes HTML", () => {
    for (const t of [
      "order.placed",
      "payment.confirmed",
      "preparation.complete",
      "delivery.out",
      "delivery.delivered",
      "delivery.failed",
    ]) {
      const r = renderTemplate({
        ...base,
        template: t,
        payload: {
          order_number: "FL-10001",
          customer_name: "<Maria>",
          tracking_path: "/orders/FL-10001?t=abc",
          total_centavos: 123450,
          delivery_date: "2026-11-01",
          delivery_slot: "Morning",
        },
      });
      expect(r.subject).toContain("FL-10001");
      expect(r.html).toContain("https://floriana.test/orders/FL-10001?t=abc");
      expect(r.html).toContain("&lt;Maria&gt;");
      expect(r.html).not.toContain("<Maria>");
      expect(r.text.length).toBeGreaterThan(10);
    }
  });

  it("includes bank-transfer guidance only for bank orders", () => {
    const bank = renderTemplate({
      ...base,
      template: "order.placed",
      payload: { order_number: "FL-1", payment_method: "bank_transfer" },
    });
    const online = renderTemplate({
      ...base,
      template: "order.placed",
      payload: { order_number: "FL-1", payment_method: "paymongo" },
    });
    expect(bank.html).toContain("bank transfer");
    expect(online.html).not.toContain("bank transfer");
  });

  it("renders the low-stock digest as a table", () => {
    const r = renderTemplate({
      ...base,
      template: "inventory.low_stock",
      payload: {
        count: 2,
        items: [
          { name: "Sunflower", available: 3, threshold: 15, unit: "stem" },
          { name: "Ribbon", available: 1, threshold: 10, unit: "metre" },
        ],
      },
    });
    expect(r.subject).toBe("2 materials are low on stock");
    expect(r.html).toContain("Sunflower");
    expect(r.html).toContain("/admin/inventory");
  });

  it("keeps SMS under 160 characters", () => {
    const s = renderSms(
      "delivery.out",
      { order_number: "FL-10001", tracking_path: "/orders/FL-10001?t=" + "a".repeat(60) },
      base.siteUrl,
    );
    expect(s.length).toBeLessThanOrEqual(160);
  });
});

describe("Resend provider", () => {
  it("posts the documented payload with a bearer token", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe("https://api.resend.com/emails");
      expect((init?.headers as Record<string, string>).Authorization).toBe(
        "Bearer re_test",
      );
      expect(JSON.parse(String(init?.body))).toMatchObject({
        from: "Floriana <orders@x.ph>",
        to: ["a@b.c"],
        subject: "Hi",
      });
      return new Response(JSON.stringify({ id: "email_123" }), { status: 200 });
    });
    const p = createResendProvider("re_test", fetchImpl as unknown as typeof fetch);
    const res = await p.send({
      from: "Floriana <orders@x.ph>",
      to: "a@b.c",
      subject: "Hi",
      html: "<p>hi</p>",
      text: "hi",
    });
    expect(res).toMatchObject({ ok: true, provider: "resend", messageId: "email_123" });
  });

  it("classifies 429/5xx as retryable and 4xx as permanent", async () => {
    const mk = (status: number) =>
      createResendProvider(
        "re_test",
        (async () => new Response("err", { status })) as unknown as typeof fetch,
      );
    expect(
      await mk(429).send({ from: "f", to: "t", subject: "s", html: "", text: "" }),
    ).toMatchObject({ ok: false, retryable: true });
    expect(
      await mk(500).send({ from: "f", to: "t", subject: "s", html: "", text: "" }),
    ).toMatchObject({ ok: false, retryable: true });
    expect(
      await mk(422).send({ from: "f", to: "t", subject: "s", html: "", text: "" }),
    ).toMatchObject({ ok: false, retryable: false });
  });
});
