import { decodeGooglePolyline } from "@/utils/geo/googlePolyline";
import { filterNavigationSteps } from "@/utils/navigation/directions";
import type { GoogleDirectionsStep } from "@/types/googleDirections";

type CoordLike = { latitude: number; longitude: number };

type DirectionsOk = {
  kind: "ok";
  points: CoordLike[];
  steps: GoogleDirectionsStep[];
  totalDurationSec: number;
};

type DirectionsNotOk =
  | { kind: "zero_results" }
  | { kind: "over_query_limit" }
  | { kind: "status_error"; status: string };

export type DirectionsRouteResult = DirectionsOk | DirectionsNotOk;

export function buildDirectionsUrl(params: {
  apiKey: string;
  origin: CoordLike;
  destination: CoordLike;
  stops?: CoordLike[];
}): string {
  const { apiKey, origin, destination, stops } = params;

  const originStr = `${origin.latitude},${origin.longitude}`;
  const destinationStr = `${destination.latitude},${destination.longitude}`;

  let waypointsParam = "";
  if (stops && stops.length > 0) {
    const waypoints = stops
      .map((stop) => `${stop.latitude},${stop.longitude}`)
      .join("|");
    waypointsParam = `&waypoints=optimize:true|${waypoints}`;
  }

  return `https://maps.googleapis.com/maps/api/directions/json?origin=${originStr}&destination=${destinationStr}${waypointsParam}&key=${apiKey}`;
}

export async function fetchDirectionsRoute(params: {
  apiKey: string;
  origin: CoordLike;
  destination: CoordLike;
  stops?: CoordLike[];
  timeoutMs?: number;
}): Promise<DirectionsRouteResult> {
  const url = buildDirectionsUrl({
    apiKey: params.apiKey,
    origin: params.origin,
    destination: params.destination,
    stops: params.stops,
  });

  // Add timeout to prevent hanging
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    params.timeoutMs ?? 10_000,
  );

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      // Preserve existing behavior: treat as a hard fetch failure.
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.status === "ZERO_RESULTS") {
      return { kind: "zero_results" };
    }

    if (data.status === "OVER_QUERY_LIMIT") {
      return { kind: "over_query_limit" };
    }

    if (data.status !== "OK") {
      return { kind: "status_error", status: String(data.status) };
    }

    if (!data.routes || data.routes.length === 0) {
      return { kind: "status_error", status: "NO_ROUTES" };
    }

    const route = data.routes[0];
    const points = decodeGooglePolyline(route.overview_polyline.points);

    const steps: GoogleDirectionsStep[] = [];
    let totalDurationSec = 0;

    route.legs.forEach((leg: any) => {
      const filteredSteps = filterNavigationSteps(
        (leg?.steps ?? []) as GoogleDirectionsStep[],
      );
      steps.push(...filteredSteps);
      totalDurationSec += Number(leg.duration.value) || 0;
    });

    return { kind: "ok", points, steps, totalDurationSec };
  } finally {
    clearTimeout(timeoutId);
  }
}
