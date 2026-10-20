import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AdminDashboardPage from "@/app/admin/page";

describe("AdminDashboardPage", () => {
  it("renders metrics, the recent orders table and the empty deliveries state", () => {
    render(<AdminDashboardPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Dashboard" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Key metrics" })).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Recent orders" });
    expect(within(table).getAllByRole("row").length).toBeGreaterThan(1);
    expect(within(table).getByText("Out for delivery")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("No deliveries scheduled");
  });
});
