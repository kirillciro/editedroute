export const SNAP_HARD_DISABLE_METERS = 60;

export function computeSnapInMeters(speedMps: number): number {
  const speedKmh = (speedMps || 0) * 3.6;
  if (speedKmh <= 10) return 12;
  if (speedKmh <= 40) return 12 + ((speedKmh - 10) / 30) * 6; // 12..18
  if (speedKmh <= 90) return 18 + ((speedKmh - 40) / 50) * 6; // 18..24
  return 26;
}

export function computeNextSnapActive(params: {
  wasSnapActive: boolean;
  distanceToRouteMeters: number;
  speedMps: number;
}): boolean {
  const { wasSnapActive, distanceToRouteMeters, speedMps } = params;

  const snapInMeters = computeSnapInMeters(speedMps);
  const snapOutMeters = snapInMeters + 6;

  // Don't try to snap when clearly off-route.
  if (!Number.isFinite(distanceToRouteMeters)) return false;
  if (distanceToRouteMeters >= SNAP_HARD_DISABLE_METERS) return false;

  if (wasSnapActive) {
    return distanceToRouteMeters <= snapOutMeters;
  }

  return distanceToRouteMeters <= snapInMeters;
}
