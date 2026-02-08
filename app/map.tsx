import * as Location from "expo-location";
import { router } from "expo-router";
import { Gyroscope, Magnetometer } from "expo-sensors";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState, Keyboard, View } from "react-native";
import type {
  GooglePlaceData,
  GooglePlaceDetail,
} from "react-native-google-places-autocomplete";
import MapView, { AnimatedRegion } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MapCanvas } from "@/components/map/MapCanvas";
import { MapOverlayStack } from "@/components/map/MapOverlayStack";
import { styles } from "@/components/map/mapScreen.styles";
import {
  getLatLngFromPlaceDetails,
  getPlaceDescription,
} from "@/features/map/helpers/place";
import { useAppStateTracking } from "@/features/map/hooks/useAppStateTracking";
import { useCameraApplyMode } from "@/features/map/hooks/useCameraApplyMode";
import { useCameraBearingSmoothing } from "@/features/map/hooks/useCameraBearingSmoothing";
import {
  useCameraDebugSnapshot,
  type CameraDebugSnapshot,
} from "@/features/map/hooks/useCameraDebugSnapshot";
import { useCameraDebugUi } from "@/features/map/hooks/useCameraDebugUi";
import { useCameraTuningPreset } from "@/features/map/hooks/useCameraTuningPreset";
import { useDynamicCameraPitch } from "@/features/map/hooks/useDynamicCameraPitch";
import { useDynamicEta } from "@/features/map/hooks/useDynamicEta";
import { useGoogleMapsApiKey } from "@/features/map/hooks/useGoogleMapsApiKey";
import { useMapLayers } from "@/features/map/hooks/useMapLayers";
import { useMyLocationAction } from "@/features/map/hooks/useMyLocationAction";
import { useNavCameraActions } from "@/features/map/hooks/useNavCameraActions";
import { useNavCameraFollowLoop } from "@/features/map/hooks/useNavCameraFollowLoop";
import { useNavigationKeepAwake } from "@/features/map/hooks/useNavigationKeepAwake";
import { useNavigationZoomSmoothing } from "@/features/map/hooks/useNavigationZoomSmoothing";
import { useNavMarkerSmoothingLoop } from "@/features/map/hooks/useNavMarkerSmoothingLoop";
import { useNavViewMode } from "@/features/map/hooks/useNavViewMode";
import { useRemainingRouteMeters } from "@/features/map/hooks/useRemainingRouteMeters";
import { useResetRouteState } from "@/features/map/hooks/useResetRouteState";
import { useRoutePlanning } from "@/features/map/hooks/useRoutePlanning";
import { useRoutePolylineMetrics } from "@/features/map/hooks/useRoutePolylineMetrics";
import { useSmoothedHeadingInterpolation } from "@/features/map/hooks/useSmoothedHeadingInterpolation";
import { useSyncedRef } from "@/features/map/hooks/useSyncedRef";
import type { GoogleDirectionsStep } from "@/types/googleDirections";
import type { MapDestination, MapStop, UserLocation } from "@/types/mapRoute";
import {
  closestPointOnPolylineMeters as closestPointOnPolylineMetersFn,
  distanceMetersBetween as distanceMetersBetweenFn,
} from "@/utils/geo/geometry";
import { centerMapOnUserOnce } from "@/utils/location/centerOnUserOnce";
import {
  computeNavLookAheadMeters,
  offsetCoordinate,
} from "@/utils/navigation/camera";

import type { DynamicEtaSource } from "@/utils/navigation/eta";
import { startHeadingTracking } from "@/utils/navigation/headingTracking";
import type { LaneHint } from "@/utils/navigation/instructions";
import { applyMapCamera } from "@/utils/navigation/mapCameraApply";
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
import { seedNavAndCamera } from "@/utils/navigation/navSeed";

import { computeTurnByTurnUiFromSteps } from "@/utils/navigation/turnByTurnUi";

/**
 * Google Maps-style main screen
 * Stage 6: Full navigation with turn-by-turn, speed limits, highway guidance
 */
export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const searchRef = useRef<any>(null);
  const insets = useSafeAreaInsets();

  const googleMapsApiKey = useGoogleMapsApiKey();

  const [mapReady, setMapReady] = useState(false);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [destination, setDestination] = useState<MapDestination | null>(null);
  const destinationRef = useSyncedRef<MapDestination | null>(destination, null);
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

  const {
    mapType,
    cycleMapType,
    showsTraffic,
    setShowsTraffic,
    showsBuildings,
    setShowsBuildings,
    showsIndoors,
    setShowsIndoors,
    showsCompass,
    setShowsCompass,
  } = useMapLayers();

  // NOTE: __DEV__ is false in archives/TestFlight builds, so we support an
  // on-device unlock gesture to enable debug UI.
  const {
    showCameraDebug,
    setShowCameraDebug,
    cameraDebugUnlocked,
    unlockCameraDebug,
  } = useCameraDebugUi(__DEV__);
  const { cameraApplyMode, setCameraApplyMode, cameraApplyModeRef } =
    useCameraApplyMode("animate160");

  const { cameraTuningPreset, setCameraTuningPreset, navCameraTuningRef } =
    useCameraTuningPreset("balanced");

  const [cameraDebugSnapshot, setCameraDebugSnapshot] =
    useState<CameraDebugSnapshot | null>(null);

  // Google-like navigation camera modes:
  // - follow: camera follows marker + heading
  // - free: user explored the map, camera stops following until recenter
  // - overview: fit route overview (still not following)
  const {
    navViewMode,
    setNavViewMode,
    navViewModeRef,
    setNavViewModeImmediate,
  } = useNavViewMode("follow");

  const [currentStopIndex, setCurrentStopIndex] = useState<number>(-1); // STAGE 5.1: Track current stop (-1 = none)
  const [isInArrivalZone, setIsInArrivalZone] = useState(false); // STAGE 5.2: Within 10-20m of destination
  const [appState, setAppState] = useState(AppState.currentState); // STAGE 9.1: Track app state

  useNavigationKeepAwake({ isNavigating, appState });
  useAppStateTracking({ appState, setAppState });
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
  const cameraBearingRef = useSyncedRef(cameraBearing, 0);
  const cameraPitchRef = useSyncedRef(cameraPitch, 0);
  const cameraZoomRef = useSyncedRef(cameraZoom, 0);
  const isInArrivalZoneRef = useSyncedRef(isInArrivalZone, false);
  const userLocationRef = useSyncedRef<UserLocation | null>(userLocation, null);
  const distanceToNextTurnRef = useSyncedRef(distanceToNextTurn, 0);

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
  const routeTotalDurationSecRef = useRef<number>(0);
  const routePolylineCumulativeMetersRef = useRef<number[]>([]);
  const routePolylineTotalMetersRef = useRef<number>(0);
  const lastDynamicEtaMinutesRef = useRef<number | null>(null);
  const dynamicEtaSecondsRef = useRef<number | null>(null);
  const dynamicRemainingRouteMetersRef = useRef<number | null>(null);
  const dynamicEtaSourceRef = useRef<DynamicEtaSource>("none");

  useCameraDebugSnapshot({
    enabled: cameraDebugUnlocked && showCameraDebug,
    mapRef,
    navCameraCurrentRef,
    cameraApplyModeRef,
    cameraTuningPreset,
    navViewMode,
    navCameraHoldUntilRef,
    navSpeedRef,
    userLocationRef,
    distanceToNextTurnRef,
    dynamicRemainingRouteMetersRef,
    dynamicEtaSecondsRef,
    dynamicEtaSourceRef,
    cameraZoomRef,
    cameraBearingRef,
    cameraPitchRef,
    navTargetRef: navTarget,
    mapType,
    showsTraffic,
    showsBuildings,
    showsIndoors,
    showsCompass,
    setCameraDebugSnapshot,
  });

  const { calculateRoute, recalculateRouteToDestinationIfPresent } =
    useRoutePlanning({
      apiKey: googleMapsApiKey,
      mapRef,
      stops,
      userLocation,
      userLocationRef,
      setRouteCoordinates,
      navigationStepsRef: navigationSteps,
      currentStepIndexRef: currentStepIndex,
      routeTotalDurationSecRef,
      applyTurnByTurnUiFromIndex,
      setEtaText: setEta,
    });

  const resetRouteState = useResetRouteState({
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
  });

  const handleMyLocation = useMyLocationAction({
    mapRef,
    setUserLocation,
  });

  // Ensure we can apply an immediate "enter navigation" camera move even if the map isn't ready yet.
  const pendingNavCameraFixRef = useRef<{
    latitude: number;
    longitude: number;
    speedMps: number;
  } | null>(null);
  const didApplyNavCameraFixRef = useRef(false);

  const { requestNavRecenter, requestNavOverview } = useNavCameraActions({
    mapRef,
    routeCoordinatesRef,
    navCurrentRef: navCurrent,
    navTargetRef: navTarget,
    userLocationRef: userLocationRef,
    navSpeedRef,
    pendingNavCameraFixRef,
    didApplyNavCameraFixRef,
    navCameraHoldUntilRef,
    setNavViewModeImmediate,
  });

  useNavigationZoomSmoothing({
    isNavigating,
    appState,
    speedMps: userLocation?.speed ?? 0,
    distanceToNextTurnMeters: distanceToNextTurn,
    setCameraZoom,
    resetZoom: 16.8,
  });

  // Map-matching ("Google-like" feel)
  const lastClosestRouteIndexRef = useRef<number>(0);
  const navSnapActiveRef = useRef<boolean>(false);

  const NAV_RENDER_TAU_SECONDS = 0.12; // lower = snappier, higher = smoother

  const distanceMetersBetween = useCallback(distanceMetersBetweenFn, []);

  useRoutePolylineMetrics({
    routeCoordinates,
    routeCoordinatesRef,
    routePolylineCumulativeMetersRef,
    routePolylineTotalMetersRef,
    lastClosestRouteIndexRef,
  });

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
  }, [
    isNavigating,
    mapReady,
    cameraBearing,
    smoothedHeading,
    cameraZoomRef,
    distanceToNextTurnRef,
    cameraApplyModeRef,
  ]);

  useNavMarkerSmoothingLoop({
    isNavigating,
    appState,
    smoothedHeading,
    navTargetRef: navTarget,
    navCurrentRef: navCurrent,
    navSpeedRef,
    navRafIdRef: navRafId,
    navLastFrameTimeRef: navLastFrameTime,
    navMarkerRegionRef: navMarkerRegion,
    tauSeconds: NAV_RENDER_TAU_SECONDS,
  });

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

  const { computeRemainingRouteMeters } = useRemainingRouteMeters({
    routeCoordinatesRef,
    routePolylineCumulativeMetersRef,
    routePolylineTotalMetersRef,
    lastClosestRouteIndexRef,
    closestPointOnPolylineMeters,
  });

  useDynamicEta({
    isNavigating,
    appState,
    userLocationRef,
    computeRemainingRouteMeters,
    routeTotalDurationSecRef,
    routePolylineTotalMetersRef,
    lastDynamicEtaMinutesRef,
    dynamicEtaSecondsRef,
    dynamicRemainingRouteMetersRef,
    dynamicEtaSourceRef,
    setEtaText: setEta,
  });

  useSmoothedHeadingInterpolation({
    rawHeading,
    isSensorsActive,
    appState,
    setSmoothedHeading,
  });

  useCameraBearingSmoothing({
    smoothedHeading,
    isNavigating,
    appState,
    userSpeedMps: userLocation?.speed,
    setCameraBearing,
  });

  useDynamicCameraPitch({
    isNavigating,
    appState,
    userSpeedMps: userLocation?.speed,
    setCameraPitch,
  });

  // Heading-up camera follow should run continuously during navigation.
  // IMPORTANT: navCurrent updates via RAF (no React renders), so the camera must
  // also be driven by a loop, not a dependency-based useEffect.
  useNavCameraFollowLoop({
    isNavigating,
    appState,
    mapReady,
    mapRef,
    navViewModeRef,
    navCameraRafIdRef,
    navCameraHoldUntilRef,
    navCameraLastFrameAtRef,
    navCameraLastApplyAtRef,
    navCameraCurrentRef,
    navLastCameraCenterRef,
    navLastCameraBearingAppliedRef,
    navLastCameraPitchAppliedRef,
    navLastCameraZoomAppliedRef,
    navCameraTuningRef,
    destinationRef,
    isInArrivalZoneRef,
    navCurrentRef: navCurrent,
    navTargetRef: navTarget,
    userLocationRef,
    navSpeedRef,
    distanceToNextTurnRef,
    cameraBearingRef,
    cameraPitchRef,
    cameraZoomRef,
    cameraApplyModeRef,
  });

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

    await recalculateRouteToDestinationIfPresent(destinationRef);
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
    await recalculateRouteToDestinationIfPresent(destinationRef);
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
