import { useCallback } from "react";
import type React from "react";

import type { MapDestination, MapStop } from "@/types/mapRoute";

export function useResetRouteState(params: {
  setDestination: React.Dispatch<React.SetStateAction<MapDestination | null>>;
  setStops: React.Dispatch<React.SetStateAction<MapStop[]>>;
  setRouteCoordinates: React.Dispatch<
    React.SetStateAction<{ latitude: number; longitude: number }[]>
  >;
  setCurrentInstruction: React.Dispatch<React.SetStateAction<string>>;
  setCurrentManeuver: React.Dispatch<React.SetStateAction<string | null>>;
  setNextInstruction: React.Dispatch<React.SetStateAction<string>>;
  setNextManeuver: React.Dispatch<React.SetStateAction<string | null>>;
  setDistanceToNextTurn: React.Dispatch<React.SetStateAction<number>>;
  setEta: React.Dispatch<React.SetStateAction<string>>;
  routeTotalDurationSecRef: React.MutableRefObject<number>;
  lastDynamicEtaMinutesRef: React.MutableRefObject<number | null>;
}) {
  const {
    setDestination,
    setStops,
    setRouteCoordinates,
    setCurrentInstruction,
    setCurrentManeuver,
    setNextInstruction,
    setNextManeuver,
    setDistanceToNextTurn,
    setEta,
    routeTotalDurationSecRef,
    lastDynamicEtaMinutesRef,
  } = params;

  return useCallback(() => {
    setDestination(null);
    setStops([]);
    setRouteCoordinates([]);
    setCurrentInstruction("");
    setCurrentManeuver(null);
    setNextInstruction("");
    setNextManeuver(null);
    setDistanceToNextTurn(0);
    setEta("");
    routeTotalDurationSecRef.current = 0;
    lastDynamicEtaMinutesRef.current = null;
  }, [
    setDestination,
    setStops,
    setRouteCoordinates,
    setCurrentInstruction,
    setCurrentManeuver,
    setNextInstruction,
    setNextManeuver,
    setDistanceToNextTurn,
    setEta,
    routeTotalDurationSecRef,
    lastDynamicEtaMinutesRef,
  ]);
}
