import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AdminNav } from "@/components/layout/admin-nav";
import { adminNav } from "@/config/admin-nav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/orders/123",
}));

describe("AdminNav", () => {
  it("renders every admin destination and highlights nested active routes", () => {
    render(<AdminNav role="owner" />);
    const nav = screen.getByRole("navigation", { name: "Admin" });
    expect(within(nav).getAllByRole("link")).toHaveLength(adminNav.length);
    expect(within(nav).getByRole("link", { name: "Orders" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    // "Dashboard" (/admin) must not match /admin/orders as a prefix.
    expect(within(nav).getByRole("link", { name: "Dashboard" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("hides permission-gated destinations from roles without them", () => {
    render(<AdminNav role="support" />);
    const nav = screen.getByRole("navigation", { name: "Admin" });
    expect(within(nav).queryByRole("link", { name: "Reports" })).toBeNull();
    expect(within(nav).queryByRole("link", { name: "Promotions" })).toBeNull();
    expect(within(nav).getByRole("link", { name: "Payments" })).toBeInTheDocument();
  });

  it("hides gated destinations while the role is unknown", () => {
    render(<AdminNav />);
    const nav = screen.getByRole("navigation", { name: "Admin" });
    expect(within(nav).queryByRole("link", { name: "Content" })).toBeNull();
  });
});
