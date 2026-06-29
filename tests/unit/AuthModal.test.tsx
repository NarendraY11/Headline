// =====================================================================
// Phase B smoke test: AuthModal component (RTL unit test).
// Validates form rendering, field validation, mode switching.
// =====================================================================

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AuthModal } from "../../src/components/AuthModal";

// Mock useAuth context
vi.mock("../../src/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: null,
    signIn: vi.fn(),
    signUp: vi.fn(),
    resetPassword: vi.fn(),
  }),
}));

describe("AuthModal", () => {
  it("renders sign-in form by default", () => {
    render(<AuthModal isOpen mode="signin" onClose={vi.fn()} />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("switches to sign-up mode", () => {
    render(<AuthModal isOpen mode="signin" onClose={vi.fn()} />);

    const signUpButton = screen.getByRole("button", { name: /sign up/i });
    fireEvent.click(signUpButton);

    expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
  });

  it("validates required email field", async () => {
    render(<AuthModal isOpen mode="signin" onClose={vi.fn()} />);

    const submitButton = screen.getByRole("button", { name: /sign in/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/email.*required/i)).toBeInTheDocument();
    });
  });

  it("shows password reset form", () => {
    render(<AuthModal isOpen mode="reset" onClose={vi.fn()} />);

    expect(screen.getByRole("button", { name: /send reset link/i })).toBeInTheDocument();
  });
});
