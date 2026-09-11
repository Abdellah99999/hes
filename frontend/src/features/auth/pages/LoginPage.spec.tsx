import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LoginPage } from "./LoginPage";
import * as authHook from "../hooks/useAuth";

describe("LoginPage Form & Validation", () => {
  it("displays client-side Zod validation errors on empty submit before sending network request", async () => {
    const mockLogin = vi.fn();
    vi.spyOn(authHook, "useAuth").mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: mockLogin,
      logout: vi.fn(),
      refreshSession: vi.fn(),
      fetchCurrentUser: vi.fn(),
      hasPermission: vi.fn(),
      hasAnyPermission: vi.fn(),
    });

    render(<LoginPage />);

    const submitButton = screen.getByRole("button", {
      name: /Se connecter en toute sécurité/i,
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText("L'adresse email est requise"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Le mot de passe doit contenir au moins 8 caractères"),
      ).toBeInTheDocument();
    });

    expect(mockLogin).not.toHaveBeenCalled();
  });

  it("displays format error when entering an invalid email", async () => {
    const mockLogin = vi.fn();
    vi.spyOn(authHook, "useAuth").mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: mockLogin,
      logout: vi.fn(),
      refreshSession: vi.fn(),
      fetchCurrentUser: vi.fn(),
      hasPermission: vi.fn(),
      hasAnyPermission: vi.fn(),
    });

    render(<LoginPage />);

    const emailInput = screen.getByLabelText(/Adresse Email Professionnelle/i);
    const submitButton = screen.getByRole("button", {
      name: /Se connecter en toute sécurité/i,
    });

    fireEvent.change(emailInput, { target: { value: "invalid-email-format" } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText("Format d'adresse email invalide"),
      ).toBeInTheDocument();
    });

    expect(mockLogin).not.toHaveBeenCalled();
  });

  it("submits valid credentials and calls auth.login", async () => {
    const mockLogin = vi.fn().mockResolvedValue(undefined);
    const mockSuccess = vi.fn();

    vi.spyOn(authHook, "useAuth").mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: mockLogin,
      logout: vi.fn(),
      refreshSession: vi.fn(),
      fetchCurrentUser: vi.fn(),
      hasPermission: vi.fn(),
      hasAnyPermission: vi.fn(),
    });

    render(<LoginPage onSuccess={mockSuccess} />);

    const emailInput = screen.getByLabelText(
      /Adresse Email Professionnelle/i,
    );
    const passwordInput = screen.getByLabelText(/^Mot de Passe$/i);
    const submitButton = screen.getByRole("button", {
      name: /Se connecter en toute sécurité/i,
    });

    fireEvent.change(emailInput, {
      target: { value: "operator@hes-logistics.com" },
    });
    fireEvent.change(passwordInput, {
      target: { value: "SecurePass2026!" },
    });

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: "operator@hes-logistics.com",
        password: "SecurePass2026!",
        rememberMe: false,
      });
      expect(mockSuccess).toHaveBeenCalled();
    });
  });
});
