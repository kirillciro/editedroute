import type { LatLng } from "@/types/navigation";

type MaybeLatLng = LatLng | null | undefined;

type MaybeUserLoc =
  | { latitude: number; longitude: number }
  | null
  | undefined;

export function userLocationToLatLng(userLocation: MaybeUserLoc): LatLng | null {
  if (!userLocation) return null;
  return {
    latitude: userLocation.latitude,
    longitude: userLocation.longitude,
  };
}

export function pickNavBaseCoordinate(params: {
  navCurrent: MaybeLatLng;
  navTarget: MaybeLatLng;
  userLocation: MaybeUserLoc;
}): LatLng | null {
  const { navCurrent, navTarget, userLocation } = params;

  if (navCurrent) return navCurrent;
  if (navTarget) return navTarget;
  if (userLocation) {
    return {
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
    };
  }
  return null;
}
