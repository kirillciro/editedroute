export const OFF_ROUTE_GRACE_MS = 4000;
export const ROUTE_RECALC_COOLDOWN_MS = 30_000;

export type OffRouteDecision = {
  nextOffRouteSinceMs: number | null;
  shouldRecalculate: boolean;
};

export function decideOffRouteRecalc(params: {
  hasDestination: boolean;
  distanceToRouteMeters: number;
  nowMs: number;
  offRouteSinceMs: number | null;
  isRecalcInFlight: boolean;
  lastRecalcAtMs: number;
}): OffRouteDecision {
  const {
    hasDestination,
    distanceToRouteMeters,
    nowMs,
    offRouteSinceMs,
    isRecalcInFlight,
    lastRecalcAtMs,
  } = params;

  if (!hasDestination || !Number.isFinite(distanceToRouteMeters)) {
    return { nextOffRouteSinceMs: null, shouldRecalculate: false };
  }

  // Off-route threshold is 50m.
  if (distanceToRouteMeters <= 50) {
    return { nextOffRouteSinceMs: null, shouldRecalculate: false };
  }

  const nextOffRouteSinceMs = offRouteSinceMs ?? nowMs;
  const offRouteForMs = nowMs - nextOffRouteSinceMs;

  const canRecalc =
    offRouteForMs >= OFF_ROUTE_GRACE_MS &&
    !isRecalcInFlight &&
    nowMs - lastRecalcAtMs >= ROUTE_RECALC_COOLDOWN_MS;

  return { nextOffRouteSinceMs, shouldRecalculate: canRecalc };
}
