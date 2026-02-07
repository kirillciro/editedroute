import { LatLng } from "@/types/navigation";

export function distanceMetersBetween(a: LatLng, b: LatLng): number {
  // Haversine in meters
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLon / 2);
  const h = s1 * s1 + Math.cos(lat1) * Math.cos(lat2) * s2 * s2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function closestPointOnSegmentMeters(
  p: LatLng,
  a: LatLng,
  b: LatLng,
): { point: LatLng; distanceM: number } {
  // Local equirectangular projection (good enough for short distances)
  const originLat = a.latitude;
  const originLng = a.longitude;
  const latRad = (originLat * Math.PI) / 180;
  const metersPerDegLat = 111320;
  const metersPerDegLng = 111320 * Math.cos(latRad);

  const bx = (b.longitude - originLng) * metersPerDegLng;
  const by = (b.latitude - originLat) * metersPerDegLat;
  const px = (p.longitude - originLng) * metersPerDegLng;
  const py = (p.latitude - originLat) * metersPerDegLat;

  const ab2 = bx * bx + by * by;
  if (ab2 < 1e-6) {
    const d = Math.hypot(px, py);
    return { point: a, distanceM: d };
  }

  let t = (px * bx + py * by) / ab2;
  t = Math.max(0, Math.min(1, t));

  const projX = t * bx;
  const projY = t * by;
  const projLat = originLat + projY / metersPerDegLat;
  const projLng = originLng + projX / metersPerDegLng;
  const dist = Math.hypot(px - projX, py - projY);

  return {
    point: { latitude: projLat, longitude: projLng },
    distanceM: dist,
  };
}

export function closestPointOnPolylineMeters(
  p: LatLng,
  poly: LatLng[],
  indexHint: number,
): { point: LatLng; distanceM: number; index: number } {
  if (poly.length < 2) {
    return { point: p, distanceM: Infinity, index: 0 };
  }

  const n = poly.length;
  const hint = Math.max(0, Math.min(n - 2, indexHint || 0));
  const useFullScan = n <= 120;
  const window = 50;
  const start = useFullScan ? 0 : Math.max(0, hint - window);
  const end = useFullScan ? n - 2 : Math.min(n - 2, hint + window);

  let bestDistance = Number.POSITIVE_INFINITY;
  let bestPoint = p;
  let bestIndex = hint;

  for (let i = start; i <= end; i++) {
    const res = closestPointOnSegmentMeters(p, poly[i], poly[i + 1]);
    if (res.distanceM < bestDistance) {
      bestDistance = res.distanceM;
      bestPoint = res.point;
      bestIndex = i;
    }
  }

  return { point: bestPoint, distanceM: bestDistance, index: bestIndex };
}
