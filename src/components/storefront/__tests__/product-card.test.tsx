import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProductCard } from "@/components/shared/product-card";
import type { ProductSummary } from "@/modules/catalog/types";

const base: ProductSummary = {
  id: "p1",
  slug: "blush-romance",
  name: "Blush Romance",
  shortDescription: null,
  collectionSlug: "premium-bouquets",
  collectionName: "Premium Bouquets",
  priceCentavos: 249_000,
  compareAtPriceCentavos: 279_000,
  minPriceCentavos: 249_000,
  maxPriceCentavos: 459_000,
  variantCount: 2,
  image: { src: "/images/placeholders/bouquet.jpg", alt: "Pink bouquet" },
  availability: "in_stock",
};

describe("ProductCard", () => {
  it("renders name, collection, price and link", () => {
    render(<ProductCard product={base} />);
    expect(screen.getByRole("article", { name: "Blush Romance" })).toBeInTheDocument();
    expect(screen.getByText("Premium Bouquets")).toBeInTheDocument();
    expect(screen.getByText("₱2,490.00")).toBeInTheDocument();
    expect(screen.getByText("₱2,790.00")).toHaveClass("line-through");
    expect(screen.getByRole("link", { name: "Blush Romance" })).toHaveAttribute(
      "href",
      "/shop/blush-romance",
    );
  });

  it("shows a 'From' price when variants differ in price", () => {
    render(
      <ProductCard
        product={{ ...base, priceCentavos: 459_000, minPriceCentavos: 249_000 }}
      />,
    );
    expect(screen.getByText("From")).toBeInTheDocument();
    expect(screen.getByText("₱2,490.00")).toBeInTheDocument();
  });

  it("flags availability and badges", () => {
    const { rerender } = render(
      <ProductCard
        product={{ ...base, availability: "out_of_stock", badge: "bestseller" }}
      />,
    );
    expect(screen.getByText("Sold out")).toBeInTheDocument();
    expect(screen.getByText("Bestseller")).toBeInTheDocument();
    rerender(
      <ProductCard product={{ ...base, availability: "low_stock", badge: "new" }} />,
    );
    expect(screen.getByText("Few left")).toBeInTheDocument();
    expect(screen.getByText("New")).toBeInTheDocument();
  });
});
