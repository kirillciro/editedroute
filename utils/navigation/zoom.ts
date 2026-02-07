export function computeNavZoomTarget(params: {
  speedMps: number;
  distanceToNextTurnMeters: number;
}): number {
  const speedMps = params.speedMps || 0;
  const speedKmh = speedMps * 3.6;

  const d = Number.isFinite(params.distanceToNextTurnMeters)
    ? params.distanceToNextTurnMeters
    : 0;

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
  let distanceZoom: number | null = null;
  if (d >= 300 && d < 1000) {
    distanceZoom = 16.8 - ((d - 300) / 700) * 0.6; // 16.8..16.2
  } else if (d >= 1000 && d < 3000) {
    distanceZoom = 16.2 - ((d - 1000) / 2000) * 0.7; // 16.2..15.5
  } else if (d >= 3000) {
    distanceZoom = 15.5 - Math.min((d - 3000) / 5000, 1) * 0.5; // 15.5..15.0
  }

  let targetZoom = distanceZoom != null ? Math.min(speedZoom, distanceZoom) : speedZoom;

  // Turn anticipation: zoom in a bit as we approach the next maneuver.
  // (Keeps the junction readable like Google Maps.)
  if (speedKmh <= 110 && d > 0 && d < 180) {
    const t = Math.max(0, Math.min(1, d / 180));
    const turnZoom = 18.5 - t * 0.8; // 18.5..17.7
    targetZoom = Math.max(targetZoom, turnZoom);
  }

  return targetZoom;
}
