import type { CameraApplyMode } from "@/types/mapUi";

export type MapCameraPosition = {
  center: { latitude: number; longitude: number };
  heading: number;
  pitch: number;
  zoom: number;
};

export function applyMapCamera(params: {
  mapAny: any;
  mode: CameraApplyMode;
  camera: MapCameraPosition;
  durationMs: number;
  nowMs?: number;
  onHoldUntilMs?: (holdUntil: number) => void;
}): { applied: boolean } {
  const { mapAny, mode, camera, durationMs } = params;

  if (!mapAny) return { applied: false };

  const animateDuration = mode === "animate160" ? 160 : mode === "animate0" ? 0 : durationMs;

  if (mode === "setCamera" && mapAny?.setCamera) {
    mapAny.setCamera(camera);
    return { applied: true };
  }

  if ((mode === "animate0" || mode === "animate160") && mapAny?.animateCamera) {
    // Prevent overlapping animations (native map cancels/retargets, causing jitter).
    const now = params.nowMs ?? Date.now();
    params.onHoldUntilMs?.(now + Math.max(0, animateDuration) + 30);

    mapAny.animateCamera(camera, { duration: animateDuration });
    return { applied: true };
  }

  if (mapAny?.setCamera) {
    mapAny.setCamera(camera);
    return { applied: true };
  }

  if (mapAny?.animateCamera) {
    mapAny.animateCamera(camera, { duration: durationMs });
    return { applied: true };
  }

  return { applied: false };
}
