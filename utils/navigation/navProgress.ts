import type { MapDestination, MapStop } from "@/types/mapRoute";
import { distanceMetersBetween } from "@/utils/geo/geometry";
import type { GoogleDirectionsStep } from "@/types/googleDirections";

type LatLng = { latitude: number; longitude: number };

type NavProgressResult = {
  nextStopIndex?: number;
  enterArrivalZone?: true;
  distanceToNextTurnMeters?: number;
  nextStepIndex?: number;
};

export function computeNavProgress(params: {
  position: LatLng;

  stops: MapStop[];
  currentStopIndex: number;

  destination: MapDestination | null;
  isInArrivalZone: boolean;

  navigationSteps: GoogleDirectionsStep[];
  currentStepIndex: number;

  stopArriveMeters?: number;
  arrivalZoneMeters?: number;
  stepAdvanceMeters?: number;
}): NavProgressResult {
  const {
    position,
    stops,
    currentStopIndex,
    destination,
    isInArrivalZone,
    navigationSteps,
    currentStepIndex,
    stopArriveMeters = 10,
    arrivalZoneMeters = 20,
    stepAdvanceMeters = 30,
  } = params;

  const result: NavProgressResult = {};

  // STAGE 5.1: Stops auto-advance
  if (stops.length > 0 && currentStopIndex < stops.length) {
    const targetStopIndex = currentStopIndex === -1 ? 0 : currentStopIndex;
    const currentStop = stops[targetStopIndex];
    if (currentStop) {
      const distToStopM = distanceMetersBetween(position, {
        latitude: currentStop.latitude,
        longitude: currentStop.longitude,
      });
      if (distToStopM < stopArriveMeters) {
        result.nextStopIndex = targetStopIndex + 1;
      }
    }
  }

  // STAGE 5.2: Arrival zone detection (final destination)
  if (destination && currentStopIndex >= stops.length) {
    const distToDestinationM = distanceMetersBetween(position, {
      latitude: destination.latitude,
      longitude: destination.longitude,
    });
    if (distToDestinationM < arrivalZoneMeters && !isInArrivalZone) {
      result.enterArrivalZone = true;
    }
  }

  // STAGE 5.3: Next turn distance + step advance
  const step = navigationSteps[currentStepIndex];
  const endLat = step?.end_location?.lat;
  const endLng = step?.end_location?.lng;
  if (typeof endLat === "number" && typeof endLng === "number") {
    const distM = distanceMetersBetween(position, {
      latitude: endLat,
      longitude: endLng,
    });
    result.distanceToNextTurnMeters = distM;

    if (distM < stepAdvanceMeters) {
      const nextIdx = currentStepIndex + 1;
      result.nextStepIndex = Math.min(nextIdx, navigationSteps.length);
    }
  }

  return result;
}
