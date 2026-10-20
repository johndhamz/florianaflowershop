import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CoverageChecker } from "@/components/storefront/coverage-checker";

const checkCoverage = vi.fn();
vi.mock("@/modules/delivery/actions", () => ({
  checkCoverage: (...a: unknown[]) => checkCoverage(...a),
}));

describe("CoverageChecker", () => {
  it("shows matching zones with fee and cutoff", async () => {
    checkCoverage.mockResolvedValue({
      ok: true,
      query: "lahug",
      matches: [
        {
          zoneId: "z1",
          zoneName: "Cebu City · Central",
          city: "Cebu City",
          matchedBarangay: "Lahug",
          feeCentavos: 9900,
          freeDeliveryThresholdCentavos: 300_000,
          sameDayCutoff: "14:00:00",
          leadTimeHours: 3,
        },
      ],
    });
    render(<CoverageChecker />);
    await userEvent.type(screen.getByLabelText("Barangay or city"), "lahug");
    await userEvent.click(screen.getByRole("button", { name: "Check coverage" }));
    expect(
      await screen.findByText(/Yes, we deliver to Lahug, Cebu City/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Delivery ₱99.00 · free over ₱3,000.00 · same-day before 2:00 PM/),
    ).toBeInTheDocument();
  });

  it("says plainly when an area is not covered", async () => {
    checkCoverage.mockResolvedValue({ ok: true, query: "bogo", matches: [] });
    render(<CoverageChecker />);
    await userEvent.type(screen.getByLabelText("Barangay or city"), "bogo");
    await userEvent.click(screen.getByRole("button", { name: "Check coverage" }));
    expect(await screen.findByText(/don't deliver to “bogo” yet/)).toBeInTheDocument();
  });
});
