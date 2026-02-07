import type { LatLng } from "@/types/navigation";

export const lerp = (start: number, end: number, alpha: number) =>
  start + (end - start) * alpha;

export const angleDeltaDegrees = (toDeg: number, fromDeg: number) => {
  const t = ((toDeg % 360) + 360) % 360;
  const f = ((fromDeg % 360) + 360) % 360;
  let d = t - f;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
};

export const computeNavPredictSeconds = (speedMps: number) => {
  const speedKmh = (speedMps || 0) * 3.6;
  // Low speed: less prediction to avoid wobble. Higher speed: more prediction to reduce perceived lag.
  if (speedKmh <= 10) return 0.25;
  if (speedKmh <= 40) return 0.25 + ((speedKmh - 10) / 30) * 0.35; // 0.25..0.60
  if (speedKmh <= 90) return 0.6 + ((speedKmh - 40) / 50) * 0.25; // 0.60..0.85
  return 0.9;
};

export const applyPrediction = (
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

export const smoothHeadingValue = (target: number, current: number): number => {
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

  // Max delta per update: 20 degrees (more responsive rotation)
  const MAX_DELTA = 20;
  if (Math.abs(delta) > MAX_DELTA) {
    delta = Math.sign(delta) * MAX_DELTA;
  }

  // Apply delta and normalize
  const result = current + delta;
  return ((result % 360) + 360) % 360;
};
