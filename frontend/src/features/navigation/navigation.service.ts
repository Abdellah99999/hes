import {
  INavigationProvider,
  NavigationDestination,
  NavigationOptions,
} from "./navigation.types";
import { GoogleMapsNavigationProvider } from "./google-maps.provider";

export class NavigationService {
  private provider: INavigationProvider;

  constructor(provider?: INavigationProvider) {
    this.provider = provider || new GoogleMapsNavigationProvider();
  }

  setProvider(provider: INavigationProvider): void {
    this.provider = provider;
  }

  getProvider(): INavigationProvider {
    return this.provider;
  }

  /**
   * Opens turn-by-turn navigation to destination.
   */
  async navigateTo(
    destination: NavigationDestination,
    options?: NavigationOptions,
  ): Promise<boolean> {
    return this.provider.openNavigation(destination, options);
  }

  /**
   * Returns universal web URL for directions.
   */
  getDirectionsUrl(
    destination: NavigationDestination,
    options?: NavigationOptions,
  ): string {
    return this.provider.buildNavigationUrl(destination, options);
  }
}

// Default singleton instance using Google Maps Provider
export const navigationService = new NavigationService();
