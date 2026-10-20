import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LoginForm } from "@/app/(admin-auth)/admin/login/login-form";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("next=/admin/orders"),
}));

vi.mock("@/modules/auth/actions", () => ({
  signInWithPassword: vi.fn(),
}));

describe("LoginForm", () => {
  it("renders labelled email and password fields and carries the next path", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
    expect(document.querySelector('input[name="next"]')).toHaveValue("/admin/orders");
  });
});
