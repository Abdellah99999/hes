import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DocumentDownloadButton } from "./DocumentDownloadButton";
import * as authHook from "../../auth/hooks/useAuth";
import customFetch from "../../../lib/api-client";

vi.mock("../../../lib/api-client", () => ({
  default: vi.fn(),
}));

describe("Phase 13 Frontend Tests: Document Download Button, Role Permissions & Forced API Call Security", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
  });

  it("Permission Check: Hides download button and shows 'Impression non autorisée' when user lacks documents:generate permission", () => {
    vi.spyOn(authHook, "useAuth").mockReturnValue({
      user: {
        id: "cust-restricted",
        email: "guest@hes.ma",
        firstName: "Visiteur",
        lastName: "Guest",
        role: "CUSTOMER",
        agencyId: null,
        isActive: true,
        tokenVersion: 1,
        permissions: [], // No document generation permission
        isGlobalScope: false,
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
      <QueryClientProvider client={queryClient}>
        <DocumentDownloadButton
          documentType="DELIVERY_NOTE"
          entityId="HES-CAS-0001"
          label="Télécharger BL PDF"
        />
      </QueryClientProvider>,
    );

    // Assert that the button is NOT rendered
    expect(screen.queryByRole("button", { name: /télécharger bl pdf/i })).not.toBeInTheDocument();
    // Assert security restriction indicator
    expect(screen.getByText(/impression non autorisée/i)).toBeInTheDocument();
  });

  it("Authorized User: Allows generating PDF with copy count selector and triggers download", async () => {
    vi.spyOn(authHook, "useAuth").mockReturnValue({
      user: {
        id: "agent-quai",
        email: "agent@hes.ma",
        firstName: "Amine",
        lastName: "Agent",
        role: "OPERATOR",
        agencyId: "ag-casa",
        isActive: true,
        tokenVersion: 1,
        permissions: ["documents:generate"],
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

    const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    (customFetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      document: { id: "doc-1", version: 1, fileName: "BL_HES-CAS-0001.pdf" },
      downloadUrl: "https://s3.hes.ma/hes-documents/BL_HES-CAS-0001.pdf?token=valid",
      fileName: "BL_HES-CAS-0001.pdf",
    });

    render(
      <QueryClientProvider client={queryClient}>
        <DocumentDownloadButton
          documentType="DELIVERY_NOTE"
          entityId="HES-CAS-0001"
          defaultCopies={3}
          allowCopiesSelector={true}
          label="Imprimer BL (3 ex.)"
        />
      </QueryClientProvider>,
    );

    // Check copies selector is present
    const copiesSelect = screen.getByLabelText(/nombre d'exemplaires/i);
    expect(copiesSelect).toBeInTheDocument();
    expect(copiesSelect).toHaveValue("3");

    // Click download button
    const btn = screen.getByRole("button", { name: /imprimer bl/i });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(customFetch).toHaveBeenCalledWith(
        "/documents/generate",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            documentType: "DELIVERY_NOTE",
            entityId: "HES-CAS-0001",
            copiesCount: 3,
          }),
        }),
      );
      expect(windowOpenSpy).toHaveBeenCalledWith(
        "https://s3.hes.ma/hes-documents/BL_HES-CAS-0001.pdf?token=valid",
        "_blank",
        "noopener,noreferrer",
      );
    });
  });

  it("Forced API Call Security: If client forces API call on unauthorized entity, backend returns 403 Forbidden and displays error", async () => {
    vi.spyOn(authHook, "useAuth").mockReturnValue({
      user: {
        id: "attacker-customer",
        email: "attacker@rival.ma",
        firstName: "Malicious",
        lastName: "User",
        role: "CUSTOMER",
        agencyId: null,
        isActive: true,
        tokenVersion: 1,
        permissions: ["documents:generate"],
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

    // Mock 403 Forbidden from API
    (customFetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce({
      response: {
        data: {
          message: "Accès refusé : ce document ne vous appartient pas.",
        },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <DocumentDownloadButton
          documentType="INVOICE"
          entityId="FACT-OTHER-CLIENT"
          label="Télécharger Facture"
        />
      </QueryClientProvider>,
    );

    const btn = screen.getByRole("button", { name: /télécharger facture/i });
    fireEvent.click(btn);

    // Verify error feedback displayed to user
    expect(
      await screen.findByText(/accès refusé : ce document ne vous appartient pas\./i),
    ).toBeInTheDocument();
  });
});
