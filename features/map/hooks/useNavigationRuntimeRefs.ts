import type * as Location from "expo-location";
import { useRef } from "react";

import type { GoogleDirectionsStep } from "@/types/googleDirections";

type RoutePoint = { latitude: number; longitude: number; timestamp: number };

type RemoveableSubscription = { remove: () => void };

export function useNavigationRuntimeRefs() {
  const navigationSteps = useRef<GoogleDirectionsStep[]>([]);
  const currentStepIndex = useRef(0);

  const locationSubscription = useRef<Location.LocationSubscription | null>(
    null,
  );
  const headingSubscription = useRef<Location.LocationSubscription | null>(
    null,
  );

  const gyroSubscription = useRef<RemoveableSubscription | null>(null);
  const magnetometerSubscription = useRef<RemoveableSubscription | null>(null);

  const durationInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const routePoints = useRef<RoutePoint[]>([]);

  const currentHeading = useRef(0);
  const calibrationSamples = useRef<number[]>([]);
  const isCalibrated = useRef(false);

  return {
    navigationSteps,
    currentStepIndex,
    locationSubscription,
    headingSubscription,
    gyroSubscription,
    magnetometerSubscription,
    durationInterval,
    routePoints,
    currentHeading,
    calibrationSamples,
    isCalibrated,
  };
}
