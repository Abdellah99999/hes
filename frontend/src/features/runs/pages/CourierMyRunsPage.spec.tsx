import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CourierMyRunsPage } from "./CourierMyRunsPage";
import * as authHook from "../../auth/hooks/useAuth";
import customFetch from "../../../lib/api-client";

vi.mock("../../../lib/api-client", () => ({
  default: vi.fn(),
}));

describe("Phase 8 Frontend Tests: Courier Missions Isolation", () => {
  let queryClient: QueryClient;

  const courierUserRachid = {
    id: "user-rachid-id",
    email: "rachid.courier@hes.ma",
    firstName: "Rachid",
    lastName: "El Amrani",
    role: "COURIER",
    agencyId: "ag-casa",
    isActive: true,
    tokenVersion: 1,
    permissions: ["runs:read"],
    isGlobalScope: false,
  };

  const courierUserTarik = {
    id: "user-tarik-id",
    email: "tarik.courier@hes.ma",
    firstName: "Tarik",
    lastName: "Bennani",
    role: "COURIER",
    agencyId: "ag-casa",
    isActive: true,
    tokenVersion: 1,
    permissions: ["runs:read"],
    isGlobalScope: false,
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
  });

  it("Courier Rachid: Renders strictly Rachid's assigned runs and prevents seeing Tarik's missions", async () => {
    vi.spyOn(authHook, "useAuth").mockReturnValue({
      user: courierUserRachid,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshSession: vi.fn(),
      fetchCurrentUser: vi.fn(),
      hasPermission: vi.fn().mockReturnValue(true),
      hasAnyPermission: vi.fn().mockReturnValue(true),
    });

    // Mock API returning ONLY Rachid's run (server-enforced security)
    (customFetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: [
        {
          id: "run-rachid-1",
          runNumber: "RUN-CAS-20260903-001",
          shift: "MORNING",
          runDate: "2026-09-03",
          status: "ASSIGNED",
          totalParcels: 2,
          totalWeightKg: 5.5,
          totalCodToCollect: 650.0,
          zone: { code: "MAARIF", name: "Maârif" },
          courier: {
            userId: courierUserRachid.id,
            user: { ...courierUserRachid },
          },
          items: [
            {
              id: "item-1",
              sequenceOrder: 1,
              status: "PENDING",
              isOutOfZone: false,
              parcel: {
                id: "p1",
                trackingNumber: "HES-CAS-2026-0001-01",
                weightKg: 2.5,
                shipment: {
                  recipientName: "Yassine Mansouri",
                  recipientPhone: "+212677889900",
                  recipientAddress: "12 Boulevard Zerktouni",
                  recipientCity: "Casablanca",
                  codAmount: 250.0,
                },
              },
            },
          ],
        },
      ],
      meta: { total: 1 },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <CourierMyRunsPage />
      </QueryClientProvider>,
    );

    // Assert secured badge displays Rachid
    expect(screen.getByText(/Livreur : Rachid El Amrani/i)).toBeInTheDocument();

    // Assert Rachid's run is displayed
    expect(await screen.findByText("RUN-CAS-20260903-001")).toBeInTheDocument();
    expect(screen.getByText("12 Boulevard Zerktouni, Casablanca")).toBeInTheDocument();
    expect(screen.getByText("250.00 MAD")).toBeInTheDocument();

    // Verify endpoint called is /runs/my-runs (no foreign courierId query allowed)
    expect(customFetch).toHaveBeenCalledWith(
      expect.stringMatching(/^\/runs\/my-runs/),
    );
    expect(customFetch).not.toHaveBeenCalledWith(
      expect.stringContaining("courierId=user-tarik-id"),
    );

    // Verify Tarik's runs do NOT appear
    expect(screen.queryByText("RUN-CAS-20260903-002")).not.toBeInTheDocument();
  });

  it("Courier Tarik: Different token / user session renders Tarik's credentials exclusively", async () => {
    vi.spyOn(authHook, "useAuth").mockReturnValue({
      user: courierUserTarik,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshSession: vi.fn(),
      fetchCurrentUser: vi.fn(),
      hasPermission: vi.fn().mockReturnValue(true),
      hasAnyPermission: vi.fn().mockReturnValue(true),
    });

    (customFetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: [],
      meta: { total: 0 },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <CourierMyRunsPage />
      </QueryClientProvider>,
    );

    // Assert Tarik's identity rendered
    expect(screen.getByText(/Livreur : Tarik Bennani/i)).toBeInTheDocument();
    // Ensure Rachid's name is NOT rendered
    expect(screen.queryByText(/Rachid El Amrani/i)).not.toBeInTheDocument();
  });
});
