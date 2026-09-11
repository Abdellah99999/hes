import { describe, it, expect, vi } from "vitest";
import {
  buildGoogleMapsDirectionsUrl,
  googleMapsNavigationProvider,
} from "./navigation-provider";

describe("Navigation provider", () => {
  it("builds a pre-filled Google Maps navigation URL for an address", () => {
    const url = buildGoogleMapsDirectionsUrl({
      address: "12 Rue de la Liberté, Casablanca",
      travelMode: "driving",
    });

    expect(url).toContain("https://www.google.com/maps/dir/?");
    expect(url).toContain("destination=12+Rue+de+la+Libert%C3%A9%2C+Casablanca");
    expect(url).toContain("travelmode=driving");
  });

  it("opens the correct Google Maps navigation URL in a new tab", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    googleMapsNavigationProvider.openDirections({
      address: "Rue El Menzah, Rabat",
      travelMode: "driving",
    });

    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining("https://www.google.com/maps/dir/?"),
      "_blank",
      "noopener,noreferrer",
    );
    expect(openSpy.mock.calls[0][0]).toContain("destination=");
  });
});
