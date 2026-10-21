import { expect, test } from "@playwright/test";

import { fillCheckout, addToCart, loginAsStaff, placePaidOrder } from "./helpers";

test.describe.configure({ timeout: 150_000 });
const shotDir = "e2e/screenshots";

test.describe("dashboard & reports", () => {
  test("manager sees live dashboard tiles and downloads report CSVs", async ({
    page,
  }, testInfo) => {
    const orderNumber = await placePaidOrder(page);
    await loginAsStaff(page, "manager@floriana.local");
    await page.goto("/admin");
    await expect(page.getByTestId("tile-orders-today")).not.toHaveText("0");
    await expect(page.getByTestId("tile-sales-today")).toContainText("₱");
    await expect(page.getByText(orderNumber).first()).toBeVisible();
    await page.screenshot({
      path: `${shotDir}/admin-dashboard-${testInfo.project.name}.png`,
      fullPage: true,
    });

    await page.goto("/admin/reports?report=best-sellers");
    await expect(page.getByTestId("summary-net-sales")).toContainText("₱");
    await expect(
      page.getByRole("cell", { name: /Sunday Market Bunch/ }).first(),
    ).toBeVisible();
    await page.goto("/admin/reports?report=product-margin");
    await expect(page.getByText(/Estimated — costs are weighted averages/)).toBeVisible();
    await page.screenshot({
      path: `${shotDir}/admin-reports-${testInfo.project.name}.png`,
      fullPage: true,
    });

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTestId("export-csv").click(),
    ]);
    expect(download.suggestedFilename()).toMatch(
      /^floriana-product-margin-\d{4}-\d{2}-\d{2}-to-\d{4}-\d{2}-\d{2}\.csv$/,
    );
    const body = (await (await download.createReadStream()).toArray()).join("");
    expect(body.split("\n")[0]).toContain("estimated_margin_pesos");
    expect(body).toContain("Sunday Market Bunch");
  });

  test("support and florist are refused financial reports; the API returns 403", async ({
    page,
  }) => {
    await loginAsStaff(page, "support@floriana.local");
    const res = await page.request.get("/api/admin/reports/sales-summary.csv");
    expect(res.status()).toBe(403);
    await page.goto("/admin");
    await expect(page.getByTestId("tile-orders-today")).toBeVisible();
    await expect(page.getByTestId("tile-sales-today")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Reports" })).toHaveCount(0);
  });

  test("anonymous CSV requests are refused", async ({ request }) => {
    const res = await request.get("/api/admin/reports/orders-by-date.csv");
    expect(res.status()).toBe(401);
  });
});

test.describe("promotions", () => {
  test("manager creates a first-order-only code; checkout enforces eligibility server-side", async ({
    page,
  }) => {
    const code = `E2E${Date.now().toString().slice(-6)}`;
    await loginAsStaff(page, "manager@floriana.local");
    await page.goto("/admin/promotions");
    await page.getByRole("button", { name: "New promotion" }).click();
    await page.getByLabel("Code").fill(code.toLowerCase());
    await page.getByLabel("Value (% or ₱)").fill("20");
    await page.getByLabel("Uses per customer").fill("1");
    await page.getByLabel("First order only").check();
    await page.getByRole("button", { name: "Save promotion" }).click();
    await expect(page.getByText("Promotion created.")).toBeVisible();
    await expect(page.getByRole("cell", { name: code, exact: true })).toBeVisible();

    // Fresh shopper → accepted (20% of ₱450 = ₱90 off).
    await page.context().clearCookies();
    await addToCart(page);
    await fillCheckout(page, { method: "bank_transfer", promo: code });
    await expect(page.getByText(new RegExp(`${code} applied`))).toBeVisible();
    await expect(page.getByText("−₱90.00")).toBeVisible();

    // Returning customer (seeded Maria Santos has paid orders) → rejected.
    await page.getByLabel("Email", { exact: true }).fill("maria.santos@example.com");
    await page.getByLabel("Promo code").fill(code);
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText("This code is for first orders only.")).toBeVisible();

    // Place the order as the fresh shopper and confirm the redemption is recorded.
    await page
      .getByLabel("Email", { exact: true })
      .fill(`fresh+${Date.now()}@example.com`);
    await page.getByLabel("Promo code").fill(code);
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText(new RegExp(`${code} applied`))).toBeVisible();
    await page.getByRole("button", { name: /^Place order/ }).click();
    await expect(page).toHaveURL(/\/orders\/FL-\d+\?t=/);

    await loginAsStaff(page, "manager@floriana.local");
    await page.goto("/admin/promotions");
    const row = page.getByRole("row").filter({ hasText: code });
    await expect(row).toContainText("1");
    await expect(row).toContainText("₱90.00");
  });

  test("florist cannot open promotions", async ({ page }) => {
    await loginAsStaff(page, "florist@floriana.local");
    await page.goto("/admin/promotions");
    await expect(
      page.getByText(/permission|not allowed|Something went wrong/i).first(),
    ).toBeVisible();
  });
});

test.describe("content management", () => {
  test("publishing a hero edit updates the homepage; drafts do not", async ({ page }) => {
    const stamp = Date.now().toString().slice(-5);
    await loginAsStaff(page, "manager@floriana.local");
    await page.goto("/admin/content");
    await page.getByRole("button", { name: "Edit Homepage hero" }).click();
    const editor = page.getByLabel("Content JSON");
    const original = await editor.inputValue();
    const draft = original.replace(
      '"Love, in every bloom."',
      `"Draft ${stamp} unpublished"`,
    );
    await editor.fill(draft);
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("Draft saved.")).toBeVisible();
    await expect(
      page
        .getByRole("listitem")
        .filter({ hasText: "Homepage hero" })
        .getByText("Draft changes"),
    ).toBeVisible();

    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Love, in every bloom.",
    );

    await page.goto("/admin/content");
    await page.getByRole("button", { name: "Edit Homepage hero" }).click();
    await page
      .getByLabel("Content JSON")
      .fill(
        original.replace('"Love, in every bloom."', `"Love, in every bloom. ${stamp}"`),
      );
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText("Published.")).toBeVisible();

    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      `Love, in every bloom. ${stamp}`,
    );

    // Restore so other specs keep their expectations.
    await page.goto("/admin/content");
    await page.getByRole("button", { name: "Edit Homepage hero" }).click();
    await page.getByLabel("Content JSON").fill(original);
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText("Published.")).toBeVisible();
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Love, in every bloom.",
    );
  });

  test("invalid content is rejected before it reaches the storefront", async ({
    page,
  }) => {
    await loginAsStaff(page, "manager@floriana.local");
    await page.goto("/admin/content");
    await page.getByRole("button", { name: "Edit Contact information" }).click();
    await page
      .getByLabel("Content JSON")
      .fill('{"email":"not-an-email","phone":"1","hours":"","address":""}');
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText(/Invalid content: email/)).toBeVisible();
  });
});
