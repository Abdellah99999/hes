import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AppNavbar } from "./AppNavbar";
import { useAuth } from "../../auth/hooks/useAuth";

vi.mock("../../auth/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../../notifications/components/NotificationCenter", () => ({
  NotificationCenter: () => <div data-testid="mock-notification-center" />,
}));

describe("AppNavbar (Priorité 4)", () => {
  it("renders desktop tabs and mobile burger button for ADMIN role", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: "admin-1",
        email: "admin@hes.ma",
        firstName: "Super",
        lastName: "Admin",
        role: "ADMIN",
        isActive: true,
        permissions: ["shipments:read", "runs:manage", "agencies:read"],
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

    render(<AppNavbar currentView="dashboard" setCurrentView={vi.fn()} />);

    expect(screen.getByTestId("btn-open-burger-menu")).toBeInTheDocument();
    expect(screen.getByTestId("mock-notification-center")).toBeInTheDocument();
  });

  it("opens burger drawer when clicking the burger button", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: "admin-1",
        email: "admin@hes.ma",
        firstName: "Super",
        lastName: "Admin",
        role: "ADMIN",
        isActive: true,
        permissions: ["shipments:read"],
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

    render(<AppNavbar currentView="dashboard" setCurrentView={vi.fn()} />);

    expect(screen.queryByTestId("admin-burger-drawer")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("btn-open-burger-menu"));
    expect(screen.getByTestId("admin-burger-drawer")).toBeInTheDocument();
  });

  it("does not render burger button on mobile for COURIER role (uses bottom bar instead)", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: "courier-1",
        email: "courier@hes.ma",
        firstName: "Amine",
        lastName: "Livreur",
        role: "COURIER",
        isActive: true,
        permissions: [],
      },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshSession: vi.fn(),
      fetchCurrentUser: vi.fn(),
      hasPermission: vi.fn().mockReturnValue(false),
      hasAnyPermission: vi.fn().mockReturnValue(false),
    });

    render(
      <AppNavbar currentView="my-delivery-runs" setCurrentView={vi.fn()} />,
    );

    // Burger button is omitted for couriers who use the thumb-friendly Bottom Bar
    expect(
      screen.queryByTestId("btn-open-burger-menu"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("btn-mobile-quick-logout")).toBeInTheDocument();
  });
});
