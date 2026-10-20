import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProductCard } from "@/components/shared/product-card";
import type { ProductSummary } from "@/modules/catalog";

const base: ProductSummary = {
  id: "p1",
  slug: "blush-romance",
  name: "Blush Romance",
  category: "bouquets",
  priceCentavos: 249_000,
  image: { src: "/images/placeholders/bouquet.svg", alt: "Pink bouquet" },
  availability: "in_stock",
};

describe("ProductCard", () => {
  it("renders name, category, price and a link to the product", () => {
    render(<ProductCard product={base} />);
    expect(screen.getByRole("article", { name: "Blush Romance" })).toBeInTheDocument();
    expect(screen.getByText("Premium Bouquets")).toBeInTheDocument();
    expect(screen.getByText("₱2,490.00")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Blush Romance" })).toHaveAttribute(
      "href",
      "/shop/blush-romance",
    );
    expect(screen.getByRole("img", { name: "Pink bouquet" })).toBeInTheDocument();
  });

  it("shows compare-at pricing with an accessible label", () => {
    render(<ProductCard product={{ ...base, compareAtPriceCentavos: 279_000 }} />);
    expect(screen.getByText("Original price")).toBeInTheDocument();
    expect(screen.getByText("₱2,790.00")).toHaveClass("line-through");
  });

  it("flags sold-out and low-stock availability", () => {
    const { rerender } = render(
      <ProductCard product={{ ...base, availability: "out_of_stock" }} />,
    );
    expect(screen.getByText("Sold out")).toBeInTheDocument();
    rerender(<ProductCard product={{ ...base, availability: "low_stock" }} />);
    expect(screen.getByText("Few left")).toBeInTheDocument();
  });

  it("renders a merchandising badge", () => {
    render(<ProductCard product={{ ...base, badge: "bestseller" }} />);
    expect(screen.getByText("Bestseller")).toBeInTheDocument();
  });
});
