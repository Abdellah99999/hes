import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ShipmentCreateModal } from "./ShipmentCreateModal";
import * as apiClient from "../../../lib/api-client";

describe("ShipmentCreateModal Multi-Parcel & Error Handling Tests", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const renderModal = (isOpen = true, onClose = vi.fn()) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ShipmentCreateModal isOpen={isOpen} onClose={onClose} />
      </QueryClientProvider>,
    );
  };

  it("enforces progressive step validation: prevents advancing to step 2 when step 1 fields are empty", async () => {
    renderModal(true);

    const nextButton = screen.getByRole("button", { name: /Suivant/i });
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(
        screen.getByText("Veuillez sélectionner un client expéditeur"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Veuillez sélectionner l'agence de destination"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Le nom du destinataire doit comporter au moins 2 caractères"),
      ).toBeInTheDocument();
    });
  });

  it("handles multi-parcel addition, removal, and preserves single source of truth state", async () => {
    // Mock successful customFetch for agencies and customers select
    vi.spyOn(apiClient, "default").mockImplementation(async (endpoint: string) => {
      if (endpoint.includes("/agencies")) {
        return { data: [{ id: "ag-1", code: "CAS", name: "Casablanca Hub" }] };
      }
      if (endpoint.includes("/customers")) {
        return { data: [{ id: "cust-1", code: "CLI-01", legalName: "Client Grand Compte" }] };
      }
      return { data: [] };
    });

    renderModal(true);

    // Wait for async options to be populated
    await screen.findByText(/Client Grand Compte/i);

    // 1. Fill Step 1 with valid data
    fireEvent.change(screen.getByRole("combobox", { name: /Client Expéditeur/i }), {
      target: { value: "cust-1" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: /Agence de Destination/i }), {
      target: { value: "ag-1" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Ex: Société Marocaine/i), {
      target: { value: "Transport Express SARL" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Ex: \+212 661/i), {
      target: { value: "+212661223344" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Ex: Casablanca, Agadir/i), {
      target: { value: "Agadir" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Numéro, rue, quartier/i), {
      target: { value: "Zone Industrielle Anza" },
    });

    // Advance to Step 2
    const nextButton = screen.getByRole("button", { name: /Suivant/i });
    fireEvent.click(nextButton);

    // 2. Verify Step 2 is active with initial 1 parcel
    await waitFor(() => {
      expect(screen.getByText(/Colis 1 \/ 1/i)).toBeInTheDocument();
      expect(screen.getByText(/Gestion des Colis Physiques \(1 colis\)/i)).toBeInTheDocument();
    });

    // When only 1 parcel, no delete button should be rendered
    expect(screen.queryByTitle("Supprimer ce colis")).not.toBeInTheDocument();

    // 3. Click "Ajouter un colis" to dynamically append a 2nd parcel
    const addParcelBtn = screen.getByRole("button", { name: /Ajouter un colis/i });
    fireEvent.click(addParcelBtn);

    await waitFor(() => {
      expect(screen.getByText(/Colis 1 \/ 2/i)).toBeInTheDocument();
      expect(screen.getByText(/Colis 2 \/ 2/i)).toBeInTheDocument();
      expect(screen.getByText(/Gestion des Colis Physiques \(2 colis\)/i)).toBeInTheDocument();
    });

    // 4. Click "Ajouter un colis" again to append a 3rd parcel
    fireEvent.click(addParcelBtn);

    await waitFor(() => {
      expect(screen.getByText(/Colis 1 \/ 3/i)).toBeInTheDocument();
      expect(screen.getByText(/Colis 2 \/ 3/i)).toBeInTheDocument();
      expect(screen.getByText(/Colis 3 \/ 3/i)).toBeInTheDocument();
      expect(screen.getByText(/Gestion des Colis Physiques \(3 colis\)/i)).toBeInTheDocument();
    });

    // 5. Remove the second parcel
    const deleteButtons = screen.getAllByTitle("Supprimer ce colis");
    expect(deleteButtons).toHaveLength(3);
    fireEvent.click(deleteButtons[1]);

    // Back to 2 parcels
    await waitFor(() => {
      expect(screen.getByText(/Colis 1 \/ 2/i)).toBeInTheDocument();
      expect(screen.getByText(/Colis 2 \/ 2/i)).toBeInTheDocument();
      expect(screen.getByText(/Gestion des Colis Physiques \(2 colis\)/i)).toBeInTheDocument();
    });
  });

  it("displays backend validation and transaction errors properly in the alert banner", async () => {
    vi.spyOn(apiClient, "default").mockImplementation(async (endpoint: string, options?: RequestInit) => {
      if (endpoint.includes("/agencies")) {
        return { data: [{ id: "ag-1", code: "CAS", name: "Casablanca Hub" }] };
      }
      if (endpoint.includes("/customers")) {
        return { data: [{ id: "cust-1", code: "CLI-01", legalName: "Client Test" }] };
      }
      if (endpoint === "/shipments" && options?.method === "POST") {
        const error = new Error("Erreur de conflit de séquence ou transaction") as Error & {
          response?: { data?: { message?: string } };
        };
        error.response = {
          data: {
            message: "Numéro de séquence déjà attribué ou violation de contrainte unique",
          },
        };
        throw error;
      }
      return { data: [] };
    });

    renderModal(true);

    // Wait for async options to be populated
    await screen.findByText(/Client Test/i);

    // Fill Step 1
    fireEvent.change(screen.getByRole("combobox", { name: /Client Expéditeur/i }), {
      target: { value: "cust-1" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: /Agence de Destination/i }), {
      target: { value: "ag-1" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Ex: Société Marocaine/i), {
      target: { value: "Destinataire Test" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Ex: \+212 661/i), {
      target: { value: "+212600112233" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Ex: Casablanca, Agadir/i), {
      target: { value: "Casablanca" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Numéro, rue, quartier/i), {
      target: { value: "Boulevard Zerktouni" },
    });

    // Step 1 -> Step 2
    fireEvent.click(screen.getByRole("button", { name: /Suivant/i }));

    // Step 2 -> Step 3
    await waitFor(() => {
      expect(screen.getByText(/Colis 1 \/ 1/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /Suivant/i }));

    // Step 3 -> Step 4
    await waitFor(() => {
      expect(screen.getByText(/Service & Conditions Financières/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /Suivant/i }));

    // Step 4: Submit
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Confirmer & Créer l'Expédition/i }),
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /Confirmer & Créer l'Expédition/i }));

    // Verify backend error message is displayed in the alert banner
    await waitFor(() => {
      expect(
        screen.getByText("Numéro de séquence déjà attribué ou violation de contrainte unique"),
      ).toBeInTheDocument();
    });
  });
});
