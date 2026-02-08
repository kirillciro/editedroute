import * as Location from "expo-location";
import { Gyroscope, Magnetometer } from "expo-sensors";
import React, { useCallback } from "react";
import { Alert } from "react-native";
import type MapView from "react-native-maps";
import { AnimatedRegion } from "react-native-maps";

import type { GoogleDirectionsStep } from "@/types/googleDirections";
import type { MapDestination, MapStop, UserLocation } from "@/types/mapRoute";
import type { CameraApplyMode } from "@/types/mapUi";
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
import { startHeadingTracking } from "@/utils/navigation/headingTracking";

type LatLng = { latitude: number; longitude: number };

type Ref<T> = React.MutableRefObject<T>;

type Params = {
  mapRef: React.RefObject<MapView | null>;
  mapReady: boolean;

  isNavigating: boolean;
  setIsNavigating: React.Dispatch<React.SetStateAction<boolean>>;

  stops: MapStop[];
  currentStopIndex: number;
  setCurrentStopIndex: React.Dispatch<React.SetStateAction<number>>;

  isInArrivalZone: boolean;
  setIsInArrivalZone: React.Dispatch<React.SetStateAction<boolean>>;

  distance: number;
  duration: number;
  setDistance: React.Dispatch<React.SetStateAction<number>>;
  setDuration: React.Dispatch<React.SetStateAction<number>>;

  setIsSensorsActive: React.Dispatch<React.SetStateAction<boolean>>;

  setNavViewModeImmediate: (mode: "follow" | "free" | "overview") => void;

  setCurrentManeuver: React.Dispatch<React.SetStateAction<string | null>>;
  setNextInstruction: React.Dispatch<React.SetStateAction<string>>;
  setNextManeuver: React.Dispatch<React.SetStateAction<string | null>>;

  setUserLocation: React.Dispatch<React.SetStateAction<UserLocation | null>>;
  userLocationRef: Ref<UserLocation | null>;

  // camera/nav state
  cameraBearing: number;
  smoothedHeading: number;
  setCameraZoom: React.Dispatch<React.SetStateAction<number>>;

  navTargetRef: Ref<LatLng | null>;
  navCurrentRef: Ref<LatLng | null>;
  navMarkerRegionRef: Ref<AnimatedRegion | null>;

  navSpeedRef: Ref<number>;
  navLatestSpeedMpsRef: Ref<number>;

  distanceToNextTurnRef: Ref<number>;
  cameraZoomRef: Ref<number>;
  cameraApplyModeRef: Ref<CameraApplyMode>;

  navCameraHoldUntilRef: Ref<number>;
  navLastCameraCenterRef: Ref<LatLng | null>;
  navLastCameraBearingAppliedRef: Ref<number>;
  navLastCameraPitchAppliedRef: Ref<number>;
  navLastCameraZoomAppliedRef: Ref<number>;
  navCameraCurrentRef: Ref<
    | {
        center: LatLng;
        heading: number;
        pitch: number;
        zoom: number;
      }
    | null
  >;
  navCameraLastFrameAtRef: Ref<number>;
  didApplyNavCameraFixRef: Ref<boolean>;
  pendingNavCameraFixRef: Ref<{ latitude: number; longitude: number; speedMps: number } | null>;

  // subscriptions/intervals
  locationSubscriptionRef: Ref<Location.LocationSubscription | null>;
  headingSubscriptionRef: Ref<Location.LocationSubscription | null>;
  gyroSubscriptionRef: Ref<{ remove: () => void } | null>;
  magnetometerSubscriptionRef: Ref<{ remove: () => void } | null>;
  durationIntervalRef: Ref<ReturnType<typeof setInterval> | null>;

  // nav gps tier
  navGpsTierRef: Ref<0 | 1 | 2>;
  navLastGpsResubAtRef: Ref<number>;
  navGpsResubInFlightRef: Ref<boolean>;
  navGpsTierIntervalRef: Ref<ReturnType<typeof setInterval> | null>;

  // heading tracking
  currentHeadingRef: Ref<number>;
  calibrationSamplesRef: Ref<number[]>;
  isCalibratedRef: Ref<boolean>;
  setRawHeading: React.Dispatch<React.SetStateAction<number>>;
  setHeading: React.Dispatch<React.SetStateAction<number>>;

  // route + instructions
  destinationRef: Ref<MapDestination | null>;
  routeCoordinatesRef: Ref<LatLng[]>;

  routePointsRef: Ref<{ latitude: number; longitude: number; timestamp: number }[]>;

  closestPointOnPolylineMeters: (
    p: LatLng,
    poly: LatLng[],
    indexHint: number,
  ) => { point: LatLng; distanceM: number; index: number };
  lastClosestRouteIndexRef: Ref<number>;
  navSnapActiveRef: Ref<boolean>;

  offRouteSinceRef: Ref<number | null>;
  routeRecalcInFlightRef: Ref<boolean>;
  lastRouteRecalcAtRef: Ref<number>;

  calculateRoute: (
    destLat: number,
    destLng: number,
    retryCount?: number,
    options?: {
      origin?: LatLng;
      silent?: boolean;
      fit?: boolean;
    },
  ) => Promise<void>;

  applyTurnByTurnUiFromIndex: (idx: number) => void;
  navigationStepsRef: Ref<GoogleDirectionsStep[]>;
  currentStepIndexRef: Ref<number>;
  setDistanceToNextTurn: React.Dispatch<React.SetStateAction<number>>;

  distanceMetersBetween: (a: LatLng, b: LatLng) => number;

  logDev?: (message: string, error: unknown) => void;
};

export function useNavigationLifecycle({
  mapRef,
  mapReady,
  isNavigating,
  setIsNavigating,
  stops,
  currentStopIndex,
  setCurrentStopIndex,
  isInArrivalZone,
  setIsInArrivalZone,
  distance,
  duration,
  setDistance,
  setDuration,
  setIsSensorsActive,
  setNavViewModeImmediate,
  setCurrentManeuver,
  setNextInstruction,
  setNextManeuver,
  setUserLocation,
  userLocationRef,
  cameraBearing,
  smoothedHeading,
  setCameraZoom,
  navTargetRef,
  navCurrentRef,
  navMarkerRegionRef,
  navSpeedRef,
  navLatestSpeedMpsRef,
  distanceToNextTurnRef,
  cameraZoomRef,
  cameraApplyModeRef,
  navCameraHoldUntilRef,
  navLastCameraCenterRef,
  navLastCameraBearingAppliedRef,
  navLastCameraPitchAppliedRef,
  navLastCameraZoomAppliedRef,
  navCameraCurrentRef,
  navCameraLastFrameAtRef,
  didApplyNavCameraFixRef,
  pendingNavCameraFixRef,
  locationSubscriptionRef,
  headingSubscriptionRef,
  gyroSubscriptionRef,
  magnetometerSubscriptionRef,
  durationIntervalRef,
  navGpsTierRef,
  navLastGpsResubAtRef,
  navGpsResubInFlightRef,
  navGpsTierIntervalRef,
  currentHeadingRef,
  calibrationSamplesRef,
  isCalibratedRef,
  setRawHeading,
  setHeading,
  destinationRef,
  routeCoordinatesRef,
  routePointsRef,
  closestPointOnPolylineMeters,
  lastClosestRouteIndexRef,
  navSnapActiveRef,
  offRouteSinceRef,
  routeRecalcInFlightRef,
  lastRouteRecalcAtRef,
  calculateRoute,
  applyTurnByTurnUiFromIndex,
  navigationStepsRef,
  currentStepIndexRef,
  setDistanceToNextTurn,
  distanceMetersBetween,
  logDev,
}: Params) {
  const stopNavigation = useCallback(async () => {
    try {
      cleanupNavigationResources({
        locationSubscription: locationSubscriptionRef,
        navGpsTierIntervalRef,
        navGpsResubInFlightRef,
        headingSubscription: headingSubscriptionRef,
        gyroSubscription: gyroSubscriptionRef,
        magnetometerSubscription: magnetometerSubscriptionRef,
        durationInterval: durationIntervalRef,
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
  }, [
    distance,
    duration,
    locationSubscriptionRef,
    navGpsTierIntervalRef,
    navGpsResubInFlightRef,
    headingSubscriptionRef,
    gyroSubscriptionRef,
    magnetometerSubscriptionRef,
    durationIntervalRef,
    setIsNavigating,
    setIsSensorsActive,
    setNavViewModeImmediate,
    setCurrentManeuver,
    setNextInstruction,
    setNextManeuver,
  ]);

  const startNavigation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Location permission required");
        return;
      }

      didApplyNavCameraFixRef.current = false;
      pendingNavCameraFixRef.current = null;
      setNavViewModeImmediate("follow");
      setIsNavigating(true);
      setCurrentStopIndex(stops.length > 0 ? 0 : -1);
      setIsInArrivalZone(false);

      setCameraZoom(17.2);

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
          navTargetRef,
          navCurrentRef,
          navMarkerRegionRef,
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
            navCurrent: navCurrentRef.current,
            navTarget: navTargetRef.current,
            userLocation: userLocationRef.current,
          }),
        getExistingSpeedMps: () =>
          navSpeedRef.current || userLocationRef.current?.speed || 0,
        getCurrentUserLocation: () => userLocationToLatLng(userLocationRef.current),
        distanceMetersBetween,
        onSeedWithoutResnap: (coords, speedMps) => {
          setUserLocation({
            latitude: coords.latitude,
            longitude: coords.longitude,
            speed: speedMps,
          });
          navSpeedRef.current = speedMps;
          navLatestSpeedMpsRef.current = speedMps;
          navTargetRef.current = {
            latitude: coords.latitude,
            longitude: coords.longitude,
          };
          if (!navCurrentRef.current) {
            navCurrentRef.current = {
              latitude: coords.latitude,
              longitude: coords.longitude,
            };
          }
        },
        logDev,
      });

      const ensureNavMarkerInitialized = (coords: {
        latitude: number;
        longitude: number;
      }) => {
        if (!navCurrentRef.current) {
          navCurrentRef.current = {
            latitude: coords.latitude,
            longitude: coords.longitude,
          };
        }
        if (!navMarkerRegionRef.current) {
          navMarkerRegionRef.current = new AnimatedRegion({
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
        if (progress.nextStopIndex != null) {
          const arrivedIdx = Math.max(0, progress.nextStopIndex - 1);
          const arrivedStop = stops[arrivedIdx];
          if (__DEV__ && arrivedStop?.address) {
            console.log(`Arrived at stop: ${arrivedStop.address}`);
          }
          setCurrentStopIndex(progress.nextStopIndex);
        }

        if (progress.enterArrivalZone) {
          if (__DEV__) console.log("Entering arrival zone (< 20m)");
          setIsInArrivalZone(true);
        }

        if (progress.distanceToNextTurnMeters != null) {
          setDistanceToNextTurn(progress.distanceToNextTurnMeters);
        }
        if (progress.nextStepIndex != null) {
          currentStepIndexRef.current = progress.nextStepIndex;
          if (currentStepIndexRef.current < navigationStepsRef.current.length) {
            applyTurnByTurnUiFromIndex(currentStepIndexRef.current);
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
          navigationSteps: navigationStepsRef.current,
          currentStepIndex: currentStepIndexRef.current,
        });

        if (outcome.didComputeClosestPoint) {
          lastClosestRouteIndexRef.current = outcome.nextClosestRouteIndex;
        }
        if (outcome.didUpdateSnapActive) {
          navSnapActiveRef.current = outcome.nextSnapActive;
        }
        navTargetRef.current = outcome.target;

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
      };

      await startAdaptiveNavGpsWatch({
        Location,
        onNavLocationUpdate,
        locationSubscriptionRef,
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
        currentHeadingRef,
        calibrationSamplesRef,
        isCalibratedRef,
        setRawHeading,
        setHeading,
        setIsSensorsActive,
        headingSubscriptionRef,
        gyroSubscriptionRef,
        magnetometerSubscriptionRef,
      });

      // Start recording
      routePointsRef.current = [];
      setDistance(0);
      setDuration(0);
      const startTime = Date.now();
      durationIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setDuration(elapsed);
      }, 1000);
    } catch (error) {
      console.error("Error starting navigation:", error);
      Alert.alert("Error", "Failed to start navigation");
      setIsNavigating(false);
    }
  }, [
    applyTurnByTurnUiFromIndex,
    calibrationSamplesRef,
    calculateRoute,
    cameraApplyModeRef,
    cameraBearing,
    cameraZoomRef,
    closestPointOnPolylineMeters,
    currentHeadingRef,
    currentStepIndexRef,
    currentStopIndex,
    destinationRef,
    didApplyNavCameraFixRef,
    distanceMetersBetween,
    distanceToNextTurnRef,
    headingSubscriptionRef,
    gyroSubscriptionRef,
    isCalibratedRef,
    isInArrivalZone,
    lastClosestRouteIndexRef,
    lastRouteRecalcAtRef,
    locationSubscriptionRef,
    logDev,
    magnetometerSubscriptionRef,
    mapReady,
    mapRef,
    navCameraCurrentRef,
    navCameraHoldUntilRef,
    navCameraLastFrameAtRef,
    navCurrentRef,
    navGpsResubInFlightRef,
    navGpsTierIntervalRef,
    navGpsTierRef,
    navLastCameraBearingAppliedRef,
    navLastCameraCenterRef,
    navLastCameraPitchAppliedRef,
    navLastCameraZoomAppliedRef,
    navLastGpsResubAtRef,
    navLatestSpeedMpsRef,
    navMarkerRegionRef,
    navSnapActiveRef,
    navSpeedRef,
    navTargetRef,
    navigationStepsRef,
    offRouteSinceRef,
    pendingNavCameraFixRef,
    routeCoordinatesRef,
    routePointsRef,
    routeRecalcInFlightRef,
    setCameraZoom,
    setCurrentStopIndex,
    setDistance,
    setDistanceToNextTurn,
    setDuration,
    setHeading,
    setIsInArrivalZone,
    setIsNavigating,
    setIsSensorsActive,
    setNavViewModeImmediate,
    setRawHeading,
    setUserLocation,
    smoothedHeading,
    stops,
    durationIntervalRef,
    userLocationRef,
  ]);

  const handleStartNavigation = useCallback(async () => {
    if (isNavigating) {
      await stopNavigation();
      return;
    }

    await startNavigation();
  }, [isNavigating, startNavigation, stopNavigation]);

  return { startNavigation, stopNavigation, handleStartNavigation };
}
