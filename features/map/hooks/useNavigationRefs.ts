import { useRef } from "react";
import type { AnimatedRegion } from "react-native-maps";

import type { DynamicEtaSource } from "@/utils/navigation/eta";

type LatLng = { latitude: number; longitude: number };

type NavCameraState = {
  center: LatLng;
  heading: number;
  pitch: number;
  zoom: number;
};

type PendingNavCameraFix = {
  latitude: number;
  longitude: number;
  speedMps: number;
};

export function useNavigationRefs() {
  // Camera follow needs live values inside an animation loop (refs), because
  // navCurrent is updated via RAF without triggering React renders.
  const navCameraRafIdRef = useRef<number | null>(null);

  // Google-style smoothing for the navigation marker:
  // GPS updates set a target, and a 60fps render loop smoothly moves the marker.
  const navTarget = useRef<LatLng | null>(null);
  const navCurrent = useRef<LatLng | null>(null);
  const navSpeedRef = useRef<number>(0);
  const navLatestSpeedMpsRef = useRef<number>(0);
  const navRafId = useRef<number | null>(null);
  const navLastFrameTime = useRef<number>(0);
  const navMarkerRegion = useRef<AnimatedRegion | null>(null);

  // Adaptive GPS cadence for navigation (Google-like): update less when stopped,
  // more when moving, while UI stays smooth via RAF interpolation.
  const navGpsTierRef = useRef<0 | 1 | 2>(1);
  const navLastGpsResubAtRef = useRef<number>(0);
  const navGpsResubInFlightRef = useRef<boolean>(false);
  const navGpsTierIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  // Navigation camera smoothing: avoid overlapping animations and micro-jitter.
  const navCameraHoldUntilRef = useRef<number>(0);
  const navCameraCurrentRef = useRef<NavCameraState | null>(null);
  const navCameraLastFrameAtRef = useRef<number>(0);
  const navCameraLastApplyAtRef = useRef<number>(0);
  const navLastCameraCenterRef = useRef<LatLng | null>(null);
  const navLastCameraBearingAppliedRef = useRef<number>(0);
  const navLastCameraPitchAppliedRef = useRef<number>(0);
  const navLastCameraZoomAppliedRef = useRef<number>(17.2);

  // Ensure we can apply an immediate "enter navigation" camera move even if the map isn't ready yet.
  const pendingNavCameraFixRef = useRef<PendingNavCameraFix | null>(null);
  const didApplyNavCameraFixRef = useRef(false);

  // Map-matching ("Google-like" feel)
  const lastClosestRouteIndexRef = useRef<number>(0);
  const navSnapActiveRef = useRef<boolean>(false);

  // Directions API call guards (reduce quota burn when "off route")
  const offRouteSinceRef = useRef<number | null>(null);
  const lastRouteRecalcAtRef = useRef<number>(0);
  const routeRecalcInFlightRef = useRef<boolean>(false);

  // Route polyline metrics + dynamic ETA refs
  const routeTotalDurationSecRef = useRef<number>(0);
  const routePolylineCumulativeMetersRef = useRef<number[]>([]);
  const routePolylineTotalMetersRef = useRef<number>(0);

  const lastDynamicEtaMinutesRef = useRef<number | null>(null);
  const dynamicEtaSecondsRef = useRef<number | null>(null);
  const dynamicRemainingRouteMetersRef = useRef<number | null>(null);
  const dynamicEtaSourceRef = useRef<DynamicEtaSource>("none");

  return {
    navCameraRafIdRef,

    navTarget,
    navCurrent,
    navSpeedRef,
    navLatestSpeedMpsRef,
    navRafId,
    navLastFrameTime,
    navMarkerRegion,

    navGpsTierRef,
    navLastGpsResubAtRef,
    navGpsResubInFlightRef,
    navGpsTierIntervalRef,

    navCameraHoldUntilRef,
    navCameraCurrentRef,
    navCameraLastFrameAtRef,
    navCameraLastApplyAtRef,
    navLastCameraCenterRef,
    navLastCameraBearingAppliedRef,
    navLastCameraPitchAppliedRef,
    navLastCameraZoomAppliedRef,

    pendingNavCameraFixRef,
    didApplyNavCameraFixRef,

    lastClosestRouteIndexRef,
    navSnapActiveRef,

    offRouteSinceRef,
    lastRouteRecalcAtRef,
    routeRecalcInFlightRef,

    routeTotalDurationSecRef,
    routePolylineCumulativeMetersRef,
    routePolylineTotalMetersRef,

    lastDynamicEtaMinutesRef,
    dynamicEtaSecondsRef,
    dynamicRemainingRouteMetersRef,
    dynamicEtaSourceRef,
  };
}
