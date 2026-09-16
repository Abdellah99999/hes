import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BottomNavigationBar } from "./BottomNavigationBar";

describe("BottomNavigationBar (Priorité 4)", () => {
  it("renders 4 mobile thumb actions for COURIER role", () => {
    const setCurrentView = vi.fn();
    const onOpenScanner = vi.fn();

    render(
      <BottomNavigationBar
        role="COURIER"
        currentView="my-delivery-runs"
        setCurrentView={setCurrentView}
        onOpenScanner={onOpenScanner}
      />,
    );

    expect(screen.getByTestId("bottom-navigation-bar")).toBeInTheDocument();
    expect(screen.getByTestId("btn-bottom-my-runs")).toBeInTheDocument();
    expect(screen.getByTestId("btn-bottom-scan")).toBeInTheDocument();
    expect(screen.getByTestId("btn-bottom-returns")).toBeInTheDocument();
    expect(screen.getByTestId("btn-bottom-incidents")).toBeInTheDocument();
  });

  it("calls onOpenScanner when clicking the central scan button as COURIER", () => {
    const onOpenScanner = vi.fn();

    render(
      <BottomNavigationBar
        role="COURIER"
        currentView="my-delivery-runs"
        setCurrentView={vi.fn()}
        onOpenScanner={onOpenScanner}
      />,
    );

    fireEvent.click(screen.getByTestId("btn-bottom-scan"));
    expect(onOpenScanner).toHaveBeenCalledTimes(1);
  });

  it("navigates to returns and incidents when clicking respective tabs as COURIER", () => {
    const setCurrentView = vi.fn();

    render(
      <BottomNavigationBar
        role="COURIER"
        currentView="my-delivery-runs"
        setCurrentView={setCurrentView}
        onOpenScanner={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("btn-bottom-returns"));
    expect(setCurrentView).toHaveBeenCalledWith("recover-return");

    fireEvent.click(screen.getByTestId("btn-bottom-incidents"));
    expect(setCurrentView).toHaveBeenCalledWith("report-incident");
  });

  it("renders 3 mobile thumb actions for CLIENT role", () => {
    const setCurrentView = vi.fn();

    render(
      <BottomNavigationBar
        role="CLIENT"
        currentView="shipments"
        setCurrentView={setCurrentView}
      />,
    );

    expect(screen.getByTestId("bottom-navigation-bar")).toBeInTheDocument();
    expect(
      screen.getByTestId("btn-bottom-request-collection"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("btn-bottom-shipments")).toBeInTheDocument();
    expect(screen.getByTestId("btn-bottom-invoices")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("btn-bottom-request-collection"));
    expect(setCurrentView).toHaveBeenCalledWith("request-collection");

    fireEvent.click(screen.getByTestId("btn-bottom-invoices"));
    expect(setCurrentView).toHaveBeenCalledWith("invoices");
  });

  it("does not render bottom navigation for ADMIN or staff roles (handled by burger menu)", () => {
    const { container } = render(
      <BottomNavigationBar
        role="ADMIN"
        currentView="dashboard"
        setCurrentView={vi.fn()}
      />,
    );

    expect(container.firstChild).toBeNull();
    expect(
      screen.queryByTestId("bottom-navigation-bar"),
    ).not.toBeInTheDocument();
  });

  it("does not render bottom navigation when not authenticated", () => {
    const { container } = render(
      <BottomNavigationBar
        role={null}
        currentView="status"
        setCurrentView={vi.fn()}
      />,
    );

    expect(container.firstChild).toBeNull();
  });
});
