import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DashboardPage } from "./DashboardPage";
import customFetch from "../../../lib/api-client";

vi.mock("../../../lib/api-client", () => ({
  default: vi.fn(),
}));

describe("Phase 15 Frontend: DashboardPage components & interactions", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
  });

  it("should render KPIs, status breakdown, and allow filter application", async () => {
    (customFetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (url: string) => {
        if (url.startsWith("/reports/dashboard")) {
          return {
            period: {
              from: "2026-09-01",
              to: "2026-09-30",
              label: "Mois en cours",
            },
            filters: {},
            kpis: {
              totalShipments: 245,
              delivered: 210,
              inTransit: 25,
              outForDelivery: 10,
              pending: 5,
              cancelled: 3,
              returned: 2,
              collectionsTotal: 40,
              collectionsCompleted: 38,
              openIncidents: 4,
              deliverySuccessRate: 97.67,
              totalRevenue: 34500,
            },
            statusBreakdown: [
              { status: "DELIVERED", count: 210 },
              { status: "IN_TRANSIT", count: 25 },
              { status: "OUT_FOR_DELIVERY", count: 10 },
            ],
          };
        }
        return {};
      },
    );

    const onNavigateToReports = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <DashboardPage onNavigateToReports={onNavigateToReports} />
      </QueryClientProvider>,
    );

    // Initial render checks
    expect(screen.getByText("Dashboard Opérationnel")).toBeInTheDocument();
    expect(await screen.findByText("245")).toBeInTheDocument();
    expect(screen.getAllByText("210")).toHaveLength(2);
    expect(screen.getByText("34 500 MAD")).toBeInTheDocument();
    expect(screen.getAllByText("97.67%")).toHaveLength(2);

    // Status breakdown item
    expect(screen.getByText("Livrées")).toBeInTheDocument();

    // Filter change
    fireEvent.change(screen.getByLabelText("Période"), {
      target: { value: "week" },
    });
    fireEvent.click(screen.getByRole("button", { name: /appliquer/i }));

    await waitFor(() => {
      expect(customFetch).toHaveBeenCalledWith(
        "/reports/dashboard",
        expect.objectContaining({
          params: expect.objectContaining({
            period: "week",
          }),
        }),
      );
    });

    // Test shortcut click to reports
    const shortcutBtn = screen.getByRole("button", { name: /rapport livraisons/i });
    fireEvent.click(shortcutBtn);
    expect(onNavigateToReports).toHaveBeenCalledWith("DELIVERIES");
  });
});
