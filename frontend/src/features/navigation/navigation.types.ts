export type NavigationApp = "google-maps" | "waze" | "apple-maps" | "system-default";

export type TravelMode = "driving" | "two-wheeler" | "bicycling" | "walking";

export interface NavigationDestination {
  label?: string;
  address?: string;
  street?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface NavigationOptions {
  app?: NavigationApp;
  mode?: TravelMode;
  avoidTolls?: boolean;
  avoidHighways?: boolean;
  preferAppIntent?: boolean;
}

export interface INavigationProvider {
  readonly id: string;
  readonly name: string;

  /**
   * Builds an absolute HTTPS universal navigation URL (works on all devices and browsers).
   */
  buildNavigationUrl(
    destination: NavigationDestination,
    options?: NavigationOptions,
  ): string;

  /**
   * Builds a native platform URI scheme/intent (e.g. google.navigation: or comgooglemaps://).
   */
  buildAppIntent(
    destination: NavigationDestination,
    options?: NavigationOptions,
  ): string;

  /**
   * Opens turn-by-turn navigation on the courier device.
   */
  openNavigation(
    destination: NavigationDestination,
    options?: NavigationOptions,
  ): Promise<boolean>;

  /**
   * Checks if navigation is available in current environment.
   */
  isSupported(): boolean;
}
