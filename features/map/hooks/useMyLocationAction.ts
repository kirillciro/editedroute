import * as Location from "expo-location";
import { useCallback } from "react";
import { Alert } from "react-native";
import type MapView from "react-native-maps";

import type { UserLocation } from "@/types/mapRoute";
import { applyLocationToMap } from "@/utils/location/applyLocationToMap";
import { getMyLocationOnce } from "@/utils/location/myLocation";

type Params = {
  mapRef: React.RefObject<MapView | null>;
  setUserLocation: React.Dispatch<React.SetStateAction<UserLocation | null>>;
};

export function useMyLocationAction({ mapRef, setUserLocation }: Params) {
  return useCallback(async () => {
    try {
      const res = await getMyLocationOnce({
        accuracy: Location.Accuracy.Balanced,
      });

      if (res.kind === "permission_denied") {
        Alert.alert(
          "Location Permission Required",
          "This app needs location access to show your position and provide navigation. Please enable location permissions in Settings.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Open Settings",
              onPress: () => {
                // User can manually open settings
                Alert.alert(
                  "Manual Action Required",
                  "Please enable location permissions in iOS Settings > Privacy > Location Services",
                );
              },
            },
          ],
        );
        return;
      }

      if (res.kind === "error") {
        Alert.alert("Location Error", res.message, [{ text: "OK" }]);
        return;
      }

      applyLocationToMap({
        map: mapRef.current,
        coords: {
          latitude: res.coords.latitude,
          longitude: res.coords.longitude,
        },
        setUserLocation,
        speedMps: res.coords.speed ?? undefined,
        regionDelta: { latitudeDelta: 0.003, longitudeDelta: 0.003 },
        animateMs: 1000,
      });
    } catch (error: any) {
      console.error("Error getting location:", error);
      Alert.alert(
        "Location Error",
        "Failed to get your location. Please try again.",
        [{ text: "OK" }],
      );
    }
  }, [mapRef, setUserLocation]);
}
