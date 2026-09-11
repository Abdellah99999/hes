import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReportsPage } from "./ReportsPage";
import customFetch from "../../../lib/api-client";

vi.mock("../../../lib/api-client", () => ({
  default: vi.fn(),
}));

describe("Phase 15 Frontend Reports: filters and API behavior", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
  });

  it("should apply report filters to the API request and render returned data", async () => {
    (customFetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (url: string) => {
        if (url.startsWith("/reports/dashboard")) {
          return {
            kpis: {
              totalShipments: 159,
              delivered: 124,
              totalRevenue: 25000,
            },
            statusBreakdown: [{ status: "DELIVERED", count: 124 }],
          };
        }

        if (url.startsWith("/reports/data")) {
          return {
            data: [
              {
                id: "s-1",
                trackingNumber: "HES-AGA-2026-000001",
                globalStatus: "DELIVERED",
                shippingFee: 150,
                recipientName: "Amine Bensaid",
                recipientCity: "Casablanca",
              },
            ],
            meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
          };
        }

        return {};
      },
    );

    render(
      <QueryClientProvider client={queryClient}>
        <ReportsPage />
      </QueryClientProvider>,
    );

    fireEvent.change(screen.getByLabelText("Période"), {
      target: { value: "week" },
    });

    fireEvent.change(screen.getByLabelText("Type de rapport"), {
      target: { value: "SHIPMENTS" },
    });

    fireEvent.click(screen.getByRole("button", { name: /appliquer/i }));

    await waitFor(() => {
      expect(customFetch).toHaveBeenCalledWith(
        "/reports/data",
        expect.objectContaining({
          params: expect.objectContaining({
            type: "SHIPMENTS",
            period: "week",
            page: 1,
            limit: 20,
          }),
        }),
      );
    });

    expect(await screen.findByText("HES-AGA-2026-000001")).toBeInTheDocument();
    expect(screen.getByText("Amine Bensaid")).toBeInTheDocument();
  });
});
