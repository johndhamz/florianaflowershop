import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders an accessible button and fires onClick", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Add to cart</Button>);
    const button = screen.getByRole("button", { name: "Add to cart" });
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(button).toHaveAttribute("data-variant", "default");
  });

  it("renders as a child element with asChild", () => {
    render(
      <Button asChild variant="outline">
        <a href="https://example.com/shop">Shop</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Shop" });
    expect(link).toHaveAttribute("href", "https://example.com/shop");
    expect(link).toHaveAttribute("data-variant", "outline");
  });

  it("is not clickable when disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Disabled
      </Button>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Disabled" }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
