import { LatLng } from "@/types/navigation";
import * as Location from "expo-location";
import { useRef, useState } from "react";
import { AnimatedRegion } from "react-native-maps";

interface LocationTrackingConfig {
  enablePolylineSnapping?: boolean;
  polylineSnapDistance?: number; // meters
  enableNoiseFiltering?: boolean;
  smoothingDuration?: number; // milliseconds
  enableCameraLookAhead?: boolean;
  lookAheadDistance?: number; // meters
  gpsTimeIntervalMs?: number;
  gpsDistanceIntervalM?: number;
}

interface LocationTrackingResult {
  location: AnimatedRegion | null;
  rawLocation: LatLng | null;
  heading: number;
  speed: number; // m/s
  accuracy: number;
  isTracking: boolean;
  error: string | null;
  startTracking: () => Promise<void>;
  stopTracking: () => void;
}

const DEFAULT_CONFIG: LocationTrackingConfig = {
  enablePolylineSnapping: true,
  polylineSnapDistance: 50,
  enableNoiseFiltering: true,
  smoothingDuration: 400,
  enableCameraLookAhead: true,
  lookAheadDistance: 100,
  // Google-style: GPS updates can be slower because rendering is smoothed via RAF.
  gpsTimeIntervalMs: 1000,
  gpsDistanceIntervalM: 2,
};

/**
 * Advanced GPS tracking hook with AnimatedRegion, polyline snapping,
 * noise filtering, and camera look-ahead
 */
export function useLocationTracking(
  routePolyline?: LatLng[],
  config: LocationTrackingConfig = {},
): LocationTrackingResult {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  const DEFAULT_LATLNG_DELTA = 0.005;
  const RENDER_TAU_SECONDS = 0.18; // lower = snappier, higher = smoother
  const PREDICT_SECONDS = 0.35; // compensate typical GPS latency

  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawLocation, setRawLocation] = useState<LatLng | null>(null);
  const [heading, setHeading] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [accuracy, setAccuracy] = useState(0);

  const animatedRegion = useRef<AnimatedRegion | null>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(
    null,
  );
  const previousLocation = useRef<LatLng | null>(null);
  const previousHeading = useRef<number>(0);

  // Smooth render loop (Google-style): GPS updates target, RAF updates displayed position.
  const targetPosition = useRef<LatLng | null>(null);
  const currentPosition = useRef<LatLng | null>(null);
  const lastFrameTime = useRef<number>(0);
  const rafId = useRef<number | null>(null);

  const speedRef = useRef<number>(0);
  const headingRef = useRef<number>(0);

  const lerp = (start: number, end: number, alpha: number) =>
    start + (end - start) * alpha;

  const normalizeAngle = (angle: number): number => {
    let a = angle % 360;
    if (a < 0) a += 360;
    return a;
  };

  const applyPrediction = (
    anchor: LatLng,
    headingDegrees: number,
    speedMps: number,
    seconds: number,
  ): LatLng => {
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

  const stopRenderLoop = () => {
    if (rafId.current != null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
    lastFrameTime.current = 0;
  };

  const startRenderLoop = () => {
    if (rafId.current != null) return;

    const tick = (now: number) => {
      if (!isTracking) {
        stopRenderLoop();
        return;
      }

      const target = targetPosition.current;
      const current = currentPosition.current;

      if (target && current && animatedRegion.current) {
        const dtSeconds =
          lastFrameTime.current > 0 ? (now - lastFrameTime.current) / 1000 : 0;
        lastFrameTime.current = now;

        // Convert tau into frame-rate independent alpha
        const alpha =
          dtSeconds > 0 ? 1 - Math.exp(-dtSeconds / RENDER_TAU_SECONDS) : 0.12;

        const predictedTarget = applyPrediction(
          target,
          normalizeAngle(headingRef.current),
          speedRef.current,
          PREDICT_SECONDS,
        );

        const nextLat = lerp(current.latitude, predictedTarget.latitude, alpha);
        const nextLng = lerp(
          current.longitude,
          predictedTarget.longitude,
          alpha,
        );

        currentPosition.current = { latitude: nextLat, longitude: nextLng };

        animatedRegion.current.setValue({
          latitude: nextLat,
          longitude: nextLng,
          latitudeDelta: DEFAULT_LATLNG_DELTA,
          longitudeDelta: DEFAULT_LATLNG_DELTA,
        });
      } else {
        lastFrameTime.current = now;
      }

      rafId.current = requestAnimationFrame(tick);
    };

    rafId.current = requestAnimationFrame(tick);
  };

  // Kalman filter state for noise reduction
  const kalmanState = useRef({
    lat: 0,
    lng: 0,
    variance: 0.1,
  });

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  const calculateDistance = (coord1: LatLng, coord2: LatLng): number => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (coord1.latitude * Math.PI) / 180;
    const φ2 = (coord2.latitude * Math.PI) / 180;
    const Δφ = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
    const Δλ = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  /**
   * Calculate bearing (direction of movement) between two coordinates
   */
  const calculateBearing = (from: LatLng, to: LatLng): number => {
    const φ1 = (from.latitude * Math.PI) / 180;
    const φ2 = (to.latitude * Math.PI) / 180;
    const Δλ = ((to.longitude - from.longitude) * Math.PI) / 180;

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x =
      Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

    const θ = Math.atan2(y, x);
    const bearing = ((θ * 180) / Math.PI + 360) % 360;

    return bearing;
  };

  /**
   * Snap location to nearest point on route polyline
   */
  const snapToPolyline = (location: LatLng): LatLng => {
    if (
      !routePolyline ||
      routePolyline.length < 2 ||
      !finalConfig.enablePolylineSnapping
    ) {
      return location;
    }

    let closestPoint = location;
    let minDistance = Infinity;

    // Find closest point on polyline segments
    for (let i = 0; i < routePolyline.length - 1; i++) {
      const segmentStart = routePolyline[i];
      const segmentEnd = routePolyline[i + 1];

      const projectedPoint = projectPointOnSegment(
        location,
        segmentStart,
        segmentEnd,
      );
      const distance = calculateDistance(location, projectedPoint);

      if (distance < minDistance) {
        minDistance = distance;
        closestPoint = projectedPoint;
      }
    }

    // Only snap if within threshold
    if (minDistance <= (finalConfig.polylineSnapDistance || 50)) {
      return closestPoint;
    }

    return location;
  };

  /**
   * Project point onto line segment
   */
  const projectPointOnSegment = (
    point: LatLng,
    segmentStart: LatLng,
    segmentEnd: LatLng,
  ): LatLng => {
    const x = point.longitude;
    const y = point.latitude;
    const x1 = segmentStart.longitude;
    const y1 = segmentStart.latitude;
    const x2 = segmentEnd.longitude;
    const y2 = segmentEnd.latitude;

    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) {
      param = dot / lenSq;
    }

    let xx, yy;

    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    return { latitude: yy, longitude: xx };
  };

  /**
   * Apply Kalman filter for GPS noise reduction
   */
  const applyKalmanFilter = (
    measurement: LatLng,
    measurementAccuracy: number,
  ): LatLng => {
    if (!finalConfig.enableNoiseFiltering) {
      return measurement;
    }

    const { lat, lng, variance } = kalmanState.current;

    // First measurement - initialize
    if (lat === 0 && lng === 0) {
      kalmanState.current = {
        lat: measurement.latitude,
        lng: measurement.longitude,
        variance: measurementAccuracy,
      };
      return measurement;
    }

    // Kalman gain
    const K = variance / (variance + measurementAccuracy);

    // Update estimate
    const newLat = lat + K * (measurement.latitude - lat);
    const newLng = lng + K * (measurement.longitude - lng);
    const newVariance = (1 - K) * variance;

    kalmanState.current = { lat: newLat, lng: newLng, variance: newVariance };

    return { latitude: newLat, longitude: newLng };
  };

  /**
   * Calculate camera look-ahead position based on speed and heading
   */
  const calculateLookAhead = (
    location: LatLng,
    currentHeading: number,
    currentSpeed: number,
  ): LatLng => {
    if (!finalConfig.enableCameraLookAhead || currentSpeed < 1) {
      return location;
    }

    // Look ahead distance scales with speed (max 100m)
    const lookAheadMeters = Math.min(
      currentSpeed * 10,
      finalConfig.lookAheadDistance || 100,
    );

    // Convert heading to radians
    const headingRad = (currentHeading * Math.PI) / 180;

    // Calculate offset in degrees (approximate)
    const latOffset = (lookAheadMeters * Math.cos(headingRad)) / 111320;
    const lngOffset =
      (lookAheadMeters * Math.sin(headingRad)) /
      (111320 * Math.cos((location.latitude * Math.PI) / 180));

    return {
      latitude: location.latitude + latOffset,
      longitude: location.longitude + lngOffset,
    };
  };

  /**
   * Start GPS tracking
   */
  const startTracking = async () => {
    try {
      // Prevent duplicate subscriptions (can happen if a screen calls startTracking twice)
      if (locationSubscription.current) {
        return;
      }

      // Request permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setError("Location permission denied");
        return;
      }

      setIsTracking(true);
      setError(null);

      // Start render loop immediately; it will begin moving once target/current are set.
      startRenderLoop();

      // Subscribe to location updates
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: finalConfig.gpsTimeIntervalMs ?? 1000,
          distanceInterval: finalConfig.gpsDistanceIntervalM ?? 2,
        },
        (location) => {
          const { latitude, longitude } = location.coords;
          const currentSpeed = location.coords.speed || 0;
          const currentAccuracy = location.coords.accuracy || 10;

          // Raw location
          const rawLoc: LatLng = { latitude, longitude };
          setRawLocation(rawLoc);
          setSpeed(currentSpeed);
          setAccuracy(currentAccuracy);

          speedRef.current = currentSpeed;

          // Calculate heading from movement direction (not compass)
          let calculatedHeading = previousHeading.current;

          if (previousLocation.current && currentSpeed > 0.5) {
            // Only update heading if moving (>0.5 m/s or ~1.8 km/h)
            // This prevents erratic heading changes when stationary
            const movementDistance = calculateDistance(
              previousLocation.current,
              rawLoc,
            );

            // Only calculate new bearing if we've moved at least 2 meters
            // This filters out GPS noise
            if (movementDistance > 2) {
              calculatedHeading = calculateBearing(
                previousLocation.current,
                rawLoc,
              );
              previousHeading.current = calculatedHeading;
            }
          } else if (
            location.coords.heading !== null &&
            location.coords.heading !== undefined &&
            location.coords.heading >= 0
          ) {
            // Fall back to GPS heading if available and we're not calculating from movement
            calculatedHeading = location.coords.heading;
            previousHeading.current = calculatedHeading;
          }

          setHeading(calculatedHeading);

          headingRef.current = calculatedHeading;

          // Apply Kalman filter
          let filteredLocation = applyKalmanFilter(rawLoc, currentAccuracy);

          // Snap to polyline
          filteredLocation = snapToPolyline(filteredLocation);

          // Calculate look-ahead
          const lookAheadLocation = calculateLookAhead(
            filteredLocation,
            calculatedHeading,
            currentSpeed,
          );

          // Set the target (GPS/filtered) position; render loop will smoothly move toward it.
          targetPosition.current = lookAheadLocation;

          // Initialize current/displayed position once
          if (!currentPosition.current) {
            currentPosition.current = lookAheadLocation;
          }

          if (!animatedRegion.current) {
            animatedRegion.current = new AnimatedRegion({
              latitude: lookAheadLocation.latitude,
              longitude: lookAheadLocation.longitude,
              latitudeDelta: DEFAULT_LATLNG_DELTA,
              longitudeDelta: DEFAULT_LATLNG_DELTA,
            });
          }

          previousLocation.current = rawLoc;
        },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start tracking");
      setIsTracking(false);
      stopRenderLoop();
    }
  };

  /**
   * Stop GPS tracking
   */
  const stopTracking = () => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
    setIsTracking(false);

    stopRenderLoop();
    targetPosition.current = null;
    currentPosition.current = null;
    speedRef.current = 0;
    headingRef.current = 0;
  };

  return {
    location: animatedRegion.current,
    rawLocation,
    heading,
    speed,
    accuracy,
    isTracking,
    error,
    startTracking,
    stopTracking,
  };
}
