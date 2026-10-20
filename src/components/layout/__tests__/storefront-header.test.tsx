import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { StorefrontHeader } from "@/components/layout/storefront-header";
import { storefrontNav } from "@/config/site";

vi.mock("next/navigation", () => ({
  usePathname: () => "/collections/lolas-orchid-collection",
}));

describe("StorefrontHeader", () => {
  it("renders a labelled main navigation with every storefront link", () => {
    render(<StorefrontHeader />);
    const nav = screen.getAllByRole("navigation", { name: "Main" })[0]!;
    for (const item of storefrontNav) {
      expect(within(nav).getByRole("link", { name: item.label })).toHaveAttribute(
        "href",
        item.href,
      );
    }
  });

  it("marks the current page with aria-current", () => {
    render(<StorefrontHeader />);
    const nav = screen.getAllByRole("navigation", { name: "Main" })[0]!;
    expect(within(nav).getByRole("link", { name: "Orchids" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(nav).getByRole("link", { name: "Bouquets" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("has labelled icon-only controls", () => {
    render(<StorefrontHeader />);
    expect(screen.getByRole("link", { name: "Search flowers" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Cart/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open menu" })).toBeInTheDocument();
  });

  it("opens the mobile menu as a dialog containing the navigation", async () => {
    render(<StorefrontHeader />);
    await userEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const dialog = await screen.findByRole("dialog");
    const nav = within(dialog).getByRole("navigation", { name: "Main" });
    expect(within(nav).getAllByRole("link")).toHaveLength(storefrontNav.length);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
