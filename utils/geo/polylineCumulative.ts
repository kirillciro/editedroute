import { distanceMetersBetween } from "@/utils/geo/geometry";

type LatLng = { latitude: number; longitude: number };

type CumulativeResult = {
  cumulativeMeters: number[];
  totalMeters: number;
};

export function computePolylineCumulativeMeters(points: LatLng[]): CumulativeResult {
  if (points.length < 2) {
    return { cumulativeMeters: [], totalMeters: 0 };
  }

  const cumulativeMeters: number[] = new Array(points.length);
  cumulativeMeters[0] = 0;

  for (let i = 1; i < points.length; i++) {
    cumulativeMeters[i] =
      cumulativeMeters[i - 1] +
      distanceMetersBetween(points[i - 1], points[i]);
  }

  const totalMeters = cumulativeMeters[cumulativeMeters.length - 1] || 0;
  return { cumulativeMeters, totalMeters };
}
