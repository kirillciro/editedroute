import { distanceMetersBetween } from "@/utils/geo/geometry";
import { angleDeltaDegrees } from "@/utils/navigation/math";
import type { NavCameraPosition } from "@/utils/navigation/navCameraSmoothing";

type LatLng = { latitude: number; longitude: number };

export function computeNavCameraDtSeconds(params: {
  nowMs: number;
  lastFrameAtMs: number;
  minDtS?: number;
  maxDtS?: number;
}): { dtS: number; nextLastFrameAtMs: number } {
  const { nowMs, lastFrameAtMs, minDtS = 0.001, maxDtS = 0.25 } = params;

  const last = Number.isFinite(lastFrameAtMs) && lastFrameAtMs > 0
    ? lastFrameAtMs
    : nowMs;

  const raw = (nowMs - last) / 1000;
  const clamped = Math.min(maxDtS, Math.max(minDtS, raw));

  return {
    dtS: Number.isFinite(clamped) ? clamped : minDtS,
    nextLastFrameAtMs: nowMs,
  };
}

export function computeNavCameraApplyDecision(params: {
  nowMs: number;
  lastApplyAtMs: number;
  applyMinIntervalMs: number;

  nextCamera: NavCameraPosition;

  lastAppliedCenter: LatLng | null;
  lastAppliedHeadingDeg: number;
  lastAppliedPitchDeg: number;
  lastAppliedZoom: number;

  centerDeadbandM: number;
  bearingDeadbandDeg: number;
  pitchDeadbandDeg: number;
  zoomDeadband: number;
}): {
  canApplyByInterval: boolean;
  shouldApply: boolean;
  centerMoveM: number;
  bearingDeltaDeg: number;
  pitchDeltaDeg: number;
  zoomDelta: number;
} {
  const {
    nowMs,
    lastApplyAtMs,
    applyMinIntervalMs,
    nextCamera,
    lastAppliedCenter,
    lastAppliedHeadingDeg,
    lastAppliedPitchDeg,
    lastAppliedZoom,
    centerDeadbandM,
    bearingDeadbandDeg,
    pitchDeadbandDeg,
    zoomDeadband,
  } = params;

  const safeMinInterval = Number.isFinite(applyMinIntervalMs)
    ? applyMinIntervalMs
    : 0;
  const canApplyByInterval = nowMs - lastApplyAtMs >= safeMinInterval;
  if (!canApplyByInterval) {
    return {
      canApplyByInterval,
      shouldApply: false,
      centerMoveM: 0,
      bearingDeltaDeg: 0,
      pitchDeltaDeg: 0,
      zoomDelta: 0,
    };
  }

  const centerMoveM = lastAppliedCenter
    ? distanceMetersBetween(lastAppliedCenter, nextCamera.center)
    : Number.POSITIVE_INFINITY;

  const bearingDeltaDeg = Math.abs(
    angleDeltaDegrees(nextCamera.heading, lastAppliedHeadingDeg),
  );
  const pitchDeltaDeg = Math.abs(nextCamera.pitch - lastAppliedPitchDeg);
  const zoomDelta = Math.abs(nextCamera.zoom - lastAppliedZoom);

  const shouldApply =
    centerMoveM >= centerDeadbandM ||
    bearingDeltaDeg >= bearingDeadbandDeg ||
    pitchDeltaDeg >= pitchDeadbandDeg ||
    zoomDelta >= zoomDeadband;

  return {
    canApplyByInterval,
    shouldApply,
    centerMoveM,
    bearingDeltaDeg,
    pitchDeltaDeg,
    zoomDelta,
  };
}
