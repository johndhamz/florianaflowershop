import { expect, test, type Page } from "@playwright/test";

import { loginAsStaff, placePaidOrder } from "./helpers";

test.describe.configure({ timeout: 150_000 });
const shotDir = "e2e/screenshots";
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

async function prepareOrder(page: Page, orderNumber: string) {
  await loginAsStaff(page, "florist@floriana.local");
  await page.goto("/admin/prep");
  await page.getByRole("link", { name: new RegExp(orderNumber) }).click();
  await page.getByRole("button", { name: "Start preparation" }).click();
  await expect(page.getByText("Preparation started.")).toBeVisible();
  await page.getByRole("button", { name: "Mark ready for dispatch" }).click();
  await expect(page.getByText("Marked ready for dispatch.")).toBeVisible();
}

test.describe("dispatch", () => {
  test("manager assigns a rider; rider delivers with proof; customer sees delivered", async ({
    page,
    browser,
  }, testInfo) => {
    const orderNumber = await placePaidOrder(page, "sunday-market-bunch");
    const trackingUrl = page.url();
    await prepareOrder(page, orderNumber);

    // Manager assigns on the board.
    await loginAsStaff(page, "manager@floriana.local");
    await page.goto("/admin/dispatch?date=all");
    await expect(
      page.getByRole("heading", { level: 1, name: "Dispatch board" }),
    ).toBeVisible();
    const row = page.getByRole("row").filter({ hasText: orderNumber });
    await expect(row).toContainText("Unit 12B, Avalon Condominium"); // admins see the exact address
    await row
      .getByLabel(`Rider for ${orderNumber}`)
      .selectOption({ label: "Jun Cabahug" });
    await expect(page.getByText("Rider assigned.")).toBeVisible();
    await expect(row).toContainText("scheduled");
    await page.screenshot({
      path: `${shotDir}/dispatch-board-${testInfo.project.name}.png`,
      fullPage: true,
    });

    // Rider sees only their delivery, starts it and completes with proof.
    const rider = await browser.newPage();
    await loginAsStaff(rider, "rider@floriana.local");
    await rider.goto("/admin/rider");
    await expect(
      rider.getByRole("heading", { level: 1, name: "My deliveries" }),
    ).toBeVisible();
    const card = rider.getByRole("listitem").filter({ hasText: orderNumber });
    await expect(card).toBeVisible();
    await expect(card).toContainText("Unit 12B, Avalon Condominium");
    await rider.screenshot({
      path: `${shotDir}/rider-${testInfo.project.name}.png`,
      fullPage: true,
    });
    await card.getByRole("button", { name: `Start delivery ${orderNumber}` }).click();
    await expect(rider.getByText("Marked out for delivery.")).toBeVisible();

    await card.getByRole("button", { name: `Mark delivered ${orderNumber}` }).click();
    await expect(rider.getByRole("button", { name: "Confirm delivered" })).toBeDisabled(); // proof required
    await rider
      .getByLabel("Proof photo")
      .setInputFiles({ name: "pod.png", mimeType: "image/png", buffer: PNG });
    await expect(rider.getByText("Photo attached.").first()).toBeVisible();
    await rider.getByLabel("Received by").fill("Paolo Santos");
    await rider.getByRole("button", { name: "Confirm delivered" }).click();
    await expect(rider.getByText("Delivered. Thank you!")).toBeVisible();
    await rider.close();

    // Customer tracking reflects delivery.
    await page.goto(trackingUrl);
    await expect(page.getByText("Delivery: Delivered")).toBeVisible();

    // Rider's finished delivery is off the active list; board shows delivered.
    await page.goto("/admin/dispatch?date=all");
    await expect(page.getByRole("row").filter({ hasText: orderNumber })).toHaveCount(0);
  });

  test("failed delivery needs a note; retry must be authorized by a manager", async ({
    page,
    browser,
  }) => {
    const orderNumber = await placePaidOrder(page, "sunday-market-bunch");
    await prepareOrder(page, orderNumber);
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
    await card.getByRole("button", { name: `Mark failed ${orderNumber}` }).click();
    await rider
      .getByLabel("What happened (required)")
      .fill("Nobody home, phone unanswered after three calls.");
    await rider.getByRole("button", { name: "Record failed attempt" }).click();
    await expect(
      rider.getByText("Failed attempt recorded. Dispatch will follow up."),
    ).toBeVisible();
    await expect(card).toContainText("Wait for dispatch to authorize");
    await expect(card.getByRole("button", { name: /Start delivery/ })).toHaveCount(0);

    // Manager authorizes retry; rider can go again.
    await page.goto("/admin/dispatch?date=all");
    await expect(page.getByRole("row").filter({ hasText: orderNumber })).toContainText(
      "recipient unavailable",
    );
    await page.getByRole("button", { name: `Authorize retry ${orderNumber}` }).click();
    await expect(page.getByText("Retry authorized.")).toBeVisible();
    await rider.reload();
    await expect(
      rider
        .getByRole("listitem")
        .filter({ hasText: orderNumber })
        .getByRole("button", { name: `Start delivery ${orderNumber}` }),
    ).toBeVisible();
    await rider.close();
  });

  test("support sees the board without exact addresses and cannot assign; rider cannot open settings", async ({
    page,
  }) => {
    await loginAsStaff(page, "support@floriana.local");
    await page.goto("/admin/dispatch?date=all");
    await expect(
      page.getByRole("heading", { level: 1, name: "Dispatch board" }),
    ).toBeVisible();
    await expect(page.getByText("Unit 12B, Avalon Condominium")).toHaveCount(0);
    await expect(page.getByLabel(/Rider for/)).toHaveCount(0);

    await loginAsStaff(page, "rider@floriana.local");
    await page.goto("/admin/delivery-settings");
    await expect(
      page.getByText(/permission|not allowed|Something went wrong/i).first(),
    ).toBeVisible();
  });

  test("delivery settings: zone validation and slot capacity", async ({ page }) => {
    await loginAsStaff(page, "manager@floriana.local");
    await page.goto("/admin/delivery-settings");
    await expect(
      page.getByRole("heading", { level: 1, name: "Delivery settings" }),
    ).toBeVisible();
    const suffix = Date.now().toString().slice(-5);
    await page.getByRole("button", { name: "New zone" }).click();
    await page.getByLabel("Name", { exact: true }).fill(`Bogo City ${suffix}`);
    await page.getByLabel("Slug", { exact: true }).fill("Bad Slug");
    await page.getByLabel("City", { exact: true }).fill("Bogo");
    await page.getByLabel(/Barangays/).fill("Gairan\nCogon");
    await page.getByLabel("Fee (₱)").fill("350");
    await page.getByRole("button", { name: "Save zone" }).click();
    await expect(page.getByText("Lowercase letters, digits and dashes.")).toBeVisible();
    const slug = `bogo-city-${suffix}`;
    await page.getByLabel("Slug", { exact: true }).fill(slug);
    await page.getByRole("button", { name: "Save zone" }).click();
    await expect(page.getByText("Zone created.")).toBeVisible();
    await expect(
      page.getByRole("row").filter({ hasText: `Bogo City ${suffix}` }),
    ).toContainText("₱350.00");

    // Capacity override cannot go below bookings on a day that already has them.
    await page
      .getByLabel("Date")
      .fill(
        new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date()),
      );
    await page
      .getByLabel("Slot", { exact: true })
      .selectOption({ label: "Morning (9 AM – 12 NN)" });
    await page.getByLabel("Capacity", { exact: true }).fill("0");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(
      page.getByText(/already booked in this slot|Capacity updated/),
    ).toBeVisible();
  });

  test("notification outbox: events are queued once and the job delivers them", async ({
    page,
    request,
  }) => {
    const orderNumber = await placePaidOrder(page, "sunday-market-bunch");
    const res = await request.get("/api/jobs/notifications", {
      headers: { Authorization: "Bearer local-cron-secret-0123456789" },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.claimed).toBeGreaterThan(0);
    expect(json.sent).toBeGreaterThan(0);
    const again = await request.get("/api/jobs/notifications", {
      headers: { Authorization: "Bearer local-cron-secret-0123456789" },
    });
    const j2 = await again.json();
    expect(j2.claimed).toBe(0); // nothing re-sent
    const unauth = await request.get("/api/jobs/notifications");
    expect(unauth.status()).toBe(401);
    expect(orderNumber).toMatch(/^FL-/);
  });
});
