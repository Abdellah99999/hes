import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CustomerRequestCollectionPage } from "./CustomerRequestCollectionPage";
import * as authHook from "../../auth/hooks/useAuth";
import customFetch from "../../../lib/api-client";

vi.mock("../../../lib/api-client", () => ({
  default: vi.fn(),
}));

describe("Phase 7 Frontend Tests: Customer Collection Request & Strict Customer Isolation", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
  });

  it("Client A: Automatically binds to Client A identity and renders secured badge", () => {
    vi.spyOn(authHook, "useAuth").mockReturnValue({
      user: {
        id: "user-client-a-id",
        email: "client.alpha@shop.ma",
        firstName: "Fatima",
        lastName: "Alpha",
        phone: "+212611223344",
        role: "CUSTOMER",
        agencyId: "ag-casa",
        customerId: "cust-alpha-uuid",
        isActive: true,
        tokenVersion: 1,
        permissions: ["collections:create", "collections:read"],
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
        <CustomerRequestCollectionPage />
      </QueryClientProvider>,
    );

    // Assert secured badge displaying client A's email
    expect(screen.getByText(/Compte Client Sécurisé : client.alpha@shop.ma/i)).toBeInTheDocument();
    // Assert title
    expect(screen.getByText(/Demander un Enlèvement \/ Collecte/i)).toBeInTheDocument();
  });

  it("Client A: Submitting collection sends payload without allowing arbitrary customerId spoofing", async () => {
    vi.spyOn(authHook, "useAuth").mockReturnValue({
      user: {
        id: "user-client-a-id",
        email: "client.alpha@shop.ma",
        firstName: "Fatima",
        lastName: "Alpha",
        phone: "+212611223344",
        role: "CUSTOMER",
        agencyId: "ag-casa",
        customerId: "cust-alpha-uuid",
        isActive: true,
        tokenVersion: 1,
        permissions: ["collections:create", "collections:read"],
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
      collectionNumber: "COL-CAS-2026-00042",
    });

    render(
      <QueryClientProvider client={queryClient}>
        <CustomerRequestCollectionPage />
      </QueryClientProvider>,
    );

    // Fill pickup details
    fireEvent.change(screen.getByPlaceholderText(/Ex: 45 Rue des Alouettes/i), {
      target: { value: "45 Rue des Alouettes, Maarif" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Nom destinataire/i), {
      target: { value: "Yassine Mansouri" },
    });
    fireEvent.change(screen.getByPlaceholderText(/\+2126\.\.\./i), {
      target: { value: "+212677889900" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Adresse de livraison/i), {
      target: { value: "Avenue Allal Ben Abdellah, Rabat" },
    });

    // Submit button
    const submitBtn = screen.getByRole("button", { name: /Confirmer la demande/i });
    fireEvent.click(submitBtn);

    // Verify customFetch was called with the endpoint /collections
    await waitFor(() => {
      expect(customFetch).toHaveBeenCalledWith(
        "/collections",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("Fatima Alpha"),
        }),
      );
    });
  });

  it("Client B (Different Token): Renders distinct Client B credentials, isolated from Client A", () => {
    vi.spyOn(authHook, "useAuth").mockReturnValue({
      user: {
        id: "user-client-b-id",
        email: "client.beta@shop.ma",
        firstName: "Karim",
        lastName: "Beta",
        phone: "+212699887766",
        role: "CUSTOMER",
        agencyId: "ag-casa",
        customerId: "cust-beta-uuid",
        isActive: true,
        tokenVersion: 1,
        permissions: ["collections:create", "collections:read"],
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
        <CustomerRequestCollectionPage />
      </QueryClientProvider>,
    );

    // Assert Client B's identity is strictly rendered
    expect(screen.getByText(/Compte Client Sécurisé : client.beta@shop.ma/i)).toBeInTheDocument();
    // Ensure Client A's email is NOT present anywhere
    expect(screen.queryByText(/client.alpha@shop.ma/i)).not.toBeInTheDocument();
  });
});
