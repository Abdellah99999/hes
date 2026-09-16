import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AdminBurgerDrawer } from "./AdminBurgerDrawer";
import { User } from "../../auth/context/auth-context.types";

const mockAdminUser: User = {
  id: "user-admin-1",
  email: "admin@hes.ma",
  firstName: "Karim",
  lastName: "Admin",
  role: "ADMIN",
  isActive: true,
  permissions: [
    "shipments:read",
    "runs:manage",
    "returns:manage",
    "incidents:manage",
    "agencies:read",
  ],
};

describe("AdminBurgerDrawer (Priorité 4)", () => {
  it("does not render when isOpen is false", () => {
    render(
      <AdminBurgerDrawer
        isOpen={false}
        onClose={vi.fn()}
        currentView="dashboard"
        setCurrentView={vi.fn()}
        user={mockAdminUser}
        logout={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("admin-burger-drawer")).not.toBeInTheDocument();
  });

  it("renders all categories and user info when isOpen is true", () => {
    render(
      <AdminBurgerDrawer
        isOpen={true}
        onClose={vi.fn()}
        currentView="dashboard"
        setCurrentView={vi.fn()}
        user={mockAdminUser}
        logout={vi.fn()}
      />,
    );

    expect(screen.getByTestId("admin-burger-drawer")).toBeInTheDocument();
    expect(screen.getByText(/Karim Admin/i)).toBeInTheDocument();
    expect(screen.getAllByText(/ADMIN/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Opérations & Quai")).toBeInTheDocument();
    expect(screen.getByText("Relation Client & Litiges")).toBeInTheDocument();
    expect(screen.getByText("Réseau & Référentiel")).toBeInTheDocument();
    expect(screen.getByText("Supervision & Pilotage")).toBeInTheDocument();
  });

  it("selects a view and closes drawer when clicking a navigation item", () => {
    const setCurrentView = vi.fn();
    const onClose = vi.fn();

    render(
      <AdminBurgerDrawer
        isOpen={true}
        onClose={onClose}
        currentView="dashboard"
        setCurrentView={setCurrentView}
        user={mockAdminUser}
        logout={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("drawer-item-shipments"));
    expect(setCurrentView).toHaveBeenCalledWith("shipments");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes drawer when clicking the close button or backdrop", () => {
    const onClose = vi.fn();

    render(
      <AdminBurgerDrawer
        isOpen={true}
        onClose={onClose}
        currentView="dashboard"
        setCurrentView={vi.fn()}
        user={mockAdminUser}
        logout={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("btn-close-drawer"));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId("drawer-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("triggers logout and closes drawer when clicking the logout button", () => {
    const logout = vi.fn();
    const onClose = vi.fn();

    render(
      <AdminBurgerDrawer
        isOpen={true}
        onClose={onClose}
        currentView="dashboard"
        setCurrentView={vi.fn()}
        user={mockAdminUser}
        logout={logout}
      />,
    );

    fireEvent.click(screen.getByTestId("drawer-logout-btn"));
    expect(logout).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("filters items by permission when user lacks permissions", () => {
    const restrictedUser: User = {
      ...mockAdminUser,
      role: "AGENT",
      permissions: [], // no permissions
    };

    render(
      <AdminBurgerDrawer
        isOpen={true}
        onClose={vi.fn()}
        currentView="dashboard"
        setCurrentView={vi.fn()}
        user={restrictedUser}
        logout={vi.fn()}
      />,
    );

    // Permission-gated items should be hidden
    expect(
      screen.queryByTestId("drawer-item-shipments"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("drawer-item-delivery-assignment"),
    ).not.toBeInTheDocument();
    // Non-gated items should still be visible
    expect(
      screen.getByTestId("drawer-item-my-delivery-runs"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("drawer-item-status")).toBeInTheDocument();
  });
});
