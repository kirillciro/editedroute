export type DynamicEtaSource = "speed" | "ratio" | "none";

export const formatEtaFromSeconds = (totalSeconds: number) => {
  const seconds = Math.max(0, Math.floor(totalSeconds || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes} min`;
};

export const computeDynamicEtaSeconds = (params: {
  remainingRouteMeters: number;
  speedMps: number;
  routeTotalDurationSec: number;
  routeTotalMeters: number;
}): { etaSeconds: number | null; source: DynamicEtaSource } => {
  const {
    remainingRouteMeters,
    speedMps,
    routeTotalDurationSec,
    routeTotalMeters,
  } = params;

  if (!Number.isFinite(remainingRouteMeters) || remainingRouteMeters < 0) {
    return { etaSeconds: null, source: "none" };
  }

  const speed = Number.isFinite(speedMps) && speedMps > 0 ? speedMps : 0;

  // Prefer speed-based ETA when we have a real GPS speed.
  if (speed >= 1.5) {
    const etaSeconds = remainingRouteMeters / speed;
    return Number.isFinite(etaSeconds)
      ? { etaSeconds, source: "speed" }
      : { etaSeconds: null, source: "none" };
  }

  // Fallback: ratio ETA based on original Directions duration.
  if (routeTotalDurationSec > 0 && routeTotalMeters > 1) {
    const etaSeconds = routeTotalDurationSec * (remainingRouteMeters / routeTotalMeters);
    return Number.isFinite(etaSeconds)
      ? { etaSeconds, source: "ratio" }
      : { etaSeconds: null, source: "none" };
  }

  return { etaSeconds: null, source: "none" };
};
