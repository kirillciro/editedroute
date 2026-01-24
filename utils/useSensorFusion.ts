import { useRef, useState } from "react";
import { Gyroscope, Magnetometer } from "expo-sensors";

interface SensorFusionResult {
  compassHeading: number; // 0-360 degrees
  gyroHeading: number; // 0-360 degrees
  fusedHeading: number; // Combined heading with gyro smoothness
  isCalibrated: boolean;
  startFusion: () => void;
  stopFusion: () => void;
}

const FUSION_ALPHA = 0.98; // Weight for gyroscope (higher = smoother but drifts)
const CALIBRATION_SAMPLES = 30; // Samples needed for calibration
const UPDATE_INTERVAL = 16; // ~60 FPS

/**
 * Sensor fusion hook combining gyroscope (smooth) and magnetometer (accurate)
 * for 60 FPS rotation updates without GPS jitter
 */
export function useSensorFusion(): SensorFusionResult {
  const [compassHeading, setCompassHeading] = useState(0);
  const [gyroHeading, setGyroHeading] = useState(0);
  const [fusedHeading, setFusedHeading] = useState(0);
  const [isCalibrated, setIsCalibrated] = useState(false);

  const gyroSubscription = useRef<any>(null);
  const magnetometerSubscription = useRef<any>(null);

  const lastGyroTimestamp = useRef<number>(Date.now());
  const calibrationSamples = useRef<number>(0);
  const headingDriftCorrection = useRef<number>(0);

  /**
   * Normalize angle to 0-360 range
   */
  const normalizeAngle = (angle: number): number => {
    let normalized = angle % 360;
    if (normalized < 0) normalized += 360;
    return normalized;
  };

  /**
   * Calculate shortest angular distance between two headings
   */
  const angularDistance = (from: number, to: number): number => {
    let diff = to - from;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    return diff;
  };

  /**
   * Calculate heading from magnetometer data
   */
  const calculateMagnetometerHeading = (
    x: number,
    y: number,
    z: number,
  ): number => {
    // Convert to compass heading (0° = North, 90° = East)
    let heading = Math.atan2(y, x) * (180 / Math.PI);
    heading = normalizeAngle(heading);
    return heading;
  };

  /**
   * Integrate gyroscope rotation rate
   */
  const integrateGyroscope = (rotationZ: number, deltaTime: number): number => {
    // rotationZ is in rad/s, convert to degrees
    const deltaDegrees = rotationZ * (180 / Math.PI) * deltaTime;
    return deltaDegrees;
  };

  /**
   * Start sensor fusion
   */
  const startFusion = () => {
    // Set update intervals
    Gyroscope.setUpdateInterval(UPDATE_INTERVAL);
    Magnetometer.setUpdateInterval(100); // Magnetometer doesn't need 60Hz

    // Subscribe to gyroscope
    gyroSubscription.current = Gyroscope.addListener((data) => {
      const now = Date.now();
      const deltaTime = (now - lastGyroTimestamp.current) / 1000; // seconds
      lastGyroTimestamp.current = now;

      // Integrate gyro rotation (Z-axis is vertical rotation)
      const gyroChange = integrateGyroscope(data.z, deltaTime);

      setGyroHeading((prev) => {
        const newGyroHeading = normalizeAngle(prev + gyroChange);

        // Apply drift correction from magnetometer
        const correctedHeading = normalizeAngle(
          newGyroHeading + headingDriftCorrection.current,
        );

        return correctedHeading;
      });
    });

    // Subscribe to magnetometer
    magnetometerSubscription.current = Magnetometer.addListener((data) => {
      const magneticHeading = calculateMagnetometerHeading(
        data.x,
        data.y,
        data.z,
      );
      setCompassHeading(magneticHeading);

      // Calibration phase
      if (calibrationSamples.current < CALIBRATION_SAMPLES) {
        calibrationSamples.current++;
        setGyroHeading(magneticHeading);
        setFusedHeading(magneticHeading);

        if (calibrationSamples.current >= CALIBRATION_SAMPLES) {
          setIsCalibrated(true);
        }
        return;
      }

      // Calculate drift and apply gradual correction
      setGyroHeading((currentGyro) => {
        const drift = angularDistance(currentGyro, magneticHeading);

        // Apply complementary filter
        // Gyro provides smooth short-term rotation
        // Magnetometer corrects long-term drift
        const correctionRate = 1 - FUSION_ALPHA; // 0.02 = 2% correction per update
        headingDriftCorrection.current += drift * correctionRate;

        // Keep correction bounded
        if (Math.abs(headingDriftCorrection.current) > 10) {
          headingDriftCorrection.current =
            headingDriftCorrection.current > 0 ? 10 : -10;
        }

        // Fuse gyro (smooth) with magnetometer (accurate)
        const fused = normalizeAngle(
          FUSION_ALPHA * currentGyro + (1 - FUSION_ALPHA) * magneticHeading,
        );

        setFusedHeading(fused);
        return currentGyro;
      });
    });
  };

  /**
   * Stop sensor fusion
   */
  const stopFusion = () => {
    if (gyroSubscription.current) {
      gyroSubscription.current.remove();
      gyroSubscription.current = null;
    }
    if (magnetometerSubscription.current) {
      magnetometerSubscription.current.remove();
      magnetometerSubscription.current = null;
    }
    setIsCalibrated(false);
    calibrationSamples.current = 0;
    headingDriftCorrection.current = 0;
  };

  return {
    compassHeading,
    gyroHeading,
    fusedHeading,
    isCalibrated,
    startFusion,
    stopFusion,
  };
}
