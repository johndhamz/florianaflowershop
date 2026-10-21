import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Dashboard } from "@/app/admin/page";

vi.mock("@/modules/auth/dal", () => ({
  requireStaff: vi.fn(async () => ({
    id: "u1",
    role: "manager",
    email: "m@x",
    fullName: "M",
  })),
}));
vi.mock("@/modules/reports/queries", () => ({
  getDashboardSummary: vi.fn(async () => ({
    today: "2026-10-21",
    orders_today: 3,
    sales_today_centavos: 123450,
    pending_payments: 1,
    pending_payment_proofs: 1,
    to_prepare: 2,
    to_prepare_today: 1,
    scheduled_deliveries_today: 4,
    unassigned_today: 2,
    failed_deliveries: 1,
    low_stock: 2,
    recent_activity: [
      { kind: "order", ref: "FL-10001", action: "placed", at: "2026-10-21T01:00:00Z" },
    ],
    failed_list: [
      { order_id: "o1", order_number: "FL-10004", exception: "recipient_unavailable" },
    ],
  })),
}));

describe("AdminDashboardPage", () => {
  it("renders live tiles, activity and failed deliveries from the summary", async () => {
    render(await Dashboard());
    expect(screen.getByTestId("tile-orders-today")).toHaveTextContent("3");
    expect(screen.getByTestId("tile-sales-today")).toHaveTextContent("₱1,234.50");
    expect(screen.getByTestId("tile-failed-deliveries")).toHaveTextContent("1");
    expect(screen.getByText("FL-10001")).toBeInTheDocument();
    expect(screen.getByText("FL-10004")).toBeInTheDocument();
    expect(screen.getByText("recipient unavailable")).toBeInTheDocument();
  });
});
