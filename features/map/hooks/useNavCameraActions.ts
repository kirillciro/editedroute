import { useCallback } from "react";
import type MapView from "react-native-maps";

import type { NavViewMode } from "@/types/mapUi";
import { fitMapToCoordinates } from "@/utils/navigation/mapFit";
import { pickNavBaseCoordinate } from "@/utils/navigation/navCoordinate";

type Coord = { latitude: number; longitude: number };

type Params = {
  mapRef: React.RefObject<MapView | null>;
  routeCoordinatesRef: React.MutableRefObject<Coord[]>;

  navCurrentRef: React.MutableRefObject<Coord | null>;
  navTargetRef: React.MutableRefObject<Coord | null>;
  userLocationRef: React.MutableRefObject<(Coord & { speed?: number }) | null>;
  navSpeedRef: React.MutableRefObject<number>;

  pendingNavCameraFixRef: React.MutableRefObject<{
    latitude: number;
    longitude: number;
    speedMps: number;
  } | null>;
  didApplyNavCameraFixRef: React.MutableRefObject<boolean>;
  navCameraHoldUntilRef: React.MutableRefObject<number>;

  setNavViewModeImmediate: (mode: NavViewMode) => void;
};

export function useNavCameraActions(params: Params) {
  const {
    mapRef,
    routeCoordinatesRef,
    navCurrentRef,
    navTargetRef,
    userLocationRef,
    navSpeedRef,
    pendingNavCameraFixRef,
    didApplyNavCameraFixRef,
    navCameraHoldUntilRef,
    setNavViewModeImmediate,
  } = params;

  const requestNavRecenter = useCallback(() => {
    const base = pickNavBaseCoordinate({
      navCurrent: navCurrentRef.current,
      navTarget: navTargetRef.current,
      userLocation: userLocationRef.current,
    });

    if (!base) {
      setNavViewModeImmediate("follow");
      return;
    }

    pendingNavCameraFixRef.current = {
      latitude: base.latitude,
      longitude: base.longitude,
      speedMps: navSpeedRef.current || userLocationRef.current?.speed || 0,
    };
    didApplyNavCameraFixRef.current = false;
    // Give the recenter animation a moment to run without the follow loop fighting it.
    navCameraHoldUntilRef.current = Date.now() + 850;
    setNavViewModeImmediate("follow");
  }, [
    didApplyNavCameraFixRef,
    navCameraHoldUntilRef,
    navCurrentRef,
    navSpeedRef,
    navTargetRef,
    pendingNavCameraFixRef,
    setNavViewModeImmediate,
    userLocationRef,
  ]);

  const requestNavOverview = useCallback(() => {
    setNavViewModeImmediate("overview");
    const points = routeCoordinatesRef.current;
    fitMapToCoordinates({
      map: mapRef.current,
      points,
      edgePadding: { top: 120, right: 70, bottom: 320, left: 70 },
      animated: true,
    });
  }, [mapRef, routeCoordinatesRef, setNavViewModeImmediate]);

  return { requestNavRecenter, requestNavOverview };
}
