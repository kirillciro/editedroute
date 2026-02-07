import type { LatLng } from "@/types/navigation";
import { distanceMetersBetween } from "@/utils/geo/geometry";

type ClosestPointOnPolylineMetersFn = (
  p: LatLng,
  poly: LatLng[],
  indexHint: number,
) => { point: LatLng; distanceM: number; index: number };

export function computeRemainingRouteMetersOnPolyline(params: {
  position: LatLng;
  polyline: LatLng[];
  cumulativeMeters: number[];
  totalMeters: number;
  lastClosestIndex: number;
  closestPointOnPolylineMeters: ClosestPointOnPolylineMetersFn;
}): { remainingMeters: number | null; nextClosestIndex: number } {
  const {
    position,
    polyline,
    cumulativeMeters,
    totalMeters,
    lastClosestIndex,
    closestPointOnPolylineMeters,
  } = params;

  if (polyline.length < 2) {
    return { remainingMeters: null, nextClosestIndex: lastClosestIndex };
  }
  if (cumulativeMeters.length !== polyline.length) {
    return { remainingMeters: null, nextClosestIndex: lastClosestIndex };
  }
  if (!Number.isFinite(totalMeters) || totalMeters <= 0) {
    return { remainingMeters: null, nextClosestIndex: lastClosestIndex };
  }

  const safeHint = Number.isFinite(lastClosestIndex) ? lastClosestIndex : 0;
  const res = closestPointOnPolylineMeters(position, polyline, safeHint);

  const index = Math.max(0, Math.min(polyline.length - 1, res.index));
  const segStart = polyline[index];

  const cumulativeAtIndex = cumulativeMeters[index] ?? 0;
  const segOffset = distanceMetersBetween(segStart, res.point);
  const along = cumulativeAtIndex + segOffset;

  if (!Number.isFinite(along)) {
    return { remainingMeters: null, nextClosestIndex: index };
  }

  const remaining = Math.max(0, totalMeters - along);
  return { remainingMeters: remaining, nextClosestIndex: index };
}
