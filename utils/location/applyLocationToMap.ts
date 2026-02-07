import type MapView from "react-native-maps";

type LatLng = { latitude: number; longitude: number };

type RegionDelta = {
  latitudeDelta: number;
  longitudeDelta: number;
};

export function applyLocationToMap(params: {
  map: MapView | null;
  coords: LatLng;
  setUserLocation: (loc: LatLng & { speed?: number }) => void;
  speedMps?: number;
  regionDelta: RegionDelta;
  animateMs: number;
}): void {
  const {
    map,
    coords,
    setUserLocation,
    speedMps,
    regionDelta,
    animateMs,
  } = params;

  setUserLocation(
    speedMps != null
      ? {
          latitude: coords.latitude,
          longitude: coords.longitude,
          speed: speedMps,
        }
      : {
          latitude: coords.latitude,
          longitude: coords.longitude,
        },
  );

  map?.animateToRegion(
    {
      latitude: coords.latitude,
      longitude: coords.longitude,
      latitudeDelta: regionDelta.latitudeDelta,
      longitudeDelta: regionDelta.longitudeDelta,
    },
    animateMs,
  );
}
