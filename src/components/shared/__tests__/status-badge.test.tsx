import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusBadge } from "@/components/shared/status-badge";
import { ORDER_STATUS_META, ORDER_STATUSES } from "@/modules/orders";

describe("StatusBadge", () => {
  it("exposes its tone as a data attribute", () => {
    render(<StatusBadge tone="success">Delivered</StatusBadge>);
    const badge = screen.getByText("Delivered");
    expect(badge).toHaveAttribute("data-tone", "success");
  });

  it("defaults to the neutral tone", () => {
    render(<StatusBadge>Pending</StatusBadge>);
    expect(screen.getByText("Pending")).toHaveAttribute("data-tone", "neutral");
  });

  it("has a label and tone for every order status", () => {
    for (const status of ORDER_STATUSES) {
      const meta = ORDER_STATUS_META[status];
      expect(meta.label.length).toBeGreaterThan(0);
      render(<StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>);
      expect(screen.getByText(meta.label)).toBeInTheDocument();
    }
  });
});
