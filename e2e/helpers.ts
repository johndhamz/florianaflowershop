import { expect, type Page } from "@playwright/test";

export async function loginAsStaff(page: Page, email: string) {
  // Drop any existing session (customer cart or another staff member) first.
  await page.context().clearCookies();
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("Floriana!2026");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

export function futureWeekday(daysAhead: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAhead);
  while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export async function addToCart(page: Page, slug = "sunday-market-bunch") {
  await page.goto(`/shop/${slug}`);
  await page.getByRole("button", { name: /Add to cart/ }).click();
  await expect(page.getByText("Added to your cart.")).toBeVisible();
}

export async function fillCheckout(
  page: Page,
  opts: {
    method: "paymongo" | "bank_transfer";
    promo?: string;
    barangay?: string;
    daysAhead?: number;
  },
) {
  await page.goto("/checkout");
  await page.getByLabel("Your name").fill("Maria Santos");
  await page.getByLabel("Email", { exact: true }).fill(`maria+${Date.now()}@example.com`);
  await page.getByLabel("Mobile number").fill("0917 123 4567");
  await page.getByLabel("Recipient's name").fill("Paolo Santos");
  await page.getByLabel("Recipient's mobile").fill("0918 123 4567");
  await page.getByLabel("Street address").fill("Unit 12B, Avalon Condominium");
  await page.getByLabel("Barangay").fill(opts.barangay ?? "Lahug");
  await page.getByLabel("Delivery date").fill(futureWeekday(opts.daysAhead ?? 5));
  await expect(page.getByLabel("Time slot")).toBeEnabled();
  await expect(page.getByLabel("Time slot")).not.toHaveValue("");
  await page.getByLabel("Gift message (optional)").fill("Happy anniversary!");
  if (opts.promo) {
    await page.getByLabel("Promo code").fill(opts.promo);
    await page.getByRole("button", { name: "Apply" }).click();
  }
  await page
    .getByText(
      opts.method === "paymongo" ? "Pay online" : "Bank transfer / GCash transfer",
    )
    .click();
  await page.getByLabel(/I agree to the/).check();
}

/** Places and pays (mock gateway) an order; returns its order number. */
export async function placePaidOrder(
  page: Page,
  slug = "sunday-market-bunch",
): Promise<string> {
  await addToCart(page, slug);
  await fillCheckout(page, { method: "paymongo" });
  await page.getByRole("button", { name: /^Pay/ }).click();
  await expect(page).toHaveURL(/\/mock-pay\//);
  await page.getByRole("button", { name: "Authorize", exact: true }).click();
  await expect(page).toHaveURL(/\/orders\/FL-\d+\?t=/);
  await expect(page.getByText("Payment: Paid")).toBeVisible();
  return page.url().match(/orders\/(FL-\d+)/)![1]!;
}
