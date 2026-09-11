import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReportIncidentPage } from "./ReportIncidentPage";
import * as authHook from "../../auth/hooks/useAuth";
import customFetch from "../../../lib/api-client";

vi.mock("../../../lib/api-client", () => ({
  default: vi.fn(),
}));

describe("Phase 11 Frontend Tests: Incident Form Adapted to User Role", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
  });

  it("Customer Role: Renders customer-friendly claims title, hides internal technical severity and parcel-specific input", () => {
    vi.spyOn(authHook, "useAuth").mockReturnValue({
      user: {
        id: "cust-user-1",
        email: "client@shop.ma",
        firstName: "Karim",
        lastName: "Client",
        role: "CUSTOMER",
        agencyId: null,
        isActive: true,
        tokenVersion: 1,
        permissions: ["incidents:report"],
        isGlobalScope: false,
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
      <QueryClientProvider client={queryClient}>
        <ReportIncidentPage />
      </QueryClientProvider>,
    );

    // Assert customer title
    expect(screen.getByText("Déclarer une Réclamation / Litige")).toBeInTheDocument();
    expect(screen.getByText(/Rôle : CUSTOMER/i)).toBeInTheDocument();

    // Internal fields should NOT be present for customers
    expect(screen.queryByText(/Gravité opérationnelle/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Numéro Colis \/ Code-barres spécifique/i)).not.toBeInTheDocument();
  });

  it("Courier Role: Displays courier anomaly reporting title and includes parcel identifier input", () => {
    vi.spyOn(authHook, "useAuth").mockReturnValue({
      user: {
        id: "courier-user-1",
        email: "courier@hes.ma",
        firstName: "Rachid",
        lastName: "Livreur",
        role: "COURIER",
        agencyId: "ag-casa",
        isActive: true,
        tokenVersion: 1,
        permissions: ["incidents:report"],
        isGlobalScope: false,
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
      <QueryClientProvider client={queryClient}>
        <ReportIncidentPage />
      </QueryClientProvider>,
    );

    expect(screen.getByText("Signaler une Anomalie Colis (Livreur)")).toBeInTheDocument();
    expect(screen.getByText(/Numéro Colis \/ Code-barres spécifique/i)).toBeInTheDocument();
    expect(screen.getByText(/Gravité opérationnelle/i)).toBeInTheDocument();
  });

  it("Submission: Submits incident with tracking reference and description", async () => {
    vi.spyOn(authHook, "useAuth").mockReturnValue({
      user: {
        id: "agent-1",
        email: "agent@hes.ma",
        firstName: "Amine",
        lastName: "Agent",
        role: "OPERATOR",
        agencyId: "ag-casa",
        isActive: true,
        tokenVersion: 1,
        permissions: ["incidents:report"],
        isGlobalScope: false,
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

    (customFetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      incident: { id: "inc-1", incidentNumber: "INC-CAS-20260902-001", isDeliveredDispute: false },
      lastKnownTrackingContext: { status: "AT_HUB", agencyCode: "CAS" },
      isDeliveredDispute: false,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ReportIncidentPage />
      </QueryClientProvider>,
    );

    const shipInput = screen.getByPlaceholderText("Ex: HES-CAS-2026-000500");
    fireEvent.change(shipInput, { target: { value: "HES-CAS-2026-000500" } });

    const descInput = screen.getByPlaceholderText(/Précisez l'état du carton/i);
    fireEvent.change(descInput, {
      target: { value: "Carton détrempé suite intempéries constatées lors du déchargement quai." },
    });

    const submitBtn = screen.getByRole("button", {
      name: /enregistrer la déclaration/i,
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(customFetch).toHaveBeenCalledWith(
        "/incidents",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("HES-CAS-2026-000500"),
        }),
      );
    });

    expect(
      await screen.findByText(/Incident INC-CAS-20260902-001 déclaré avec succès/i),
    ).toBeInTheDocument();
  });
});
