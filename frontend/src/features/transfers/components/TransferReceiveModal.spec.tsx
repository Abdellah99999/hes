import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TransferReceiveModal, TransferDetail } from "./TransferReceiveModal";

const mockTransfer: TransferDetail = {
  id: "transfer-100",
  transferNumber: "TRF-CAS-RAB-2026-00001",
  originAgency: { id: "ag-cas", code: "CAS", name: "Casablanca Hub" },
  destinationAgency: { id: "ag-rab", code: "RAB", name: "Rabat Agency" },
  status: "IN_TRANSIT",
  totalExpectedParcels: 3,
  items: [
    {
      id: "item-1",
      parcelId: "p-1",
      status: "LOADED",
      parcel: {
        id: "p-1",
        trackingNumber: "HES-CAS-2026-000001-01",
        weightKg: 2.5,
        barcode: "HES-CAS-2026-000001-01",
        shipment: {
          trackingNumber: "HES-CAS-2026-000001",
          recipientName: "Ahmed Mansouri",
          recipientCity: "Rabat",
        },
      },
    },
    {
      id: "item-2",
      parcelId: "p-2",
      status: "LOADED",
      parcel: {
        id: "p-2",
        trackingNumber: "HES-CAS-2026-000001-02",
        weightKg: 3.0,
        barcode: "HES-CAS-2026-000001-02",
        shipment: {
          trackingNumber: "HES-CAS-2026-000001",
          recipientName: "Ahmed Mansouri",
          recipientCity: "Rabat",
        },
      },
    },
    {
      id: "item-3",
      parcelId: "p-3",
      status: "LOADED",
      parcel: {
        id: "p-3",
        trackingNumber: "HES-CAS-2026-000001-03",
        weightKg: 1.8,
        barcode: "HES-CAS-2026-000001-03",
        shipment: {
          trackingNumber: "HES-CAS-2026-000001",
          recipientName: "Ahmed Mansouri",
          recipientCity: "Rabat",
        },
      },
    },
  ],
};

describe("Phase 6 Frontend Tests: TransferReceiveModal Expected vs Received Reconciliation", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it("renders transfer details, expected count (3), and initial discrepancy alert banner", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <TransferReceiveModal
          isOpen={true}
          transfer={mockTransfer}
          onClose={vi.fn()}
        />
      </QueryClientProvider>,
    );

    // Assert header
    expect(screen.getByText(/Réception Transfert TRF-CAS-RAB-2026-00001/i)).toBeInTheDocument();
    // Assert 3 expected
    expect(screen.getByText("3")).toBeInTheDocument();

    // Initially 0 received, so all 3 are missing -> Discrepancy alert banner is displayed
    expect(
      screen.getByRole("alert", { name: /Alerte colis manquant/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Écart de déchargement détecté \(3 colis manquants\)/i)).toBeInTheDocument();
  });

  it("updates counters and highlights discrepancy when only 2 of 3 parcels are checked/scanned", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <TransferReceiveModal
          isOpen={true}
          transfer={mockTransfer}
          onClose={vi.fn()}
        />
      </QueryClientProvider>,
    );

    // Check parcel 1
    const p1Checkbox = screen.getByText("HES-CAS-2026-000001-01");
    fireEvent.click(p1Checkbox);

    // Check parcel 2
    const p2Checkbox = screen.getByText("HES-CAS-2026-000001-02");
    fireEvent.click(p2Checkbox);

    // Counter shows 2 received
    expect(screen.getByText("2")).toBeInTheDocument();
    // Counter shows -1 missing
    expect(screen.getByText("-1")).toBeInTheDocument();

    // Discrepancy alert is active for 1 missing parcel
    expect(screen.getByText(/Écart de déchargement détecté \(1 colis manquant\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Clôturer avec 1 manquant\(s\)/i)).toBeInTheDocument();
  });

  it("clears discrepancy alert when all 3 parcels are checked (complete reception)", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <TransferReceiveModal
          isOpen={true}
          transfer={mockTransfer}
          onClose={vi.fn()}
        />
      </QueryClientProvider>,
    );

    // Click 'Tout pointer'
    const selectAllBtn = screen.getByText("Tout pointer");
    fireEvent.click(selectAllBtn);

    // Discrepancy alert disappears
    expect(
      screen.queryByRole("alert", { name: /Alerte colis manquant/i }),
    ).not.toBeInTheDocument();

    // Button states complete reception
    expect(screen.getByText("Valider la réception complète")).toBeInTheDocument();
  });
});
