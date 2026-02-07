import type { MapDestination, MapStop } from "@/types/mapRoute";
import type { GoogleDirectionsStep } from "@/types/googleDirections";
import type { LatLng } from "@/types/navigation";
import type { DynamicEtaSource } from "@/utils/navigation/eta";
import { computeNextSnapActive } from "@/utils/navigation/mapMatching";
import { computeNavProgress } from "@/utils/navigation/navProgress";
import { decideOffRouteRecalc } from "@/utils/navigation/offRoute";

export type NavLocationUpdateOutcome = {
  raw: LatLng;
  speedMps: number;

  didComputeClosestPoint: boolean;
  closestPoint: LatLng | null;
  nextClosestRouteIndex: number;
  distanceToRouteMeters: number;

  didUpdateSnapActive: boolean;
  nextSnapActive: boolean;
  target: LatLng;

  offRoute: {
    shouldConsider: boolean;
    nextOffRouteSinceMs: number | null;
    shouldRecalculate: boolean;
    nowMs: number;
  };

  progress: ReturnType<typeof computeNavProgress>;

  // reserved for future debugging (kept out of MapScreen)
  dynamicEtaSource?: DynamicEtaSource;
};

export function computeNavLocationUpdate(params: {
  latitude: number;
  longitude: number;
  speedMps: number;

  routePoints: LatLng[];
  closestPointOnPolylineMeters: (
    p: LatLng,
    poly: LatLng[],
    indexHint: number,
  ) => { point: LatLng; distanceM: number; index: number };
  lastClosestRouteIndex: number;

  wasSnapActive: boolean;

  nowMs: number;
  destination: MapDestination | null;
  offRouteSinceMs: number | null;
  isRecalcInFlight: boolean;
  lastRecalcAtMs: number;

  stops: MapStop[];
  currentStopIndex: number;
  isInArrivalZone: boolean;
  navigationSteps: GoogleDirectionsStep[];
  currentStepIndex: number;
}): NavLocationUpdateOutcome {
  const {
    latitude,
    longitude,
    speedMps,
    routePoints,
    closestPointOnPolylineMeters,
    lastClosestRouteIndex,
    wasSnapActive,
    nowMs,
    destination,
    offRouteSinceMs,
    isRecalcInFlight,
    lastRecalcAtMs,
    stops,
    currentStopIndex,
    isInArrivalZone,
    navigationSteps,
    currentStepIndex,
  } = params;

  const raw: LatLng = { latitude, longitude };

  let didComputeClosestPoint = false;
  let closestPoint: LatLng | null = null;
  let distanceToRouteMeters = Infinity;
  let nextClosestRouteIndex = lastClosestRouteIndex;

  let didUpdateSnapActive = false;
  let nextSnapActive = wasSnapActive;
  let target: LatLng = raw;

  if (routePoints.length >= 2) {
    const closest = closestPointOnPolylineMeters(
      raw,
      routePoints,
      lastClosestRouteIndex,
    );

    didComputeClosestPoint = true;
    closestPoint = closest.point;
    distanceToRouteMeters = closest.distanceM;
    nextClosestRouteIndex = closest.index;

    didUpdateSnapActive = true;
    nextSnapActive = computeNextSnapActive({
      wasSnapActive,
      distanceToRouteMeters,
      speedMps,
    });

    target = nextSnapActive ? closest.point : raw;
  }

  const shouldConsiderOffRoute =
    routePoints.length >= 2 && Number.isFinite(distanceToRouteMeters);

  const offRouteDecision = shouldConsiderOffRoute
    ? decideOffRouteRecalc({
        hasDestination: !!destination,
        distanceToRouteMeters,
        nowMs,
        offRouteSinceMs,
        isRecalcInFlight,
        lastRecalcAtMs,
      })
    : { nextOffRouteSinceMs: null, shouldRecalculate: false };

  const progress = computeNavProgress({
    position: raw,
    stops,
    currentStopIndex,
    destination,
    isInArrivalZone,
    navigationSteps,
    currentStepIndex,
  });

  return {
    raw,
    speedMps,
    didComputeClosestPoint,
    closestPoint,
    nextClosestRouteIndex,
    distanceToRouteMeters,
    didUpdateSnapActive,
    nextSnapActive,
    target,
    offRoute: {
      shouldConsider: shouldConsiderOffRoute,
      nextOffRouteSinceMs: offRouteDecision.nextOffRouteSinceMs,
      shouldRecalculate: offRouteDecision.shouldRecalculate,
      nowMs,
    },
    progress,
  };
}
