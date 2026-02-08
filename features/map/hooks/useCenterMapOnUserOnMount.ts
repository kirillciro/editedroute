import { useEffect } from "react";
import type React from "react";
import type MapView from "react-native-maps";
import * as Location from "expo-location";

import type { UserLocation } from "@/types/mapRoute";
import { centerMapOnUserOnce } from "@/utils/location/centerOnUserOnce";

type Params = {
  mapRef: React.RefObject<MapView | null>;
  setUserLocation: React.Dispatch<React.SetStateAction<UserLocation | null>>;
};

export function useCenterMapOnUserOnMount({ mapRef, setUserLocation }: Params) {
  // Auto-center on user's current location when map loads
  useEffect(() => {
    centerMapOnUserOnce({
      map: mapRef.current,
      setUserLocation,
      accuracy: Location.Accuracy.Balanced,
      regionDelta: { latitudeDelta: 0.01, longitudeDelta: 0.01 },
      animateMs: 1000,
    });
  }, []);
}
