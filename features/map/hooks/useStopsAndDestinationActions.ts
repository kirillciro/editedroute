import React, { useCallback } from "react";
import { Keyboard } from "react-native";
import type {
  GooglePlaceData,
  GooglePlaceDetail,
} from "react-native-google-places-autocomplete";

import type { MapDestination, MapStop, UserLocation } from "@/types/mapRoute";

type Ref<T> = { current: T };

type Params = {
  destination: MapDestination | null;
  setDestination: React.Dispatch<React.SetStateAction<MapDestination | null>>;

  stops: MapStop[];
  setStops: React.Dispatch<React.SetStateAction<MapStop[]>>;

  isNavigating: boolean;
  currentStopIndex: number;
  setCurrentStopIndex: React.Dispatch<React.SetStateAction<number>>;

  userLocation: UserLocation | null;
  handleMyLocation: () => Promise<void>;

  calculateRoute: (
    destLat: number,
    destLng: number,
    retryCount?: number,
    options?: {
      origin?: { latitude: number; longitude: number };
      silent?: boolean;
      fit?: boolean;
    },
  ) => Promise<void>;
  recalculateRouteToDestinationIfPresent: (
    destinationRef: Ref<MapDestination | null>,
  ) => Promise<void>;
  destinationRef: Ref<MapDestination | null>;

  resetRouteState: () => void;

  searchRef: React.MutableRefObject<{
    setAddressText?: (text: string) => void;
  } | null>;

  getLatLngFromPlaceDetails: (
    details: GooglePlaceDetail | null,
  ) => { lat: number; lng: number } | null | undefined;
  getPlaceDescription: (data: GooglePlaceData) => string;

  logDev?: (msg: string) => void;
};

export function useStopsAndDestinationActions({
  destination,
  setDestination,
  stops,
  setStops,
  isNavigating,
  currentStopIndex,
  setCurrentStopIndex,
  userLocation,
  handleMyLocation,
  calculateRoute,
  recalculateRouteToDestinationIfPresent,
  destinationRef,
  resetRouteState,
  searchRef,
  getLatLngFromPlaceDetails,
  getPlaceDescription,
  logDev,
}: Params) {
  const handlePlaceSelect = useCallback(
    async (data: GooglePlaceData, details: GooglePlaceDetail | null) => {
      const ll = getLatLngFromPlaceDetails(details);
      if (ll) {
        const { lat, lng } = ll;
        const description = getPlaceDescription(data);

        if (!destination) {
          setDestination({
            latitude: lat,
            longitude: lng,
            address: description,
          });
        } else {
          const newStop: MapStop = {
            id: Date.now().toString(),
            latitude: lat,
            longitude: lng,
            address: description,
          };
          setStops((prev) => [...prev, newStop]);
        }

        searchRef.current?.setAddressText?.("");

        if (!userLocation) {
          await handleMyLocation();
        }

        await calculateRoute(lat, lng);
      }
      Keyboard.dismiss();
    },
    [
      calculateRoute,
      destination,
      getLatLngFromPlaceDetails,
      getPlaceDescription,
      handleMyLocation,
      searchRef,
      setDestination,
      setStops,
      userLocation,
    ],
  );

  const handleRemoveStop = useCallback(
    async (stopId: string) => {
      const updatedStops = stops.filter((stop) => stop.id !== stopId);
      setStops(updatedStops);
      setCurrentStopIndex(updatedStops.length > 0 && isNavigating ? 0 : -1);

      await recalculateRouteToDestinationIfPresent(destinationRef);
    },
    [
      destinationRef,
      isNavigating,
      recalculateRouteToDestinationIfPresent,
      setCurrentStopIndex,
      setStops,
      stops,
    ],
  );

  const handleNextStop = useCallback(() => {
    if (stops.length > 0 && currentStopIndex < stops.length) {
      const nextIndex = currentStopIndex === -1 ? 0 : currentStopIndex + 1;
      setCurrentStopIndex(nextIndex);
      if (logDev) {
        logDev(`Manually advanced to stop ${nextIndex + 1}/${stops.length}`);
      }
    }
  }, [currentStopIndex, logDev, setCurrentStopIndex, stops.length]);

  const handleRemoveDestination = useCallback(() => {
    resetRouteState();
  }, [resetRouteState]);

  const onStopsDragEnd = useCallback(
    async (data: MapStop[]) => {
      setStops(data);
      setCurrentStopIndex(data.length > 0 && isNavigating ? 0 : -1);

      await recalculateRouteToDestinationIfPresent(destinationRef);
    },
    [
      destinationRef,
      isNavigating,
      recalculateRouteToDestinationIfPresent,
      setCurrentStopIndex,
      setStops,
    ],
  );

  return {
    handlePlaceSelect,
    handleRemoveStop,
    handleNextStop,
    handleRemoveDestination,
    onStopsDragEnd,
  };
}
