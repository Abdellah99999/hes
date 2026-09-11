import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GoogleMapsNavigationProvider } from "./google-maps.provider";
import { NavigationService } from "./navigation.service";
import { INavigationProvider, NavigationDestination } from "./navigation.types";

describe("Phase 16 Frontend: Navigation Provider & Google Maps Integration", () => {
  let provider: GoogleMapsNavigationProvider;
  let service: NavigationService;

  beforeEach(() => {
    provider = new GoogleMapsNavigationProvider();
    service = new NavigationService(provider);
    vi.clearAllMocks();
  });

  describe("GoogleMapsNavigationProvider - URL & Intent Construction", () => {
    it("should build universal navigation URL prioritizing GPS coordinates", () => {
      const destination: NavigationDestination = {
        label: "Client Casablanca",
        address: "Boulevard d'Anfa",
        city: "Casablanca",
        latitude: 33.589886,
        longitude: -7.632545,
      };

      const url = provider.buildNavigationUrl(destination);
      expect(url).toContain("https://www.google.com/maps/dir/?");
      expect(url).toContain("api=1");
      expect(url).toContain("destination=33.589886%2C-7.632545");
      expect(url).toContain("travelmode=driving");
    });

    it("should fallback to structured postal address when coordinates are missing", () => {
      const destination: NavigationDestination = {
        label: "Agence Rabat",
        street: "Avenue Mohammed V",
        city: "Rabat",
        postalCode: "10000",
        country: "Maroc",
      };

      const url = provider.buildNavigationUrl(destination);
      expect(url).toContain("https://www.google.com/maps/dir/?");
      expect(url).toContain("api=1");
      expect(url).toContain("Avenue+Mohammed+V");
      expect(url).toContain("Rabat");
      expect(url).toContain("Maroc");
    });

    it("should support different travel modes (two-wheeler, walking, bicycling)", () => {
      const destination: NavigationDestination = {
        street: "Zone Industrielle Sidi Maârouf",
        city: "Casablanca",
      };

      const twoWheelerUrl = provider.buildNavigationUrl(destination, {
        mode: "two-wheeler",
      });
      expect(twoWheelerUrl).toContain("travelmode=two-wheeler");

      const walkingUrl = provider.buildNavigationUrl(destination, {
        mode: "walking",
      });
      expect(walkingUrl).toContain("travelmode=walking");
    });

    it("should build native app intents with correct schemes", () => {
      const destination: NavigationDestination = {
        latitude: 31.6295,
        longitude: -7.9811,
      };

      const intent = provider.buildAppIntent(destination);
      // Default non-iOS environment generates Android intent
      expect(intent).toContain("google.navigation:q=31.6295%2C-7.9811");
    });
  });

  describe("NavigationService & Window Dispatching", () => {
    let windowOpenSpy: any;

    beforeEach(() => {
      windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null as any);
    });

    afterEach(() => {
      windowOpenSpy.mockRestore();
    });

    it("should dispatch universal URL securely via window.open", async () => {
      const destination: NavigationDestination = {
        address: "Quartier Gauthier",
        city: "Casablanca",
      };

      await service.navigateTo(destination);

      expect(windowOpenSpy).toHaveBeenCalledTimes(1);
      const calledUrl = windowOpenSpy.mock.calls[0][0];
      const target = windowOpenSpy.mock.calls[0][1];
      const windowFeatures = windowOpenSpy.mock.calls[0][2];

      expect(calledUrl).toContain("https://www.google.com/maps/dir/?");
      expect(calledUrl).toContain("Quartier+Gauthier");
      expect(target).toBe("_blank");
      expect(windowFeatures).toBe("noopener,noreferrer");
    });

    it("should allow dynamic substitution of custom navigation provider", async () => {
      const customMockProvider: INavigationProvider = {
        id: "waze-mock",
        name: "Waze Mock",
        buildNavigationUrl: vi.fn().mockReturnValue("https://waze.com/ul?q=destination"),
        buildAppIntent: vi.fn().mockReturnValue("waze://?q=destination"),
        openNavigation: vi.fn().mockResolvedValue(true),
        isSupported: vi.fn().mockReturnValue(true),
      };

      service.setProvider(customMockProvider);
      expect(service.getProvider().id).toBe("waze-mock");

      const res = await service.navigateTo({ city: "Tanger" });
      expect(res).toBe(true);
      expect(customMockProvider.openNavigation).toHaveBeenCalledWith(
        { city: "Tanger" },
        undefined,
      );
    });
  });
});
