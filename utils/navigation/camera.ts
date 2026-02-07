import type { LatLng } from "@/types/navigation";

// Camera look-ahead center (keeps the marker lower on screen like Google/Waze)
export const offsetCoordinate = (
  anchor: LatLng,
  headingDegrees: number,
  meters: number,
): LatLng => {
  if (!meters) return anchor;

  const headingRad = (headingDegrees * Math.PI) / 180;
  const latOffset = (meters * Math.cos(headingRad)) / 111320;
  const lngOffset =
    (meters * Math.sin(headingRad)) /
    (111320 * Math.cos((anchor.latitude * Math.PI) / 180));

  return {
    latitude: anchor.latitude + latOffset,
    longitude: anchor.longitude + lngOffset,
  };
};

export const computeNavLookAheadMeters = (
  speedMps: number,
  distanceToNextTurnMeters?: number | null,
) => {
  const speedKmh = (speedMps || 0) * 3.6;
  let base = 70;
  if (speedKmh <= 10) base = 70;
  else if (speedKmh <= 30) base = 70 + ((speedKmh - 10) / 20) * 40; // 70..110
  else if (speedKmh <= 60) base = 110 + ((speedKmh - 30) / 30) * 60; // 110..170
  else if (speedKmh <= 100) base = 170 + ((speedKmh - 60) / 40) * 30; // 170..200
  else base = 200;

  // Turn anticipation: as we approach the next maneuver, reduce look-ahead so
  // the marker stays more centered relative to the upcoming turn.
  const d = distanceToNextTurnMeters;
  if (Number.isFinite(d) && (d as number) > 0 && (d as number) < 160) {
    const t = Math.max(0, Math.min(1, (d as number) / 160));
    const scale = 0.45 + 0.55 * t; // 0.45 at the turn, 1.0 at >=160m
    return base * scale;
  }

  return base;
};
