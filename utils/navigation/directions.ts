import type { GoogleDirectionsStep } from "@/types/googleDirections";

type CoordLike = { latitude: number; longitude: number };

export const DIRECTIONS_CACHE_TTL_MS = 60_000;

export function roundCoordForCache(v: number): number {
  // ~0.0005° ≈ 55m
  return Math.round(v * 2000) / 2000;
}

export function buildDirectionsCacheKey(params: {
  origin: CoordLike;
  destination: CoordLike;
  waypoints?: CoordLike[];
}): string {
  const { origin, destination, waypoints } = params;

  const waypointsKey =
    waypoints && waypoints.length > 0
      ? waypoints
          .map(
            (w) =>
              `${roundCoordForCache(w.latitude)}:${roundCoordForCache(w.longitude)}`,
          )
          .join("|")
      : "";

  return `${roundCoordForCache(origin.latitude)},${roundCoordForCache(
    origin.longitude,
  )} -> ${roundCoordForCache(destination.latitude)},${roundCoordForCache(
    destination.longitude,
  )} | ${waypointsKey}`;
}

// STAGE 5.3: Filter and prioritize navigation instructions
export function filterNavigationSteps(
  steps: GoogleDirectionsStep[],
): GoogleDirectionsStep[] {
  const filtered: GoogleDirectionsStep[] = [];
  const noiseKeywords = ["continue straight", "continue onto", "head", "slight"];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const instruction = String(step?.html_instructions ?? "").toLowerCase();
    const distance = Number(step?.distance?.value ?? 0);

    // Skip very short steps (< 50m) unless it's a turn
    if (distance < 50 && !instruction.includes("turn")) {
      continue;
    }

    // Skip noise instructions unless significant distance
    let isNoise = false;
    for (const keyword of noiseKeywords) {
      if (instruction.includes(keyword) && distance < 200) {
        isNoise = true;
        break;
      }
    }

    if (!isNoise) {
      filtered.push(step);
    }
  }

  // Always keep at least the first step
  if (filtered.length === 0 && steps.length > 0) {
    filtered.push(steps[0]);
  }

  return filtered;
}
