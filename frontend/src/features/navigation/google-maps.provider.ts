import {
  INavigationProvider,
  NavigationDestination,
  NavigationOptions,
  TravelMode,
} from "./navigation.types";

export class GoogleMapsNavigationProvider implements INavigationProvider {
  readonly id = "google-maps";
  readonly name = "Google Maps";

  private readonly apiKey?: string;

  constructor(apiKey?: string) {
    // API key injected strictly via environment or config, never hardcoded.
    this.apiKey =
      apiKey ||
      (typeof import.meta !== "undefined" && import.meta.env
        ? (import.meta.env.VITE_GOOGLE_MAPS_CLIENT_KEY as string | undefined)
        : undefined);
  }

  getApiKey(): string | undefined {
    return this.apiKey;
  }

  isSupported(): boolean {
    return typeof window !== "undefined";
  }

  /**
   * Resolves destination query string prioritizing GPS coordinates,
   * then structured postal address.
   */
  resolveDestinationQuery(destination: NavigationDestination): string {
    if (
      destination.latitude != null &&
      destination.longitude != null &&
      !isNaN(destination.latitude) &&
      !isNaN(destination.longitude)
    ) {
      return `${destination.latitude},${destination.longitude}`;
    }

    const parts: string[] = [];
    const mainAddress = destination.street || destination.address;
    if (mainAddress) parts.push(mainAddress.trim());
    if (destination.postalCode) parts.push(destination.postalCode.trim());
    if (destination.city) parts.push(destination.city.trim());
    if (destination.country) {
      parts.push(destination.country.trim());
    } else {
      parts.push("Maroc");
    }

    const query = parts.filter(Boolean).join(", ");
    return query || destination.label || "Casablanca, Maroc";
  }

  private mapTravelMode(mode?: TravelMode): string {
    switch (mode) {
      case "two-wheeler":
        return "two-wheeler";
      case "walking":
        return "walking";
      case "bicycling":
        return "bicycling";
      case "driving":
      default:
        return "driving";
    }
  }

  buildNavigationUrl(
    destination: NavigationDestination,
    options?: NavigationOptions,
  ): string {
    const query = this.resolveDestinationQuery(destination);
    const travelMode = this.mapTravelMode(options?.mode);

    const params = new URLSearchParams({
      api: "1",
      destination: query,
      travelmode: travelMode,
    });

    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }

  buildAppIntent(
    destination: NavigationDestination,
    options?: NavigationOptions,
  ): string {
    const query = this.resolveDestinationQuery(destination);
    const isIOS = this.isAppleDevice();

    if (isIOS) {
      const mode =
        options?.mode === "walking"
          ? "walking"
          : options?.mode === "bicycling"
          ? "bicycling"
          : "driving";
      return `comgooglemaps://?daddr=${encodeURIComponent(query)}&directionsmode=${mode}`;
    }

    // Android navigation intent
    const mode =
      options?.mode === "walking"
        ? "w"
        : options?.mode === "bicycling"
        ? "b"
        : "d";
    return `google.navigation:q=${encodeURIComponent(query)}&mode=${mode}`;
  }

  async openNavigation(
    destination: NavigationDestination,
    options?: NavigationOptions,
  ): Promise<boolean> {
    if (!this.isSupported()) {
      return false;
    }

    const universalUrl = this.buildNavigationUrl(destination, options);

    // On mobile devices, try native app intent if requested, fallback to universal HTTPS link
    if (options?.preferAppIntent && this.isMobileDevice()) {
      const appIntent = this.buildAppIntent(destination, options);
      try {
        window.location.href = appIntent;
        return true;
      } catch {
        // Fallback to web universal link
      }
    }

    const opened = window.open(universalUrl, "_blank", "noopener,noreferrer");
    return opened !== null;
  }

  private isMobileDevice(): boolean {
    if (typeof navigator === "undefined") return false;
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  private isAppleDevice(): boolean {
    if (typeof navigator === "undefined") return false;
    return /iPhone|iPad|iPod/i.test(navigator.userAgent);
  }
}
