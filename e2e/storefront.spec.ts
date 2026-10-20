import { expect, test, type Page } from "@playwright/test";

const shotDir = "e2e/screenshots";

async function openFilters(page: Page) {
  // The catalog streams in behind a skeleton; wait for the filter form first.
  await page.getByRole("button", { name: "Apply" }).waitFor();
  const toggle = page.getByRole("button", { name: "Filters" });
  const field = page.getByLabel("Max price (₱)");
  if (!(await toggle.isVisible()) || (await field.isVisible())) return;
  // React replays clicks made before hydration, so a naive click-and-retry can
  // toggle the panel closed again. Click only when closed, then let it settle.
  await expect(async () => {
    if (!(await field.isVisible())) await toggle.click();
    await page.waitForTimeout(400);
    await expect(field).toBeVisible({ timeout: 500 });
  }).toPass({ timeout: 15_000 });
}

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
}

test.describe("catalog", () => {
  test("shop lists products, filters by collection and price, sorts, and paginates URL-first", async ({
    page,
  }, testInfo) => {
    await page.goto("/shop");
    await expect(
      page.getByRole("heading", { level: 1, name: "All flowers" }),
    ).toBeVisible();
    const grid = page.getByRole("list", { name: "Products" });
    await expect(grid.getByRole("article")).toHaveCount(12);
    await expect(page.getByRole("status")).toContainText("12 flowers");

    // Collection filter writes to the URL and narrows results.
    await openFilters(page);
    await page.getByLabel("Collection").selectOption("lolas-orchid-collection");
    await expect(page).toHaveURL(/collection=lolas-orchid-collection/);
    await expect(grid.getByRole("article")).toHaveCount(3);
    await expect(grid.getByRole("link", { name: "Lola's Phalaenopsis" })).toBeVisible();

    // Price filter + search via the form.
    await page.goto("/shop");
    await openFilters(page);
    await page.getByLabel("Max price (₱)").fill("700");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page).toHaveURL(/max=700/);
    const names = await grid.getByRole("heading", { level: 3 }).allTextContents();
    expect(names).toContain("Sunday Market Bunch");
    expect(names).not.toContain("Blush Romance");

    // Sorting.
    await page.goto("/shop?sort=price-desc");
    const first = await grid.getByRole("heading", { level: 3 }).first().textContent();
    expect(first).toBe("Ivory Urn");

    // Search.
    await page.goto("/shop?q=orchid");
    await expect(page.getByRole("status")).toContainText("for “orchid”");
    await expect(grid.getByRole("article")).toHaveCount(3);

    // Garbage params do not break the page.
    await page.goto("/shop?sort=evil&page=-1&min=abc");
    await expect(grid.getByRole("article")).toHaveCount(12);

    await noHorizontalOverflow(page);
    await page.goto("/shop");
    await page.screenshot({
      path: `${shotDir}/shop-${testInfo.project.name}.png`,
      fullPage: true,
    });
  });

  test("collection and occasion pages scope the catalog and 404 for unknown slugs", async ({
    page,
  }, testInfo) => {
    await page.goto("/collections/premium-bouquets");
    await expect(
      page.getByRole("heading", { level: 1, name: "Premium Bouquets" }),
    ).toBeVisible();
    await expect(page.getByLabel("Collection")).toHaveCount(0); // locked
    await expect(
      page.getByRole("list", { name: "Products" }).getByRole("article"),
    ).toHaveCount(3);

    await page.goto("/occasions/sympathy");
    await expect(
      page.getByRole("heading", { level: 1, name: "Sympathy flowers" }),
    ).toBeVisible();
    await expect(
      page.getByRole("list", { name: "Products" }).getByRole("article"),
    ).toHaveCount(2);
    await page.screenshot({
      path: `${shotDir}/occasion-${testInfo.project.name}.png`,
      fullPage: true,
    });

    // Unknown slugs render the branded not-found UI. Streamed routes answer 200
    // with a noindex tag (documented Next.js behaviour), so we assert on that.
    for (const path of [
      "/collections/does-not-exist",
      "/occasions/nope",
      "/shop/not-a-real-product",
    ]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toContainText("wandered off");
      expect(
        await page.locator('meta[name="robots"][content*="noindex"]').count(),
      ).toBeGreaterThan(0);
    }

    // Draft products are not reachable.
    await page.goto("/shop/valentines-preview");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("wandered off");
  });

  test("product page shows gallery, variants, add-ons, care and structured data", async ({
    page,
  }, testInfo) => {
    await page.goto("/shop/blush-romance");
    await expect(
      page.getByRole("heading", { level: 1, name: "Blush Romance" }),
    ).toBeVisible();
    await expect(page.getByRole("radio", { name: /A dozen/ })).toBeChecked();
    await expect(
      page.getByRole("button", { name: /Add to cart · ₱2,490.00/ }),
    ).toBeVisible();

    await page.getByText("Two dozen", { exact: true }).click();
    await expect(
      page.getByRole("button", { name: /Add to cart · ₱4,590.00/ }),
    ).toBeVisible();

    await page.getByLabel("Glass vase").check();
    await expect(
      page.getByRole("button", { name: /Add to cart · ₱4,940.00/ }),
    ).toBeVisible();

    await expect(page.getByRole("heading", { name: "Care instructions" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Show photo 2 of 2" })).toBeVisible();

    const ld = await page
      .locator('script[type="application/ld+json"]')
      .first()
      .textContent();
    expect(JSON.parse(ld ?? "{}")).toMatchObject({
      "@type": "Product",
      name: "Blush Romance",
    });
    await expect(page).toHaveTitle(/Blush Romance/);

    await noHorizontalOverflow(page);
    await page.screenshot({
      path: `${shotDir}/product-${testInfo.project.name}.png`,
      fullPage: true,
    });
  });
});

test.describe("cart", () => {
  test("adds, persists across reload, updates, and removes", async ({
    page,
  }, testInfo) => {
    await page.goto("/shop/lolas-phalaenopsis");
    await page.getByLabel("Handwritten card").check();
    await page.getByRole("button", { name: /Add to cart/ }).click();
    await expect(page.getByText("Added to your cart.")).toBeVisible();
    await expect(page.getByTestId("cart-count")).toHaveText("1");

    // Persistent anonymous cart: a fresh load still has it.
    await page.goto("/cart");
    await expect(
      page.getByRole("heading", { name: "Lola's Phalaenopsis" }),
    ).toBeVisible();
    await expect(page.getByText(/Handwritten card/)).toBeVisible();
    await expect(page.getByTestId("cart-total")).toHaveText("₱1,940.00");

    await page.reload();
    await expect(page.getByTestId("cart-total")).toHaveText("₱1,940.00");

    // Quantity up → server recomputes total.
    await page
      .getByRole("group", { name: "Lola's Phalaenopsis quantity" })
      .getByRole("button", { name: "Increase quantity" })
      .click();
    await expect(page.getByTestId("cart-total")).toHaveText("₱3,830.00");
    await expect(page.getByTestId("cart-count")).toHaveText("2");

    await page.screenshot({
      path: `${shotDir}/cart-${testInfo.project.name}.png`,
      fullPage: true,
    });

    // Remove → empty state.
    await page.getByRole("button", { name: "Remove Lola's Phalaenopsis" }).click();
    await expect(page.getByRole("status")).toContainText("Your cart is empty");
    await expect(page.getByTestId("cart-count")).toHaveCount(0);
  });

  test("respects stock limits", async ({ page }) => {
    // Triple-spike phalaenopsis has 2 available.
    await page.goto("/shop/lolas-phalaenopsis");
    await page.getByText("Triple spike, ivory pot", { exact: true }).click();
    await expect(page.getByText("Only 2 left")).toBeVisible();
    const increase = page.getByRole("button", { name: "Increase quantity" });
    await increase.click();
    await expect(increase).toBeDisabled();
    await page.getByRole("button", { name: /Add to cart/ }).click();
    await expect(page.getByText("Added to your cart.")).toBeVisible();

    // Trying to add one more is refused by the server.
    await page.getByRole("button", { name: /Add to cart/ }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: /Only \d+ left in stock/ }),
    ).toBeVisible();
  });
});

test.describe("content pages", () => {
  test("homepage sections, coverage checker and content pages render", async ({
    page,
  }, testInfo) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Love, in every bloom.",
    );
    await expect(page.getByRole("link", { name: "Shop flowers" }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Best sellers" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Named after Lola Floriana, 86/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Living gifts that keep blooming" }),
    ).toBeVisible();
    await expect(page.getByText("No reviews yet")).toBeVisible();

    await page.getByLabel("Barangay or city").fill("Talamban");
    await page.getByRole("button", { name: "Check coverage" }).click();
    await expect(page.getByText(/Yes, we deliver to Talamban, Cebu City/)).toBeVisible();
    await page.getByLabel("Barangay or city").fill("Bogo");
    await page.getByRole("button", { name: "Check coverage" }).click();
    await expect(page.getByText(/don't deliver to “Bogo” yet/)).toBeVisible();

    await noHorizontalOverflow(page);
    await page.screenshot({
      path: `${shotDir}/home-${testInfo.project.name}.png`,
      fullPage: true,
    });

    for (const [path, heading] of [
      ["/our-story", "Our story"],
      ["/delivery", "Delivery information"],
      ["/faqs", "Frequently asked questions"],
      ["/contact", "Talk to us"],
      ["/occasions", "Say it with the right flowers"],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await noHorizontalOverflow(page);
    }
    await page.goto("/delivery");
    await expect(page.getByRole("cell", { name: /Lapu-Lapu City/ })).toBeVisible();
    await page.screenshot({
      path: `${shotDir}/delivery-${testInfo.project.name}.png`,
      fullPage: true,
    });

    const sitemap = await page.request.get("/sitemap.xml");
    expect(sitemap.status()).toBe(200);
    expect(await sitemap.text()).toContain("/shop/blush-romance");
  });
});
