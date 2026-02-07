import {
  computeNavLookAheadMeters,
  offsetCoordinate,
} from "@/utils/navigation/camera";

type LatLng = { latitude: number; longitude: number };

type Targets = {
  centerTarget: LatLng;
  pitchTarget: number;
  zoomTarget: number;
};

export function computeNavCameraTargets(params: {
  base: LatLng;
  bearingDeg: number;
  speedMps: number;
  distanceToNextTurnMeters: number;

  inArrival: boolean;

  cameraPitchDeg: number;
  cameraZoom: number;
}): Targets {
  const {
    base,
    bearingDeg,
    speedMps,
    distanceToNextTurnMeters,
    inArrival,
    cameraPitchDeg,
    cameraZoom,
  } = params;

  let pitchTarget = inArrival ? 45 : Math.max(30, cameraPitchDeg);
  let zoomTarget = cameraZoom || 17.2;

  const d = distanceToNextTurnMeters;
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
        bearingDeg,
        computeNavLookAheadMeters(speedMps, distanceToNextTurnMeters),
      );

  return { centerTarget, pitchTarget, zoomTarget };
}
