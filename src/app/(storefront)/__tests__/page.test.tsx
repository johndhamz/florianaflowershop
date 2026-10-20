import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "@/app/(storefront)/page";
import { sampleProducts } from "@/modules/catalog";

describe("HomePage", () => {
  it("renders the hero, collections, featured products and CTAs", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Love, in every bloom.",
    );
    expect(screen.getAllByRole("link", { name: /Shop bouquets/ })[0]).toHaveAttribute(
      "href",
      "/shop",
    );
    expect(
      screen.getByRole("heading", { name: "Shop by collection" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(sampleProducts.length);
    expect(screen.getByRole("link", { name: /See delivery zones/ })).toHaveAttribute(
      "href",
      "/delivery",
    );
  });
});
