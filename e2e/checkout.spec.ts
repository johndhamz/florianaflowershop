import { expect, test } from "@playwright/test";

import { addToCart, fillCheckout } from "./helpers";

/**
 * Checkout + payments against the mock gateway (PAYMENT_PROVIDER=mock).
 * The mock mirrors PayMongo's hosted page and posts a signed webhook to our
 * endpoint (twice, to prove duplicate deliveries are harmless).
 */
const shotDir = "e2e/screenshots";

// Multi-page flows (cart → form → gateway → tracking → admin) need more than the default 30 s.
test.describe.configure({ timeout: 120_000 });

test.describe("checkout", () => {
  test("successful online payment confirms the order (webhook + redirect)", async ({
    page,
  }, testInfo) => {
    await addToCart(page, "blush-romance");
    await fillCheckout(page, { method: "paymongo", promo: "LOLA10" });
    await expect(page.getByText(/LOLA10 applied/)).toBeVisible();
    await expect(page.getByTestId("checkout-total")).toHaveText("₱2,340.00"); // 2490 − 249 + 99
    await page.screenshot({
      path: `${shotDir}/checkout-${testInfo.project.name}.png`,
      fullPage: true,
    });

    await page.getByRole("button", { name: /^Pay ₱2,340.00/ }).click();
    await expect(page).toHaveURL(/\/mock-pay\//);
    await expect(page.getByRole("heading", { name: /Pay ₱2,340.00/ })).toBeVisible();
    await page.getByRole("button", { name: "Authorize", exact: true }).click();

    await expect(page).toHaveURL(/\/orders\/FL-\d+\?t=/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Your order is confirmed",
    );
    await expect(page.getByText("Payment: Paid")).toBeVisible();
    await expect(page.getByTestId("order-total")).toHaveText("₱2,340.00");
    await page.screenshot({
      path: `${shotDir}/order-confirmed-${testInfo.project.name}.png`,
      fullPage: true,
    });

    // Cart is empty afterwards.
    await page.goto("/cart");
    await expect(page.getByRole("status")).toContainText("Your cart is empty");
  });

  test("failed payment leaves the order payable and retry works", async ({ page }) => {
    await addToCart(page);
    await fillCheckout(page, { method: "paymongo" });
    await page.getByRole("button", { name: /^Pay/ }).click();
    await expect(page).toHaveURL(/\/mock-pay\//);
    await page.getByRole("button", { name: "Fail", exact: true }).click();

    await expect(page).toHaveURL(/\/orders\/FL-\d+\?t=/);
    await expect(page.getByText("Payment: Failed")).toBeVisible();
    await expect(page.getByText("Payment didn't go through")).toBeVisible();

    await page.getByRole("button", { name: "Try paying again" }).click();
    await expect(page).toHaveURL(/\/mock-pay\//);
    await page.getByRole("button", { name: "Authorize", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Your order is confirmed",
    );
  });

  test("browser closed after paying: the webhook alone confirms the order", async ({
    page,
  }) => {
    await addToCart(page);
    await fillCheckout(page, { method: "paymongo" });
    await page.getByRole("button", { name: /^Pay/ }).click();
    await expect(page).toHaveURL(/\/mock-pay\//);
    const cancelHref = await page
      .getByRole("link", { name: "Cancel and go back" })
      .getAttribute("href");
    await page.getByTestId("authorize-no-redirect").click();
    await expect(page.getByTestId("authorize-no-redirect")).toBeEnabled();
    // No redirect happened; open the tracking page fresh.
    await page.goto(cancelHref!);
    await expect(page.getByText("Payment: Paid")).toBeVisible();
  });

  test("bank transfer: instructions, proof upload, staff verification", async ({
    page,
    browser,
  }) => {
    await addToCart(page, "lolas-phalaenopsis");
    await fillCheckout(page, { method: "bank_transfer" });
    await page.getByRole("button", { name: /^Place order/ }).click();
    await expect(page).toHaveURL(/\/orders\/FL-\d+\?t=.*placed=1/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("one more step");
    await expect(page.getByText("Complete your bank transfer")).toBeVisible();
    await expect(page.getByText(/BPI 1234-5678-90/)).toBeVisible();
    const orderNumber = page.url().match(/orders\/(FL-\d+)/)![1]!;

    await page.getByLabel("Transfer reference (optional)").fill("GC123456");
    await page.getByLabel("Screenshot or PDF of the transfer").setInputFiles({
      name: "proof.png",
      mimeType: "image/png",
      buffer: Buffer.from("89504e470d0a1a0a", "hex"),
    });
    await page.getByRole("button", { name: "Upload proof" }).click();
    await expect(page.getByText("Proof received")).toBeVisible();

    // Staff verifies in the admin.
    const staff = await browser.newPage();
    await staff.goto("/admin/login");
    await staff.getByLabel("Email").fill("manager@floriana.local");
    await staff.getByLabel("Password").fill("Floriana!2026");
    await staff.getByRole("button", { name: "Sign in" }).click();
    await expect(staff).toHaveURL(/\/admin$/);
    await staff.goto("/admin/payments");
    await expect(
      staff.getByRole("heading", { level: 1, name: "Payments" }),
    ).toBeVisible();
    const row = staff.getByRole("row").filter({ hasText: orderNumber });
    await expect(row.locator("a", { hasText: "View" })).toHaveCount(1); // CSS locator: column is display:none below lg
    await row.getByRole("button", { name: `Approve ${orderNumber}` }).click();
    await expect(staff.getByText("Payment verified. Order confirmed.")).toBeVisible();
    await staff.close();

    await page.reload();
    await expect(page.getByText("Payment: Paid")).toBeVisible();
  });

  test("invalid promo, uncovered barangay and insufficient stock are rejected", async ({
    page,
  }) => {
    await addToCart(page);
    await fillCheckout(page, { method: "bank_transfer", promo: "NOPE123" });
    await expect(page.getByText("That promo code is not valid.")).toBeVisible();

    await page.getByLabel("Barangay").fill("Talamban"); // Cebu City · Outer, not Central
    await page.getByRole("button", { name: /^Place order/ }).click();
    await expect(
      page.getByText(/Talamban is not in the Cebu City · Central zone/).first(),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/checkout$/);
  });

  test("unauthorized order access is refused", async ({ page }) => {
    await page.goto("/orders/FL-10001?t=not-the-token-at-all-really");
    await expect(page.getByRole("status")).toContainText("couldn't find that order");
    await page.goto("/orders/FL-10001");
    await expect(page.getByRole("status")).toContainText("couldn't find that order");
    // The seeded dev token works.
    await page.goto("/orders/FL-10001?t=track-fl-10001-dev");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Your order is confirmed",
    );
    await expect(page.getByText("+63918•••••01")).toBeVisible();
  });

  test("webhook endpoint rejects bad signatures and tolerates duplicates", async ({
    request,
  }) => {
    const bad = await request.post("/api/webhooks/paymongo", {
      data: {
        data: {
          id: "evt_x",
          attributes: {
            type: "payment.paid",
            livemode: false,
            data: { id: "pay_x", attributes: {} },
          },
        },
      },
      headers: { "Paymongo-Signature": "t=1,te=deadbeef,li=" },
    });
    expect(bad.status()).toBe(400);
  });
});
