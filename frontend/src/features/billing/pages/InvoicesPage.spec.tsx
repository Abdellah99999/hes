import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { InvoicesPage } from "./InvoicesPage";
import customFetch from "../../../lib/api-client";

import * as authHook from "../../auth/hooks/useAuth";

vi.mock("../../../lib/api-client", () => ({
  default: vi.fn(),
}));

describe("Phase 12a Frontend Tests: Invoices List & Customer Security Scoping", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
    vi.spyOn(authHook, "useAuth").mockReturnValue({
      user: {
        id: "cust-user-1",
        email: "test@client.ma",
        firstName: "Test",
        lastName: "Client",
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
  });

  it("Portal Isolation: Displays only invoices returned for the authenticated user and allows inspecting certified details", async () => {
    // 1. Mock invoice list returned by API (already scoped backend-side)
    (customFetch as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes("/customers")) {
        return Promise.resolve({
          data: [{ id: "cust-1", code: "CLI-01", legalName: "Boutique Mode SARL" }],
        });
      }
      if (url.includes("/invoices")) {
        return Promise.resolve({
          data: [
            {
              id: "inv-1",
              invoiceNumber: "FACT-202609-0042",
              status: "ISSUED",
              issueDate: "2026-09-02T10:00:00Z",
              dueDate: "2026-10-02T10:00:00Z",
              subtotalAmount: 500.0,
              taxRate: 20.0,
              taxAmount: 100.0,
              totalAmount: 600.0,
              paidAmount: 0.0,
              remainingAmount: 600.0,
              notes: "Facture transport mensuelle",
              customer: {
                id: "cust-1",
                code: "CLI-01",
                legalName: "Boutique Mode SARL",
                ice: "00123456789",
                email: "compta@mode.ma",
              },
              items: [
                {
                  id: "item-1",
                  description: "Fret Casablanca -> Marrakech (10 colis)",
                  quantity: 10,
                  unitPrice: 50.0,
                  totalPrice: 500.0,
                },
              ],
            },
          ],
          meta: { total: 1 },
        });
      }
      return Promise.resolve({});
    });

    render(
      <QueryClientProvider client={queryClient}>
        <InvoicesPage />
      </QueryClientProvider>,
    );

    // Verify header
    expect(screen.getByText("Facturation des Prestations")).toBeInTheDocument();

    // Verify invoice rendered
    expect(await screen.findByText("FACT-202609-0042")).toBeInTheDocument();
    expect(screen.getByText("Boutique Mode SARL")).toBeInTheDocument();
    expect(screen.getByText("600.00 MAD TTC")).toBeInTheDocument();

    // Click on invoice to inspect detail panel
    const invCard = screen.getByText("FACT-202609-0042");
    fireEvent.click(invCard);

    // Verify details panel
    await waitFor(() => {
      expect(screen.getByText(/Sous-total HT/i)).toBeInTheDocument();
      expect(screen.getAllByText("500.00 MAD").length).toBeGreaterThan(0);
      expect(screen.getByText("100.00 MAD")).toBeInTheDocument();
    });
  });
});
