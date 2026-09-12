import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CameraBarcodeScanner } from "./CameraBarcodeScanner";

describe("CameraBarcodeScanner: Core Security, Permission, Stream Cleanup & Detection Tests", () => {
  let mockTrack1: { stop: ReturnType<typeof vi.fn>; kind: string };
  let mockTrack2: { stop: ReturnType<typeof vi.fn>; kind: string };
  let mockMediaStream: {
    getTracks: () => Array<{ stop: ReturnType<typeof vi.fn>; kind: string }>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockTrack1 = { stop: vi.fn(), kind: "video" };
    mockTrack2 = { stop: vi.fn(), kind: "video" };
    mockMediaStream = {
      getTracks: () => [mockTrack1, mockTrack2],
    };

    // Ensure window.isSecureContext is true by default
    Object.defineProperty(window, "isSecureContext", {
      value: true,
      configurable: true,
      writable: true,
    });

    // Mock HTMLMediaElement play
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);

    // Mock navigator.mediaDevices.getUserMedia
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockMediaStream),
      },
      configurable: true,
      writable: true,
    });

    // Mock navigator.vibrate
    Object.defineProperty(navigator, "vibrate", {
      value: vi.fn(),
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("1. Permission Refusal: gracefully handles NotAllowedError, displays explicit message and triggers onFallback", async () => {
    const onFallback = vi.fn();
    const onScan = vi.fn();

    // Mock camera permission denied
    const permissionError = new DOMException(
      "Permission denied by user",
      "NotAllowedError",
    );
    (
      navigator.mediaDevices.getUserMedia as unknown as ReturnType<typeof vi.fn>
    ).mockRejectedValueOnce(permissionError);

    render(<CameraBarcodeScanner onScan={onScan} onFallback={onFallback} />);

    // Expect explicit user-facing message, no frozen screen
    await waitFor(() => {
      expect(
        screen.getByText(
          "Caméra indisponible, saisissez le numéro manuellement",
        ),
      ).toBeInTheDocument();
    });

    expect(onFallback).toHaveBeenCalledWith(
      "Caméra indisponible, saisissez le numéro manuellement",
    );
    expect(onScan).not.toHaveBeenCalled();

    // Saisie manuelle button is available to click
    const manualButtons = screen.getAllByRole("button", {
      name: /saisie manuelle/i,
    });
    expect(manualButtons.length).toBeGreaterThan(0);
    fireEvent.click(manualButtons[0]);
    expect(onFallback).toHaveBeenCalled();
  });

  it("2. Stream Cleanup on Unmount: strictly stops all MediaStream tracks (track.stop())", async () => {
    const onScan = vi.fn();

    const { unmount } = render(<CameraBarcodeScanner onScan={onScan} />);

    // Wait until camera stream is acquired
    await waitFor(() => {
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
    });

    // Tracks should NOT be stopped yet while component is mounted
    expect(mockTrack1.stop).not.toHaveBeenCalled();
    expect(mockTrack2.stop).not.toHaveBeenCalled();

    // Unmount the component (simulating modal close or page change)
    unmount();

    // Verify all active media tracks have been stopped to prevent background camera leaks
    expect(mockTrack1.stop).toHaveBeenCalledTimes(1);
    expect(mockTrack2.stop).toHaveBeenCalledTimes(1);
  });

  it("3. Insecure Context: detects non-HTTPS/non-localhost and triggers onFallback with clear message", async () => {
    const onFallback = vi.fn();

    Object.defineProperty(window, "isSecureContext", {
      value: false,
      configurable: true,
      writable: true,
    });

    render(<CameraBarcodeScanner onScan={vi.fn()} onFallback={onFallback} />);

    await waitFor(() => {
      expect(
        screen.getByText(
          "Caméra indisponible dans un contexte non sécurisé (HTTPS requis). Saisie manuelle activée.",
        ),
      ).toBeInTheDocument();
    });

    expect(onFallback).toHaveBeenCalledWith(
      "Caméra indisponible dans un contexte non sécurisé (HTTPS requis). Saisie manuelle activée.",
    );
  });

  it("4. Successful Barcode Detection: triggers onScan, stops stream, and provides haptic vibration feedback", async () => {
    const onScan = vi.fn();

    // Mock native BarcodeDetector
    const mockDetect = vi
      .fn()
      .mockResolvedValue([
        { rawValue: "HES-CAS-2026-000042-01", format: "code_128" },
      ]);
    window.BarcodeDetector = vi.fn().mockImplementation(() => ({
      detect: mockDetect,
    })) as unknown as typeof window.BarcodeDetector;

    render(
      <CameraBarcodeScanner
        onScan={onScan}
        scanIntervalMs={50}
        allowSimulatedScan={true}
      />,
    );

    // Wait for video element and readyState
    const video = screen.getByTestId(
      "scanner-video-element",
    ) as HTMLVideoElement;
    Object.defineProperty(video, "readyState", {
      value: 4,
      configurable: true,
    });

    // Wait for the throttled detector loop to run
    await waitFor(() => {
      expect(onScan).toHaveBeenCalledWith("HES-CAS-2026-000042-01");
    });

    // Verify vibration feedback
    expect(navigator.vibrate).toHaveBeenCalledWith(100);

    // Verify stream was immediately stopped on detection
    expect(mockTrack1.stop).toHaveBeenCalled();
  });

  it("5. Simulated scan input works for test and device fallback", async () => {
    const onScan = vi.fn();

    render(<CameraBarcodeScanner onScan={onScan} allowSimulatedScan={true} />);

    // Wait for stream to be acquired
    await waitFor(() => {
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
    });

    const input = screen.getByTestId("simulate-barcode-input");
    const submitBtn = screen.getByTestId("simulate-barcode-btn");

    fireEvent.change(input, { target: { value: "HES-RAB-2026-000099-01" } });
    fireEvent.click(submitBtn);

    expect(onScan).toHaveBeenCalledWith("HES-RAB-2026-000099-01");
    expect(navigator.vibrate).toHaveBeenCalledWith(100);
    expect(mockTrack1.stop).toHaveBeenCalled();
  });
});
