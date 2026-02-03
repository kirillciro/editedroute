import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router } from "expo-router";
import { Gyroscope, Magnetometer } from "expo-sensors";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  AppState,
  Keyboard,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from "react-native-draggable-flatlist";
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";
import MapView, {
  AnimatedRegion,
  Marker,
  PROVIDER_GOOGLE,
  Polyline,
} from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Google Maps-style main screen
 * Stage 6: Full navigation with turn-by-turn, speed limits, highway guidance
 */
export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const searchRef = useRef<any>(null);
  const insets = useSafeAreaInsets();
  const [mapReady, setMapReady] = useState(false);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
    speed?: number;
  } | null>(null);
  const [destination, setDestination] = useState<{
    latitude: number;
    longitude: number;
    address: string;
  } | null>(null);
  const destinationRef = useRef<{
    latitude: number;
    longitude: number;
    address: string;
  } | null>(null);
  const [stops, setStops] = useState<
    {
      id: string;
      latitude: number;
      longitude: number;
      address: string;
    }[]
  >([]);
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
  const [laneHint, setLaneHint] = useState<
    null | "keep-left" | "keep-right" | "left" | "right" | "straight"
  >(null);
  const [distanceToNextTurn, setDistanceToNextTurn] = useState<number>(0);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [speedLimit, setSpeedLimit] = useState<number>(0);
  const [eta, setEta] = useState<string>("");
  const [isNavigating, setIsNavigating] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [isSensorsActive, setIsSensorsActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [heading, setHeading] = useState(0); // Legacy - kept for compatibility
  const [rawHeading, setRawHeading] = useState(0); // STAGE 4.1: Raw sensor value
  const [smoothedHeading, setSmoothedHeading] = useState(0); // STAGE 4.1: Interpolated value
  const [cameraBearing, setCameraBearing] = useState(0); // STAGE 4.2: Camera rotation
  const [cameraPitch, setCameraPitch] = useState(0); // STAGE 4.3: Camera tilt angle
  // Google Maps camera zoom LEVEL (not region delta). Typical navigation zooms are ~15..19.
  const [cameraZoom, setCameraZoom] = useState(17.2);

  // Google Maps-style layers & overlays
  type MapLayerType = "standard" | "satellite" | "hybrid" | "terrain";
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

  type CameraApplyMode = "auto" | "setCamera" | "animate0" | "animate160";
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

  type CameraTuningPreset = "balanced" | "smooth" | "snappy";
  const [cameraTuningPreset, setCameraTuningPreset] =
    useState<CameraTuningPreset>("balanced");
  const navCameraTuningRef = useRef({
    applyMinIntervalMs: 1000 / 30,
    tauCenterS: 0.35,
    tauHeadingS: 0.25,
    tauPitchS: 0.35,
    tauZoomS: 0.45,
    centerDeadbandM: 0.25,
    bearingDeadbandDeg: 0.4,
    pitchDeadbandDeg: 0.3,
    zoomDeadband: 0.02,
  });
  useEffect(() => {
    if (cameraTuningPreset === "smooth") {
      navCameraTuningRef.current = {
        applyMinIntervalMs: 1000 / 24,
        tauCenterS: 0.55,
        tauHeadingS: 0.35,
        tauPitchS: 0.55,
        tauZoomS: 0.7,
        centerDeadbandM: 0.35,
        bearingDeadbandDeg: 0.6,
        pitchDeadbandDeg: 0.45,
        zoomDeadband: 0.03,
      };
      return;
    }
    if (cameraTuningPreset === "snappy") {
      navCameraTuningRef.current = {
        applyMinIntervalMs: 1000 / 40,
        tauCenterS: 0.22,
        tauHeadingS: 0.18,
        tauPitchS: 0.24,
        tauZoomS: 0.3,
        centerDeadbandM: 0.18,
        bearingDeadbandDeg: 0.3,
        pitchDeadbandDeg: 0.22,
        zoomDeadband: 0.015,
      };
      return;
    }

    // balanced
    navCameraTuningRef.current = {
      applyMinIntervalMs: 1000 / 30,
      tauCenterS: 0.35,
      tauHeadingS: 0.25,
      tauPitchS: 0.35,
      tauZoomS: 0.45,
      centerDeadbandM: 0.25,
      bearingDeadbandDeg: 0.4,
      pitchDeadbandDeg: 0.3,
      zoomDeadband: 0.02,
    };
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
  type NavViewMode = "follow" | "free" | "overview";
  const [navViewMode, setNavViewMode] = useState<NavViewMode>("follow");
  const navViewModeRef = useRef<NavViewMode>("follow");
  useEffect(() => {
    navViewModeRef.current = navViewMode;
  }, [navViewMode]);

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
  const [distance, setDistance] = useState(0);
  const [duration, setDuration] = useState(0);
  const navigationSteps = useRef<any[]>([]);
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

  const cleanHtmlInstruction = (html: string) => {
    return html
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  };

  const inferManeuverFromInstruction = (instructionText: string) => {
    const t = instructionText.toLowerCase();
    if (t.includes("u-turn") || t.includes("uturn")) return "uturn";
    if (t.includes("roundabout")) return "roundabout";
    if (t.includes("merge")) return "merge";
    if (t.includes("exit")) return "exit";
    if (t.includes("keep left")) return "keep-left";
    if (t.includes("keep right")) return "keep-right";
    if (t.includes("slight left")) return "turn-slight-left";
    if (t.includes("slight right")) return "turn-slight-right";
    if (t.includes("sharp left")) return "turn-sharp-left";
    if (t.includes("sharp right")) return "turn-sharp-right";
    if (t.includes("turn left")) return "turn-left";
    if (t.includes("turn right")) return "turn-right";
    return null;
  };

  const inferLaneHint = (
    maneuver: string | null,
    instructionText: string,
  ): null | "keep-left" | "keep-right" | "left" | "right" | "straight" => {
    const t = instructionText.toLowerCase();
    const m = (maneuver || "").toLowerCase();

    if (t.includes("keep left") || m.includes("keep-left")) return "keep-left";
    if (t.includes("keep right") || m.includes("keep-right"))
      return "keep-right";

    if (m.includes("turn-left") || t.includes("turn left")) return "left";
    if (m.includes("turn-right") || t.includes("turn right")) return "right";

    if (m.includes("ramp-left") || (m.includes("exit") && t.includes("left")))
      return "keep-left";
    if (m.includes("ramp-right") || (m.includes("exit") && t.includes("right")))
      return "keep-right";

    if (t.includes("continue") || t.includes("head") || t.includes("straight"))
      return "straight";

    return null;
  };

  const getStepManeuver = (step: any): string | null => {
    const raw = typeof step?.maneuver === "string" ? step.maneuver : null;
    if (raw) return raw;
    const instructionText =
      typeof step?.html_instructions === "string"
        ? cleanHtmlInstruction(step.html_instructions)
        : "";
    return inferManeuverFromInstruction(instructionText);
  };

  const maneuverToIconName = (
    maneuver: string | null,
    instructionText: string,
  ): React.ComponentProps<typeof MaterialCommunityIcons>["name"] => {
    const m = maneuver || inferManeuverFromInstruction(instructionText) || "";
    switch (m) {
      case "turn-left":
        return "arrow-left";
      case "turn-right":
        return "arrow-right";
      case "turn-slight-left":
      case "fork-left":
        return "arrow-top-left";
      case "turn-slight-right":
      case "fork-right":
        return "arrow-top-right";
      case "turn-sharp-left":
        return "arrow-bottom-left";
      case "turn-sharp-right":
        return "arrow-bottom-right";
      case "uturn":
      case "uturn-left":
      case "uturn-right":
        return "undo";
      case "merge":
        return "merge";
      case "roundabout":
      case "roundabout-left":
      case "roundabout-right":
        return "rotate-right";
      case "exit":
      case "ramp-left":
      case "ramp-right":
        return "exit-to-app";
      case "keep-left":
        return "arrow-left";
      case "keep-right":
        return "arrow-right";
      default:
        return "arrow-up";
    }
  };

  const applyTurnByTurnUiFromIndex = (idx: number) => {
    const step = navigationSteps.current[idx];
    if (!step) return;

    const instructionText =
      typeof step.html_instructions === "string"
        ? cleanHtmlInstruction(step.html_instructions)
        : "";

    setCurrentInstruction(instructionText);
    const maneuver = getStepManeuver(step);
    setCurrentManeuver(maneuver);
    setLaneHint(inferLaneHint(maneuver, instructionText));
    if (step?.distance?.value != null) {
      setDistanceToNextTurn(step.distance.value);
    }

    const next = navigationSteps.current[idx + 1];
    if (next?.html_instructions) {
      setNextInstruction(cleanHtmlInstruction(next.html_instructions));
      setNextManeuver(getStepManeuver(next));
    } else {
      setNextInstruction("");
      setNextManeuver(null);
    }
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
  const directionsCacheRef = useRef<
    Map<
      string,
      {
        ts: number;
        points: { latitude: number; longitude: number }[];
        steps: any[];
        eta: string;
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

  useEffect(() => {
    routeCoordinatesRef.current = routeCoordinates;
    // Reset hint when route changes significantly
    lastClosestRouteIndexRef.current = 0;
  }, [routeCoordinates]);

  const NAV_RENDER_TAU_SECONDS = 0.12; // lower = snappier, higher = smoother

  const computeNavPredictSeconds = (speedMps: number) => {
    const speedKmh = (speedMps || 0) * 3.6;
    // Low speed: less prediction to avoid wobble. Higher speed: more prediction to reduce perceived lag.
    if (speedKmh <= 10) return 0.25;
    if (speedKmh <= 40) return 0.25 + ((speedKmh - 10) / 30) * 0.35; // 0.25..0.60
    if (speedKmh <= 90) return 0.6 + ((speedKmh - 40) / 50) * 0.25; // 0.60..0.85
    return 0.9;
  };

  const lerp = (start: number, end: number, alpha: number) =>
    start + (end - start) * alpha;

  const angleDeltaDegrees = (toDeg: number, fromDeg: number) => {
    const t = ((toDeg % 360) + 360) % 360;
    const f = ((fromDeg % 360) + 360) % 360;
    let d = t - f;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
  };

  const distanceMetersBetween = (
    a: { latitude: number; longitude: number },
    b: { latitude: number; longitude: number },
  ) =>
    calculateDistance(a.latitude, a.longitude, b.latitude, b.longitude) * 1000;

  const applyPrediction = (
    anchor: { latitude: number; longitude: number },
    headingDegrees: number,
    speedMps: number,
    seconds: number,
  ) => {
    if (!speedMps || speedMps < 0.5 || seconds <= 0) return anchor;

    const headingRad = (headingDegrees * Math.PI) / 180;
    const meters = speedMps * seconds;

    const latOffset = (meters * Math.cos(headingRad)) / 111320;
    const lngOffset =
      (meters * Math.sin(headingRad)) /
      (111320 * Math.cos((anchor.latitude * Math.PI) / 180));

    return {
      latitude: anchor.latitude + latOffset,
      longitude: anchor.longitude + lngOffset,
    };
  };

  // Camera look-ahead center (keeps the marker lower on screen like Google/Waze)
  const offsetCoordinate = (
    anchor: { latitude: number; longitude: number },
    headingDegrees: number,
    meters: number,
  ) => {
    if (!meters) return anchor;

    const headingRad = (headingDegrees * Math.PI) / 180;
    const latOffset = (meters * Math.cos(headingRad)) / 111320;
    const lngOffset =
      (meters * Math.sin(headingRad)) /
      (111320 * Math.cos((anchor.latitude * Math.PI) / 180));

    return {
      latitude: anchor.latitude + latOffset,
      longitude: anchor.longitude + lngOffset,
    };
  };

  const computeNavLookAheadMeters = (speedMps: number) => {
    const speedKmh = (speedMps || 0) * 3.6;
    let base = 70;
    if (speedKmh <= 10) base = 70;
    else if (speedKmh <= 30)
      base = 70 + ((speedKmh - 10) / 20) * 40; // 70..110
    else if (speedKmh <= 60)
      base = 110 + ((speedKmh - 30) / 30) * 60; // 110..170
    else if (speedKmh <= 100)
      base = 170 + ((speedKmh - 60) / 40) * 30; // 170..200
    else base = 200;

    // Turn anticipation: as we approach the next maneuver, reduce look-ahead so
    // the marker stays more centered relative to the upcoming turn.
    const d = distanceToNextTurnRef.current;
    if (Number.isFinite(d) && d > 0 && d < 160) {
      const t = Math.max(0, Math.min(1, d / 160));
      const scale = 0.45 + 0.55 * t; // 0.45 at the turn, 1.0 at >=160m
      return base * scale;
    }

    return base;
  };

  const pickNavGpsTier = (speedMps: number, currentTier: 0 | 1 | 2) => {
    const speedKmh = (speedMps || 0) * 3.6;
    // Hysteresis to avoid flapping between tiers.
    if (currentTier === 0) {
      if (speedKmh > 4) return 1;
      return 0;
    }
    if (currentTier === 1) {
      if (speedKmh < 1.5) return 0;
      if (speedKmh > 30) return 2;
      return 1;
    }
    // currentTier === 2
    if (speedKmh < 20) return 1;
    return 2;
  };

  const navGpsOptionsForTier = (tier: 0 | 1 | 2) => {
    // NOTE: Keep BestForNavigation for correctness; just reduce cadence.
    if (tier === 0) {
      return {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1500,
        distanceInterval: 8,
      };
    }
    if (tier === 2) {
      return {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 500,
        distanceInterval: 2,
      };
    }
    return {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 800,
      distanceInterval: 4,
    };
  };

  useEffect(() => {
    if (!isNavigating || !mapReady || !mapRef.current) return;
    if (didApplyNavCameraFixRef.current) return;
    const pending = pendingNavCameraFixRef.current;
    if (!pending) return;

    const lookAheadCenter = offsetCoordinate(
      { latitude: pending.latitude, longitude: pending.longitude },
      cameraBearing || smoothedHeading,
      computeNavLookAheadMeters(pending.speedMps),
    );

    const durationMs = 650;

    // Hold the follow loop while this animation plays to prevent camera fights.
    navCameraHoldUntilRef.current = Date.now() + durationMs + 150;

    const bearing = cameraBearing || smoothedHeading;
    const zoom = cameraZoomRef.current || 17.2;

    // Google Maps-style: animate a single CameraPosition (center + bearing + tilt + zoom).
    const mapAny = mapRef.current as any;
    const mode = cameraApplyModeRef.current;
    const animateDuration = mode === "animate160" ? 160 : 0;

    if (mode === "setCamera" && mapAny?.setCamera) {
      mapAny.setCamera({
        center: lookAheadCenter,
        heading: bearing,
        pitch: 45,
        zoom,
      });
    } else if (
      (mode === "animate0" || mode === "animate160") &&
      mapAny?.animateCamera
    ) {
      mapAny.animateCamera(
        { center: lookAheadCenter, heading: bearing, pitch: 45, zoom },
        { duration: animateDuration },
      );
    } else if (mapAny?.setCamera) {
      mapAny.setCamera({
        center: lookAheadCenter,
        heading: bearing,
        pitch: 45,
        zoom,
      });
    } else if (mapAny?.animateCamera) {
      mapAny.animateCamera(
        { center: lookAheadCenter, heading: bearing, pitch: 45, zoom },
        { duration: durationMs },
      );
    }

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
        const dtSeconds =
          navLastFrameTime.current > 0
            ? (now - navLastFrameTime.current) / 1000
            : 0;
        navLastFrameTime.current = now;

        const alpha =
          dtSeconds > 0
            ? 1 - Math.exp(-dtSeconds / NAV_RENDER_TAU_SECONDS)
            : 0.12;

        const predicted = applyPrediction(
          target,
          smoothedHeading,
          navSpeedRef.current,
          computeNavPredictSeconds(navSpeedRef.current || 0),
        );

        const nextLat = lerp(current.latitude, predicted.latitude, alpha);
        const nextLng = lerp(current.longitude, predicted.longitude, alpha);

        navCurrent.current = { latitude: nextLat, longitude: nextLng };
        region.setValue({
          latitude: nextLat,
          longitude: nextLng,
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

  // Decode Google polyline
  const decodePolyline = (
    encoded: string,
  ): { latitude: number; longitude: number }[] => {
    const poly = [];
    let index = 0,
      len = encoded.length;
    let lat = 0,
      lng = 0;

    while (index < len) {
      let b,
        shift = 0,
        result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = result & 1 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = result & 1 ? ~(result >> 1) : result >> 1;
      lng += dlng;

      poly.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
    }
    return poly;
  };

  // STAGE 4.1: Smooth heading interpolation with max delta
  const smoothHeadingValue = (target: number, current: number): number => {
    // Normalize angles to 0-360
    target = ((target % 360) + 360) % 360;
    current = ((current % 360) + 360) % 360;

    // Calculate shortest path delta
    let delta = target - current;
    if (delta > 180) {
      delta -= 360;
    } else if (delta < -180) {
      delta += 360;
    }

    // Max delta per frame: 20 degrees (more responsive rotation)
    const MAX_DELTA = 20;
    if (Math.abs(delta) > MAX_DELTA) {
      delta = Math.sign(delta) * MAX_DELTA;
    }

    // Apply delta and normalize
    const result = current + delta;
    return ((result % 360) + 360) % 360;
  };

  // Haversine formula for distance calculation
  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number => {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const closestPointOnSegmentMeters = (
    p: { latitude: number; longitude: number },
    a: { latitude: number; longitude: number },
    b: { latitude: number; longitude: number },
  ): { point: { latitude: number; longitude: number }; distanceM: number } => {
    // Local equirectangular projection (good enough for short distances)
    const originLat = a.latitude;
    const originLng = a.longitude;
    const latRad = (originLat * Math.PI) / 180;
    const metersPerDegLat = 111320;
    const metersPerDegLng = 111320 * Math.cos(latRad);

    const bx = (b.longitude - originLng) * metersPerDegLng;
    const by = (b.latitude - originLat) * metersPerDegLat;
    const px = (p.longitude - originLng) * metersPerDegLng;
    const py = (p.latitude - originLat) * metersPerDegLat;

    const ab2 = bx * bx + by * by;
    if (ab2 < 1e-6) {
      const d = Math.hypot(px, py);
      return { point: a, distanceM: d };
    }

    let t = (px * bx + py * by) / ab2;
    t = Math.max(0, Math.min(1, t));

    const projX = t * bx;
    const projY = t * by;
    const projLat = originLat + projY / metersPerDegLat;
    const projLng = originLng + projX / metersPerDegLng;
    const dist = Math.hypot(px - projX, py - projY);

    return {
      point: { latitude: projLat, longitude: projLng },
      distanceM: dist,
    };
  };

  const closestPointOnPolylineMeters = (
    p: { latitude: number; longitude: number },
    poly: { latitude: number; longitude: number }[],
    indexHint: number,
  ): {
    point: { latitude: number; longitude: number };
    distanceM: number;
    index: number;
  } => {
    if (poly.length < 2) {
      return { point: p, distanceM: Infinity, index: 0 };
    }

    const n = poly.length;
    const hint = Math.max(0, Math.min(n - 2, indexHint || 0));
    const useFullScan = n <= 120;
    const window = 50;
    const start = useFullScan ? 0 : Math.max(0, hint - window);
    const end = useFullScan ? n - 2 : Math.min(n - 2, hint + window);

    let bestDistance = Number.POSITIVE_INFINITY;
    let bestPoint = p;
    let bestIndex = hint;

    for (let i = start; i <= end; i++) {
      const res = closestPointOnSegmentMeters(p, poly[i], poly[i + 1]);
      if (res.distanceM < bestDistance) {
        bestDistance = res.distanceM;
        bestPoint = res.point;
        bestIndex = i;
      }
    }

    return { point: bestPoint, distanceM: bestDistance, index: bestIndex };
  };

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

    const speed = userLocation?.speed || 0; // m/s
    const speedKmh = speed * 3.6;

    // Calculate easing factor based on speed
    // Low speed (0-10 km/h): slow easing (0.02-0.05)
    // Medium speed (10-50 km/h): medium easing (0.05-0.15)
    // High speed (50+ km/h): fast easing (0.15-0.25)
    let easingFactor = 0.02; // Default: very slow
    if (speedKmh > 50) {
      easingFactor = 0.25; // Fast easing at highway speeds
    } else if (speedKmh > 10) {
      easingFactor = 0.05 + ((speedKmh - 10) / 40) * 0.1; // Interpolate between 0.05 and 0.15
    } else if (speedKmh > 0) {
      easingFactor = 0.02 + (speedKmh / 10) * 0.03; // Interpolate between 0.02 and 0.05
    }

    const intervalId = setInterval(() => {
      setCameraBearing((prev) => {
        const target = smoothedHeading;

        // Calculate shortest path
        let delta = target - prev;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;

        // Apply easing
        const result = prev + delta * easingFactor;
        return ((result % 360) + 360) % 360;
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

    const speed = userLocation?.speed || 0; // m/s
    const speedKmh = speed * 3.6;

    // Calculate target pitch based on speed ranges
    let targetPitch = 0;
    if (speedKmh <= 10) {
      // 0-10 km/h: Linear interpolation from 0° to 15°
      targetPitch = (speedKmh / 10) * 15;
    } else if (speedKmh <= 50) {
      // 10-50 km/h: Linear interpolation from 15° to 30°
      targetPitch = 15 + ((speedKmh - 10) / 40) * 15;
    } else {
      // 50+ km/h: Linear interpolation from 30° to 60°
      const speedOver50 = Math.min(speedKmh - 50, 50); // Cap at 100 km/h
      targetPitch = 30 + (speedOver50 / 50) * 30;
    }

    // Smooth transition to target pitch
    const intervalId = setInterval(() => {
      setCameraPitch((prev) => {
        const delta = targetPitch - prev;
        const easingFactor = 0.1; // Smooth but responsive
        return prev + delta * easingFactor;
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

      const fallback = userLocationRef.current
        ? {
            latitude: userLocationRef.current.latitude,
            longitude: userLocationRef.current.longitude,
          }
        : null;

      const base = inArrival
        ? { latitude: destNow!.latitude, longitude: destNow!.longitude }
        : navCurrent.current || navTarget.current || fallback;

      if (base) {
        const bearingTarget = cameraBearingRef.current;
        const speedMps = inArrival
          ? 0
          : navSpeedRef.current || userLocationRef.current?.speed || 0;

        let pitchTarget = inArrival ? 45 : Math.max(30, cameraPitchRef.current);
        let zoomTarget = cameraZoomRef.current || 17.2;

        const d = distanceToNextTurnRef.current;
        if (!inArrival && Number.isFinite(d) && d > 0) {
          // Close to the maneuver: slightly more top-down and slightly closer.
          if (d < 60) {
            pitchTarget = Math.min(pitchTarget, 32);
            zoomTarget = Math.max(zoomTarget, 18.0);
          } else if (d < 120) {
            pitchTarget = Math.min(pitchTarget, 38);
          }
        }

        const centerTarget = inArrival
          ? base
          : offsetCoordinate(
              base,
              bearingTarget,
              computeNavLookAheadMeters(speedMps),
            );

        const lastFrameAt = navCameraLastFrameAtRef.current || now;
        const dtS = Math.min(0.25, Math.max(0.001, (now - lastFrameAt) / 1000));
        navCameraLastFrameAtRef.current = now;

        const alphaCenter = 1 - Math.exp(-dtS / TAU_CENTER_S);
        const alphaHeading = 1 - Math.exp(-dtS / TAU_HEADING_S);
        const alphaPitch = 1 - Math.exp(-dtS / TAU_PITCH_S);
        const alphaZoom = 1 - Math.exp(-dtS / TAU_ZOOM_S);

        if (!navCameraCurrentRef.current) {
          navCameraCurrentRef.current = {
            center: centerTarget,
            heading: bearingTarget,
            pitch: pitchTarget,
            zoom: zoomTarget,
          };
        } else {
          const cur = navCameraCurrentRef.current;
          const nextCenter = {
            latitude: lerp(
              cur.center.latitude,
              centerTarget.latitude,
              alphaCenter,
            ),
            longitude: lerp(
              cur.center.longitude,
              centerTarget.longitude,
              alphaCenter,
            ),
          };
          const headingDelta = angleDeltaDegrees(bearingTarget, cur.heading);
          const nextHeading =
            (((cur.heading + headingDelta * alphaHeading) % 360) + 360) % 360;
          const nextPitch = lerp(cur.pitch, pitchTarget, alphaPitch);
          const nextZoom = lerp(cur.zoom, zoomTarget, alphaZoom);

          navCameraCurrentRef.current = {
            center: nextCenter,
            heading: nextHeading,
            pitch: nextPitch,
            zoom: nextZoom,
          };
        }

        const curNow = navCameraCurrentRef.current;
        if (
          curNow &&
          now - navCameraLastApplyAtRef.current >= APPLY_MIN_INTERVAL_MS
        ) {
          const lastCenter = navLastCameraCenterRef.current;
          const centerMoveM = lastCenter
            ? distanceMetersBetween(lastCenter, curNow.center)
            : Infinity;
          const bearingDelta = Math.abs(
            angleDeltaDegrees(
              curNow.heading,
              navLastCameraBearingAppliedRef.current,
            ),
          );
          const pitchDelta = Math.abs(
            curNow.pitch - navLastCameraPitchAppliedRef.current,
          );
          const zoomDelta = Math.abs(
            curNow.zoom - navLastCameraZoomAppliedRef.current,
          );

          if (
            centerMoveM >= CENTER_DEADBAND_M ||
            bearingDelta >= BEARING_DEADBAND_DEG ||
            pitchDelta >= PITCH_DEADBAND_DEG ||
            zoomDelta >= ZOOM_DEADBAND
          ) {
            navCameraLastApplyAtRef.current = now;
            const mapAny = mapRef.current as any;
            const mode = cameraApplyModeRef.current;
            const animateDuration = mode === "animate160" ? 160 : 0;

            if (mode === "setCamera" && mapAny?.setCamera) {
              mapAny.setCamera({
                center: curNow.center,
                heading: curNow.heading,
                pitch: curNow.pitch,
                zoom: curNow.zoom,
              });
            } else if (
              (mode === "animate0" || mode === "animate160") &&
              mapAny?.animateCamera
            ) {
              mapAny.animateCamera(
                {
                  center: curNow.center,
                  heading: curNow.heading,
                  pitch: curNow.pitch,
                  zoom: curNow.zoom,
                },
                { duration: animateDuration },
              );
            } else if (mapAny?.setCamera) {
              mapAny.setCamera({
                center: curNow.center,
                heading: curNow.heading,
                pitch: curNow.pitch,
                zoom: curNow.zoom,
              });
            } else if (mapAny?.animateCamera) {
              mapAny.animateCamera(
                {
                  center: curNow.center,
                  heading: curNow.heading,
                  pitch: curNow.pitch,
                  zoom: curNow.zoom,
                },
                { duration: 0 },
              );
            }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNavigating, appState, mapReady]);

  const requestNavRecenter = () => {
    const base =
      navCurrent.current ||
      navTarget.current ||
      (userLocationRef.current
        ? {
            latitude: userLocationRef.current.latitude,
            longitude: userLocationRef.current.longitude,
          }
        : null);

    if (!base) {
      setNavViewMode("follow");
      navViewModeRef.current = "follow";
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
    setNavViewMode("follow");
    navViewModeRef.current = "follow";
  };

  const requestNavOverview = () => {
    setNavViewMode("overview");
    navViewModeRef.current = "overview";
    const points = routeCoordinatesRef.current;
    if (points && points.length > 1) {
      mapRef.current?.fitToCoordinates(points, {
        edgePadding: { top: 120, right: 70, bottom: 320, left: 70 },
        animated: true,
      });
    }
  };

  // Dynamic camera zoom (Google Maps style): combine speed-based zoom-out and
  // distance-to-next-maneuver zoom-out, so long straight segments zoom out more.
  useEffect(() => {
    if (!isNavigating || appState !== "active") {
      setCameraZoom(16.8); // Reset when not navigating
      return;
    }

    const speed = userLocation?.speed || 0; // m/s
    const speedKmh = speed * 3.6;

    // Target Google zoom LEVEL (higher = closer).
    let speedZoom = 18.3;
    if (speedKmh <= 30) {
      speedZoom = 18.3 - (speedKmh / 30) * 1.0; // 18.3..17.3
    } else if (speedKmh <= 60) {
      speedZoom = 17.3 - ((speedKmh - 30) / 30) * 0.8; // 17.3..16.5
    } else {
      speedZoom = 16.5; // Base highway zoom-out
    }

    // Zoom out more when the next maneuver is far away.
    const d = Number.isFinite(distanceToNextTurn) ? distanceToNextTurn : 0;
    let distanceZoom: number | null = null;
    if (d >= 300 && d < 1000) {
      distanceZoom = 16.8 - ((d - 300) / 700) * 0.6; // 16.8..16.2
    } else if (d >= 1000 && d < 3000) {
      distanceZoom = 16.2 - ((d - 1000) / 2000) * 0.7; // 16.2..15.5
    } else if (d >= 3000) {
      distanceZoom = 15.5 - Math.min((d - 3000) / 5000, 1) * 0.5; // 15.5..15.0
    }

    let targetZoom =
      distanceZoom != null ? Math.min(speedZoom, distanceZoom) : speedZoom;

    // Turn anticipation: zoom in a bit as we approach the next maneuver.
    // (Keeps the junction readable like Google Maps.)
    if (speedKmh <= 110 && d > 0 && d < 180) {
      const t = Math.max(0, Math.min(1, d / 180));
      const turnZoom = 18.5 - t * 0.8; // 18.5..17.7
      targetZoom = Math.max(targetZoom, turnZoom);
    }

    // Smooth transition to target zoom
    const intervalId = setInterval(() => {
      setCameraZoom((prev) => {
        const delta = targetZoom - prev;
        const easingFactor = 0.07; // Slow and smooth zoom transitions
        return prev + delta * easingFactor;
      });
    }, 100); // 10 FPS for zoom (subtle changes)

    return () => clearInterval(intervalId);
  }, [isNavigating, userLocation?.speed, distanceToNextTurn, appState]);

  // Auto-center on user's current location when map loads
  useEffect(() => {
    const getCenterOnUserLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          const { latitude, longitude } = location.coords;
          setUserLocation({ latitude, longitude, speed: 0 });

          // Center map on user location
          mapRef.current?.animateToRegion(
            {
              latitude,
              longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            },
            1000,
          );
        }
      } catch (error) {
        if (__DEV__) console.log("Could not get initial location:", error);
      }
    };

    getCenterOnUserLocation();
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
  // STAGE 5.3: Filter and prioritize navigation instructions
  const filterNavigationSteps = (steps: any[]) => {
    const filtered = [];
    const noiseKeywords = [
      "continue straight",
      "continue onto",
      "head",
      "slight",
    ];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const instruction = step.html_instructions.toLowerCase();
      const distance = step.distance.value;

      // Skip very short steps (< 50m) unless it's a turn
      if (distance < 50 && !instruction.includes("turn")) {
        continue;
      }

      // Skip noise instructions unless significant distance
      let isNoise = false;
      for (const keyword of noiseKeywords) {
        if (instruction.includes(keyword) && distance < 200) {
          isNoise = true;
          break;
        }
      }

      if (!isNoise) {
        filtered.push(step);
      }
    }

    // Always keep at least the first step
    if (filtered.length === 0 && steps.length > 0) {
      filtered.push(steps[0]);
    }

    return filtered;
  };

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
    const originCoords = options?.origin ?? userLocation;
    if (!originCoords) {
      // STAGE 9.2: Handle missing location gracefully
      if (!options?.silent) {
        Alert.alert(
          "Location Required",
          "Please enable location services to calculate route.",
          [{ text: "OK" }],
        );
      }
      return;
    }

    const nowMs = Date.now();

    // Cooldown after hitting OVER_QUERY_LIMIT
    if (directionsCooldownUntilRef.current > nowMs) {
      if (!options?.silent && nowMs - lastOverQueryAlertAtRef.current > 8000) {
        lastOverQueryAlertAtRef.current = nowMs;
        Alert.alert(
          "Directions Limit Reached",
          "Google Directions API quota was exceeded (OVER_QUERY_LIMIT). Please wait a bit and try again.",
          [{ text: "OK" }],
        );
      }
      return;
    }

    // Cache key: round origin to reduce churn from tiny GPS movement
    const roundCoord = (v: number) => Math.round(v * 2000) / 2000; // ~0.0005° ≈ 55m
    const waypointsKey =
      stops.length > 0
        ? stops
            .map((s) => `${roundCoord(s.latitude)}:${roundCoord(s.longitude)}`)
            .join("|")
        : "";
    const cacheKey = `${roundCoord(originCoords.latitude)},${roundCoord(
      originCoords.longitude,
    )} -> ${roundCoord(destLat)},${roundCoord(destLng)} | ${waypointsKey}`;

    // Serve from cache when recent
    const CACHE_TTL_MS = 60_000;
    const cached = directionsCacheRef.current.get(cacheKey);
    if (cached && nowMs - cached.ts <= CACHE_TTL_MS) {
      setRouteCoordinates(cached.points);
      navigationSteps.current = cached.steps;
      currentStepIndex.current = 0;
      if (navigationSteps.current.length > 0) {
        applyTurnByTurnUiFromIndex(0);
      }
      setEta(cached.eta);
      return;
    }

    // Coalesce concurrent requests: keep only the latest
    if (routeRequestInFlightRef.current) {
      pendingRouteRequestRef.current = {
        destLat,
        destLng,
        retryCount,
        options,
      };
      return;
    }

    try {
      routeRequestInFlightRef.current = true;
      const origin = `${originCoords.latitude},${originCoords.longitude}`;
      const destination = `${destLat},${destLng}`;

      // Build waypoints parameter if there are stops
      let waypointsParam = "";
      if (stops.length > 0) {
        const waypoints = stops
          .map((stop) => `${stop.latitude},${stop.longitude}`)
          .join("|");
        waypointsParam = `&waypoints=optimize:true|${waypoints}`;
      }

      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}${waypointsParam}&key=${process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}`;

      // STAGE 9.2: Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(url, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      // STAGE 9.2: Handle API errors gracefully
      if (data.status === "ZERO_RESULTS") {
        if (!options?.silent) {
          Alert.alert(
            "No Route Found",
            "Unable to find a route to this destination. Please try a different location.",
            [{ text: "OK" }],
          );
        }
        return;
      }

      if (data.status === "OVER_QUERY_LIMIT") {
        // Back off to avoid burning quota; do not throw.
        directionsCooldownUntilRef.current = nowMs + 60_000;
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

      if (data.status !== "OK") {
        if (!options?.silent) {
          Alert.alert(
            "Route Error",
            `Unable to calculate route (status: ${data.status}).`,
            [{ text: "OK" }],
          );
        }
        return;
      }

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const points = decodePolyline(route.overview_polyline.points);
        setRouteCoordinates(points);

        // Combine all steps from all legs
        navigationSteps.current = [];
        let totalDuration = 0;
        route.legs.forEach((leg: any) => {
          // STAGE 5.3: Filter out noise instructions
          const filteredSteps = filterNavigationSteps(leg.steps);
          navigationSteps.current.push(...filteredSteps);
          totalDuration += leg.duration.value;
        });
        currentStepIndex.current = 0;

        // Set initial instruction
        if (navigationSteps.current.length > 0) {
          applyTurnByTurnUiFromIndex(0);
        }

        // Calculate total ETA
        const hours = Math.floor(totalDuration / 3600);
        const minutes = Math.floor((totalDuration % 3600) / 60);
        const computedEta =
          hours > 0 ? `${hours}h ${minutes}m` : `${minutes} min`;
        setEta(computedEta);

        // Cache result to avoid repeated calls for near-identical origin
        directionsCacheRef.current.set(cacheKey, {
          ts: nowMs,
          points,
          steps: navigationSteps.current,
          eta: computedEta,
        });

        // Fit map to route (skip during navigation recalc to avoid camera jumps)
        if (options?.fit !== false) {
          mapRef.current?.fitToCoordinates(points, {
            edgePadding: { top: 100, right: 50, bottom: 300, left: 50 },
            animated: true,
          });
        }
      }
    } catch (error: any) {
      console.error("Error fetching route:", error);

      // STAGE 9.2: Smart retry logic for network failures
      if (
        retryCount < 2 &&
        (error.name === "AbortError" || error.message?.includes("network"))
      ) {
        if (__DEV__)
          console.log(
            `Retrying route calculation... (attempt ${retryCount + 1})`,
          );
        // Exponential backoff: 1s, 2s
        setTimeout(
          () => {
            calculateRoute(destLat, destLng, retryCount + 1, options);
          },
          1000 * Math.pow(2, retryCount),
        );
        return;
      }

      if (options?.silent) {
        return;
      }

      // Show user-friendly error message
      const errorMessage =
        error.name === "AbortError"
          ? "Request timed out. Please check your internet connection and try again."
          : "Unable to calculate route. Please check your internet connection.";

      Alert.alert("Connection Error", errorMessage, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Retry",
          onPress: () => calculateRoute(destLat, destLng, 0, options),
        },
      ]);
    } finally {
      routeRequestInFlightRef.current = false;

      // Run the latest queued request (if any)
      const pending = pendingRouteRequestRef.current;
      if (pending) {
        pendingRouteRequestRef.current = null;
        // Small delay to avoid immediate bursts
        setTimeout(() => {
          calculateRoute(
            pending.destLat,
            pending.destLng,
            pending.retryCount,
            pending.options,
          );
        }, 250);
      }
    }
  };

  const handleMyLocation = async () => {
    try {
      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        // STAGE 9.2: Better permission error handling
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

      // Get current position (one-time, no tracking)
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = location.coords;
      setUserLocation({ latitude, longitude });

      // Animate map to user location
      mapRef.current?.animateToRegion(
        {
          latitude,
          longitude,
          latitudeDelta: 0.003,
          longitudeDelta: 0.003,
        },
        1000,
      );
    } catch (error: any) {
      console.error("Error getting location:", error);

      // STAGE 9.2: Specific error messages
      let errorMessage = "Failed to get your location. Please try again.";
      if (error.code === "E_LOCATION_TIMEOUT") {
        errorMessage =
          "Location request timed out. Make sure you have a clear view of the sky and try again.";
      } else if (error.code === "E_LOCATION_UNAVAILABLE") {
        errorMessage =
          "Location services are unavailable. Please check your device settings.";
      }

      Alert.alert("Location Error", errorMessage, [{ text: "OK" }]);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleToggleTracking = async () => {
    if (isTracking) {
      // Stop tracking
      try {
        if (locationSubscription.current) {
          locationSubscription.current.remove();
          locationSubscription.current = null;
        }
        setIsTracking(false);
      } catch (error) {
        console.error("Error stopping tracking:", error);
      }
    } else {
      // Start tracking
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Permission Denied",
            "Location permission is required for GPS tracking.",
          );
          return;
        }

        // Start continuous tracking with watchPositionAsync
        const subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 100,
            distanceInterval: 1,
          },
          (location) => {
            const { latitude, longitude } = location.coords;
            setUserLocation({ latitude, longitude });

            // Animate camera to follow user (zoom closer during navigation)
            mapRef.current?.animateToRegion(
              {
                latitude,
                longitude,
                latitudeDelta: isNavigating ? 0.005 : 0.01,
                longitudeDelta: isNavigating ? 0.005 : 0.01,
              },
              300,
            );
          },
        );

        locationSubscription.current = subscription;
        setIsTracking(true);
      } catch (error) {
        console.error("Error starting tracking:", error);
        Alert.alert("Error", "Failed to start GPS tracking. Please try again.");
      }
    }
  };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleToggleSensors = async () => {
    if (isSensorsActive) {
      // Stop sensors
      try {
        if (gyroSubscription.current) {
          gyroSubscription.current.remove();
          gyroSubscription.current = null;
        }
        if (magnetometerSubscription.current) {
          magnetometerSubscription.current.remove();
          magnetometerSubscription.current = null;
        }
        setIsSensorsActive(false);
        isCalibrated.current = false;
        calibrationSamples.current = [];
      } catch (error) {
        console.error("Error stopping sensors:", error);
      }
    } else {
      // Start sensors
      try {
        // Gyroscope for smooth rotation (60 FPS)
        Gyroscope.setUpdateInterval(16);
        const gyroSub = Gyroscope.addListener((data) => {
          if (!isCalibrated.current) {
            // Calibration phase
            calibrationSamples.current.push(data.z);
            if (calibrationSamples.current.length >= 30) {
              isCalibrated.current = true;
            }
            return;
          }

          // Apply gyroscope rotation (z-axis for heading)
          const rotationRate = data.z * (180 / Math.PI); // Convert to degrees
          currentHeading.current += rotationRate * 0.016; // 16ms delta

          // Normalize to 0-360
          currentHeading.current = ((currentHeading.current % 360) + 360) % 360;

          // STAGE 4.1: Update raw heading for smooth interpolation
          setRawHeading(currentHeading.current);
          setHeading(currentHeading.current); // Legacy compatibility
        });
        gyroSubscription.current = gyroSub;

        // Magnetometer for drift correction (10 FPS)
        Magnetometer.setUpdateInterval(100);
        const magSub = Magnetometer.addListener((data) => {
          if (!isCalibrated.current) return;

          // Calculate heading from magnetometer
          const magHeading = Math.atan2(data.y, data.x) * (180 / Math.PI);
          const normalizedMagHeading = (magHeading + 360) % 360;

          // Complementary filter: 98% gyro, 2% magnetometer
          const drift = normalizedMagHeading - currentHeading.current;
          let correction = drift;

          // Handle wrap-around
          if (Math.abs(drift) > 180) {
            correction = drift > 0 ? drift - 360 : drift + 360;
          }

          // Apply bounded correction
          const maxCorrection = 10;
          correction = Math.max(
            -maxCorrection,
            Math.min(maxCorrection, correction),
          );

          currentHeading.current += correction * 0.02;
          currentHeading.current = ((currentHeading.current % 360) + 360) % 360;
        });
        magnetometerSubscription.current = magSub;

        setIsSensorsActive(true);
      } catch (error) {
        console.error("Error starting sensors:", error);
        Alert.alert("Error", "Failed to start sensors. Please try again.");
      }
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleToggleRecording = () => {
    if (isRecording) {
      // Stop recording
      try {
        if (durationInterval.current) {
          clearInterval(durationInterval.current);
          durationInterval.current = null;
        }
        setIsRecording(false);
        Alert.alert(
          "Recording Stopped",
          `Distance: ${distance.toFixed(2)} km\nDuration: ${Math.floor(duration / 60)}m ${duration % 60}s`,
        );
      } catch (error) {
        console.error("Error stopping recording:", error);
      }
    } else {
      // Start recording
      try {
        routePoints.current = [];
        setDistance(0);
        setDuration(0);

        // Start duration counter
        const startTime = Date.now();
        durationInterval.current = setInterval(() => {
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          setDuration(elapsed);
        }, 1000);

        setIsRecording(true);
      } catch (error) {
        console.error("Error starting recording:", error);
        Alert.alert("Error", "Failed to start recording. Please try again.");
      }
    }
  };

  const handleStartNavigation = async () => {
    if (isNavigating) {
      // Stop navigation
      try {
        // Stop tracking
        if (locationSubscription.current) {
          locationSubscription.current.remove();
          locationSubscription.current = null;
        }
        if (navGpsTierIntervalRef.current) {
          clearInterval(navGpsTierIntervalRef.current);
          navGpsTierIntervalRef.current = null;
        }
        navGpsResubInFlightRef.current = false;
        // Stop sensors
        if (headingSubscription.current) {
          headingSubscription.current.remove();
          headingSubscription.current = null;
        }
        if (gyroSubscription.current) {
          gyroSubscription.current.remove();
          gyroSubscription.current = null;
        }
        if (magnetometerSubscription.current) {
          magnetometerSubscription.current.remove();
          magnetometerSubscription.current = null;
        }
        // Stop recording
        if (durationInterval.current) {
          clearInterval(durationInterval.current);
          durationInterval.current = null;
        }

        setIsNavigating(false);
        setIsTracking(false);
        setIsSensorsActive(false);
        setIsRecording(false);
        setNavViewMode("follow");
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
    } else {
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
        setNavViewMode("follow");
        navViewModeRef.current = "follow";
        setIsNavigating(true);
        setCurrentStopIndex(stops.length > 0 ? 0 : -1);
        setIsInArrivalZone(false);

        // Set initial navigation zoom LEVEL (Google-like).
        setCameraZoom(17.2);

        // Immediately move camera into navigation view (like pressing the location button)
        // Prefer cached/last-known location first so we don't block on GPS.
        const seedNavAndCamera = (
          coords: { latitude: number; longitude: number },
          speedMps: number,
          durationMs: number,
        ) => {
          const { latitude, longitude } = coords;

          setUserLocation({ latitude, longitude, speed: speedMps });

          // Seed smooth marker system right away
          navSpeedRef.current = speedMps;
          navLatestSpeedMpsRef.current = speedMps;
          navTarget.current = { latitude, longitude };
          if (!navCurrent.current) {
            navCurrent.current = { latitude, longitude };
          }
          if (!navMarkerRegion.current) {
            navMarkerRegion.current = new AnimatedRegion({
              latitude,
              longitude,
              latitudeDelta: 0.0038,
              longitudeDelta: 0.0038,
            });
          }

          // Immediate camera move (or queue it until map is ready)
          const base = { latitude, longitude };
          const bearing = cameraBearing || smoothedHeading;
          const lookAheadCenter = offsetCoordinate(
            base,
            bearing,
            computeNavLookAheadMeters(speedMps),
          );

          if (mapReady && mapRef.current) {
            // Prevent the follow loop from fighting this explicit snap.
            navCameraHoldUntilRef.current = Date.now() + durationMs + 150;

            const zoom = cameraZoomRef.current || 17.2;

            // Google Maps-style: single CameraPosition animation (no region-based zoom).
            const mapAny = mapRef.current as any;
            const mode = cameraApplyModeRef.current;
            const animateDuration = mode === "animate160" ? 160 : 0;
            if (mode === "setCamera" && mapAny?.setCamera) {
              mapAny.setCamera({
                center: lookAheadCenter,
                heading: bearing,
                pitch: 45,
                zoom,
              });
            } else if (
              (mode === "animate0" || mode === "animate160") &&
              mapAny?.animateCamera
            ) {
              mapAny.animateCamera(
                {
                  center: lookAheadCenter,
                  heading: bearing,
                  pitch: 45,
                  zoom,
                },
                { duration: animateDuration || durationMs },
              );
            } else if (mapAny?.setCamera) {
              mapAny.setCamera({
                center: lookAheadCenter,
                heading: bearing,
                pitch: 45,
                zoom,
              });
            } else if (mapAny?.animateCamera) {
              mapAny.animateCamera(
                {
                  center: lookAheadCenter,
                  heading: bearing,
                  pitch: 45,
                  zoom,
                },
                { duration: durationMs },
              );
            }

            // Seed camera state so the follow loop continues smoothly.
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
          } else {
            pendingNavCameraFixRef.current = {
              latitude,
              longitude,
              speedMps,
            };
            didApplyNavCameraFixRef.current = false;
          }
        };

        const maybeSnapFromExisting = () => {
          const base =
            navCurrent.current ||
            navTarget.current ||
            (userLocationRef.current
              ? {
                  latitude: userLocationRef.current.latitude,
                  longitude: userLocationRef.current.longitude,
                }
              : null);
          if (!base) return;

          const speedMps =
            navSpeedRef.current || userLocationRef.current?.speed || 0;
          seedNavAndCamera(base, speedMps, 550);
        };

        // 1) Snap immediately from whatever we already know (prevents “press location first”).
        try {
          maybeSnapFromExisting();
        } catch (e) {
          if (__DEV__)
            console.log("Immediate nav camera snap (existing) failed:", e);
        }

        // 2) Try last-known position (fast, cached)
        try {
          const last = await Location.getLastKnownPositionAsync({
            maxAge: 20000,
            requiredAccuracy: 80,
          });
          if (last?.coords) {
            const distM =
              userLocationRef.current?.latitude != null &&
              userLocationRef.current?.longitude != null
                ? calculateDistance(
                    userLocationRef.current.latitude,
                    userLocationRef.current.longitude,
                    last.coords.latitude,
                    last.coords.longitude,
                  ) * 1000
                : Infinity;

            // Only resnap if we haven't snapped yet, or if cached is meaningfully different.
            if (!didApplyNavCameraFixRef.current || distM > 12) {
              seedNavAndCamera(
                {
                  latitude: last.coords.latitude,
                  longitude: last.coords.longitude,
                },
                last.coords.speed || 0,
                450,
              );
            }
          }
        } catch (e) {
          if (__DEV__) console.log("Last-known nav camera snap failed:", e);
        }

        // 3) Finally, get a fresh GPS fix (slower but most accurate)
        try {
          const initial = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.BestForNavigation,
          });
          const { latitude, longitude, speed } = initial.coords;

          const distM =
            userLocationRef.current?.latitude != null &&
            userLocationRef.current?.longitude != null
              ? calculateDistance(
                  userLocationRef.current.latitude,
                  userLocationRef.current.longitude,
                  latitude,
                  longitude,
                ) * 1000
              : Infinity;

          if (!didApplyNavCameraFixRef.current || distM > 12) {
            seedNavAndCamera(
              { latitude, longitude },
              speed || 0,
              didApplyNavCameraFixRef.current ? 350 : 700,
            );
          } else {
            // Still seed marker/speed so smoothing starts correctly.
            setUserLocation({ latitude, longitude, speed: speed || 0 });
            navSpeedRef.current = speed || 0;
            navLatestSpeedMpsRef.current = speed || 0;
            navTarget.current = { latitude, longitude };
            if (!navCurrent.current) {
              navCurrent.current = { latitude, longitude };
            }
          }
        } catch (e) {
          // If the one-shot fix fails, navigation will still start and camera will follow on watchPosition.
          if (__DEV__) console.log("Initial navigation camera fix failed:", e);
        }

        const onNavLocationUpdate = async (
          location: Location.LocationObject,
        ) => {
          const { latitude, longitude, speed } = location.coords;
          const speedMps = speed || 0;

          const destNow = destinationRef.current;
          const routeNow = routeCoordinatesRef.current;
          const raw = { latitude, longitude };

          navLatestSpeedMpsRef.current = speedMps;
          setUserLocation({ latitude, longitude, speed: speedMps });

          // Update target position for smooth marker rendering
          navSpeedRef.current = speedMps;

          // Google-like map-matching: keep marker visually on the route when close.
          // Also use this distance to decide "off route" without scanning the whole polyline.
          let distanceToRouteMeters = Infinity;
          if (routeNow.length >= 2) {
            const closest = closestPointOnPolylineMeters(
              raw,
              routeNow,
              lastClosestRouteIndexRef.current,
            );
            lastClosestRouteIndexRef.current = closest.index;
            distanceToRouteMeters = closest.distanceM;

            // Speed-adaptive snapping + hysteresis (prevents flicker when hovering near threshold)
            const speedKmh = (speedMps || 0) * 3.6;
            const snapInMeters = (() => {
              if (speedKmh <= 10) return 12;
              if (speedKmh <= 40) return 12 + ((speedKmh - 10) / 30) * 6; // 12..18
              if (speedKmh <= 90) return 18 + ((speedKmh - 40) / 50) * 6; // 18..24
              return 26;
            })();
            const snapOutMeters = snapInMeters + 6;

            // Don't try to snap when clearly off-route.
            const SNAP_HARD_DISABLE_METERS = 60;
            if (distanceToRouteMeters >= SNAP_HARD_DISABLE_METERS) {
              navSnapActiveRef.current = false;
            } else if (navSnapActiveRef.current) {
              if (distanceToRouteMeters > snapOutMeters) {
                navSnapActiveRef.current = false;
              }
            } else {
              if (distanceToRouteMeters <= snapInMeters) {
                navSnapActiveRef.current = true;
              }
            }

            navTarget.current = navSnapActiveRef.current ? closest.point : raw;
          } else {
            navTarget.current = raw;
          }
          if (!navCurrent.current) {
            navCurrent.current = { latitude, longitude };
          }
          if (!navMarkerRegion.current) {
            navMarkerRegion.current = new AnimatedRegion({
              latitude,
              longitude,
              latitudeDelta: 0.0038,
              longitudeDelta: 0.0038,
            });
          }

          // Check if user has deviated from route
          if (routeNow.length >= 2 && Number.isFinite(distanceToRouteMeters)) {
            const minDistanceKm = distanceToRouteMeters / 1000;

            // If user is more than 50 meters off route, recalculate (THROTTLED)
            if (destNow && minDistanceKm > 0.05) {
              const now = Date.now();
              if (offRouteSinceRef.current == null) {
                offRouteSinceRef.current = now;
              }

              const OFF_ROUTE_GRACE_MS = 4000; // require sustained deviation
              const ROUTE_RECALC_COOLDOWN_MS = 30000; // prevent quota burn

              const offRouteForMs = now - offRouteSinceRef.current;
              const canRecalc =
                offRouteForMs >= OFF_ROUTE_GRACE_MS &&
                !routeRecalcInFlightRef.current &&
                now - lastRouteRecalcAtRef.current >= ROUTE_RECALC_COOLDOWN_MS;

              if (canRecalc) {
                routeRecalcInFlightRef.current = true;
                lastRouteRecalcAtRef.current = now;
                if (__DEV__)
                  console.log(
                    `Off route by ${distanceToRouteMeters.toFixed(0)}m - recalculating (throttled)...`,
                  );
                try {
                  await calculateRoute(destNow.latitude, destNow.longitude, 0, {
                    origin: { latitude, longitude },
                    silent: true,
                    fit: false,
                  });
                } catch (error) {
                  console.error("Error recalculating route:", error);
                } finally {
                  routeRecalcInFlightRef.current = false;
                }
              }
            } else {
              offRouteSinceRef.current = null;
            }
          } else {
            offRouteSinceRef.current = null;
          }

          // STAGE 5.1: Check if we've arrived at current stop (auto-advance)
          if (stops.length > 0 && currentStopIndex < stops.length) {
            const targetStopIndex =
              currentStopIndex === -1 ? 0 : currentStopIndex;
            if (targetStopIndex < stops.length) {
              const currentStop = stops[targetStopIndex];
              const distToStop = calculateDistance(
                latitude,
                longitude,
                currentStop.latitude,
                currentStop.longitude,
              );

              // Auto-advance when within 10m of current stop
              if (distToStop < 0.01) {
                if (__DEV__)
                  console.log(`Arrived at stop: ${currentStop.address}`);
                setCurrentStopIndex(targetStopIndex + 1);
              }
            }
          }

          // STAGE 5.2: Arrival zone detection for final destination
          if (destination && currentStopIndex >= stops.length) {
            const distToDestination = calculateDistance(
              latitude,
              longitude,
              destination.latitude,
              destination.longitude,
            );

            // Enter arrival zone when within 20m
            if (distToDestination < 0.02 && !isInArrivalZone) {
              if (__DEV__) console.log("Entering arrival zone (< 20m)");
              setIsInArrivalZone(true);
            }
          }

          // Update distance to next turn
          if (navigationSteps.current[currentStepIndex.current]) {
            const nextTurn = navigationSteps.current[currentStepIndex.current];
            const dist = calculateDistance(
              latitude,
              longitude,
              nextTurn.end_location.lat,
              nextTurn.end_location.lng,
            );
            setDistanceToNextTurn(dist * 1000); // Convert to meters

            // STAGE 5.3: Move to next step with better threshold (30m for filtered steps)
            if (dist < 0.03) {
              currentStepIndex.current++;
              if (currentStepIndex.current < navigationSteps.current.length) {
                applyTurnByTurnUiFromIndex(currentStepIndex.current);
              }
            }
          }

          // Camera updates are driven by the dedicated follow loop (smooth + bottom-pinned).
        };

        const startNavGpsWatch = async (tier: 0 | 1 | 2) => {
          if (navGpsResubInFlightRef.current) return;
          navGpsResubInFlightRef.current = true;
          try {
            if (locationSubscription.current) {
              locationSubscription.current.remove();
              locationSubscription.current = null;
            }

            const options = navGpsOptionsForTier(tier);
            const sub = await Location.watchPositionAsync(
              options,
              onNavLocationUpdate,
            );
            locationSubscription.current = sub;
            navGpsTierRef.current = tier;
            navLastGpsResubAtRef.current = Date.now();
          } finally {
            navGpsResubInFlightRef.current = false;
          }
        };

        // Start GPS tracking (adaptive cadence)
        const initialSpeedMps = navSpeedRef.current || 0;
        const initialTier = pickNavGpsTier(
          initialSpeedMps,
          navGpsTierRef.current,
        );
        await startNavGpsWatch(initialTier);
        setIsTracking(true);

        // Periodically adjust tier based on latest speed with cooldown to avoid thrash.
        if (navGpsTierIntervalRef.current) {
          clearInterval(navGpsTierIntervalRef.current);
          navGpsTierIntervalRef.current = null;
        }
        navGpsTierIntervalRef.current = setInterval(() => {
          const now = Date.now();
          const MIN_RESUB_MS = 6000;
          if (now - navLastGpsResubAtRef.current < MIN_RESUB_MS) return;
          const desired = pickNavGpsTier(
            navLatestSpeedMpsRef.current,
            navGpsTierRef.current,
          );
          if (desired !== navGpsTierRef.current) {
            void startNavGpsWatch(desired);
          }
        }, 2000);

        // Start heading updates for "heading-up" map rotation.
        // Prefer OS-provided heading (tilt-compensated). If unavailable (e.g. simulator), fall back
        // to the existing gyro+magnetometer fusion.
        try {
          const sub = await Location.watchHeadingAsync((h) => {
            const next =
              h.trueHeading != null && h.trueHeading >= 0
                ? h.trueHeading
                : h.magHeading;
            if (typeof next !== "number" || Number.isNaN(next)) return;
            currentHeading.current = next;
            setRawHeading(next);
            setHeading(next);
          });
          headingSubscription.current = sub;
          isCalibrated.current = true;
          setIsSensorsActive(true);
        } catch (e) {
          console.warn(
            "watchHeadingAsync unavailable, falling back to sensors:",
            e,
          );

          Gyroscope.setUpdateInterval(16);
          const gyroSub = Gyroscope.addListener((data) => {
            if (!isCalibrated.current) {
              calibrationSamples.current.push(data.z);
              if (calibrationSamples.current.length >= 30) {
                isCalibrated.current = true;
              }
              return;
            }
            const rotationRate = data.z * (180 / Math.PI);
            currentHeading.current += rotationRate * 0.016;
            currentHeading.current =
              ((currentHeading.current % 360) + 360) % 360;
            setRawHeading(currentHeading.current);
            setHeading(currentHeading.current);
          });
          gyroSubscription.current = gyroSub;

          Magnetometer.setUpdateInterval(100);
          const magSub = Magnetometer.addListener((data) => {
            if (!isCalibrated.current) return;
            const magHeading = Math.atan2(data.y, data.x) * (180 / Math.PI);
            const normalizedMagHeading = (magHeading + 360) % 360;
            const drift = normalizedMagHeading - currentHeading.current;
            let correction = drift;
            if (Math.abs(drift) > 180) {
              correction = drift > 0 ? drift - 360 : drift + 360;
            }
            const maxCorrection = 10;
            correction = Math.max(
              -maxCorrection,
              Math.min(maxCorrection, correction),
            );
            currentHeading.current += correction * 0.02;
            currentHeading.current =
              ((currentHeading.current % 360) + 360) % 360;
          });
          magnetometerSubscription.current = magSub;
          setIsSensorsActive(true);
        }

        // Start recording
        routePoints.current = [];
        setDistance(0);
        setDuration(0);
        const startTime = Date.now();
        durationInterval.current = setInterval(() => {
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          setDuration(elapsed);
        }, 1000);
        setIsRecording(true);
      } catch (error) {
        console.error("Error starting navigation:", error);
        Alert.alert("Error", "Failed to start navigation");
        setIsNavigating(false);
      }
    }
  };

  const handlePlaceSelect = async (data: any, details: any) => {
    if (details?.geometry?.location) {
      const { lat, lng } = details.geometry.location;

      // If no destination yet, set it as destination
      if (!destination) {
        setDestination({
          latitude: lat,
          longitude: lng,
          address: data.description,
        });
      } else {
        // Add as a stop before the destination
        const newStop = {
          id: Date.now().toString(),
          latitude: lat,
          longitude: lng,
          address: data.description,
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

    // Recalculate route if destination exists
    if (destination) {
      await calculateRoute(destination.latitude, destination.longitude);
    }
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
    setDestination(null);
    setStops([]);
    setRouteCoordinates([]);
    setCurrentInstruction("");
    setCurrentManeuver(null);
    setNextInstruction("");
    setNextManeuver(null);
    setDistanceToNextTurn(0);
    setEta("");
  };

  const onStopsDragEnd = async (data: typeof stops) => {
    setStops(data);
    setCurrentStopIndex(data.length > 0 && isNavigating ? 0 : -1); // STAGE 5.1: Reset to first stop

    // Recalculate route with new order
    if (destination) {
      await calculateRoute(destination.latitude, destination.longitude);
    }
  };

  const renderStopItem = ({
    item,
    drag,
    isActive,
  }: RenderItemParams<(typeof stops)[0]>) => {
    const index = stops.findIndex((stop) => stop.id === item.id);

    return (
      <ScaleDecorator>
        <TouchableOpacity
          onLongPress={drag}
          disabled={isActive}
          activeOpacity={0.8}
        >
          <View style={[styles.stopItem, isActive && styles.stopItemDragging]}>
            <TouchableOpacity onLongPress={drag}>
              <MaterialCommunityIcons name="drag" size={24} color="#999" />
            </TouchableOpacity>
            <View style={styles.stopItemNumber}>
              <Text style={styles.stopItemNumberText}>{index + 1}</Text>
            </View>
            <Text style={styles.stopItemAddress} numberOfLines={2}>
              {item.address}
            </Text>
            <TouchableOpacity
              onPress={() => handleRemoveStop(item.id)}
              style={styles.stopItemButton}
            >
              <Ionicons name="trash-outline" size={16} color="#EA4335" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </ScaleDecorator>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Map - renders immediately like Google Maps */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={initialRegion}
        mapType={mapType}
        showsTraffic={showsTraffic}
        showsBuildings={showsBuildings}
        showsIndoors={showsIndoors}
        onMapReady={() => setMapReady(true)}
        onPanDrag={() => {
          if (isNavigating && navViewModeRef.current === "follow") {
            setNavViewMode("free");
          }
        }}
        showsUserLocation={!!userLocation}
        showsMyLocationButton={false}
        showsCompass={showsCompass}
        showsScale={true}
        rotateEnabled={true}
        pitchEnabled={true}
      >
        {/* Route Polyline */}
        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#4285F4"
            strokeWidth={5}
          />
        )}

        {/* User Arrow Marker during navigation - smooth position + smooth rotation */}
        {isNavigating && userLocation && (
          <Marker.Animated
            coordinate={
              (navMarkerRegion.current as any) || {
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
              }
            }
            anchor={{ x: 0.5, y: 0.5 }}
            flat={true}
            rotation={smoothedHeading}
          >
            <View style={styles.arrowMarker}>
              <MaterialCommunityIcons
                name="navigation"
                size={44}
                color="#4285F4"
              />
            </View>
          </Marker.Animated>
        )}

        {/* Stop Markers */}
        {stops.map((stop, index) => (
          <Marker
            key={stop.id}
            coordinate={{
              latitude: stop.latitude,
              longitude: stop.longitude,
            }}
            title={`Stop ${index + 1}`}
            description={stop.address}
          >
            <View style={styles.stopMarker}>
              <Text style={styles.stopMarkerText}>{index + 1}</Text>
            </View>
          </Marker>
        ))}

        {/* Destination Marker */}
        {destination && (
          <Marker
            coordinate={{
              latitude: destination.latitude,
              longitude: destination.longitude,
            }}
            title="Destination"
            description={destination.address}
            pinColor="#EA4335"
          />
        )}
      </MapView>

      {/* Search Bar at Top - Google Maps style with real autocomplete */}
      {!isNavigating && (
        <View style={[styles.searchContainer, { top: insets.top + 10 }]}>
          <GooglePlacesAutocomplete
            ref={searchRef}
            placeholder="Search here"
            fetchDetails={true}
            onPress={handlePlaceSelect}
            query={{
              key: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
              language: "en",
              location: userLocation
                ? `${userLocation.latitude},${userLocation.longitude}`
                : undefined,
              radius: 50000, // 50km radius
              rankby: "distance",
            }}
            styles={{
              container: {
                flex: 0,
              },
              textInputContainer: styles.searchBar,
              textInput: styles.searchInput,
              listView: styles.suggestionsContainer,
              row: styles.suggestionItem,
              description: styles.suggestionText,
            }}
            renderLeftButton={() => (
              <Ionicons
                name="search"
                size={20}
                color="#666"
                style={styles.searchIcon}
              />
            )}
            enablePoweredByContainer={false}
            nearbyPlacesAPI="GooglePlacesSearch"
            debounce={300}
          />
        </View>
      )}

      {/* Right side buttons container */}
      <View
        style={[styles.rightButtonsContainer, { bottom: insets.bottom + 100 }]}
      >
        {/* Camera debug toggle (always visible; first tap unlocks in release builds) */}
        <TouchableOpacity
          style={styles.cameraDebugToggle}
          onPress={() => {
            if (!cameraDebugUnlocked) {
              unlockCameraDebug();
              return;
            }
            setShowCameraDebug((v) => !v);
          }}
        >
          <Text style={styles.cameraDebugToggleText}>DBG</Text>
        </TouchableOpacity>

        {/* Layers (Google Maps-style): Standard/Satellite/etc */}
        <TouchableOpacity
          style={styles.myLocationButton}
          onPress={cycleMapType}
          onLongPress={unlockCameraDebug}
          delayLongPress={700}
        >
          <MaterialCommunityIcons
            name={mapType === "standard" ? "layers-outline" : "layers"}
            size={24}
            color="#1A73E8"
          />
        </TouchableOpacity>

        {/* Overlay toggles for quick A/B (unlockable on-device) */}
        {cameraDebugUnlocked && (
          <TouchableOpacity
            style={[
              styles.myLocationButton,
              showsTraffic && styles.myLocationButtonActive,
            ]}
            onPress={() => setShowsTraffic((v) => !v)}
          >
            <MaterialCommunityIcons
              name="traffic-light"
              size={22}
              color="#1A73E8"
            />
          </TouchableOpacity>
        )}

        {cameraDebugUnlocked && (
          <TouchableOpacity
            style={[
              styles.myLocationButton,
              showsBuildings && styles.myLocationButtonActive,
            ]}
            onPress={() => setShowsBuildings((v) => !v)}
          >
            <MaterialCommunityIcons name="city" size={22} color="#1A73E8" />
          </TouchableOpacity>
        )}

        {cameraDebugUnlocked && (
          <TouchableOpacity
            style={[
              styles.myLocationButton,
              showsCompass && styles.myLocationButtonActive,
            ]}
            onPress={() => setShowsCompass((v) => !v)}
          >
            <MaterialCommunityIcons
              name="compass-outline"
              size={22}
              color="#1A73E8"
            />
          </TouchableOpacity>
        )}

        {/* Navigation controls (Google-style) */}
        {isNavigating && routeCoordinates.length > 1 && (
          <TouchableOpacity
            style={styles.myLocationButton}
            onPress={requestNavOverview}
          >
            <MaterialCommunityIcons name="routes" size={24} color="#1A73E8" />
          </TouchableOpacity>
        )}

        {isNavigating && navViewMode !== "follow" && (
          <TouchableOpacity
            style={styles.myLocationButton}
            onPress={requestNavRecenter}
          >
            <MaterialCommunityIcons
              name="crosshairs-gps"
              size={24}
              color="#1A73E8"
            />
          </TouchableOpacity>
        )}

        {/* Stats Button - STAGE 7.1 */}
        {!isNavigating && (
          <TouchableOpacity
            style={styles.statsButton}
            onPress={() => router.push("/(main)/stats")}
          >
            <MaterialCommunityIcons
              name="chart-line"
              size={24}
              color="#1A73E8"
            />
          </TouchableOpacity>
        )}

        {/* Stops Panel Button */}
        {destination && !isNavigating && (
          <TouchableOpacity
            style={styles.stopsButton}
            onPress={() => setShowStopsPanel(!showStopsPanel)}
          >
            <MaterialCommunityIcons
              name="map-marker-multiple"
              size={24}
              color="#1A73E8"
            />
            {stops.length > 0 && (
              <View style={styles.stopsBadge}>
                <Text style={styles.stopsBadgeText}>{stops.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* My Location Button */}
        <TouchableOpacity
          style={styles.myLocationButton}
          onPress={handleMyLocation}
        >
          <Ionicons name="locate" size={24} color="#1A73E8" />
        </TouchableOpacity>
      </View>

      {/* Camera Debug Panel */}
      {cameraDebugUnlocked && showCameraDebug && (
        <View
          style={[
            styles.cameraDebugPanel,
            { right: 16, bottom: insets.bottom + 170 },
          ]}
        >
          <View style={styles.cameraDebugHeader}>
            <Text style={styles.cameraDebugTitle}>Camera Debug</Text>
            <TouchableOpacity onPress={() => setShowCameraDebug(false)}>
              <Ionicons name="close" size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          <Text style={styles.cameraDebugLine}>
            Apply: {cameraApplyMode} | Preset: {cameraTuningPreset}
          </Text>
          {!!cameraDebugSnapshot && (
            <>
              <Text style={styles.cameraDebugLine}>
                layer:{cameraDebugSnapshot.mapType} | traffic:
                {cameraDebugSnapshot.showsTraffic ? "on" : "off"} | 3D:
                {cameraDebugSnapshot.showsBuildings ? "on" : "off"} | indoor:
                {cameraDebugSnapshot.showsIndoors ? "on" : "off"}
              </Text>
              <Text style={styles.cameraDebugLine}>
                setCamera:{cameraDebugSnapshot.hasSetCamera ? "Y" : "N"} |
                animateCamera:
                {cameraDebugSnapshot.hasAnimateCamera ? "Y" : "N"} | hold:
                {Math.round(cameraDebugSnapshot.holdMs)}ms
              </Text>
              <Text style={styles.cameraDebugLine}>
                nav:{cameraDebugSnapshot.navViewMode} | v:
                {(cameraDebugSnapshot.speedMps * 3.6).toFixed(0)} km/h | d:
                {Math.round(cameraDebugSnapshot.distToTurnM)}m
              </Text>
              <Text style={styles.cameraDebugLine}>
                tgt z:{cameraDebugSnapshot.zoomTarget.toFixed(2)} h:
                {cameraDebugSnapshot.bearingTarget.toFixed(0)} p:
                {cameraDebugSnapshot.pitchTarget.toFixed(0)}
              </Text>
              <Text style={styles.cameraDebugLine}>
                app z:{(cameraDebugSnapshot.zoomApplied ?? 0).toFixed(2)} h:
                {(cameraDebugSnapshot.headingApplied ?? 0).toFixed(0)} p:
                {(cameraDebugSnapshot.pitchApplied ?? 0).toFixed(0)}
              </Text>
            </>
          )}

          <View style={styles.cameraDebugButtonsRow}>
            <TouchableOpacity
              style={styles.cameraDebugButton}
              onPress={() => {
                const order: (typeof cameraApplyMode)[] = [
                  "auto",
                  "setCamera",
                  "animate0",
                  "animate160",
                ];
                const idx = Math.max(0, order.indexOf(cameraApplyMode));
                setCameraApplyMode(order[(idx + 1) % order.length]);
              }}
            >
              <Text style={styles.cameraDebugButtonText}>Cycle Apply</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cameraDebugButton}
              onPress={() => {
                const order: (typeof cameraTuningPreset)[] = [
                  "balanced",
                  "smooth",
                  "snappy",
                ];
                const idx = Math.max(0, order.indexOf(cameraTuningPreset));
                setCameraTuningPreset(order[(idx + 1) % order.length]);
              }}
            >
              <Text style={styles.cameraDebugButtonText}>Cycle Preset</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.cameraDebugButtonsRow}>
            <TouchableOpacity
              style={styles.cameraDebugButton}
              onPress={cycleMapType}
            >
              <Text style={styles.cameraDebugButtonText}>Cycle Layer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cameraDebugButton}
              onPress={() => setShowsTraffic((v) => !v)}
            >
              <Text style={styles.cameraDebugButtonText}>
                Traffic {showsTraffic ? "On" : "Off"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.cameraDebugButtonsRow}>
            <TouchableOpacity
              style={styles.cameraDebugButton}
              onPress={() => setShowsBuildings((v) => !v)}
            >
              <Text style={styles.cameraDebugButtonText}>
                3D {showsBuildings ? "On" : "Off"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cameraDebugButton}
              onPress={() => setShowsIndoors((v) => !v)}
            >
              <Text style={styles.cameraDebugButtonText}>
                Indoor {showsIndoors ? "On" : "Off"}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.cameraDebugHint}>
            Tip: try Apply=animate160 if setCamera feels “steppy”.
          </Text>
        </View>
      )}

      {/* Stops Panel */}
      {showStopsPanel && !isNavigating && (
        <View style={[styles.stopsPanel, { bottom: insets.bottom + 180 }]}>
          <View style={styles.stopsPanelHeader}>
            <Text style={styles.stopsPanelTitle}>Route Stops</Text>
            <TouchableOpacity onPress={() => setShowStopsPanel(false)}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          <DraggableFlatList
            data={stops}
            onDragEnd={({ data }) => onStopsDragEnd(data)}
            keyExtractor={(item) => item.id}
            renderItem={renderStopItem}
            style={styles.stopsList}
            containerStyle={{ maxHeight: 200 }}
            ListFooterComponent={
              <View style={styles.stopItem}>
                <View style={{ width: 24 }} />
                <View style={[styles.stopItemNumber, styles.destinationNumber]}>
                  <Ionicons name="flag" size={14} color="#fff" />
                </View>
                <Text style={styles.stopItemAddress} numberOfLines={2}>
                  {destination?.address}
                </Text>
                <TouchableOpacity
                  onPress={handleRemoveDestination}
                  style={styles.stopItemButton}
                >
                  <Ionicons name="trash-outline" size={16} color="#EA4335" />
                </TouchableOpacity>
              </View>
            }
          />
          <View style={styles.stopsPanelFooter}>
            <Text style={styles.stopsPanelHint}>
              Search for a location to add more stops
            </Text>
          </View>
        </View>
      )}

      {/* Start Navigation Button - replaces individual toggles */}
      {destination && (
        <TouchableOpacity
          style={[
            styles.startNavigationButton,
            { bottom: insets.bottom + 20 },
            isNavigating && styles.stopNavigationButton,
          ]}
          onPress={handleStartNavigation}
        >
          <MaterialCommunityIcons
            name={isNavigating ? "stop" : "navigation"}
            size={24}
            color="#fff"
          />
          <Text style={styles.startNavigationText}>
            {isNavigating ? "Stop Navigation" : "Start Navigation"}
          </Text>
        </TouchableOpacity>
      )}

      {/* Stage Info */}
      {__DEV__ && (
        <View style={[styles.stageInfo, { bottom: insets.bottom + 20 }]}>
          <Text style={styles.stageText}>STAGE 6: Full Navigation ✓</Text>
          <Text style={styles.stageSubtext}>Search destination to begin</Text>
        </View>
      )}

      {/* Navigation Instructions Panel */}
      {isNavigating && (currentInstruction || isInArrivalZone) && (
        <View style={[styles.instructionPanel, { top: insets.top + 10 }]}>
          <View style={styles.instructionHeader}>
            <MaterialCommunityIcons
              name={
                isInArrivalZone
                  ? "flag-checkered"
                  : maneuverToIconName(
                      currentManeuver,
                      currentInstruction || "",
                    )
              }
              size={32}
              color={isInArrivalZone ? "#34A853" : "#4285F4"}
            />
            <View style={styles.instructionContent}>
              {isInArrivalZone ? (
                <>
                  <Text style={styles.arrivalText}>
                    Arriving at destination
                  </Text>
                  <Text style={styles.arrivalSubtext}>
                    {destination?.address}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.distanceText}>
                    {distanceToNextTurn < 1000
                      ? `${Math.round(distanceToNextTurn)} m`
                      : `${(distanceToNextTurn / 1000).toFixed(1)} km`}
                  </Text>
                  <Text style={styles.instructionText}>
                    {currentInstruction}
                  </Text>

                  {!!laneHint && (
                    <View style={styles.laneGuidanceRow}>
                      <View style={styles.lanesStrip}>
                        <View
                          style={[
                            styles.lanePill,
                            (laneHint === "keep-left" || laneHint === "left") &&
                              styles.lanePillActive,
                          ]}
                        />
                        <View
                          style={[
                            styles.lanePill,
                            laneHint === "straight" && styles.lanePillActive,
                          ]}
                        />
                        <View
                          style={[
                            styles.lanePill,
                            (laneHint === "keep-right" ||
                              laneHint === "right") &&
                              styles.lanePillActive,
                          ]}
                        />
                      </View>
                      <Text style={styles.laneHintText}>
                        {laneHint === "keep-left"
                          ? "Keep left"
                          : laneHint === "keep-right"
                            ? "Keep right"
                            : laneHint === "left"
                              ? "Turn left"
                              : laneHint === "right"
                                ? "Turn right"
                                : "Go straight"}
                      </Text>
                    </View>
                  )}

                  {!!nextInstruction && (
                    <View style={styles.nextStepRow}>
                      <MaterialCommunityIcons
                        name={maneuverToIconName(nextManeuver, nextInstruction)}
                        size={16}
                        color="#5F6368"
                      />
                      <Text style={styles.nextStepText} numberOfLines={1}>
                        Then {nextInstruction}
                      </Text>
                    </View>
                  )}
                </>
              )}
            </View>
          </View>

          {/* Speed and Speed Limit */}
          <View style={styles.speedContainer}>
            <View style={styles.currentSpeed}>
              <Text style={styles.speedValue}>
                {Math.round((userLocation?.speed || 0) * 3.6)}
              </Text>
              <Text style={styles.speedUnit}>km/h</Text>
            </View>
            {speedLimit > 0 && (
              <View style={styles.speedLimitCircle}>
                <Text style={styles.speedLimitText}>{speedLimit}</Text>
              </View>
            )}
            {isSensorsActive && (
              <View style={styles.headingDisplay}>
                <Ionicons name="compass" size={16} color="#666" />
                <Text style={styles.headingValue}>{Math.round(heading)}°</Text>
              </View>
            )}
          </View>

          {/* ETA and Distance */}
          <View style={styles.etaContainer}>
            <Text style={styles.etaText}>🕐 {eta}</Text>
            <Text style={styles.etaText}>📍 {distance.toFixed(1)} km</Text>
          </View>

          {/* STAGE 5.1: Next Stop Button */}
          {stops.length > 0 && currentStopIndex < stops.length && (
            <TouchableOpacity
              style={styles.nextStopButton}
              onPress={handleNextStop}
            >
              <Ionicons name="flag" size={20} color="#fff" />
              <Text style={styles.nextStopButtonText}>
                {currentStopIndex === -1 || currentStopIndex === 0
                  ? `Stop 1/${stops.length}`
                  : `Stop ${currentStopIndex + 1}/${stops.length}`}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: "100%",
    height: "100%",
  },
  searchContainer: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 1000,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    fontSize: 16,
    color: "#000",
    paddingVertical: 0,
  },
  suggestionsContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginTop: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
  },
  suggestionItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  suggestionText: {
    fontSize: 15,
    color: "#333",
  },
  nextStepRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  nextStepText: {
    fontSize: 13,
    color: "#5F6368",
    flexShrink: 1,
  },
  laneGuidanceRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  lanesStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  lanePill: {
    width: 26,
    height: 10,
    borderRadius: 6,
    backgroundColor: "#E8EAED",
  },
  lanePillActive: {
    backgroundColor: "#1A73E8",
  },
  laneHintText: {
    fontSize: 13,
    color: "#5F6368",
    fontWeight: "600",
  },
  arrowMarker: {
    width: 60,
    height: 60,
    backgroundColor: "#fff",
    opacity: 0.98,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "#E8EAED",
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
  },
  rightButtonsContainer: {
    position: "absolute",
    right: 16,
    flexDirection: "column",
    gap: 12,
  },
  myLocationButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
  },
  myLocationButtonActive: {
    backgroundColor: "#E8F0FE",
  },
  cameraDebugToggle: {
    width: 48,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#111",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
  cameraDebugToggleText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  cameraDebugPanel: {
    position: "absolute",
    width: 260,
    backgroundColor: "rgba(17, 17, 17, 0.92)",
    borderRadius: 12,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 12,
  },
  cameraDebugHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  cameraDebugTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
  },
  cameraDebugLine: {
    color: "#fff",
    fontSize: 12,
    opacity: 0.92,
    marginBottom: 4,
  },
  cameraDebugButtonsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  cameraDebugButton: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cameraDebugButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  cameraDebugHint: {
    color: "#fff",
    fontSize: 11,
    opacity: 0.75,
    marginTop: 10,
  },
  stopsButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
  },
  statsButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
  },
  startNavigationButton: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4285F4",
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  stopNavigationButton: {
    backgroundColor: "#EA4335",
  },
  startNavigationText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginLeft: 8,
  },
  instructionPanel: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
  },
  instructionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  instructionContent: {
    flex: 1,
    marginLeft: 12,
  },
  distanceText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#4285F4",
    marginBottom: 4,
  },
  instructionText: {
    fontSize: 16,
    color: "#333",
    fontWeight: "600",
  },
  arrivalText: {
    fontSize: 22,
    fontWeight: "700",
    color: "#34A853",
    marginBottom: 4,
  },
  arrivalSubtext: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  speedContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  currentSpeed: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  speedValue: {
    fontSize: 32,
    fontWeight: "700",
    color: "#333",
  },
  speedUnit: {
    fontSize: 16,
    color: "#666",
    marginLeft: 4,
  },
  speedLimitCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 4,
    borderColor: "#EA4335",
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  speedLimitText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#EA4335",
  },
  headingDisplay: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  headingValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  etaContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  etaText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "600",
  },
  nextStopButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#34A853",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
    justifyContent: "center",
  },
  nextStopButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  stageInfo: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  stageText: {
    color: "#4CAF50",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  stageSubtext: {
    color: "#fff",
    fontSize: 12,
    opacity: 0.8,
  },
  stopMarker: {
    width: 32,
    height: 32,
    backgroundColor: "#4285F4",
    borderRadius: 16,
    borderWidth: 3,
    borderColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  stopMarkerText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  stopsBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#EA4335",
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  stopsBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  stopsPanel: {
    position: "absolute",
    left: 16,
    right: 16,
    maxHeight: 300,
    backgroundColor: "#fff",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
  },
  stopsPanelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  stopsPanelTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
  },
  stopsList: {
    maxHeight: 200,
  },
  stopItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
    backgroundColor: "#fff",
  },
  stopItemDragging: {
    backgroundColor: "#f9f9f9",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  stopItemNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#4285F4",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  destinationNumber: {
    backgroundColor: "#EA4335",
  },
  stopItemNumberText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  stopItemAddress: {
    flex: 1,
    fontSize: 14,
    color: "#333",
  },
  stopItemActions: {
    flexDirection: "row",
    gap: 8,
  },
  stopItemButton: {
    padding: 4,
  },
  stopsPanelFooter: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  stopsPanelHint: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
  },
});
