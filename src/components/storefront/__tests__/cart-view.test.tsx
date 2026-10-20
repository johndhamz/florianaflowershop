import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CartView } from "@/components/storefront/cart-view";
import type { Cart } from "@/modules/cart/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const updateCartItem = vi.fn();
const removeCartItem = vi.fn();
const removeUnavailableItems = vi.fn();
vi.mock("@/modules/cart/actions", () => ({
  updateCartItem: (...a: unknown[]) => updateCartItem(...a),
  removeCartItem: (...a: unknown[]) => removeCartItem(...a),
  removeUnavailableItems: (...a: unknown[]) => removeUnavailableItems(...a),
}));

const cart: Cart = {
  id: "c1",
  item_count: 3,
  subtotal_centavos: 249_000 * 2 + 65_000,
  add_ons_centavos: 5000,
  total_centavos: 249_000 * 2 + 65_000 + 5000,
  has_issues: false,
  items: [
    {
      id: "i1",
      variant_id: "v1",
      product_id: "p1",
      product_slug: "blush-romance",
      product_name: "Blush Romance",
      variant_name: "A dozen",
      sku: "PB-BLUSH-12",
      image_path: null,
      image_alt: null,
      quantity: 2,
      unit_price_centavos: 249_000,
      unit_price_at_add_centavos: 249_000,
      price_changed: false,
      line_total_centavos: 498_000,
      availability: "in_stock",
      available_quantity: 10,
      is_available: true,
      add_ons: [
        {
          add_on_id: "a1",
          name: "Handwritten card",
          sku: "ADD-CARD",
          quantity: 1,
          unit_price_centavos: 5000,
          line_total_centavos: 5000,
          is_available: true,
        },
      ],
      add_ons_total_centavos: 5000,
      created_at: "2026-10-20T00:00:00Z",
    },
    {
      id: "i2",
      variant_id: "v2",
      product_id: "p2",
      product_slug: "cebu-morning",
      product_name: "Cebu Morning",
      variant_name: "Three sunflowers",
      sku: "EV-CEBU-STD",
      image_path: null,
      image_alt: null,
      quantity: 1,
      unit_price_centavos: 65_000,
      unit_price_at_add_centavos: 65_000,
      price_changed: false,
      line_total_centavos: 65_000,
      availability: "low_stock",
      available_quantity: 1,
      is_available: true,
      add_ons: [],
      add_ons_total_centavos: 0,
      created_at: "2026-10-20T00:00:01Z",
    },
  ],
};

describe("CartView", () => {
  beforeEach(() => {
    updateCartItem.mockReset().mockResolvedValue({ ok: true, cart });
    removeCartItem
      .mockReset()
      .mockResolvedValue({ ok: true, cart, message: "Removed from your cart." });
  });

  it("renders lines, add-ons and server totals", () => {
    render(<CartView cart={cart} />);
    expect(screen.getByRole("heading", { name: "Blush Romance" })).toBeInTheDocument();
    expect(screen.getByText(/Handwritten card/)).toBeInTheDocument();
    expect(screen.getByTestId("cart-total")).toHaveTextContent("₱5,680.00");
    expect(screen.getByRole("link", { name: "Proceed to checkout" })).toHaveAttribute(
      "href",
      "/checkout",
    );
  });

  it("updates quantity through the server action", async () => {
    render(<CartView cart={cart} />);
    const group = screen.getByRole("group", { name: "Blush Romance quantity" });
    await userEvent.click(
      within(group).getByRole("button", { name: "Increase quantity" }),
    );
    expect(updateCartItem).toHaveBeenCalledWith({ itemId: "i1", quantity: 3 });
  });

  it("prevents exceeding available stock", () => {
    render(<CartView cart={cart} />);
    const group = screen.getByRole("group", { name: "Cebu Morning quantity" });
    expect(
      within(group).getByRole("button", { name: "Increase quantity" }),
    ).toBeDisabled();
  });

  it("removes a line", async () => {
    render(<CartView cart={cart} />);
    await userEvent.click(screen.getByRole("button", { name: "Remove Cebu Morning" }));
    expect(removeCartItem).toHaveBeenCalledWith("i2");
  });

  it("blocks checkout and offers a fix when the cart has issues", () => {
    const broken: Cart = {
      ...cart,
      has_issues: true,
      items: [
        {
          ...cart.items[0]!,
          is_available: false,
          availability: "out_of_stock",
          available_quantity: 0,
        },
      ],
    };
    render(<CartView cart={broken} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Some items changed");
    expect(screen.getByText("Sold out")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Proceed to checkout" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update cart" })).toBeEnabled();
  });

  it("shows an empty state", () => {
    render(<CartView cart={{ ...cart, items: [], item_count: 0, total_centavos: 0 }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Your cart is empty");
    expect(screen.getByRole("link", { name: "Shop flowers" })).toHaveAttribute(
      "href",
      "/shop",
    );
  });
});
