import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";

describe("Toast notifications", () => {
  it("shows a toast when triggered", async () => {
    render(
      <>
        <Toaster />
        <Button onClick={() => toast.success("Added to cart")}>Add</Button>
      </>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText("Added to cart")).toBeInTheDocument();
  });
});
