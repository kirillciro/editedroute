import * as Location from "expo-location";
import type MapView from "react-native-maps";

import { applyLocationToMap } from "@/utils/location/applyLocationToMap";
import { getMyLocationOnce } from "@/utils/location/myLocation";

export async function centerMapOnUserOnce(params: {
  map: MapView | null;
  setUserLocation: (loc: { latitude: number; longitude: number; speed?: number }) => void;
  accuracy?: Location.Accuracy;
  regionDelta?: { latitudeDelta: number; longitudeDelta: number };
  animateMs?: number;
}): Promise<void> {
  const {
    map,
    setUserLocation,
    accuracy = Location.Accuracy.Balanced,
    regionDelta = { latitudeDelta: 0.01, longitudeDelta: 0.01 },
    animateMs = 1000,
  } = params;

  try {
    const res = await getMyLocationOnce({ accuracy });
    if (res.kind !== "ok") return;

    applyLocationToMap({
      map,
      coords: { latitude: res.coords.latitude, longitude: res.coords.longitude },
      setUserLocation,
      speedMps: 0,
      regionDelta,
      animateMs,
    });
  } catch (error) {
    if (__DEV__) console.log("Could not get initial location:", error);
  }
}
