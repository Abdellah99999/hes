import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConfirmDeliveryModal } from "./ConfirmDeliveryModal";
import customFetch from "../../../lib/api-client";

vi.mock("../../../lib/api-client", () => ({
  default: vi.fn(),
}));

describe("ConfirmDeliveryModal: Tactile & Touch POD Signature Tests", () => {
  let queryClient: QueryClient;

  const mockParcel = {
    id: "parcel-pod-101",
    trackingNumber: "HES-CAS-2026-000101-01",
    recipientName: "Fatima Zahra",
    recipientPhone: "+212612345678",
    recipientAddress: "45 Rue Al Fourat, Maarif",
    recipientCity: "Casablanca",
    codAmount: 280.0,
  };

  const mockCtx = {
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    clearRect: vi.fn(),
    lineWidth: 0,
    lineCap: "",
    lineJoin: "",
    strokeStyle: "",
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();

    // Mock HTMLCanvasElement 2D context and measurement methods
    HTMLCanvasElement.prototype.getContext = vi
      .fn()
      .mockImplementation((contextId) => {
        if (contextId === "2d") return mockCtx;
        return null;
      });

    HTMLCanvasElement.prototype.toDataURL = vi
      .fn()
      .mockReturnValue("data:image/png;base64,mockSignatureDataString");

    HTMLCanvasElement.prototype.getBoundingClientRect = vi
      .fn()
      .mockReturnValue({
        left: 20,
        top: 50,
        width: 440,
        height: 120,
        right: 460,
        bottom: 170,
      } as DOMRect);
  });

  it("Blocks submission if tactile signature is missing in DIGITAL_SIGNATURE mode", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ConfirmDeliveryModal
          isOpen={true}
          parcel={mockParcel}
          onClose={vi.fn()}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByText("Confirmer la Livraison")).toBeInTheDocument();
    expect(screen.getByText("HES-CAS-2026-000101-01")).toBeInTheDocument();

    const submitBtn = screen.getByRole("button", {
      name: /confirmer la livraison \(pod\)/i,
    });
    fireEvent.click(submitBtn);

    expect(
      screen.getByText(
        "Veuillez apposer une signature tactile dans le cadre prévu.",
      ),
    ).toBeInTheDocument();
    expect(customFetch).not.toHaveBeenCalled();
  });

  it("Captures tactile POD signature on smartphone touch events (touchstart, touchmove, touchend) and submits successfully", async () => {
    (customFetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      success: true,
      parcel: { id: mockParcel.id, status: "DELIVERED" },
    });

    const onSuccess = vi.fn();
    const onClose = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <ConfirmDeliveryModal
          isOpen={true}
          parcel={mockParcel}
          onClose={onClose}
          onSuccess={onSuccess}
        />
      </QueryClientProvider>,
    );

    const canvas = screen.getByTestId("signature-canvas");
    expect(canvas).toBeInTheDocument();

    // Simulate mobile touchstart with finger at clientX: 50, clientY: 80
    fireEvent.touchStart(canvas, {
      touches: [{ clientX: 50, clientY: 80 }],
    });
    expect(mockCtx.beginPath).toHaveBeenCalled();
    expect(mockCtx.moveTo).toHaveBeenCalled();

    // Simulate finger drag (touchmove) to clientX: 120, clientY: 100
    fireEvent.touchMove(canvas, {
      touches: [{ clientX: 120, clientY: 100 }],
    });
    expect(mockCtx.lineTo).toHaveBeenCalled();
    expect(mockCtx.stroke).toHaveBeenCalled();

    // Simulate finger lift (touchend)
    fireEvent.touchEnd(canvas);

    // Submit the form
    const submitBtn = screen.getByRole("button", {
      name: /confirmer la livraison \(pod\)/i,
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(customFetch).toHaveBeenCalledWith(
        `/deliveries/${mockParcel.id}/confirm`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            proofType: "DIGITAL_SIGNATURE",
            recipientName: "Fatima Zahra",
            signatureDataUrl: "data:image/png;base64,mockSignatureDataString",
            collectedCodAmount: 280,
          }),
        }),
      );
    });

    expect(onSuccess).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("Clearing canvas resets the signature state and prevents blank submission", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ConfirmDeliveryModal
          isOpen={true}
          parcel={mockParcel}
          onClose={vi.fn()}
        />
      </QueryClientProvider>,
    );

    const canvas = screen.getByTestId("signature-canvas");

    // Touch sign
    fireEvent.touchStart(canvas, {
      touches: [{ clientX: 60, clientY: 90 }],
    });
    fireEvent.touchMove(canvas, {
      touches: [{ clientX: 130, clientY: 110 }],
    });
    fireEvent.touchEnd(canvas);

    // Click 'Effacer'
    const clearBtn = screen.getByRole("button", { name: /effacer/i });
    fireEvent.click(clearBtn);

    expect(mockCtx.clearRect).toHaveBeenCalled();

    // Now submit: should fail because signature was cleared
    const submitBtn = screen.getByRole("button", {
      name: /confirmer la livraison \(pod\)/i,
    });
    fireEvent.click(submitBtn);

    expect(
      screen.getByText(
        "Veuillez apposer une signature tactile dans le cadre prévu.",
      ),
    ).toBeInTheDocument();
    expect(customFetch).not.toHaveBeenCalled();
  });

  it("Also supports desktop mouse events for hybrid and PC users", async () => {
    (customFetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      success: true,
      parcel: { id: mockParcel.id, status: "DELIVERED" },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ConfirmDeliveryModal
          isOpen={true}
          parcel={mockParcel}
          onClose={vi.fn()}
        />
      </QueryClientProvider>,
    );

    const canvas = screen.getByTestId("signature-canvas");

    fireEvent.mouseDown(canvas, { clientX: 40, clientY: 70 });
    fireEvent.mouseMove(canvas, { clientX: 100, clientY: 90 });
    fireEvent.mouseUp(canvas);

    const submitBtn = screen.getByRole("button", {
      name: /confirmer la livraison \(pod\)/i,
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(customFetch).toHaveBeenCalledWith(
        `/deliveries/${mockParcel.id}/confirm`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            proofType: "DIGITAL_SIGNATURE",
            recipientName: "Fatima Zahra",
            signatureDataUrl: "data:image/png;base64,mockSignatureDataString",
            collectedCodAmount: 280,
          }),
        }),
      );
    });
  });
});
