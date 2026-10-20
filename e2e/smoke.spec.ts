import { expect, test } from "@playwright/test";

const shotDir = "e2e/screenshots";

test.describe("storefront", () => {
  test("homepage renders with accessible navigation", async ({ page }, testInfo) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Floriana Flowers/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Love, in every");

    // Skip link is the first focusable element.
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();

    const isMobile = testInfo.project.name.includes("mobile");
    if (isMobile) {
      await page.getByRole("button", { name: "Open menu" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("navigation", { name: "Main" })).toBeVisible();
      await expect(dialog.getByRole("link", { name: "Orchids" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
    } else {
      const nav = page.getByRole("navigation", { name: "Main" });
      await expect(nav.getByRole("link", { name: "Bouquets" })).toBeVisible();
    }

    // No horizontal overflow on any viewport.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);

    await page.screenshot({
      path: `${shotDir}/home-${testInfo.project.name}.png`,
      fullPage: true,
    });
  });

  test("unknown routes show the branded 404", async ({ page }, testInfo) => {
    const response = await page.goto("/this-does-not-exist");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("wandered off");
    await expect(page.getByRole("link", { name: "Back to home" })).toHaveAttribute(
      "href",
      "/",
    );
    await page.screenshot({ path: `${shotDir}/404-${testInfo.project.name}.png` });
  });
});

test.describe("admin", () => {
  test("dashboard shell renders with sidebar or drawer navigation", async ({
    page,
  }, testInfo) => {
    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { level: 1, name: "Dashboard" }),
    ).toBeVisible();
    await expect(page.getByRole("table", { name: "Recent orders" })).toBeVisible();

    const isMobile = testInfo.project.name.includes("mobile");
    if (isMobile) {
      await page.getByRole("button", { name: "Open admin menu" }).click();
      await expect(
        page.getByRole("dialog").getByRole("navigation", { name: "Admin" }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
    } else {
      const nav = page.getByRole("navigation", { name: "Admin" });
      await expect(nav.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
        "aria-current",
        "page",
      );
    }

    await page.getByRole("button", { name: "Account menu" }).click();
    await expect(page.getByRole("menuitem", { name: "Settings" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menuitem", { name: "Settings" })).toBeHidden();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);

    await page.screenshot({
      path: `${shotDir}/admin-${testInfo.project.name}.png`,
      fullPage: true,
    });
  });
});
