import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EmptyState } from "@/components/shared/empty-state";
import { ProductGridSkeleton, TableSkeleton } from "@/components/shared/skeletons";
import { Button } from "@/components/ui/button";

describe("EmptyState", () => {
  it("renders title, description and action", () => {
    render(
      <EmptyState
        title="No deliveries"
        description="Nothing scheduled."
        action={<Button>Open board</Button>}
      />,
    );
    const region = screen.getByRole("status");
    expect(region).toHaveTextContent("No deliveries");
    expect(region).toHaveTextContent("Nothing scheduled.");
    expect(screen.getByRole("button", { name: "Open board" })).toBeInTheDocument();
  });
});

describe("Skeletons", () => {
  it("announce busy state to assistive tech", () => {
    render(<ProductGridSkeleton count={4} />);
    const grid = screen.getByRole("status", { name: "Loading products" });
    expect(grid).toHaveAttribute("aria-busy", "true");
    expect(grid.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(12);
  });

  it("renders the requested table shape", () => {
    render(<TableSkeleton rows={2} columns={3} />);
    const table = screen.getByRole("status", { name: "Loading table" });
    expect(table.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(3 + 2 * 3);
  });
});
