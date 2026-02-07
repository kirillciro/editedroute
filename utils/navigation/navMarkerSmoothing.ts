import {
  applyPrediction,
  computeNavPredictSeconds,
  lerp,
} from "@/utils/navigation/math";

type LatLng = { latitude: number; longitude: number };

type NavMarkerStepResult = {
  next: LatLng;
  nextLastFrameAtMs: number;
};

export function computeNextNavMarkerPosition(params: {
  nowMs: number;
  lastFrameAtMs: number;
  tauSeconds: number;
  fallbackAlpha?: number;

  current: LatLng;
  target: LatLng;

  headingDeg: number;
  speedMps: number;
}): NavMarkerStepResult {
  const {
    nowMs,
    lastFrameAtMs,
    tauSeconds,
    fallbackAlpha = 0.12,
    current,
    target,
    headingDeg,
    speedMps,
  } = params;

  const dtSeconds = lastFrameAtMs > 0 ? (nowMs - lastFrameAtMs) / 1000 : 0;

  const alpha =
    dtSeconds > 0 ? 1 - Math.exp(-dtSeconds / tauSeconds) : fallbackAlpha;

  const predicted = applyPrediction(
    target,
    headingDeg,
    speedMps,
    computeNavPredictSeconds(speedMps || 0),
  );

  return {
    next: {
      latitude: lerp(current.latitude, predicted.latitude, alpha),
      longitude: lerp(current.longitude, predicted.longitude, alpha),
    },
    nextLastFrameAtMs: nowMs,
  };
}
