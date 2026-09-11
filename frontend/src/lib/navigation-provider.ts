export type NavigationTarget = {
  address?: string;
  latitude?: number;
  longitude?: number;
  travelMode?: "driving" | "walking" | "bicycling" | "transit";
};

export interface NavigationProvider {
  openDirections(target: NavigationTarget): Window | null;
}

export const buildGoogleMapsDirectionsUrl = (
  target: NavigationTarget,
): string => {
  const params = new URLSearchParams({
    api: "1",
    travelmode: target.travelMode ?? "driving",
  });

  if (target.address) {
    params.set("destination", target.address);
  } else if (
    target.latitude !== undefined &&
    target.longitude !== undefined
  ) {
    params.set("destination", `${target.latitude},${target.longitude}`);
  } else {
    throw new Error("Un lieu de destination est requis pour la navigation.");
  }

  const mapsKey =
    typeof import.meta !== "undefined" && import.meta.env
      ? import.meta.env.VITE_GOOGLE_MAPS_CLIENT_KEY
      : undefined;

  if (mapsKey) {
    params.set("key", mapsKey);
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
};

export const googleMapsNavigationProvider: NavigationProvider = {
  openDirections(target: NavigationTarget): Window | null {
    const url = buildGoogleMapsDirectionsUrl(target);
    return window.open(url, "_blank", "noopener,noreferrer");
  },
};
