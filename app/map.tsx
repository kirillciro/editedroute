import Constants from "expo-constants";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import * as Location from "expo-location";
import { router } from "expo-router";
import { Gyroscope, Magnetometer } from "expo-sensors";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState, Keyboard, Platform, View } from "react-native";
import type {
  GooglePlaceData,
  GooglePlaceDetail,
} from "react-native-google-places-autocomplete";
import MapView, { AnimatedRegion } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MapCanvas } from "@/components/map/MapCanvas";
import { MapOverlayStack } from "@/components/map/MapOverlayStack";
import { styles } from "@/components/map/mapScreen.styles";
import type { GoogleDirectionsStep } from "@/types/googleDirections";
import type { MapDestination, MapStop, UserLocation } from "@/types/mapRoute";
import type {
  CameraApplyMode,
  CameraTuningPreset,
  MapLayerType,
  NavViewMode,
} from "@/types/mapUi";
import {
  closestPointOnPolylineMeters as closestPointOnPolylineMetersFn,
  distanceMetersBetween as distanceMetersBetweenFn,
} from "@/utils/geo/geometry";
import { computePolylineCumulativeMeters } from "@/utils/geo/polylineCumulative";
import { applyLocationToMap } from "@/utils/location/applyLocationToMap";
import { centerMapOnUserOnce } from "@/utils/location/centerOnUserOnce";
import { getMyLocationOnce } from "@/utils/location/myLocation";
import {
  computeNavLookAheadMeters,
  offsetCoordinate,
} from "@/utils/navigation/camera";
import { computeNextCameraBearingDeg } from "@/utils/navigation/cameraBearing";
import { computeCameraPitchTargetDeg } from "@/utils/navigation/cameraPitch";
import {
  applyScalarEasing,
  computeBearingEasingFactor,
  PITCH_EASING_FACTOR,
  ZOOM_EASING_FACTOR,
} from "@/utils/navigation/cameraSmoothing";
import {
  navCameraTuningForPreset,
  type NavCameraTuning,
} from "@/utils/navigation/cameraTuning";
import {
  computeDynamicEtaSeconds,
  formatEtaFromSeconds,
  type DynamicEtaSource,
} from "@/utils/navigation/eta";
import { startHeadingTracking } from "@/utils/navigation/headingTracking";
import type { LaneHint } from "@/utils/navigation/instructions";
import { applyMapCamera } from "@/utils/navigation/mapCameraApply";
import { fitMapToCoordinates } from "@/utils/navigation/mapFit";
import { smoothHeadingValue } from "@/utils/navigation/math";
import {
  computeNavCameraApplyDecision,
  computeNavCameraDtSeconds,
} from "@/utils/navigation/navCameraLoop";
import { smoothNavCameraPosition } from "@/utils/navigation/navCameraSmoothing";
import { computeNavCameraTargets } from "@/utils/navigation/navCameraTargets";
import { cleanupNavigationResources } from "@/utils/navigation/navCleanup";
import {
  pickNavBaseCoordinate,
  userLocationToLatLng,
} from "@/utils/navigation/navCoordinate";
import { startAdaptiveNavGpsWatch } from "@/utils/navigation/navGpsWatch";
import { runInitialNavCameraFixes } from "@/utils/navigation/navInitialCameraFix";
import {
  computeNavLocationUpdate,
  type NavLocationUpdateOutcome,
} from "@/utils/navigation/navLocationUpdate";
import { computeNextNavMarkerPosition } from "@/utils/navigation/navMarkerSmoothing";
import { seedNavAndCamera } from "@/utils/navigation/navSeed";
import { computeRemainingRouteMetersOnPolyline } from "@/utils/navigation/remainingRoute";
import { orchestrateRouteRequest } from "@/utils/navigation/routeOrchestrator";
import { computeTurnByTurnUiFromSteps } from "@/utils/navigation/turnByTurnUi";
import { computeNavZoomTarget } from "@/utils/navigation/zoom";

/**
 * Google Maps-style main screen
 * Stage 6: Full navigation with turn-by-turn, speed limits, highway guidance
 */
export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const searchRef = useRef<any>(null);
  const insets = useSafeAreaInsets();

  const googleMapsApiKey =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    (Platform.OS === "ios"
      ? // Prefer the native iOS config key (also ends up as GMSApiKey in Info.plist)
        ((Constants.expoConfig as any)?.ios?.config?.googleMapsApiKey as
          | string
          | undefined)
      : ((Constants.expoConfig as any)?.android?.config?.googleMaps?.apiKey as
          | string
          | undefined)) ||
    ((Constants.expoConfig as any)?.extra?.googleMapsApiKey as
      | string
      | undefined) ||
    "";

  const [mapReady, setMapReady] = useState(false);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [destination, setDestination] = useState<MapDestination | null>(null);
  const destinationRef = useRef<MapDestination | null>(null);
  const [stops, setStops] = useState<MapStop[]>([]);
  const [showStopsPanel, setShowStopsPanel] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState<
    { latitude: number; longitude: number }[]
  >([]);
  const routeCoordinatesRef = useRef<{ latitude: number; longitude: number }[]>(
    [],
  );
  const [currentInstruction, setCurrentInstruction] = useState<string>("");
  const [currentManeuver, setCurrentManeuver] = useState<string | null>(null);
  const [nextInstruction, setNextInstruction] = useState<string>("");
  const [nextManeuver, setNextManeuver] = useState<string | null>(null);
  const [laneHint, setLaneHint] = useState<LaneHint>(null);
  const [distanceToNextTurn, setDistanceToNextTurn] = useState<number>(0);
  const [speedLimit] = useState<number>(0);
  const [eta, setEta] = useState<string>("");
  const [isNavigating, setIsNavigating] = useState(false);
  const [isSensorsActive, setIsSensorsActive] = useState(false);
  const [heading, setHeading] = useState(0); // Legacy - kept for compatibility
  const [rawHeading, setRawHeading] = useState(0); // STAGE 4.1: Raw sensor value
  const [smoothedHeading, setSmoothedHeading] = useState(0); // STAGE 4.1: Interpolated value
  const [cameraBearing, setCameraBearing] = useState(0); // STAGE 4.2: Camera rotation
  const [cameraPitch, setCameraPitch] = useState(0); // STAGE 4.3: Camera tilt angle
  // Google Maps camera zoom LEVEL (not region delta). Typical navigation zooms are ~15..19.
  const [cameraZoom, setCameraZoom] = useState(17.2);

  // Google Maps-style layers & overlays
  const [mapType, setMapType] = useState<MapLayerType>("standard");
  const [showsTraffic, setShowsTraffic] = useState(false);
  const [showsBuildings, setShowsBuildings] = useState(true);
  const [showsIndoors, setShowsIndoors] = useState(false);
  const [showsCompass, setShowsCompass] = useState(true);

  const cycleMapType = () => {
    const cycle: MapLayerType[] =
      Platform.OS === "android"
        ? ["standard", "satellite", "hybrid", "terrain"]
        : ["standard", "satellite", "hybrid"];
    const idx = Math.max(0, cycle.indexOf(mapType));
    setMapType(cycle[(idx + 1) % cycle.length]);
  };

  const [showCameraDebug, setShowCameraDebug] = useState(false);
  // NOTE: __DEV__ is false in archives/TestFlight builds, so we support an
  // on-device unlock gesture to enable debug UI.
  const [cameraDebugUnlocked, setCameraDebugUnlocked] = useState(__DEV__);
  const [cameraApplyMode, setCameraApplyMode] =
    useState<CameraApplyMode>("animate160");
  const cameraApplyModeRef = useRef<CameraApplyMode>("animate160");
  useEffect(() => {
    cameraApplyModeRef.current = cameraApplyMode;
  }, [cameraApplyMode]);

  const unlockCameraDebug = () => {
    setCameraDebugUnlocked(true);
    setShowCameraDebug(true);
  };

  const [cameraTuningPreset, setCameraTuningPreset] =
    useState<CameraTuningPreset>("balanced");
  const navCameraTuningRef = useRef<NavCameraTuning>(
    navCameraTuningForPreset("balanced"),
  );
  useEffect(() => {
    navCameraTuningRef.current = navCameraTuningForPreset(cameraTuningPreset);
  }, [cameraTuningPreset]);

  const [cameraDebugSnapshot, setCameraDebugSnapshot] = useState<{
    now: number;
    mode: CameraApplyMode;
    preset: CameraTuningPreset;
    hasSetCamera: boolean;
    hasAnimateCamera: boolean;
    navViewMode: NavViewMode;
    holdMs: number;
    speedMps: number;
    distToTurnM: number;
    remainingRouteM: number | null;
    etaSeconds: number | null;
    etaSource: string;
    zoomTarget: number;
    bearingTarget: number;
    pitchTarget: number;
    centerTarget?: { latitude: number; longitude: number };
    centerApplied?: { latitude: number; longitude: number };
    zoomApplied?: number;
    headingApplied?: number;
    pitchApplied?: number;
    mapType?: MapLayerType;
    showsTraffic?: boolean;
    showsBuildings?: boolean;
    showsIndoors?: boolean;
    showsCompass?: boolean;
  } | null>(null);

  // Google-like navigation camera modes:
  // - follow: camera follows marker + heading
  // - free: user explored the map, camera stops following until recenter
  // - overview: fit route overview (still not following)
  const [navViewMode, setNavViewMode] = useState<NavViewMode>("follow");
  const navViewModeRef = useRef<NavViewMode>("follow");
  useEffect(() => {
    navViewModeRef.current = navViewMode;
  }, [navViewMode]);

  const setNavViewModeImmediate = useCallback((mode: NavViewMode) => {
    navViewModeRef.current = mode;
    setNavViewMode(mode);
  }, []);

  useEffect(() => {
    if (!cameraDebugUnlocked) return;
    if (!showCameraDebug) return;

    const id = setInterval(() => {
      const now = Date.now();
      const mapAny = mapRef.current as any;
      const cur = navCameraCurrentRef.current;
      setCameraDebugSnapshot({
        now,
        mode: cameraApplyModeRef.current,
        preset: cameraTuningPreset,
        hasSetCamera: !!mapAny?.setCamera,
        hasAnimateCamera: !!mapAny?.animateCamera,
        navViewMode,
        holdMs: Math.max(0, navCameraHoldUntilRef.current - now),
        speedMps: navSpeedRef.current || userLocationRef.current?.speed || 0,
        distToTurnM: distanceToNextTurnRef.current || 0,
        remainingRouteM: dynamicRemainingRouteMetersRef.current,
        etaSeconds: dynamicEtaSecondsRef.current,
        etaSource: dynamicEtaSourceRef.current,
        zoomTarget: cameraZoomRef.current || 0,
        bearingTarget: cameraBearingRef.current || 0,
        pitchTarget: cameraPitchRef.current || 0,
        centerTarget: navTarget.current || undefined,
        centerApplied: cur?.center,
        zoomApplied: cur?.zoom,
        headingApplied: cur?.heading,
        pitchApplied: cur?.pitch,
        mapType,
        showsTraffic,
        showsBuildings,
        showsIndoors,
        showsCompass,
      });
    }, 250);

    return () => clearInterval(id);
  }, [
    cameraDebugUnlocked,
    showCameraDebug,
    navViewMode,
    cameraTuningPreset,
    mapType,
    showsTraffic,
    showsBuildings,
    showsIndoors,
    showsCompass,
  ]);
  const [currentStopIndex, setCurrentStopIndex] = useState<number>(-1); // STAGE 5.1: Track current stop (-1 = none)
  const [isInArrivalZone, setIsInArrivalZone] = useState(false); // STAGE 5.2: Within 10-20m of destination
  const [appState, setAppState] = useState(AppState.currentState); // STAGE 9.1: Track app state

  // Prevent the OS from dimming/locking the screen during turn-by-turn navigation.
  // This avoids the “screen goes dark after a few minutes” behavior while driving.
  const keepAwakeActiveRef = useRef(false);
  useEffect(() => {
    const tag = "EditedRouteNavigation";
    const shouldKeepAwake = isNavigating && appState === "active";
    if (shouldKeepAwake === keepAwakeActiveRef.current) return;
    keepAwakeActiveRef.current = shouldKeepAwake;
    if (shouldKeepAwake) {
      activateKeepAwakeAsync(tag).catch(() => undefined);
    } else {
      deactivateKeepAwake(tag).catch(() => undefined);
    }
  }, [isNavigating, appState]);

  useEffect(() => {
    const tag = "EditedRouteNavigation";
    return () => {
      deactivateKeepAwake(tag).catch(() => undefined);
    };
  }, []);
  const [distance, setDistance] = useState(0);
  const [duration, setDuration] = useState(0);
  const navigationSteps = useRef<GoogleDirectionsStep[]>([]);
  const currentStepIndex = useRef(0);
  const locationSubscription = useRef<Location.LocationSubscription | null>(
    null,
  );
  const headingSubscription = useRef<Location.LocationSubscription | null>(
    null,
  );
  const gyroSubscription = useRef<{ remove: () => void } | null>(null);
  const magnetometerSubscription = useRef<{ remove: () => void } | null>(null);
  const durationInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const routePoints = useRef<
    { latitude: number; longitude: number; timestamp: number }[]
  >([]);
  const currentHeading = useRef(0);
  const calibrationSamples = useRef<number[]>([]);
  const isCalibrated = useRef(false);

  // Camera follow needs live values inside an animation loop (refs), because
  // navCurrent is updated via RAF without triggering React renders.
  const navCameraRafIdRef = useRef<number | null>(null);
  const cameraBearingRef = useRef<number>(0);
  const cameraPitchRef = useRef<number>(0);
  const cameraZoomRef = useRef<number>(17.2);
  const isInArrivalZoneRef = useRef<boolean>(false);
  const userLocationRef = useRef<{
    latitude: number;
    longitude: number;
    speed?: number;
  } | null>(null);
  const distanceToNextTurnRef = useRef<number>(0);

  useEffect(() => {
    cameraBearingRef.current = cameraBearing;
  }, [cameraBearing]);

  useEffect(() => {
    cameraPitchRef.current = cameraPitch;
  }, [cameraPitch]);

  useEffect(() => {
    cameraZoomRef.current = cameraZoom;
  }, [cameraZoom]);

  useEffect(() => {
    isInArrivalZoneRef.current = isInArrivalZone;
  }, [isInArrivalZone]);

  useEffect(() => {
    userLocationRef.current = userLocation;
  }, [userLocation]);

  useEffect(() => {
    distanceToNextTurnRef.current = distanceToNextTurn;
  }, [distanceToNextTurn]);

  const applyTurnByTurnUiFromIndex = (idx: number) => {
    const ui = computeTurnByTurnUiFromSteps({
      steps: navigationSteps.current,
      index: idx,
    });
    if (!ui) return;

    setCurrentInstruction(ui.currentInstruction);
    setCurrentManeuver(ui.currentManeuver);
    setLaneHint(ui.laneHint);
    if (ui.distanceToNextTurnMeters != null) {
      setDistanceToNextTurn(ui.distanceToNextTurnMeters);
    }
    setNextInstruction(ui.nextInstruction);
    setNextManeuver(ui.nextManeuver);
  };

  // Google-style smoothing for the navigation marker:
  // GPS updates set a target, and a 60fps render loop smoothly moves the marker.
  const navTarget = useRef<{ latitude: number; longitude: number } | null>(
    null,
  );
  const navCurrent = useRef<{ latitude: number; longitude: number } | null>(
    null,
  );
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
  const navCameraCurrentRef = useRef<{
    center: { latitude: number; longitude: number };
    heading: number;
    pitch: number;
    zoom: number;
  } | null>(null);
  const navCameraLastFrameAtRef = useRef<number>(0);
  const navCameraLastApplyAtRef = useRef<number>(0);
  const navLastCameraCenterRef = useRef<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const navLastCameraBearingAppliedRef = useRef<number>(0);
  const navLastCameraPitchAppliedRef = useRef<number>(0);
  const navLastCameraZoomAppliedRef = useRef<number>(17.2);

  // Directions API call guards (reduce quota burn when "off route")
  const offRouteSinceRef = useRef<number | null>(null);
  const lastRouteRecalcAtRef = useRef<number>(0);
  const routeRecalcInFlightRef = useRef<boolean>(false);

  // Global Directions API guards (reduce overall quota burn)
  const routeRequestInFlightRef = useRef<boolean>(false);
  const pendingRouteRequestRef = useRef<{
    destLat: number;
    destLng: number;
    retryCount: number;
    options?: {
      origin?: { latitude: number; longitude: number };
      silent?: boolean;
      fit?: boolean;
    };
  } | null>(null);
  const directionsCooldownUntilRef = useRef<number>(0);
  const lastOverQueryAlertAtRef = useRef<number>(0);
  const routeTotalDurationSecRef = useRef<number>(0);
  const routePolylineCumulativeMetersRef = useRef<number[]>([]);
  const routePolylineTotalMetersRef = useRef<number>(0);
  const lastDynamicEtaMinutesRef = useRef<number | null>(null);
  const dynamicEtaSecondsRef = useRef<number | null>(null);
  const dynamicRemainingRouteMetersRef = useRef<number | null>(null);
  const dynamicEtaSourceRef = useRef<DynamicEtaSource>("none");
  const directionsCacheRef = useRef<
    Map<
      string,
      {
        ts: number;
        points: { latitude: number; longitude: number }[];
        steps: any[];
        eta: string;
        totalDurationSec: number;
      }
    >
  >(new Map());

  // Ensure we can apply an immediate "enter navigation" camera move even if the map isn't ready yet.
  const pendingNavCameraFixRef = useRef<{
    latitude: number;
    longitude: number;
    speedMps: number;
  } | null>(null);
  const didApplyNavCameraFixRef = useRef(false);

  // Map-matching ("Google-like" feel)
  const lastClosestRouteIndexRef = useRef<number>(0);
  const navSnapActiveRef = useRef<boolean>(false);

  useEffect(() => {
    destinationRef.current = destination;
  }, [destination]);

  const NAV_RENDER_TAU_SECONDS = 0.12; // lower = snappier, higher = smoother

  const distanceMetersBetween = useCallback(distanceMetersBetweenFn, []);

  useEffect(() => {
    routeCoordinatesRef.current = routeCoordinates;
    // Reset hint when route changes significantly
    lastClosestRouteIndexRef.current = 0;

    // Precompute cumulative distance along the polyline for fast remaining-distance queries.
    const cumulative = computePolylineCumulativeMeters(routeCoordinates);
    routePolylineCumulativeMetersRef.current = cumulative.cumulativeMeters;
    routePolylineTotalMetersRef.current = cumulative.totalMeters;
  }, [routeCoordinates]);

  useEffect(() => {
    if (!isNavigating || !mapReady || !mapRef.current) return;
    if (didApplyNavCameraFixRef.current) return;
    const pending = pendingNavCameraFixRef.current;
    if (!pending) return;

    const lookAheadCenter = offsetCoordinate(
      { latitude: pending.latitude, longitude: pending.longitude },
      cameraBearing || smoothedHeading,
      computeNavLookAheadMeters(
        pending.speedMps,
        distanceToNextTurnRef.current,
      ),
    );

    const durationMs = 650;

    // Hold the follow loop while this animation plays to prevent camera fights.
    navCameraHoldUntilRef.current = Date.now() + durationMs + 150;

    const bearing = cameraBearing || smoothedHeading;
    const zoom = cameraZoomRef.current || 17.2;

    // Google Maps-style: animate a single CameraPosition (center + bearing + tilt + zoom).
    applyMapCamera({
      mapAny: mapRef.current as any,
      mode: cameraApplyModeRef.current,
      camera: {
        center: lookAheadCenter,
        heading: bearing,
        pitch: 45,
        zoom,
      },
      durationMs,
      nowMs: Date.now(),
    });

    // Seed last-known applied state so the follow loop doesn't immediately "snap back".
    navLastCameraCenterRef.current = lookAheadCenter;
    navLastCameraBearingAppliedRef.current = bearing;
    navLastCameraPitchAppliedRef.current = 45;
    navLastCameraZoomAppliedRef.current = zoom;
    navCameraCurrentRef.current = {
      center: lookAheadCenter,
      heading: bearing,
      pitch: 45,
      zoom,
    };
    navCameraLastFrameAtRef.current = 0;

    didApplyNavCameraFixRef.current = true;
    pendingNavCameraFixRef.current = null;
  }, [isNavigating, mapReady, cameraBearing, smoothedHeading]);

  const stopNavRenderLoop = () => {
    if (navRafId.current != null) {
      cancelAnimationFrame(navRafId.current);
      navRafId.current = null;
    }
    navLastFrameTime.current = 0;
  };

  const startNavRenderLoop = () => {
    if (navRafId.current != null) return;

    const tick = (now: number) => {
      if (!isNavigating || appState !== "active") {
        stopNavRenderLoop();
        return;
      }

      const target = navTarget.current;
      const current = navCurrent.current;
      const region = navMarkerRegion.current;

      if (target && current && region) {
        const res = computeNextNavMarkerPosition({
          nowMs: now,
          lastFrameAtMs: navLastFrameTime.current,
          tauSeconds: NAV_RENDER_TAU_SECONDS,
          current,
          target,
          headingDeg: smoothedHeading,
          speedMps: navSpeedRef.current,
        });

        navLastFrameTime.current = res.nextLastFrameAtMs;
        navCurrent.current = res.next;
        region.setValue({
          latitude: res.next.latitude,
          longitude: res.next.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        });
      } else {
        navLastFrameTime.current = now;
      }

      navRafId.current = requestAnimationFrame(tick);
    };

    navRafId.current = requestAnimationFrame(tick);
  };

  // Start/stop the marker render loop with navigation + app state
  useEffect(() => {
    if (isNavigating && appState === "active") {
      startNavRenderLoop();
      return;
    }
    stopNavRenderLoop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNavigating, appState]);

  // Stage 1: Static map center (Toronto for now)
  const initialRegion = {
    latitude: 43.6532,
    longitude: -79.3832,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  const closestPointOnPolylineMeters = useCallback(
    closestPointOnPolylineMetersFn,
    [],
  );

  const computeRemainingRouteMeters = useCallback(
    (p: { latitude: number; longitude: number }): number | null => {
      const polyline = routeCoordinatesRef.current;
      const cumulativeMeters = routePolylineCumulativeMetersRef.current;
      const totalMeters = routePolylineTotalMetersRef.current;

      const res = computeRemainingRouteMetersOnPolyline({
        position: p,
        polyline,
        cumulativeMeters,
        totalMeters,
        lastClosestIndex: lastClosestRouteIndexRef.current,
        closestPointOnPolylineMeters,
      });
      lastClosestRouteIndexRef.current = res.nextClosestIndex;
      return res.remainingMeters;
    },
    [closestPointOnPolylineMeters],
  );

  // Dynamic ETA: update during navigation based on remaining route distance + real speed.
  // This mimics Google Maps behavior (31 → 30 → 29 min as you progress).
  useEffect(() => {
    if (!isNavigating || appState !== "active") {
      dynamicEtaSecondsRef.current = null;
      dynamicRemainingRouteMetersRef.current = null;
      dynamicEtaSourceRef.current = "none";
      return;
    }

    const id = setInterval(() => {
      const loc = userLocationRef.current;
      if (!loc) return;

      const remainingM = computeRemainingRouteMeters({
        latitude: loc.latitude,
        longitude: loc.longitude,
      });
      dynamicRemainingRouteMetersRef.current = remainingM;
      if (remainingM == null) {
        dynamicEtaSecondsRef.current = null;
        dynamicEtaSourceRef.current = "none";
        return;
      }

      const speedMpsRaw = loc.speed ?? 0;
      const speedMps =
        Number.isFinite(speedMpsRaw) && speedMpsRaw > 0 ? speedMpsRaw : 0;

      const computed = computeDynamicEtaSeconds({
        remainingRouteMeters: remainingM,
        speedMps,
        routeTotalDurationSec: routeTotalDurationSecRef.current,
        routeTotalMeters: routePolylineTotalMetersRef.current,
      });
      dynamicEtaSecondsRef.current = computed.etaSeconds;
      dynamicEtaSourceRef.current = computed.source;
      if (
        computed.etaSeconds == null ||
        !Number.isFinite(computed.etaSeconds)
      ) {
        dynamicEtaSourceRef.current = "none";
        return;
      }
      const minutes = Math.max(1, Math.round(computed.etaSeconds / 60));
      if (lastDynamicEtaMinutesRef.current === minutes) return;
      lastDynamicEtaMinutesRef.current = minutes;
      setEta(formatEtaFromSeconds(minutes * 60));
    }, 1000);

    return () => clearInterval(id);
  }, [isNavigating, appState, computeRemainingRouteMeters]);

  // STAGE 4.1: Smooth heading interpolation with frame-based updates
  useEffect(() => {
    if (!isSensorsActive || appState !== "active") return; // STAGE 9.1: Pause when backgrounded

    const intervalId = setInterval(() => {
      setSmoothedHeading((prev) => smoothHeadingValue(rawHeading, prev));
    }, 16); // 60 FPS

    return () => clearInterval(intervalId);
  }, [rawHeading, isSensorsActive, appState]);

  // STAGE 4.2: Camera bearing smoothing with speed-based easing
  useEffect(() => {
    if (!isNavigating || appState !== "active") return; // STAGE 9.1: Pause when backgrounded

    const easingFactor = computeBearingEasingFactor(userLocation?.speed || 0);

    const intervalId = setInterval(() => {
      setCameraBearing((prev) => {
        return computeNextCameraBearingDeg({
          currentDeg: prev,
          targetDeg: smoothedHeading,
          easingFactor,
        });
      });
    }, 50); // 20 FPS for camera (smoother, less battery intensive)

    return () => clearInterval(intervalId);
  }, [smoothedHeading, isNavigating, userLocation?.speed, appState]);

  // STAGE 4.3: Dynamic camera pitch based on speed
  useEffect(() => {
    if (!isNavigating || appState !== "active") {
      // STAGE 9.1: Pause when backgrounded
      setCameraPitch(0); // Reset to 0 when not navigating or backgrounded
      return;
    }

    const targetPitch = computeCameraPitchTargetDeg(userLocation?.speed || 0);

    // Smooth transition to target pitch
    const intervalId = setInterval(() => {
      setCameraPitch((prev) => {
        return applyScalarEasing(prev, targetPitch, PITCH_EASING_FACTOR);
      });
    }, 50); // 20 FPS

    return () => clearInterval(intervalId);
  }, [isNavigating, userLocation?.speed, appState]);

  // Heading-up camera follow should run continuously during navigation.
  // IMPORTANT: navCurrent updates via RAF (no React renders), so the camera must
  // also be driven by a loop, not a dependency-based useEffect.
  useEffect(() => {
    if (!isNavigating || appState !== "active") return;
    if (!mapReady || !mapRef.current) return;

    // Google Maps-style camera controller:
    // - compute a target CameraPosition
    // - smooth it every frame
    // - apply via setCamera (no overlapping animations)
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;

      // If the user is exploring the map (free/overview), pause camera follow.
      if (navViewModeRef.current !== "follow") {
        navCameraRafIdRef.current = requestAnimationFrame(tick);
        return;
      }

      // During explicit snaps/recenters, avoid fighting the ongoing animation.
      if (Date.now() < navCameraHoldUntilRef.current) {
        // Reset frame timing so we don't get a big dt spike after a hold.
        navCameraLastFrameAtRef.current = 0;
        navCameraRafIdRef.current = requestAnimationFrame(tick);
        return;
      }

      const now = Date.now();
      const tuning = navCameraTuningRef.current;
      const APPLY_MIN_INTERVAL_MS = tuning.applyMinIntervalMs;
      const TAU_CENTER_S = tuning.tauCenterS;
      const TAU_HEADING_S = tuning.tauHeadingS;
      const TAU_PITCH_S = tuning.tauPitchS;
      const TAU_ZOOM_S = tuning.tauZoomS;
      const CENTER_DEADBAND_M = tuning.centerDeadbandM;
      const BEARING_DEADBAND_DEG = tuning.bearingDeadbandDeg;
      const PITCH_DEADBAND_DEG = tuning.pitchDeadbandDeg;
      const ZOOM_DEADBAND = tuning.zoomDeadband;
      const destNow = destinationRef.current;
      const inArrival = isInArrivalZoneRef.current && destNow;

      const base = inArrival
        ? { latitude: destNow!.latitude, longitude: destNow!.longitude }
        : pickNavBaseCoordinate({
            navCurrent: navCurrent.current,
            navTarget: navTarget.current,
            userLocation: userLocationRef.current,
          });

      if (base) {
        const bearingTarget = cameraBearingRef.current;
        const speedMps = inArrival
          ? 0
          : navSpeedRef.current || userLocationRef.current?.speed || 0;

        const { centerTarget, pitchTarget, zoomTarget } =
          computeNavCameraTargets({
            base,
            bearingDeg: bearingTarget,
            speedMps,
            distanceToNextTurnMeters: distanceToNextTurnRef.current,
            inArrival: !!inArrival,
            cameraPitchDeg: cameraPitchRef.current,
            cameraZoom: cameraZoomRef.current || 17.2,
          });

        const frame = computeNavCameraDtSeconds({
          nowMs: now,
          lastFrameAtMs: navCameraLastFrameAtRef.current,
        });
        navCameraLastFrameAtRef.current = frame.nextLastFrameAtMs;

        navCameraCurrentRef.current = smoothNavCameraPosition({
          current: navCameraCurrentRef.current,
          centerTarget,
          headingTarget: bearingTarget,
          pitchTarget,
          zoomTarget,
          dtS: frame.dtS,
          tauCenterS: TAU_CENTER_S,
          tauHeadingS: TAU_HEADING_S,
          tauPitchS: TAU_PITCH_S,
          tauZoomS: TAU_ZOOM_S,
        });

        const curNow = navCameraCurrentRef.current;
        if (curNow) {
          const decision = computeNavCameraApplyDecision({
            nowMs: now,
            lastApplyAtMs: navCameraLastApplyAtRef.current,
            applyMinIntervalMs: APPLY_MIN_INTERVAL_MS,
            nextCamera: curNow,
            lastAppliedCenter: navLastCameraCenterRef.current,
            lastAppliedHeadingDeg: navLastCameraBearingAppliedRef.current,
            lastAppliedPitchDeg: navLastCameraPitchAppliedRef.current,
            lastAppliedZoom: navLastCameraZoomAppliedRef.current,
            centerDeadbandM: CENTER_DEADBAND_M,
            bearingDeadbandDeg: BEARING_DEADBAND_DEG,
            pitchDeadbandDeg: PITCH_DEADBAND_DEG,
            zoomDeadband: ZOOM_DEADBAND,
          });

          if (decision.shouldApply) {
            navCameraLastApplyAtRef.current = now;
            const mapAny = mapRef.current as any;

            applyMapCamera({
              mapAny,
              mode: cameraApplyModeRef.current,
              camera: {
                center: curNow.center,
                heading: curNow.heading,
                pitch: curNow.pitch,
                zoom: curNow.zoom,
              },
              durationMs: 0,
              nowMs: now,
              onHoldUntilMs: (holdUntil) => {
                navCameraHoldUntilRef.current = holdUntil;
              },
            });

            navLastCameraCenterRef.current = curNow.center;
            navLastCameraBearingAppliedRef.current = curNow.heading;
            navLastCameraPitchAppliedRef.current = curNow.pitch;
            navLastCameraZoomAppliedRef.current = curNow.zoom;
          }
        }
      }

      navCameraRafIdRef.current = requestAnimationFrame(tick);
    };

    navCameraRafIdRef.current = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      if (navCameraRafIdRef.current != null) {
        cancelAnimationFrame(navCameraRafIdRef.current);
        navCameraRafIdRef.current = null;
      }
    };
  }, [isNavigating, appState, mapReady]);

  const requestNavRecenter = () => {
    const base = pickNavBaseCoordinate({
      navCurrent: navCurrent.current,
      navTarget: navTarget.current,
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
  };

  const requestNavOverview = () => {
    setNavViewModeImmediate("overview");
    const points = routeCoordinatesRef.current;
    fitMapToCoordinates({
      map: mapRef.current,
      points,
      edgePadding: { top: 120, right: 70, bottom: 320, left: 70 },
      animated: true,
    });
  };

  // Dynamic camera zoom (Google Maps style): combine speed-based zoom-out and
  // distance-to-next-maneuver zoom-out, so long straight segments zoom out more.
  useEffect(() => {
    if (!isNavigating || appState !== "active") {
      setCameraZoom(16.8); // Reset when not navigating
      return;
    }

    const targetZoom = computeNavZoomTarget({
      speedMps: userLocation?.speed ?? 0,
      distanceToNextTurnMeters: distanceToNextTurn,
    });

    // Smooth transition to target zoom
    const intervalId = setInterval(() => {
      setCameraZoom((prev) => {
        return applyScalarEasing(prev, targetZoom, ZOOM_EASING_FACTOR);
      });
    }, 100); // 10 FPS for zoom (subtle changes)

    return () => clearInterval(intervalId);
  }, [isNavigating, userLocation?.speed, distanceToNextTurn, appState]);

  // Auto-center on user's current location when map loads
  useEffect(() => {
    centerMapOnUserOnce({
      map: mapRef.current,
      setUserLocation,
      accuracy: Location.Accuracy.Balanced,
      regionDelta: { latitudeDelta: 0.01, longitudeDelta: 0.01 },
      animateMs: 1000,
    });
  }, []); // Run once on mount

  // STAGE 9.1: Battery optimization - suspend updates when app is backgrounded
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (appState.match(/active/) && nextAppState === "background") {
        if (__DEV__)
          console.log("App backgrounded - suspending sensors and animations");
        // Sensors will continue but animations will pause
      } else if (appState === "background" && nextAppState === "active") {
        if (__DEV__) console.log("App foregrounded - resuming");
      }
      setAppState(nextAppState);
    });

    return () => {
      subscription.remove();
    };
  }, [appState]);

  // Calculate route with Google Directions API
  const calculateRoute = async (
    destLat: number,
    destLng: number,
    retryCount = 0,
    options?: {
      origin?: { latitude: number; longitude: number };
      silent?: boolean;
      fit?: boolean;
    },
  ) => {
    const applyRouteToState = (params: {
      points: { latitude: number; longitude: number }[];
      steps: GoogleDirectionsStep[];
      eta: string;
      totalDurationSec: number;
    }) => {
      setRouteCoordinates(params.points);
      navigationSteps.current = params.steps;
      currentStepIndex.current = 0;
      routeTotalDurationSecRef.current = params.totalDurationSec;

      if (navigationSteps.current.length > 0) {
        applyTurnByTurnUiFromIndex(0);
      }

      setEta(params.eta);
    };

    const scheduleRoute = (params: {
      destLat: number;
      destLng: number;
      retryCount: number;
      options?: {
        origin?: { latitude: number; longitude: number };
        silent?: boolean;
        fit?: boolean;
      };
      delayMs: number;
    }) => {
      setTimeout(() => {
        calculateRoute(
          params.destLat,
          params.destLng,
          params.retryCount,
          params.options,
        );
      }, params.delayMs);
    };

    const nowMs = Date.now();

    const baseUserLoc = (() => {
      if (options?.origin) return options.origin;
      const loc = userLocationRef.current ?? userLocation;
      return loc ? { latitude: loc.latitude, longitude: loc.longitude } : null;
    })();

    const { outcome, pendingToRun } = await orchestrateRouteRequest({
      apiKey: googleMapsApiKey,
      destLat,
      destLng,
      retryCount,
      options,
      userLocation: baseUserLoc,
      stops,
      routeRequestInFlightRef,
      pendingRouteRequestRef,
      directionsCooldownUntilRef,
      directionsCacheRef,
      nowMs,
    });

    if (pendingToRun) {
      // Small delay to avoid immediate bursts
      scheduleRoute({
        destLat: pendingToRun.destLat,
        destLng: pendingToRun.destLng,
        retryCount: pendingToRun.retryCount,
        options: pendingToRun.options,
        delayMs: 250,
      });
    }

    switch (outcome.kind) {
      case "missing_key": {
        if (!options?.silent) {
          Alert.alert(
            "Missing Google Maps API Key",
            "The app is missing a Google Maps API key, so directions cannot be fetched. Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY or configure ios.config.googleMapsApiKey / android.config.googleMaps.apiKey in app.json.",
          );
        }
        return;
      }
      case "missing_origin": {
        if (!options?.silent) {
          Alert.alert(
            "Location Required",
            "Please enable location services to calculate route.",
            [{ text: "OK" }],
          );
        }
        return;
      }
      case "cooldown_active": {
        if (
          !options?.silent &&
          nowMs - lastOverQueryAlertAtRef.current > 8000
        ) {
          lastOverQueryAlertAtRef.current = nowMs;
          Alert.alert(
            "Directions Limit Reached",
            "Google Directions API quota was exceeded (OVER_QUERY_LIMIT). Please wait a bit and try again.",
            [{ text: "OK" }],
          );
        }
        return;
      }
      case "cache_hit": {
        applyRouteToState({
          points: outcome.cached.points,
          steps: outcome.cached.steps,
          eta: outcome.cached.eta,
          totalDurationSec: outcome.cached.totalDurationSec || 0,
        });
        return;
      }
      case "coalesced": {
        return;
      }
      case "zero_results": {
        if (!options?.silent) {
          Alert.alert(
            "No Route Found",
            "Unable to find a route to this destination. Please try a different location.",
            [{ text: "OK" }],
          );
        }
        return;
      }
      case "over_query_limit": {
        if (
          !options?.silent &&
          nowMs - lastOverQueryAlertAtRef.current > 8000
        ) {
          lastOverQueryAlertAtRef.current = nowMs;
          Alert.alert(
            "Directions Limit Reached",
            "Too many route requests right now (OVER_QUERY_LIMIT). Please wait ~1 minute and try again.",
            [{ text: "OK" }],
          );
        }
        return;
      }
      case "status_error": {
        if (!options?.silent) {
          Alert.alert(
            "Route Error",
            `Unable to calculate route (status: ${outcome.status}).`,
            [{ text: "OK" }],
          );
        }
        return;
      }
      case "retry": {
        if (__DEV__)
          console.log(
            `Retrying route calculation... (attempt ${outcome.nextRetryCount})`,
          );
        scheduleRoute({
          destLat,
          destLng,
          retryCount: outcome.nextRetryCount,
          options,
          delayMs: outcome.delayMs,
        });
        return;
      }
      case "error": {
        console.error("Error fetching route:", outcome.error);

        if (options?.silent) {
          return;
        }

        const errAny = outcome.error as any;
        const errorMessage =
          errAny?.name === "AbortError"
            ? "Request timed out. Please check your internet connection and try again."
            : "Unable to calculate route. Please check your internet connection.";

        Alert.alert("Connection Error", errorMessage, [
          { text: "Cancel", style: "cancel" },
          {
            text: "Retry",
            onPress: () => calculateRoute(destLat, destLng, 0, options),
          },
        ]);
        return;
      }
      case "ok": {
        applyRouteToState({
          points: outcome.points,
          steps: outcome.steps,
          eta: outcome.eta,
          totalDurationSec: outcome.totalDurationSec,
        });
        break;
      }
      default: {
        return;
      }
    }

    if (options?.fit !== false) {
      fitMapToCoordinates({
        map: mapRef.current,
        points: outcome.points,
        edgePadding: { top: 100, right: 50, bottom: 300, left: 50 },
        animated: true,
      });
    }
  };

  const getLatLngFromPlaceDetails = (details: GooglePlaceDetail | null) => {
    const lat = details?.geometry?.location?.lat;
    const lng = details?.geometry?.location?.lng;
    if (typeof lat !== "number" || typeof lng !== "number") return null;
    return { lat, lng };
  };

  const getPlaceDescription = (data: GooglePlaceData): string => {
    return typeof data?.description === "string" ? data.description : "";
  };

  const recalculateRouteToDestinationIfPresent = async () => {
    const destNow = destinationRef.current;
    if (!destNow) return;
    await calculateRoute(destNow.latitude, destNow.longitude);
  };

  const resetRouteState = () => {
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
  };

  const handleMyLocation = async () => {
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
  };

  const stopNavigation = async () => {
    // Stop navigation
    try {
      cleanupNavigationResources({
        locationSubscription,
        navGpsTierIntervalRef,
        navGpsResubInFlightRef,
        headingSubscription,
        gyroSubscription,
        magnetometerSubscription,
        durationInterval,
      });

      setIsNavigating(false);
      setIsSensorsActive(false);
      setNavViewModeImmediate("follow");
      setCurrentManeuver(null);
      setNextInstruction("");
      setNextManeuver(null);

      Alert.alert(
        "Navigation Stopped",
        `Distance: ${distance.toFixed(2)} km\nDuration: ${Math.floor(duration / 60)}m ${duration % 60}s`,
      );
    } catch (error) {
      console.error("Error stopping navigation:", error);
    }
  };

  const startNavigation = async () => {
    // Start navigation - auto-start ALL features
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Location permission required");
        return;
      }

      // Flip into navigation mode immediately (UI + marker smoothing loop can start now)
      didApplyNavCameraFixRef.current = false;
      pendingNavCameraFixRef.current = null;
      setNavViewModeImmediate("follow");
      setIsNavigating(true);
      setCurrentStopIndex(stops.length > 0 ? 0 : -1);
      setIsInArrivalZone(false);

      // Set initial navigation zoom LEVEL (Google-like).
      setCameraZoom(17.2);

      // Immediately move camera into navigation view (like pressing the location button)
      // Prefer cached/last-known location first so we don't block on GPS.
      const seed = (
        coords: { latitude: number; longitude: number },
        speedMps: number,
        durationMs: number,
      ) => {
        seedNavAndCamera({
          coords,
          speedMps,
          durationMs,
          setUserLocation,
          navSpeedRef,
          navLatestSpeedMpsRef,
          navTargetRef: navTarget,
          navCurrentRef: navCurrent,
          navMarkerRegionRef: navMarkerRegion,
          cameraBearing,
          smoothedHeading,
          distanceToNextTurnMeters: distanceToNextTurnRef.current,
          mapReady,
          mapRefCurrent: mapRef.current,
          cameraZoom: cameraZoomRef.current || 17.2,
          cameraApplyMode: cameraApplyModeRef.current,
          navCameraHoldUntilRef,
          navLastCameraCenterRef,
          navLastCameraBearingAppliedRef,
          navLastCameraPitchAppliedRef,
          navLastCameraZoomAppliedRef,
          navCameraCurrentRef,
          navCameraLastFrameAtRef,
          didApplyNavCameraFixRef,
          pendingNavCameraFixRef,
        });
      };

      await runInitialNavCameraFixes({
        Location,
        seed,
        didApplyNavCameraFix: () => didApplyNavCameraFixRef.current,
        getExistingBase: () =>
          pickNavBaseCoordinate({
            navCurrent: navCurrent.current,
            navTarget: navTarget.current,
            userLocation: userLocationRef.current,
          }),
        getExistingSpeedMps: () =>
          navSpeedRef.current || userLocationRef.current?.speed || 0,
        getCurrentUserLocation: () =>
          userLocationToLatLng(userLocationRef.current),
        distanceMetersBetween,
        onSeedWithoutResnap: (coords, speedMps) => {
          setUserLocation({
            latitude: coords.latitude,
            longitude: coords.longitude,
            speed: speedMps,
          });
          navSpeedRef.current = speedMps;
          navLatestSpeedMpsRef.current = speedMps;
          navTarget.current = {
            latitude: coords.latitude,
            longitude: coords.longitude,
          };
          if (!navCurrent.current) {
            navCurrent.current = {
              latitude: coords.latitude,
              longitude: coords.longitude,
            };
          }
        },
        logDev: __DEV__
          ? (message, error) => console.log(`${message}:`, error)
          : undefined,
      });

      const ensureNavMarkerInitialized = (coords: {
        latitude: number;
        longitude: number;
      }) => {
        if (!navCurrent.current) {
          navCurrent.current = {
            latitude: coords.latitude,
            longitude: coords.longitude,
          };
        }
        if (!navMarkerRegion.current) {
          navMarkerRegion.current = new AnimatedRegion({
            latitude: coords.latitude,
            longitude: coords.longitude,
            latitudeDelta: 0.0038,
            longitudeDelta: 0.0038,
          });
        }
      };

      const maybeRecalculateOffRoute = async (params: {
        shouldRecalculate: boolean;
        destination: MapDestination | null;
        distanceToRouteMeters: number;
        origin: { latitude: number; longitude: number };
        nowMs: number;
      }) => {
        const {
          shouldRecalculate,
          destination,
          distanceToRouteMeters,
          origin,
          nowMs,
        } = params;
        if (!shouldRecalculate || !destination) return;

        routeRecalcInFlightRef.current = true;
        lastRouteRecalcAtRef.current = nowMs;

        if (__DEV__)
          console.log(
            `Off route by ${distanceToRouteMeters.toFixed(0)}m - recalculating (throttled)...`,
          );
        try {
          await calculateRoute(destination.latitude, destination.longitude, 0, {
            origin,
            silent: true,
            fit: false,
          });
        } catch (error) {
          console.error("Error recalculating route:", error);
        } finally {
          routeRecalcInFlightRef.current = false;
        }
      };

      const applyProgressSideEffects = (
        progress: NavLocationUpdateOutcome["progress"],
      ) => {
        // STAGE 5.1: Check if we've arrived at current stop (auto-advance)
        if (progress.nextStopIndex != null) {
          const arrivedIdx = Math.max(0, progress.nextStopIndex - 1);
          const arrivedStop = stops[arrivedIdx];
          if (__DEV__ && arrivedStop?.address) {
            console.log(`Arrived at stop: ${arrivedStop.address}`);
          }
          setCurrentStopIndex(progress.nextStopIndex);
        }

        // STAGE 5.2: Arrival zone detection for final destination
        if (progress.enterArrivalZone) {
          if (__DEV__) console.log("Entering arrival zone (< 20m)");
          setIsInArrivalZone(true);
        }

        // Update distance to next turn + step progression
        if (progress.distanceToNextTurnMeters != null) {
          setDistanceToNextTurn(progress.distanceToNextTurnMeters);
        }
        if (progress.nextStepIndex != null) {
          currentStepIndex.current = progress.nextStepIndex;
          if (currentStepIndex.current < navigationSteps.current.length) {
            applyTurnByTurnUiFromIndex(currentStepIndex.current);
          }
        }
      };

      const applyNavLocationBasics = (coords: {
        latitude: number;
        longitude: number;
        speedMps: number;
      }) => {
        navLatestSpeedMpsRef.current = coords.speedMps;
        setUserLocation({
          latitude: coords.latitude,
          longitude: coords.longitude,
          speed: coords.speedMps,
        });

        // Update target position for smooth marker rendering
        navSpeedRef.current = coords.speedMps;
      };

      const onNavLocationUpdate = async (location: Location.LocationObject) => {
        const { latitude, longitude, speed } = location.coords;
        const speedMps = speed || 0;

        applyNavLocationBasics({ latitude, longitude, speedMps });

        const destNow = destinationRef.current;
        const routeNow = routeCoordinatesRef.current;
        const now = Date.now();

        const outcome = computeNavLocationUpdate({
          latitude,
          longitude,
          speedMps,
          routePoints: routeNow,
          closestPointOnPolylineMeters,
          lastClosestRouteIndex: lastClosestRouteIndexRef.current,
          wasSnapActive: navSnapActiveRef.current,
          nowMs: now,
          destination: destNow,
          offRouteSinceMs: offRouteSinceRef.current,
          isRecalcInFlight: routeRecalcInFlightRef.current,
          lastRecalcAtMs: lastRouteRecalcAtRef.current,
          stops,
          currentStopIndex,
          isInArrivalZone,
          navigationSteps: navigationSteps.current,
          currentStepIndex: currentStepIndex.current,
        });

        if (outcome.didComputeClosestPoint) {
          lastClosestRouteIndexRef.current = outcome.nextClosestRouteIndex;
        }
        if (outcome.didUpdateSnapActive) {
          navSnapActiveRef.current = outcome.nextSnapActive;
        }
        navTarget.current = outcome.target;

        ensureNavMarkerInitialized({ latitude, longitude });

        offRouteSinceRef.current = outcome.offRoute.nextOffRouteSinceMs;
        if (!outcome.offRoute.shouldConsider) {
          offRouteSinceRef.current = null;
        }

        await maybeRecalculateOffRoute({
          shouldRecalculate: outcome.offRoute.shouldRecalculate,
          destination: destNow,
          distanceToRouteMeters: outcome.distanceToRouteMeters,
          origin: { latitude, longitude },
          nowMs: now,
        });

        applyProgressSideEffects(outcome.progress);

        // Camera updates are driven by the dedicated follow loop (smooth + bottom-pinned).
      };

      await startAdaptiveNavGpsWatch({
        Location,
        onNavLocationUpdate,
        locationSubscriptionRef: locationSubscription,
        navGpsResubInFlightRef,
        navGpsTierRef,
        navLastGpsResubAtRef,
        navGpsTierIntervalRef,
        navLatestSpeedMpsRef,
        initialSpeedMps: navSpeedRef.current || 0,
      });

      await startHeadingTracking({
        Location,
        Gyroscope,
        Magnetometer,
        currentHeadingRef: currentHeading,
        calibrationSamplesRef: calibrationSamples,
        isCalibratedRef: isCalibrated,
        setRawHeading,
        setHeading,
        setIsSensorsActive,
        headingSubscriptionRef: headingSubscription,
        gyroSubscriptionRef: gyroSubscription,
        magnetometerSubscriptionRef: magnetometerSubscription,
      });

      // Start recording
      routePoints.current = [];
      setDistance(0);
      setDuration(0);
      const startTime = Date.now();
      durationInterval.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setDuration(elapsed);
      }, 1000);
    } catch (error) {
      console.error("Error starting navigation:", error);
      Alert.alert("Error", "Failed to start navigation");
      setIsNavigating(false);
    }
  };

  const handleStartNavigation = async () => {
    if (isNavigating) {
      await stopNavigation();
      return;
    }

    await startNavigation();
  };

  const handlePlaceSelect = async (
    data: GooglePlaceData,
    details: GooglePlaceDetail | null,
  ) => {
    const ll = getLatLngFromPlaceDetails(details);
    if (ll) {
      const { lat, lng } = ll;
      const description = getPlaceDescription(data);

      // If no destination yet, set it as destination
      if (!destination) {
        setDestination({
          latitude: lat,
          longitude: lng,
          address: description,
        });
      } else {
        // Add as a stop before the destination
        const newStop = {
          id: Date.now().toString(),
          latitude: lat,
          longitude: lng,
          address: description,
        };
        setStops((prev) => [...prev, newStop]);
      }

      // Clear search input
      searchRef.current?.setAddressText("");

      // Get current location first if not available
      if (!userLocation) {
        await handleMyLocation();
      }

      // Fetch route
      await calculateRoute(lat, lng);
    }
    Keyboard.dismiss();
  };

  const handleRemoveStop = async (stopId: string) => {
    const updatedStops = stops.filter((stop) => stop.id !== stopId);
    setStops(updatedStops);
    setCurrentStopIndex(updatedStops.length > 0 && isNavigating ? 0 : -1); // STAGE 5.1: Reset stop index

    await recalculateRouteToDestinationIfPresent();
  };

  // STAGE 5.1: Manual advance to next stop
  const handleNextStop = () => {
    if (stops.length > 0 && currentStopIndex < stops.length) {
      const nextIndex = currentStopIndex === -1 ? 0 : currentStopIndex + 1;
      setCurrentStopIndex(nextIndex);
      if (__DEV__)
        console.log(
          `Manually advanced to stop ${nextIndex + 1}/${stops.length}`,
        );
    }
  };

  const handleRemoveDestination = () => {
    resetRouteState();
  };

  const onStopsDragEnd = async (data: typeof stops) => {
    setStops(data);
    setCurrentStopIndex(data.length > 0 && isNavigating ? 0 : -1); // STAGE 5.1: Reset to first stop

    // Recalculate route with new order
    await recalculateRouteToDestinationIfPresent();
  };

  return (
    <View style={styles.container}>
      {/* Map - renders immediately like Google Maps */}
      <MapCanvas
        mapRef={mapRef}
        initialRegion={initialRegion}
        mapType={mapType}
        showsTraffic={showsTraffic}
        showsBuildings={showsBuildings}
        showsIndoors={showsIndoors}
        showsCompass={showsCompass}
        isNavigating={isNavigating}
        userLocation={userLocation}
        smoothedHeading={smoothedHeading}
        routeCoordinates={routeCoordinates}
        stops={stops}
        destination={destination}
        navMarkerRegionRef={navMarkerRegion}
        navViewModeRef={navViewModeRef}
        onSetNavViewMode={setNavViewMode}
        onMapReady={() => setMapReady(true)}
      />

      <MapOverlayStack
        topInset={insets.top}
        bottomInset={insets.bottom}
        googleMapsApiKey={googleMapsApiKey}
        searchRef={searchRef}
        userLocation={userLocation}
        isNavigating={isNavigating}
        onPlaceSelect={handlePlaceSelect}
        cameraDebugUnlocked={cameraDebugUnlocked}
        onPressDebug={() => {
          if (!cameraDebugUnlocked) {
            unlockCameraDebug();
            return;
          }
          setShowCameraDebug((v) => !v);
        }}
        onLongPressUnlockDebug={unlockCameraDebug}
        mapType={mapType}
        onCycleMapType={cycleMapType}
        showsTraffic={showsTraffic}
        onToggleTraffic={() => setShowsTraffic((v) => !v)}
        showsBuildings={showsBuildings}
        onToggleBuildings={() => setShowsBuildings((v) => !v)}
        showsIndoors={showsIndoors}
        onToggleIndoors={() => setShowsIndoors((v) => !v)}
        showsCompass={showsCompass}
        onToggleCompass={() => setShowsCompass((v) => !v)}
        routeHasCoordinates={routeCoordinates.length > 1}
        navViewMode={navViewMode}
        onRequestOverview={requestNavOverview}
        onRequestRecenter={requestNavRecenter}
        destination={destination}
        stops={stops}
        onToggleStopsPanel={() => setShowStopsPanel((v) => !v)}
        onOpenStats={() => router.push("/(main)/stats")}
        onMyLocation={handleMyLocation}
        showCameraDebug={showCameraDebug}
        cameraApplyMode={cameraApplyMode}
        cameraTuningPreset={cameraTuningPreset}
        cameraDebugSnapshot={cameraDebugSnapshot}
        onCloseCameraDebug={() => setShowCameraDebug(false)}
        onCycleApplyMode={() => {
          const order: (typeof cameraApplyMode)[] = [
            "auto",
            "setCamera",
            "animate0",
            "animate160",
          ];
          const idx = Math.max(0, order.indexOf(cameraApplyMode));
          setCameraApplyMode(order[(idx + 1) % order.length]);
        }}
        onCycleTuningPreset={() => {
          const order: (typeof cameraTuningPreset)[] = [
            "balanced",
            "smooth",
            "snappy",
          ];
          const idx = Math.max(0, order.indexOf(cameraTuningPreset));
          setCameraTuningPreset(order[(idx + 1) % order.length]);
        }}
        showStopsPanel={showStopsPanel}
        onCloseStopsPanel={() => setShowStopsPanel(false)}
        onStopsDragEnd={onStopsDragEnd}
        onRemoveStop={handleRemoveStop}
        onRemoveDestination={handleRemoveDestination}
        onStartNavigation={handleStartNavigation}
        stageInfoVisible={__DEV__}
        isInArrivalZone={isInArrivalZone}
        currentManeuver={currentManeuver}
        currentInstruction={currentInstruction}
        nextManeuver={nextManeuver}
        nextInstruction={nextInstruction}
        distanceToNextTurnM={distanceToNextTurn}
        laneHint={laneHint}
        speedLimit={speedLimit}
        isSensorsActive={isSensorsActive}
        headingDegrees={heading}
        etaText={eta}
        distanceKm={distance}
        currentStopIndex={currentStopIndex}
        onNextStop={handleNextStop}
      />
    </View>
  );
}
