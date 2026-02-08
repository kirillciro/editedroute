import { useStopsAndDestinationActions } from "@/features/map/hooks/useStopsAndDestinationActions";
import React, { useCallback, useRef, useState } from "react";
import { AppState, View } from "react-native";
import MapView from "react-native-maps";
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
import { useCenterMapOnUserOnMount } from "@/features/map/hooks/useCenterMapOnUserOnMount";
import { useDynamicCameraPitch } from "@/features/map/hooks/useDynamicCameraPitch";
import { useDynamicEta } from "@/features/map/hooks/useDynamicEta";
import { useEnterNavigationCameraFix } from "@/features/map/hooks/useEnterNavigationCameraFix";
import { useGoogleMapsApiKey } from "@/features/map/hooks/useGoogleMapsApiKey";
import { useMapLayers } from "@/features/map/hooks/useMapLayers";
import { useMapOverlayActions } from "@/features/map/hooks/useMapOverlayActions";
import { useMyLocationAction } from "@/features/map/hooks/useMyLocationAction";
import { useNavCameraActions } from "@/features/map/hooks/useNavCameraActions";
import { useNavCameraFollowLoop } from "@/features/map/hooks/useNavCameraFollowLoop";
import { useNavigationKeepAwake } from "@/features/map/hooks/useNavigationKeepAwake";
import { useNavigationLifecycle } from "@/features/map/hooks/useNavigationLifecycle";
import { useNavigationRefs } from "@/features/map/hooks/useNavigationRefs";
import { useNavigationRuntimeRefs } from "@/features/map/hooks/useNavigationRuntimeRefs";
import { useNavigationZoomSmoothing } from "@/features/map/hooks/useNavigationZoomSmoothing";
import { useNavMarkerSmoothingLoop } from "@/features/map/hooks/useNavMarkerSmoothingLoop";
import { useNavViewMode } from "@/features/map/hooks/useNavViewMode";
import { useRemainingRouteMeters } from "@/features/map/hooks/useRemainingRouteMeters";
import { useResetRouteState } from "@/features/map/hooks/useResetRouteState";
import { useRoutePlanning } from "@/features/map/hooks/useRoutePlanning";
import { useRoutePolylineMetrics } from "@/features/map/hooks/useRoutePolylineMetrics";
import { useSmoothedHeadingInterpolation } from "@/features/map/hooks/useSmoothedHeadingInterpolation";
import { useSyncedRef } from "@/features/map/hooks/useSyncedRef";
import type { MapDestination, MapStop, UserLocation } from "@/types/mapRoute";
import {
  closestPointOnPolylineMeters as closestPointOnPolylineMetersFn,
  distanceMetersBetween as distanceMetersBetweenFn,
} from "@/utils/geo/geometry";

import { useTurnByTurnUi } from "@/features/map/hooks/useTurnByTurnUi";
import type { LaneHint } from "@/utils/navigation/instructions";
// nav location update logic is handled inside useNavigationLifecycle

/**
 * Google Maps-style main screen
 * Stage 6: Full navigation with turn-by-turn, speed limits, highway guidance
 */

// Stage 1: Static map center (Toronto for now)
const INITIAL_REGION = {
  latitude: 43.6532,
  longitude: -79.3832,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

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

  const {
    onPressDebug,
    onCloseCameraDebug,
    onCycleApplyMode,
    onCycleTuningPreset,
    onToggleTraffic,
    onToggleBuildings,
    onToggleIndoors,
    onToggleCompass,
    onToggleStopsPanel,
    onCloseStopsPanel,
    onOpenStats,
  } = useMapOverlayActions({
    cameraDebugUnlocked,
    unlockCameraDebug,
    setShowCameraDebug,
    cameraApplyMode,
    setCameraApplyMode,
    cameraTuningPreset,
    setCameraTuningPreset,
    setShowsTraffic,
    setShowsBuildings,
    setShowsIndoors,
    setShowsCompass,
    setShowStopsPanel,
  });

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

  const {
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
  } = useNavigationRuntimeRefs();

  const {
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
  } = useNavigationRefs();
  const cameraBearingRef = useSyncedRef(cameraBearing, 0);
  const cameraPitchRef = useSyncedRef(cameraPitch, 0);
  const cameraZoomRef = useSyncedRef(cameraZoom, 0);
  const isInArrivalZoneRef = useSyncedRef(isInArrivalZone, false);
  const userLocationRef = useSyncedRef<UserLocation | null>(userLocation, null);
  const distanceToNextTurnRef = useSyncedRef(distanceToNextTurn, 0);

  const { applyTurnByTurnUiFromIndex } = useTurnByTurnUi({
    stepsRef: navigationSteps,
    setCurrentInstruction,
    setCurrentManeuver,
    setNextInstruction,
    setNextManeuver,
    setLaneHint,
    setDistanceToNextTurn,
  });

  // (navigation + route refs extracted into useNavigationRefs)

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

  // (enter-navigation camera refs extracted into useNavigationRefs)

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

  // (map-matching refs extracted into useNavigationRefs)

  const NAV_RENDER_TAU_SECONDS = 0.12; // lower = snappier, higher = smoother

  const distanceMetersBetween = useCallback(distanceMetersBetweenFn, []);

  useRoutePolylineMetrics({
    routeCoordinates,
    routeCoordinatesRef,
    routePolylineCumulativeMetersRef,
    routePolylineTotalMetersRef,
    lastClosestRouteIndexRef,
  });

  useEnterNavigationCameraFix({
    isNavigating,
    mapReady,
    mapRef,
    didApplyNavCameraFixRef,
    pendingNavCameraFixRef,
    navCameraHoldUntilRef,
    navCameraCurrentRef,
    navCameraLastFrameAtRef,
    navLastCameraCenterRef,
    navLastCameraBearingAppliedRef,
    navLastCameraPitchAppliedRef,
    navLastCameraZoomAppliedRef,
    cameraBearing,
    smoothedHeading,
    cameraZoomRef,
    distanceToNextTurnRef,
    cameraApplyModeRef,
  });

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

  useCenterMapOnUserOnMount({ mapRef, setUserLocation });

  const closestPointOnPolylineMeters = useCallback(
    closestPointOnPolylineMetersFn,
    [],
  );

  const { handleStartNavigation } = useNavigationLifecycle({
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
    navTargetRef: navTarget,
    navCurrentRef: navCurrent,
    navMarkerRegionRef: navMarkerRegion,
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
    locationSubscriptionRef: locationSubscription,
    headingSubscriptionRef: headingSubscription,
    gyroSubscriptionRef: gyroSubscription,
    magnetometerSubscriptionRef: magnetometerSubscription,
    durationIntervalRef: durationInterval,
    navGpsTierRef,
    navLastGpsResubAtRef,
    navGpsResubInFlightRef,
    navGpsTierIntervalRef,
    currentHeadingRef: currentHeading,
    calibrationSamplesRef: calibrationSamples,
    isCalibratedRef: isCalibrated,
    setRawHeading,
    setHeading,
    destinationRef,
    routeCoordinatesRef,
    routePointsRef: routePoints,
    closestPointOnPolylineMeters,
    lastClosestRouteIndexRef,
    navSnapActiveRef,
    offRouteSinceRef,
    routeRecalcInFlightRef,
    lastRouteRecalcAtRef,
    calculateRoute,
    applyTurnByTurnUiFromIndex,
    navigationStepsRef: navigationSteps,
    currentStepIndexRef: currentStepIndex,
    setDistanceToNextTurn,
    distanceMetersBetween,
    logDev: __DEV__
      ? (message, error) => console.log(`${message}:`, error)
      : undefined,
  });

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

  const {
    handlePlaceSelect,
    handleRemoveStop,
    handleNextStop,
    handleRemoveDestination,
    onStopsDragEnd,
  } = useStopsAndDestinationActions({
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
    logDev: __DEV__ ? (msg) => console.log(msg) : undefined,
  });

  return (
    <View style={styles.container}>
      {/* Map - renders immediately like Google Maps */}
      <MapCanvas
        mapRef={mapRef}
        initialRegion={INITIAL_REGION}
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
        onPressDebug={onPressDebug}
        onLongPressUnlockDebug={unlockCameraDebug}
        mapType={mapType}
        onCycleMapType={cycleMapType}
        showsTraffic={showsTraffic}
        onToggleTraffic={onToggleTraffic}
        showsBuildings={showsBuildings}
        onToggleBuildings={onToggleBuildings}
        showsIndoors={showsIndoors}
        onToggleIndoors={onToggleIndoors}
        showsCompass={showsCompass}
        onToggleCompass={onToggleCompass}
        routeHasCoordinates={routeCoordinates.length > 1}
        navViewMode={navViewMode}
        onRequestOverview={requestNavOverview}
        onRequestRecenter={requestNavRecenter}
        destination={destination}
        stops={stops}
        onToggleStopsPanel={onToggleStopsPanel}
        onOpenStats={onOpenStats}
        onMyLocation={handleMyLocation}
        showCameraDebug={showCameraDebug}
        cameraApplyMode={cameraApplyMode}
        cameraTuningPreset={cameraTuningPreset}
        cameraDebugSnapshot={cameraDebugSnapshot}
        onCloseCameraDebug={onCloseCameraDebug}
        onCycleApplyMode={onCycleApplyMode}
        onCycleTuningPreset={onCycleTuningPreset}
        showStopsPanel={showStopsPanel}
        onCloseStopsPanel={onCloseStopsPanel}
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
