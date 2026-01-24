import { useRef, useState } from "react";
import { LatLng } from "@/types/navigation";

interface RoutePoint extends LatLng {
  timestamp: number;
  speed: number;
  heading: number;
  accuracy: number;
}

interface RouteRecordingResult {
  isRecording: boolean;
  recordedRoute: RoutePoint[];
  currentDistance: number; // meters
  currentDuration: number; // seconds
  averageSpeed: number; // m/s
  startRecording: () => void;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  clearRecording: () => void;
  saveRoute: () => RoutePoint[];
  addRoutePoint: (point: RoutePoint) => void;
}

/**
 * Hook for recording GPS routes with timestamps and metrics
 */
export function useRouteRecording(): RouteRecordingResult {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordedRoute, setRecordedRoute] = useState<RoutePoint[]>([]);
  const [currentDistance, setCurrentDistance] = useState(0);
  const [currentDuration, setCurrentDuration] = useState(0);
  const [averageSpeed, setAverageSpeed] = useState(0);

  const startTime = useRef<number | null>(null);
  const pauseTime = useRef<number | null>(null);
  const totalPausedTime = useRef<number>(0);
  const durationInterval = useRef<ReturnType<typeof setInterval> | null>(null);

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
   * Add a point to the recorded route
   */
  const addRoutePoint = (point: RoutePoint) => {
    if (!isRecording || isPaused) return;

    setRecordedRoute((prev) => {
      const newRoute = [...prev, point];

      // Update distance if we have previous point
      if (prev.length > 0) {
        const lastPoint = prev[prev.length - 1];
        const segmentDistance = calculateDistance(lastPoint, point);

        // Only add distance if movement is reasonable (< 100m between points)
        if (segmentDistance < 100) {
          setCurrentDistance((d) => d + segmentDistance);
        }
      }

      return newRoute;
    });
  };

  /**
   * Start recording
   */
  const startRecording = () => {
    setIsRecording(true);
    setIsPaused(false);
    startTime.current = Date.now();
    totalPausedTime.current = 0;

    // Update duration every second
    durationInterval.current = setInterval(() => {
      if (startTime.current && !isPaused) {
        const elapsed = Math.floor(
          (Date.now() - startTime.current - totalPausedTime.current) / 1000,
        );
        setCurrentDuration(elapsed);

        // Update average speed
        if (elapsed > 0) {
          setAverageSpeed(currentDistance / elapsed);
        }
      }
    }, 1000);
  };

  /**
   * Stop recording
   */
  const stopRecording = () => {
    setIsRecording(false);
    setIsPaused(false);

    if (durationInterval.current) {
      clearInterval(durationInterval.current);
      durationInterval.current = null;
    }
  };

  /**
   * Pause recording
   */
  const pauseRecording = () => {
    if (!isRecording || isPaused) return;

    setIsPaused(true);
    pauseTime.current = Date.now();
  };

  /**
   * Resume recording
   */
  const resumeRecording = () => {
    if (!isRecording || !isPaused || !pauseTime.current) return;

    const pauseDuration = Date.now() - pauseTime.current;
    totalPausedTime.current += pauseDuration;
    setIsPaused(false);
    pauseTime.current = null;
  };

  /**
   * Clear recorded route
   */
  const clearRecording = () => {
    setRecordedRoute([]);
    setCurrentDistance(0);
    setCurrentDuration(0);
    setAverageSpeed(0);
    startTime.current = null;
    pauseTime.current = null;
    totalPausedTime.current = 0;
  };

  /**
   * Save and return recorded route
   */
  const saveRoute = (): RoutePoint[] => {
    return [...recordedRoute];
  };

  return {
    isRecording,
    recordedRoute,
    currentDistance,
    currentDuration,
    averageSpeed,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    clearRecording,
    saveRoute,
    addRoutePoint,
  };
}
