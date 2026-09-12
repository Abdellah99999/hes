import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NetworkStatusIndicator } from "./NetworkStatusIndicator";

describe("NetworkStatusIndicator: Bidirectional Offline and Reconnected Transition Tests", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, "onLine", {
      value: true,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("1. Renders nothing when browser is online", () => {
    render(<NetworkStatusIndicator />);
    expect(screen.queryByTestId("pwa-offline-banner")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("pwa-reconnected-banner"),
    ).not.toBeInTheDocument();
  });

  it("2. Displays persistent offline warning when offline event fires", () => {
    render(<NetworkStatusIndicator />);

    act(() => {
      Object.defineProperty(navigator, "onLine", { value: false });
      window.dispatchEvent(new Event("offline"));
    });

    const banner = screen.getByTestId("pwa-offline-banner");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent(
      "Mode hors-ligne : connexion réseau interrompue. Les actions nécessitant le serveur sont suspendues.",
    );
  });

  it("3. Transitions gracefully to 'Connexion rétablie' and auto-fades without reload", () => {
    render(<NetworkStatusIndicator />);

    // Go offline
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getByTestId("pwa-offline-banner")).toBeInTheDocument();

    // Come back online
    act(() => {
      Object.defineProperty(navigator, "onLine", { value: true });
      window.dispatchEvent(new Event("online"));
    });

    // Offline banner should disappear and reconnected banner appears
    expect(screen.queryByTestId("pwa-offline-banner")).not.toBeInTheDocument();
    const reconnectedBanner = screen.getByTestId("pwa-reconnected-banner");
    expect(reconnectedBanner).toBeInTheDocument();
    expect(reconnectedBanner).toHaveTextContent(
      "Connexion rétablie — Système reconnecté au serveur.",
    );

    // Advance 3.5 seconds
    act(() => {
      vi.advanceTimersByTime(3500);
    });

    // Banner fades out completely without needing any page reload
    expect(
      screen.queryByTestId("pwa-reconnected-banner"),
    ).not.toBeInTheDocument();
  });
});
