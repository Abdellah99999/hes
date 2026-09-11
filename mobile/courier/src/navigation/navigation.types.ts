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

  buildNavigationUrl(
    destination: NavigationDestination,
    options?: NavigationOptions,
  ): string;

  buildAppIntent(
    destination: NavigationDestination,
    options?: NavigationOptions,
  ): string;

  openNavigation(
    destination: NavigationDestination,
    options?: NavigationOptions,
  ): Promise<boolean>;

  isSupported(): boolean;
}
