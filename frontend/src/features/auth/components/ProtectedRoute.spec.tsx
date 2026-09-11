import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProtectedRoute } from "./ProtectedRoute";
import * as authHook from "../hooks/useAuth";

describe("ProtectedRoute Component", () => {
  it("shows loading state when session is being resolved", () => {
    vi.spyOn(authHook, "useAuth").mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      login: vi.fn(),
      logout: vi.fn(),
      refreshSession: vi.fn(),
      fetchCurrentUser: vi.fn(),
      hasPermission: vi.fn(),
      hasAnyPermission: vi.fn(),
    });

    render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
    );

    expect(
      screen.getByText("Vérification de la session en cours..."),
    ).toBeInTheDocument();
  });

  it("shows redirect notification when user is unauthenticated", () => {
    vi.spyOn(authHook, "useAuth").mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshSession: vi.fn(),
      fetchCurrentUser: vi.fn(),
      hasPermission: vi.fn(),
      hasAnyPermission: vi.fn(),
    });

    render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
    );

    expect(
      screen.getByText("Redirection vers la page de connexion..."),
    ).toBeInTheDocument();
  });

  it("blocks access and displays 403 banner when user lacks required permission", () => {
    vi.spyOn(authHook, "useAuth").mockReturnValue({
      user: {
        id: "user-1",
        email: "operator@hes.com",
        firstName: "Jean",
        lastName: "Dupont",
        role: "OPERATOR",
        isActive: true,
        permissions: ["shipments:read"],
      },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshSession: vi.fn(),
      fetchCurrentUser: vi.fn(),
      hasPermission: vi.fn((perm) => perm === "shipments:read"),
      hasAnyPermission: vi.fn(),
    });

    render(
      <ProtectedRoute requiredPermissions={["users:manage"]}>
        <div>Secret Admin Area</div>
      </ProtectedRoute>,
    );

    expect(screen.getByText("Accès Refusé (HTTP 403)")).toBeInTheDocument();
    expect(screen.getByText("users:manage")).toBeInTheDocument();
    expect(screen.queryByText("Secret Admin Area")).not.toBeInTheDocument();
  });

  it("renders children when authenticated and possessing required permissions", () => {
    vi.spyOn(authHook, "useAuth").mockReturnValue({
      user: {
        id: "admin-1",
        email: "admin@hes.com",
        firstName: "Admin",
        lastName: "Super",
        role: "SUPER_ADMIN",
        isActive: true,
        permissions: ["shipments:read", "users:manage"],
      },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshSession: vi.fn(),
      fetchCurrentUser: vi.fn(),
      hasPermission: vi.fn().mockReturnValue(true),
      hasAnyPermission: vi.fn().mockReturnValue(true),
    });

    render(
      <ProtectedRoute requiredPermissions={["users:manage"]}>
        <div data-testid="admin-content">Admin Dashboard Visible</div>
      </ProtectedRoute>,
    );

    expect(screen.getByTestId("admin-content")).toBeInTheDocument();
  });
});
