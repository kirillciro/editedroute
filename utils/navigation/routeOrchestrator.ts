import type { MapStop } from "@/types/mapRoute";
import { buildDirectionsCacheKey, DIRECTIONS_CACHE_TTL_MS } from "@/utils/navigation/directions";
import { fetchDirectionsRoute } from "@/utils/navigation/directionsApi";
import { formatEtaFromSeconds } from "@/utils/navigation/eta";
import type { GoogleDirectionsStep } from "@/types/googleDirections";

type Ref<T> = { current: T };

type LatLng = { latitude: number; longitude: number };

type CalculateRouteOptions = {
  origin?: LatLng;
  silent?: boolean;
  fit?: boolean;
};

export type PendingRouteRequest = {
  destLat: number;
  destLng: number;
  retryCount: number;
  options?: CalculateRouteOptions;
};

type CachedDirectionsEntry = {
  ts: number;
  points: LatLng[];
  steps: GoogleDirectionsStep[];
  eta: string;
  totalDurationSec?: number;
};

type RouteOutcome =
  | { kind: "missing_key" }
  | { kind: "missing_origin" }
  | { kind: "cooldown_active" }
  | { kind: "cache_hit"; cacheKey: string; cached: CachedDirectionsEntry }
  | { kind: "coalesced" }
  | { kind: "zero_results" }
  | { kind: "over_query_limit"; cooldownUntilMs: number }
  | { kind: "status_error"; status: string }
  | {
      kind: "ok";
      cacheKey: string;
      points: LatLng[];
      steps: GoogleDirectionsStep[];
      totalDurationSec: number;
      eta: string;
      nowMs: number;
    }
  | {
      kind: "retry";
      delayMs: number;
      nextRetryCount: number;
      error: unknown;
    }
  | { kind: "error"; error: unknown };

export async function orchestrateRouteRequest(params: {
  apiKey: string;
  destLat: number;
  destLng: number;
  retryCount: number;
  options?: CalculateRouteOptions;

  userLocation: LatLng | null;
  stops: MapStop[];

  routeRequestInFlightRef: Ref<boolean>;
  pendingRouteRequestRef: Ref<PendingRouteRequest | null>;
  directionsCooldownUntilRef: Ref<number>;
  directionsCacheRef: Ref<Map<string, CachedDirectionsEntry>>;

  nowMs?: number;
}): Promise<{ outcome: RouteOutcome; pendingToRun: PendingRouteRequest | null }> {
  const {
    apiKey,
    destLat,
    destLng,
    retryCount,
    options,
    userLocation,
    stops,
    routeRequestInFlightRef,
    pendingRouteRequestRef,
    directionsCooldownUntilRef,
    directionsCacheRef,
    nowMs: nowMsOverride,
  } = params;

  if (!apiKey) {
    return { outcome: { kind: "missing_key" }, pendingToRun: null };
  }

  const originCoords = options?.origin ?? userLocation;
  if (!originCoords) {
    return { outcome: { kind: "missing_origin" }, pendingToRun: null };
  }

  const nowMs = nowMsOverride ?? Date.now();

  if (directionsCooldownUntilRef.current > nowMs) {
    return { outcome: { kind: "cooldown_active" }, pendingToRun: null };
  }

  const cacheKey = buildDirectionsCacheKey({
    origin: {
      latitude: originCoords.latitude,
      longitude: originCoords.longitude,
    },
    destination: { latitude: destLat, longitude: destLng },
    waypoints: stops,
  });

  const cached = directionsCacheRef.current.get(cacheKey);
  if (cached && nowMs - cached.ts <= DIRECTIONS_CACHE_TTL_MS) {
    return {
      outcome: { kind: "cache_hit", cacheKey, cached },
      pendingToRun: null,
    };
  }

  // Coalesce concurrent requests: keep only the latest
  if (routeRequestInFlightRef.current) {
    pendingRouteRequestRef.current = {
      destLat,
      destLng,
      retryCount,
      options,
    };
    return { outcome: { kind: "coalesced" }, pendingToRun: null };
  }

  let pendingToRun: PendingRouteRequest | null = null;
  let outcome: RouteOutcome = { kind: "error", error: new Error("unknown") };

  try {
    routeRequestInFlightRef.current = true;

    const result = await fetchDirectionsRoute({
      apiKey,
      origin: {
        latitude: originCoords.latitude,
        longitude: originCoords.longitude,
      },
      destination: { latitude: destLat, longitude: destLng },
      stops,
      timeoutMs: 10_000,
    });

    if (result.kind === "zero_results") {
      outcome = { kind: "zero_results" };
    } else if (result.kind === "over_query_limit") {
      const cooldownUntilMs = nowMs + 60_000;
      directionsCooldownUntilRef.current = cooldownUntilMs;
      outcome = { kind: "over_query_limit", cooldownUntilMs };
    } else if (result.kind === "status_error") {
      outcome = { kind: "status_error", status: result.status };
    } else {
      const eta = formatEtaFromSeconds(result.totalDurationSec);

      directionsCacheRef.current.set(cacheKey, {
        ts: nowMs,
        points: result.points,
        steps: result.steps,
        eta,
        totalDurationSec: result.totalDurationSec,
      });

      outcome = {
        kind: "ok",
        cacheKey,
        points: result.points,
        steps: result.steps,
        totalDurationSec: result.totalDurationSec,
        eta,
        nowMs,
      };
    }
  } catch (error: any) {
    const isRetryable =
      retryCount < 2 &&
      (error?.name === "AbortError" ||
        (typeof error?.message === "string" && error.message.includes("network")));

    if (isRetryable) {
      const delayMs = 1000 * Math.pow(2, retryCount);
      outcome = {
        kind: "retry",
        delayMs,
        nextRetryCount: retryCount + 1,
        error,
      };
    } else {
      outcome = { kind: "error", error };
    }
  } finally {
    routeRequestInFlightRef.current = false;

    // Drain the latest queued request (if any)
    const pending = pendingRouteRequestRef.current;
    pendingRouteRequestRef.current = null;
    pendingToRun = pending;
  }

  return { outcome, pendingToRun };
}
