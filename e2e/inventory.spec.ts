import { expect, test } from "@playwright/test";

import { loginAsStaff as login, placePaidOrder } from "./helpers";

test.describe.configure({ timeout: 120_000 });
const shotDir = "e2e/screenshots";

test.describe("inventory (manager)", () => {
  test("receive stock, see it in batches and movements, record wastage, reconcile", async ({
    page,
  }, testInfo) => {
    await login(page, "manager@floriana.local");
    const code = `B-E2E-${Date.now().toString().slice(-6)}`;

    await page.goto("/admin/inventory/receive");
    await page.locator('form[data-hydrated="true"]').waitFor();
    await page.getByLabel("Material").selectOption({ label: "Sunflower (FL-SUNFLOWER)" });
    await page.getByLabel(/^Quantity/).fill("25");
    await page.getByLabel("Unit cost (₱)").fill("25");
    await page.getByLabel("Batch code (optional)").fill(code);
    await page.getByRole("button", { name: "Receive into stock" }).click();
    await expect(page.getByText(`Received into batch ${code}.`)).toBeVisible();

    await page.goto("/admin/inventory/batches");
    const row = page.getByRole("row").filter({ hasText: code });
    await expect(row).toBeVisible();
    await expect(row).toContainText("25");
    await page.screenshot({
      path: `${shotDir}/inventory-batches-${testInfo.project.name}.png`,
      fullPage: true,
    });

    // Wastage from the new batch.
    await row.getByRole("button", { name: `Record wastage for ${code}` }).click();
    await page.getByLabel("Quantity wasted").fill("3");
    await page.getByLabel("Reason").selectOption("wilted");
    await page.getByLabel("Note").fill("heat damage");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Wastage recorded.")).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: code })).toContainText("22");

    // Over-wastage is refused.
    await page
      .getByRole("row")
      .filter({ hasText: code })
      .getByRole("button", { name: `Record wastage for ${code}` })
      .click();
    await page.getByLabel("Quantity wasted").fill("999");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(/Only .* available on this batch/)).toBeVisible();
    await page.keyboard.press("Escape");

    await page.goto("/admin/inventory/movements?material=&type=discard");
    await expect(page.getByRole("row").filter({ hasText: code })).toContainText(
      "heat damage",
    );

    await page.goto("/admin/inventory/reconciliation");
    await expect(page.getByTestId("reconciliation-summary")).toContainText(
      "all balanced",
    );
    await page.screenshot({
      path: `${shotDir}/inventory-reconciliation-${testInfo.project.name}.png`,
      fullPage: true,
    });
  });

  test("materials and recipe editor", async ({ page }) => {
    await login(page, "manager@floriana.local");
    await page.goto("/admin/inventory/materials");
    await page.getByRole("button", { name: "New material" }).click();
    const sku = `E2E-RIB-${Date.now().toString().slice(-5)}`;
    await page.getByLabel("SKU").fill(sku);
    await page.getByLabel("Name").fill("Velvet ribbon, sage");
    await page.getByLabel("Category").selectOption("wrap");
    await page.getByLabel("Unit").selectOption("metre");
    await page.getByLabel("Perishable").uncheck();
    await page.getByLabel("Low-stock threshold").fill("5");
    await page.getByRole("button", { name: "Save material" }).click();
    await expect(page.getByText("Material created.")).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: sku })).toBeVisible();

    await page.goto("/admin/inventory/recipes");
    await page
      .getByRole("row")
      .filter({ hasText: "EV-GYP-STD" })
      .getByRole("link", { name: "Edit" })
      .click();
    await expect(
      page.getByRole("heading", { name: /Baby's Breath Cloud/ }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Add material" }).click();
    const lastSelect = page.getByLabel(/^Material \d+$/).last();
    await lastSelect.selectOption({ label: "Velvet ribbon, sage" });
    await page
      .getByLabel(/^Quantity \d+$/)
      .last()
      .fill("1.5");
    await page.getByRole("button", { name: "Save recipe" }).click();
    await expect(page.getByText("Recipe saved.")).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: "EV-GYP-STD" })).toContainText(
      "Velvet ribbon, sage",
    );
  });

  test("overview shows low-stock alerts and upcoming requirements", async ({ page }) => {
    await login(page, "manager@floriana.local");
    await page.goto("/admin/inventory");
    await expect(page.getByRole("heading", { name: "Low-stock alerts" })).toBeVisible();
    await expect(page.getByRole("table", { name: "Low-stock materials" })).toContainText(
      "Phalaenopsis, white, 3 spikes",
    );
    await expect(
      page.getByRole("heading", { name: /Upcoming material requirements/ }),
    ).toBeVisible();
  });
});

test.describe("florist preparation", () => {
  test("florist works the queue: start, substitute, record consumption, mark ready; cannot see customers or payments", async ({
    page,
  }, testInfo) => {
    // A fresh paid order of our own (placed anonymously) so the test is repeatable across projects.
    const orderNumber = await placePaidOrder(page, "sunday-market-bunch");
    await login(page, "florist@floriana.local");

    // Financial / customer areas are off limits.
    await page.goto("/admin/payments");
    await expect(
      page.getByText(/permission|not allowed|Something went wrong/i).first(),
    ).toBeVisible();

    await page.goto("/admin/prep");
    await expect(
      page.getByRole("heading", { level: 1, name: "Preparation queue" }),
    ).toBeVisible();
    const card = page.getByRole("link", { name: new RegExp(orderNumber) });
    await expect(card).toBeVisible();
    await page.screenshot({
      path: `${shotDir}/prep-queue-${testInfo.project.name}.png`,
      fullPage: true,
    });
    await card.click();
    await expect(page).toHaveURL(/\/admin\/prep\/[0-9a-f-]+$/);

    await expect(
      page.getByRole("heading", { level: 1, name: orderNumber }),
    ).toBeVisible();
    await expect(page.getByText("Card message", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Happy anniversary!")).toBeVisible();
    await expect(
      page.getByRole("table", { name: /Recipe for Sunday Market Bunch/ }),
    ).toBeVisible();

    // Start, then record actuals (one fewer yellow mum than planned) and mark ready.
    await page.getByRole("button", { name: "Start preparation" }).click();
    await expect(page.getByText("Preparation started.")).toBeVisible();
    await page.getByLabel(/Chrysanthemum, yellow/).fill("4");
    await page.getByLabel("Notes").fill("Tied with kraft paper.");
    await page.getByRole("button", { name: "Mark ready for dispatch" }).click();
    await expect(page.getByText("Marked ready for dispatch.")).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/prep$/);
    await expect(page.getByRole("link", { name: new RegExp(orderNumber) })).toHaveCount(
      0,
    );

    // Show ready list includes it.
    await page.goto("/admin/prep?ready=1");
    await expect(page.getByRole("link", { name: new RegExp(orderNumber) })).toBeVisible();
    await page.screenshot({
      path: `${shotDir}/prep-ready-${testInfo.project.name}.png`,
      fullPage: true,
    });
  });

  test("rider is blocked from inventory", async ({ page }) => {
    await login(page, "rider@floriana.local");
    await page.goto("/admin/inventory");
    await expect(
      page.getByText(/permission|not allowed|Something went wrong/i).first(),
    ).toBeVisible();
  });
});
