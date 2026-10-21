import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

import { addToCart, fillCheckout, loginAsStaff, placePaidOrder } from "./helpers";

test.describe.configure({ timeout: 180_000 });
const shotDir = "e2e/screenshots";
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

async function expectNoSeriousA11yIssues(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(
    serious.map(
      (v) =>
        `${label}: ${v.id} — ${v.help} (${v.nodes.length} nodes: ${v.nodes
          .slice(0, 2)
          .map((n) => n.target.join(" "))
          .join("; ")})`,
    ),
  ).toEqual([]);
}

test.describe("launch · full journey", () => {
  test("browse → cart → checkout → payment → preparation → dispatch → delivered", async ({
    page,
    browser,
  }) => {
    // Browse from the homepage rather than a deep link.
    await page.goto("/");
    await page.getByRole("link", { name: "Shop flowers" }).first().click();
    await expect(page).toHaveURL(/\/shop/);
    await page
      .getByRole("link", { name: /Sunday Market Bunch/ })
      .first()
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Sunday Market Bunch",
    );
    await page.getByRole("button", { name: /^Add to cart/ }).click();
    await expect(page.getByTestId("cart-count")).toHaveText("1");
    await page.goto("/cart");
    await page.getByRole("link", { name: "Proceed to checkout" }).click();
    await expect(page).toHaveURL(/\/checkout/);
    await fillCheckout(page, { method: "paymongo" });
    await page.getByRole("button", { name: /^Pay/ }).click();
    await page.getByRole("button", { name: "Authorize", exact: true }).click();
    await expect(page).toHaveURL(/\/orders\/FL-\d+\?t=/);
    await expect(page.getByText("Payment: Paid")).toBeVisible();
    const orderNumber = page.url().match(/orders\/(FL-\d+)/)![1]!;
    const trackingUrl = page.url();

    // Florist prepares.
    await loginAsStaff(page, "florist@floriana.local");
    await page.goto("/admin/prep");
    await page.getByRole("link", { name: new RegExp(orderNumber) }).click();
    await page.getByRole("button", { name: "Start preparation" }).click();
    await expect(page.getByText("Preparation started.")).toBeVisible();
    await page.getByRole("button", { name: "Mark ready for dispatch" }).click();
    await expect(page.getByText("Marked ready for dispatch.")).toBeVisible();

    // Manager dispatches, rider delivers.
    await loginAsStaff(page, "manager@floriana.local");
    await page.goto("/admin/dispatch?date=all");
    const row = page.getByRole("row").filter({ hasText: orderNumber });
    await row
      .getByLabel(`Rider for ${orderNumber}`)
      .selectOption({ label: "Jun Cabahug" });
    await expect(page.getByText("Rider assigned.")).toBeVisible();
    const rider = await browser.newPage();
    await loginAsStaff(rider, "rider@floriana.local");
    await rider.goto("/admin/rider");
    const card = rider.getByRole("listitem").filter({ hasText: orderNumber });
    await card.getByRole("button", { name: `Start delivery ${orderNumber}` }).click();
    await expect(rider.getByText("Marked out for delivery.")).toBeVisible();
    await card.getByRole("button", { name: `Mark delivered ${orderNumber}` }).click();
    await rider
      .getByLabel("Proof photo")
      .setInputFiles({ name: "pod.png", mimeType: "image/png", buffer: PNG });
    await rider.getByLabel("Received by").fill("Paolo Santos");
    await rider.getByRole("button", { name: "Confirm delivered" }).click();
    await expect(rider.getByText("Delivered. Thank you!")).toBeVisible();
    await rider.close();

    // Customer sees it, admin order record is complete.
    await page.goto(trackingUrl);
    await expect(page.getByText("Delivery: Delivered")).toBeVisible();
    await page.goto(`/admin/orders?q=${orderNumber}`);
    await page.getByRole("link", { name: orderNumber }).click();
    await expect(page.getByTestId("payment-status")).toContainText("paid");
    await expect(page.getByText("Delivery: delivered")).toBeVisible();
  });
});

test.describe("launch · order lifecycle", () => {
  test("order cancellation releases stock and the slot; customer tracking reflects it", async ({
    page,
  }) => {
    await addToCart(page, "sunday-market-bunch");
    await fillCheckout(page, { method: "bank_transfer" });
    await page.getByRole("button", { name: /^Place order/ }).click();
    await expect(page).toHaveURL(/\/orders\/FL-\d+\?t=/);
    const orderNumber = page.url().match(/orders\/(FL-\d+)/)![1]!;
    const trackingUrl = page.url();

    await loginAsStaff(page, "support@floriana.local"); // support may cancel
    await page.goto(`/admin/orders?q=${orderNumber}&status=pending`);
    await page.getByRole("link", { name: orderNumber }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: orderNumber }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Cancel order" }).click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("button", { name: "Confirm cancellation" }),
    ).toBeDisabled(); // reason required
    await dialog.getByLabel("Reason").fill("Customer changed their mind");
    await dialog.getByRole("button", { name: "Confirm cancellation" }).click();
    await expect(
      page.getByText("Order cancelled. Stock and delivery slot released."),
    ).toBeVisible();
    await expect(page.getByTestId("order-status")).toContainText("cancelled");
    await expect(page.getByRole("status")).toContainText("Customer changed their mind");
    await expect(page.getByRole("button", { name: "Cancel order" })).toHaveCount(0);

    await page.goto(trackingUrl);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("cancelled");
  });

  test("refund workflow: full refund through the gateway shows on tracking, order and reports", async ({
    page,
  }) => {
    const orderNumber = await placePaidOrder(page, "sunday-market-bunch");
    const trackingUrl = page.url();
    await loginAsStaff(page, "manager@floriana.local");
    await page.goto("/admin/payments");
    const row = page.getByRole("row").filter({ hasText: orderNumber });
    await row.getByRole("button", { name: `Refund ${orderNumber}` }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Amount (₱)")).toHaveValue(/\d/);
    await dialog
      .getByLabel("Reason")
      .selectOption({ index: 1 })
      .catch(async () => {
        await dialog.getByLabel("Reason").fill("requested_by_customer");
      });
    await dialog.getByLabel("Notes").fill("Damaged on arrival (E2E)");
    await dialog.getByRole("button", { name: "Record refund" }).click();
    await expect(page.getByText(/Refund/).first()).toBeVisible();
    await expect(row).toContainText(/refunded/i);

    await page.goto(trackingUrl);
    await expect(page.getByText("Payment: Refunded")).toBeVisible();

    await page.goto(`/admin/orders?q=${orderNumber}`);
    await page.getByRole("link", { name: orderNumber }).click();
    await expect(page.getByTestId("payment-status")).toContainText("refunded");
    await expect(page.getByText(/Refund ₱/)).toBeVisible();

    await page.goto("/admin/reports");
    const refunds = await page.getByTestId("summary-refunds").textContent();
    expect(refunds).toMatch(/₱[1-9]/);
  });
});

test.describe("launch · catalogue administration", () => {
  test("product updates reach the storefront; archived products disappear", async ({
    page,
  }) => {
    await loginAsStaff(page, "manager@floriana.local");
    await page.goto("/admin/products");
    await page.getByRole("link", { name: "Cebu Morning" }).click();
    const variant = page.getByRole("form", { name: /Variant Three sunflowers/ });
    const original = await variant.getByLabel("Price (₱)").inputValue();
    await variant.getByLabel("Price (₱)").fill("675");
    await variant.getByRole("button", { name: /^Save/ }).click();
    await expect(page.getByText("Variant saved.")).toBeVisible();

    await page.goto("/shop/cebu-morning");
    await expect(page.getByText("₱675.00").first()).toBeVisible();

    await page.goto("/admin/products");
    await page.getByRole("link", { name: "Cebu Morning" }).click();
    await page.getByLabel("Status").selectOption("archived");
    await page.getByRole("button", { name: "Save product" }).click();
    await expect(page.getByText("Product saved.")).toBeVisible();
    await page.goto("/shop/cebu-morning");
    await expect(
      page.locator('meta[name="robots"][content*="noindex"]').first(),
    ).toBeAttached();
    await page.goto("/shop");
    await expect(page.getByRole("link", { name: /Cebu Morning/ })).toHaveCount(0);

    // Restore.
    await page.goto("/admin/products");
    await page.getByRole("link", { name: "Cebu Morning" }).click();
    await page.getByLabel("Status").selectOption("active");
    await page.getByRole("button", { name: "Save product" }).click();
    await expect(page.getByText("Product saved.")).toBeVisible();
    await page
      .getByRole("form", { name: /Variant Three sunflowers/ })
      .getByLabel("Price (₱)")
      .fill(original);
    await page
      .getByRole("form", { name: /Variant Three sunflowers/ })
      .getByRole("button", { name: /^Save/ })
      .click();
    await expect(page.getByText("Variant saved.")).toBeVisible();
  });

  test("settings: switching online payments off removes the option at checkout", async ({
    page,
  }) => {
    await loginAsStaff(page, "manager@floriana.local");
    await page.goto("/admin/settings");
    await page.getByLabel("Online payments (PayMongo) enabled").uncheck();
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Settings saved.")).toBeVisible();

    await page.context().clearCookies();
    await addToCart(page, "sunday-market-bunch");
    await page.goto("/checkout");
    await expect(page.getByText("Pay online")).toHaveCount(0);
    await expect(page.getByText("Bank transfer / GCash transfer")).toBeVisible();

    await loginAsStaff(page, "manager@floriana.local");
    await page.goto("/admin/settings");
    await page.getByLabel("Online payments (PayMongo) enabled").check();
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Settings saved.")).toBeVisible();
  });
});

test.describe("launch · authorization", () => {
  test("role boundaries across the new admin surfaces and jobs", async ({
    page,
    request,
  }) => {
    expect((await request.get("/api/jobs/retention")).status()).toBe(401);
    expect(
      (
        await request.get("/api/jobs/retention", {
          headers: { authorization: "Bearer wrong" },
        })
      ).status(),
    ).toBe(401);
    expect((await request.get("/api/admin/reports/sales-summary.csv")).status()).toBe(
      401,
    );

    await page.goto("/admin/orders");
    await expect(page).toHaveURL(/\/admin\/login/);

    await loginAsStaff(page, "rider@floriana.local");
    for (const path of [
      "/admin/products",
      "/admin/settings",
      "/admin/customers",
      "/admin/promotions",
    ]) {
      await page.goto(path);
      await expect(
        page.getByText(/permission|not allowed|Something went wrong/i).first(),
      ).toBeVisible();
    }
    await page.goto("/admin");
    const nav = page.getByRole("navigation", { name: "Admin" }).first();
    for (const label of ["Products", "Settings", "Customers", "Reports"]) {
      await expect(nav.getByRole("link", { name: label, exact: true })).toHaveCount(0);
    }

    await loginAsStaff(page, "florist@floriana.local");
    await page.goto("/admin/orders");
    await page
      .getByRole("link", { name: /FL-\d+/ })
      .first()
      .click();
    await expect(
      page.getByText("Contact details restricted for your role."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel order" })).toHaveCount(0);
  });
});

test.describe("launch · accessibility & platform", () => {
  test("keyboard: skip link, focus order, dialog escape", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();

    await loginAsStaff(page, "manager@floriana.local");
    await page.goto("/admin/orders");
    await page
      .getByRole("link", { name: /FL-\d+/ })
      .first()
      .click();
    const cancel = page.getByRole("button", { name: "Cancel order" });
    if (await cancel.count()) {
      await cancel.focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.getByRole("dialog").getByLabel("Reason")).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(cancel).toBeFocused();
    }
  });

  test("axe: no serious or critical WCAG 2.1 AA violations on key pages", async ({
    page,
  }, testInfo) => {
    // Entrance animations fade text in; scan the settled page, as a reduced-motion user sees it.
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const [path, label] of [
      ["/", "home"],
      ["/shop", "shop"],
      ["/shop/sunday-market-bunch", "product"],
      ["/cart", "cart"],
      ["/faqs", "faqs"],
    ] as const) {
      await page.goto(path);
      await expectNoSeriousA11yIssues(page, label);
    }
    await addToCart(page, "sunday-market-bunch");
    await page.goto("/checkout");
    await expectNoSeriousA11yIssues(page, "checkout");

    await loginAsStaff(page, "manager@floriana.local");
    for (const [path, label] of [
      ["/admin", "dashboard"],
      ["/admin/orders", "orders"],
      ["/admin/reports", "reports"],
      ["/admin/products", "products"],
    ] as const) {
      await page.goto(path);
      await expectNoSeriousA11yIssues(page, label);
    }
    await page.screenshot({
      path: `${shotDir}/admin-orders-${testInfo.project.name}.png`,
      fullPage: true,
    });
  });

  test("health endpoint and security headers", async ({ request }) => {
    const health = await request.get("/api/health");
    expect(health.status()).toBe(200);
    const body = await health.json();
    expect(body.status).toBe("ok");
    expect(body.database).toBe("ok");
    expect(JSON.stringify(body)).not.toMatch(/key|secret/i);

    const home = await request.get("/");
    const h = home.headers();
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["strict-transport-security"]).toContain("max-age=");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["x-powered-by"]).toBeUndefined();
  });
});
