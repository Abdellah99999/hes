import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RecoverReturnPage } from "./RecoverReturnPage";
import customFetch from "../../../lib/api-client";

vi.mock("../../../lib/api-client", () => ({
  default: vi.fn(),
}));

describe("Phase 10 Frontend Tests: Recover Return (Manual Entry without Scan & Emergency Fallback)", () => {
  let queryClient: QueryClient;

  let mockTrack: { stop: ReturnType<typeof vi.fn>; kind: string };
  let mockStream: {
    getTracks: () => Array<{ stop: ReturnType<typeof vi.fn>; kind: string }>;
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();

    mockTrack = { stop: vi.fn(), kind: "video" };
    mockStream = { getTracks: () => [mockTrack] };

    Object.defineProperty(window, "isSecureContext", {
      value: true,
      configurable: true,
      writable: true,
    });

    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      },
      configurable: true,
      writable: true,
    });

    Object.defineProperty(navigator, "vibrate", {
      value: vi.fn(),
      configurable: true,
      writable: true,
    });

    window.BarcodeDetector = vi.fn().mockImplementation(() => ({
      detect: vi.fn().mockResolvedValue([]),
    })) as unknown as typeof window.BarcodeDetector;
  });

  it("Manual Mode: Allows typing BL number on keyboard and submits with isScan = false", async () => {
    (customFetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      returnItem: {
        id: "item-123",
        originalTrackingNumber: "HES-CAS-2026-000100-01",
      },
      trackingNumber: "HES-CAS-2026-000100-01",
      recoveredVia: "MANUAL",
    });

    render(
      <QueryClientProvider client={queryClient}>
        <RecoverReturnPage />
      </QueryClientProvider>,
    );

    // Assert page header and elements
    expect(
      screen.getByText("Récupérer un Colis Retour (Livreur)"),
    ).toBeInTheDocument();

    // Select manual mode
    const manualModeBtn = screen.getByRole("button", {
      name: /saisie manuelle numéro bl/i,
    });
    fireEvent.click(manualModeBtn);

    // Type tracking/BL number manually
    const input = screen.getByPlaceholderText(
      /Ex: BL-TNG-2026-001 ou HES-CAS-2026-000100-01/i,
    );
    fireEvent.change(input, { target: { value: "BL-TNG-2026-001" } });

    // Submit
    const submitBtn = screen.getByRole("button", {
      name: /confirmer la récupération du retour/i,
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(customFetch).toHaveBeenCalledWith(
        "/returns/recover",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            identifier: "BL-TNG-2026-001",
            isScan: false,
            isFallbackEmergency: false,
          }),
        }),
      );
    });

    // Assert success feedback
    expect(
      await screen.findByText(
        /récupéré avec succès \(par saisie manuelle du BL\)/i,
      ),
    ).toBeInTheDocument();
  });

  it("Emergency Fallback: Allows emergency return recovery when BL is lost / unreadable with mandatory reason", async () => {
    (customFetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      returnItem: {
        id: "item-emergency",
        originalTrackingNumber: "HES-CAS-0001",
      },
      trackingNumber: "HES-CAS-0001",
      recoveredVia: "MANUAL",
    });

    render(
      <QueryClientProvider client={queryClient}>
        <RecoverReturnPage />
      </QueryClientProvider>,
    );

    const input = screen.getByPlaceholderText(
      /Ex: BL-TNG-2026-001 ou HES-CAS-2026-000100-01/i,
    );
    fireEvent.change(input, { target: { value: "HES-CAS-0001" } });

    // Enable emergency toggle
    const toggle = screen.getByRole("checkbox");
    fireEvent.click(toggle);

    // Fill emergency reason
    const reasonTextarea = screen.getByPlaceholderText(
      /Étiquette arrachée, colis identifié par facture intérieure/i,
    );
    fireEvent.change(reasonTextarea, {
      target: { value: "Étiquette arrachée lors de la pluie" },
    });

    // Submit
    const submitBtn = screen.getByRole("button", {
      name: /confirmer la récupération du retour/i,
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(customFetch).toHaveBeenCalledWith(
        "/returns/recover",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            identifier: "HES-CAS-0001",
            isScan: false,
            isFallbackEmergency: true,
            emergencyReason: "Étiquette arrachée lors de la pluie",
          }),
        }),
      );
    });
  });

  it("Scan Mode: Uses unified CameraBarcodeScanner, captures code, and falls back to manual on camera error", async () => {
    (customFetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      returnItem: {
        id: "item-scan",
        originalTrackingNumber: "HES-RAB-2026-000055-01",
      },
      trackingNumber: "HES-RAB-2026-000055-01",
      recoveredVia: "SCAN",
    });

    render(
      <QueryClientProvider client={queryClient}>
        <RecoverReturnPage />
      </QueryClientProvider>,
    );

    // Click on Mode Scan Caméra
    const scanModeBtn = screen.getByRole("button", {
      name: /mode scan caméra \/ douchette/i,
    });
    fireEvent.click(scanModeBtn);

    // CameraBarcodeScanner is mounted
    expect(
      await screen.findByTestId("camera-barcode-scanner"),
    ).toBeInTheDocument();

    // Trigger simulated scan in CameraBarcodeScanner
    const simInput = screen.getByTestId("simulate-barcode-input");
    const simBtn = screen.getByTestId("simulate-barcode-btn");
    fireEvent.change(simInput, { target: { value: "HES-RAB-2026-000055-01" } });
    fireEvent.click(simBtn);

    // Submit return recovery
    const submitBtn = screen.getByRole("button", {
      name: /confirmer la récupération du retour/i,
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(customFetch).toHaveBeenCalledWith(
        "/returns/recover",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            identifier: "HES-RAB-2026-000055-01",
            isScan: true,
            isFallbackEmergency: false,
          }),
        }),
      );
    });
  });
});
