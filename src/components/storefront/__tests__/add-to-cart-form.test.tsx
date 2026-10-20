import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AddToCartForm } from "@/components/storefront/add-to-cart-form";
import type { ProductDetail } from "@/modules/catalog/types";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));

const addToCart = vi.fn();
vi.mock("@/modules/cart/actions", () => ({
  addToCart: (...args: unknown[]) => addToCart(...args),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const product: ProductDetail = {
  id: "p1",
  slug: "blush-romance",
  name: "Blush Romance",
  shortDescription: null,
  description: null,
  careInstructions: null,
  collection: { slug: "premium-bouquets", name: "Premium Bouquets" },
  occasions: [],
  tags: [],
  images: [
    {
      src: "/images/placeholders/bouquet.jpg",
      alt: "Bouquet",
      width: null,
      height: null,
    },
  ],
  variants: [
    {
      id: "v12",
      sku: "PB-BLUSH-12",
      name: "A dozen",
      priceCentavos: 249_000,
      compareAtPriceCentavos: null,
      isDefault: true,
      availability: "in_stock",
      availableQuantity: 10,
    },
    {
      id: "v24",
      sku: "PB-BLUSH-24",
      name: "Two dozen",
      priceCentavos: 459_000,
      compareAtPriceCentavos: null,
      isDefault: false,
      availability: "low_stock",
      availableQuantity: 2,
    },
    {
      id: "v99",
      sku: "PB-BLUSH-99",
      name: "Sold out size",
      priceCentavos: 999_000,
      compareAtPriceCentavos: null,
      isDefault: false,
      availability: "out_of_stock",
      availableQuantity: 0,
    },
  ],
  addOns: [
    {
      id: "a1",
      sku: "ADD-CARD",
      name: "Handwritten card",
      description: null,
      priceCentavos: 5000,
      maxQuantity: 1,
      image: null,
    },
    {
      id: "a2",
      sku: "ADD-BALLOON",
      name: "Mini balloon",
      description: null,
      priceCentavos: 12_000,
      maxQuantity: 3,
      image: null,
    },
  ],
  isBestSeller: true,
  isFeatured: true,
  seoTitle: null,
  seoDescription: null,
  publishedAt: null,
};

describe("AddToCartForm", () => {
  beforeEach(() => {
    addToCart.mockReset();
    refresh.mockReset();
  });

  it("selects variants, caps quantity at available stock and totals add-ons", async () => {
    render(<AddToCartForm product={product} />);
    expect(screen.getByRole("button", { name: /Add to cart · ₱2,490.00/ })).toBeEnabled();

    await userEvent.click(screen.getByRole("radio", { name: /Two dozen/ }));
    expect(
      screen.getByRole("button", { name: /Add to cart · ₱4,590.00/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Only 2 left")).toBeInTheDocument();

    const increase = screen.getByRole("button", { name: "Increase quantity" });
    await userEvent.click(increase);
    expect(increase).toBeDisabled(); // quantity 2 == available 2
    expect(
      screen.getByRole("button", { name: /Add to cart · ₱9,180.00/ }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("Handwritten card"));
    await userEvent.click(screen.getByLabelText("Mini balloon"));
    await userEvent.selectOptions(screen.getByLabelText("Mini balloon quantity"), "3");
    expect(
      screen.getByRole("button", { name: /Add to cart · ₱9,590.00/ }),
    ).toBeInTheDocument();
  });

  it("disables the button for sold-out variants", async () => {
    render(<AddToCartForm product={product} />);
    await userEvent.click(screen.getByRole("radio", { name: /Sold out size/ }));
    expect(screen.getByRole("button", { name: "Sold out" })).toBeDisabled();
  });

  it("submits the selection to the server action and refreshes on success", async () => {
    addToCart.mockResolvedValue({
      ok: true,
      cart: { items: [] },
      message: "Added to your cart.",
    });
    render(<AddToCartForm product={product} />);
    await userEvent.click(screen.getByLabelText("Handwritten card"));
    await userEvent.click(screen.getByRole("button", { name: /Add to cart/ }));
    expect(addToCart).toHaveBeenCalledWith({
      variantId: "v12",
      quantity: 1,
      addOns: [{ add_on_id: "a1", quantity: 1 }],
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("shows server errors inline", async () => {
    addToCart.mockResolvedValue({ ok: false, error: "Only 1 left in stock." });
    render(<AddToCartForm product={product} />);
    await userEvent.click(screen.getByRole("button", { name: /Add to cart/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Only 1 left in stock.");
  });
});
