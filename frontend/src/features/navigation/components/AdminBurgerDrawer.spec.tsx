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

  it("filters items strictly for DISPATCHER role (partial permissions: shipments:read, runs:manage)", () => {
    const dispatcherUser: User = {
      id: "disp-1",
      email: "disp@hes.ma",
      firstName: "Omar",
      lastName: "Dispatcher",
      role: "DISPATCHER",
      isActive: true,
      permissions: ["shipments:read", "runs:manage"],
    };

    render(
      <AdminBurgerDrawer
        isOpen={true}
        onClose={vi.fn()}
        currentView="dashboard"
        setCurrentView={vi.fn()}
        user={dispatcherUser}
        logout={vi.fn()}
      />,
    );

    // Rubriques AUTORISÉES (shipments:read, runs:manage)
    expect(screen.getByTestId("drawer-item-shipments")).toBeInTheDocument();
    expect(screen.getByTestId("drawer-item-transfers")).toBeInTheDocument();
    expect(screen.getByTestId("drawer-item-stock")).toBeInTheDocument();
    expect(
      screen.getByTestId("drawer-item-delivery-assignment"),
    ).toBeInTheDocument();

    // Rubriques NON AUTORISÉES (returns:manage, incidents:manage, agencies:read)
    expect(
      screen.queryByTestId("drawer-item-returns-monitoring"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("drawer-item-incidents-management"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("drawer-item-agencies"),
    ).not.toBeInTheDocument();
  });

  it("filters items strictly for MANAGER role (shipments:read, returns:manage, incidents:manage without agencies:read)", () => {
    const managerUser: User = {
      id: "mgr-1",
      email: "mgr@hes.ma",
      firstName: "Fatima",
      lastName: "Manager",
      role: "MANAGER",
      isActive: true,
      permissions: ["shipments:read", "returns:manage", "incidents:manage"],
    };

    render(
      <AdminBurgerDrawer
        isOpen={true}
        onClose={vi.fn()}
        currentView="dashboard"
        setCurrentView={vi.fn()}
        user={managerUser}
        logout={vi.fn()}
      />,
    );

    // Rubriques AUTORISÉES
    expect(screen.getByTestId("drawer-item-shipments")).toBeInTheDocument();
    expect(
      screen.getByTestId("drawer-item-returns-monitoring"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("drawer-item-incidents-management"),
    ).toBeInTheDocument();

    // Rubriques NON AUTORISÉES
    expect(
      screen.queryByTestId("drawer-item-delivery-assignment"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("drawer-item-agencies"),
    ).not.toBeInTheDocument();
  });

  it("filters items strictly for AGENT role (shipments:read only)", () => {
    const agentUser: User = {
      id: "agt-1",
      email: "agent@hes.ma",
      firstName: "Youssef",
      lastName: "Agent",
      role: "AGENT",
      isActive: true,
      permissions: ["shipments:read"],
    };

    render(
      <AdminBurgerDrawer
        isOpen={true}
        onClose={vi.fn()}
        currentView="dashboard"
        setCurrentView={vi.fn()}
        user={agentUser}
        logout={vi.fn()}
      />,
    );

    // Rubriques AUTORISÉES
    expect(screen.getByTestId("drawer-item-shipments")).toBeInTheDocument();
    expect(screen.getByTestId("drawer-item-stock")).toBeInTheDocument();
    expect(
      screen.getByTestId("drawer-item-my-delivery-runs"),
    ).toBeInTheDocument();

    // Rubriques NON AUTORISÉES
    expect(
      screen.queryByTestId("drawer-item-delivery-assignment"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("drawer-item-returns-monitoring"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("drawer-item-incidents-management"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("drawer-item-agencies"),
    ).not.toBeInTheDocument();
  });

  it("allows SUPER_ADMIN to see all items even with empty permissions array", () => {
    const superAdminUser: User = {
      id: "super-1",
      email: "super@hes.ma",
      firstName: "Root",
      lastName: "SuperAdmin",
      role: "SUPER_ADMIN",
      isActive: true,
      permissions: [],
    };

    render(
      <AdminBurgerDrawer
        isOpen={true}
        onClose={vi.fn()}
        currentView="dashboard"
        setCurrentView={vi.fn()}
        user={superAdminUser}
        logout={vi.fn()}
      />,
    );

    // Tout doit être visible
    expect(screen.getByTestId("drawer-item-shipments")).toBeInTheDocument();
    expect(
      screen.getByTestId("drawer-item-delivery-assignment"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("drawer-item-returns-monitoring"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("drawer-item-incidents-management"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("drawer-item-agencies")).toBeInTheDocument();
  });
});
