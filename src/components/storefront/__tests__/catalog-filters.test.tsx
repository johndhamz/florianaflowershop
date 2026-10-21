import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CatalogFilters } from "@/components/storefront/catalog-filters";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const collections = [
  {
    id: "c1",
    slug: "premium-bouquets",
    name: "Premium Bouquets",
    tagline: null,
    description: null,
    seoTitle: null,
    seoDescription: null,
    image: "/x.jpg",
    productCount: 3,
  },
];
const occasions = [{ id: "o1", slug: "birthday", name: "Birthday", description: null }];

describe("CatalogFilters", () => {
  beforeEach(() => push.mockReset());

  it("navigates with URL params when a filter changes", async () => {
    render(
      <CatalogFilters
        params={{ sort: "featured", page: 1 }}
        collections={collections}
        occasions={occasions}
        resultCount={12}
      />,
    );
    await userEvent.selectOptions(
      screen.getByLabelText("Collection"),
      "premium-bouquets",
    );
    expect(push).toHaveBeenCalledWith("/shop?collection=premium-bouquets");
    await userEvent.selectOptions(screen.getByLabelText("Sort by"), "price-desc");
    expect(push).toHaveBeenLastCalledWith("/shop?sort=price-desc");
  });

  it("submits search and price range together and resets to page 1", async () => {
    render(
      <CatalogFilters
        params={{ sort: "newest", page: 3 }}
        collections={collections}
        occasions={occasions}
        resultCount={0}
      />,
    );
    await userEvent.type(screen.getByLabelText("Search flowers"), "orchid");
    await userEvent.type(screen.getByLabelText("Min price (₱)"), "500");
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(push).toHaveBeenCalledWith("/shop?q=orchid&min=500&sort=newest");
  });

  it("locks the collection on collection pages and offers a clear link", () => {
    render(
      <CatalogFilters
        params={{ sort: "featured", page: 1, collection: "premium-bouquets", q: "rose" }}
        collections={collections}
        occasions={occasions}
        basePath="/collections/premium-bouquets"
        lock="collection"
        resultCount={1}
      />,
    );
    expect(screen.queryByLabelText("Collection")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("1 flower for “rose”");
    expect(screen.getByRole("link", { name: /Clear filters/ })).toHaveAttribute(
      "href",
      "/collections/premium-bouquets",
    );
  });
});
