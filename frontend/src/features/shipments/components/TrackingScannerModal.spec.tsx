import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TrackingScannerModal } from "./TrackingScannerModal";
import customFetch from "../../../lib/api-client";

vi.mock("../../../lib/api-client", () => ({
  default: vi.fn(),
}));

describe("TrackingScannerModal: Camera Barcode Scanner & Unified Integration Tests", () => {
  let queryClient: QueryClient;
  let mockTrack: { stop: ReturnType<typeof vi.fn>; kind: string };
  let mockStream: {
    getTracks: () => Array<{ stop: ReturnType<typeof vi.fn>; kind: string }>;
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("1. Camera Mode Permission Refusal: automatically falls back to manual mode and displays explicit message", async () => {
    const permissionError = new DOMException(
      "Camera permission denied",
      "NotAllowedError",
    );
    (
      navigator.mediaDevices.getUserMedia as unknown as ReturnType<typeof vi.fn>
    ).mockRejectedValueOnce(permissionError);

    render(
      <QueryClientProvider client={queryClient}>
        <TrackingScannerModal isOpen={true} onClose={vi.fn()} />
      </QueryClientProvider>,
    );

    // Switch to Camera Mode
    const cameraTabBtn = screen.getByRole("button", {
      name: /caméra 2d \(mobile\)/i,
    });
    fireEvent.click(cameraTabBtn);

    // Should detect permission rejection and fall back to manual mode automatically
    await waitFor(() => {
      expect(
        screen.getByText(
          "Caméra indisponible, saisissez le numéro manuellement",
        ),
      ).toBeInTheDocument();
    });

    // Manual input is now visible and usable
    expect(
      screen.getByPlaceholderText(
        /Prêt pour le scan\.\.\. \(ou taper et appuyer sur Entrée\)/i,
      ),
    ).toBeInTheDocument();
  });

  it("2. Real Camera Scan: executes scan mutation via CameraBarcodeScanner and renders tracking status", async () => {
    (customFetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      duplicate: false,
      message: "Colis scanné avec succès",
      source: "CAMERA",
      parcel: {
        id: "parcel-cam-1",
        trackingNumber: "HES-CAS-2026-000088-01",
        status: "IN_TRANSIT",
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <TrackingScannerModal isOpen={true} onClose={vi.fn()} />
      </QueryClientProvider>,
    );

    // Switch to Camera Mode
    const cameraTabBtn = screen.getByRole("button", {
      name: /caméra 2d \(mobile\)/i,
    });
    fireEvent.click(cameraTabBtn);

    // Simulate scan detection in CameraBarcodeScanner
    const simInput = await screen.findByTestId("simulate-barcode-input");
    const simBtn = screen.getByTestId("simulate-barcode-btn");

    fireEvent.change(simInput, { target: { value: "HES-CAS-2026-000088-01" } });
    fireEvent.click(simBtn);

    await waitFor(() => {
      expect(customFetch).toHaveBeenCalledWith(
        "/shipments/track/scan",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ barcode: "HES-CAS-2026-000088-01" }),
        }),
      );
    });

    // Verifies success banner
    expect(
      await screen.findByText("Colis scanné avec succès"),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/HES-CAS-2026-000088-01/i).length,
    ).toBeGreaterThan(0);
  });

  it("3. Resource Cleanup: stops MediaStream tracks when modal closes or switches tabs", async () => {
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <TrackingScannerModal isOpen={true} onClose={vi.fn()} />
      </QueryClientProvider>,
    );

    // Switch to Camera Mode
    const cameraTabBtn = screen.getByRole("button", {
      name: /caméra 2d \(mobile\)/i,
    });
    fireEvent.click(cameraTabBtn);

    await waitFor(() => {
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
    });

    // Close modal
    rerender(
      <QueryClientProvider client={queryClient}>
        <TrackingScannerModal isOpen={false} onClose={vi.fn()} />
      </QueryClientProvider>,
    );

    // Verify stream was cleanly closed
    expect(mockTrack.stop).toHaveBeenCalled();
  });
});
