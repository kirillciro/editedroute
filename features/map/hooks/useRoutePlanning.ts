import { useCallback, useRef } from "react";
import { Alert } from "react-native";
import type MapView from "react-native-maps";

import type { GoogleDirectionsStep } from "@/types/googleDirections";
import type { MapDestination, MapStop, UserLocation } from "@/types/mapRoute";
import { fitMapToCoordinates } from "@/utils/navigation/mapFit";
import { orchestrateRouteRequest } from "@/utils/navigation/routeOrchestrator";

type Coord = { latitude: number; longitude: number };

type PendingRouteRequest = {
  destLat: number;
  destLng: number;
  retryCount: number;
  options?: {
    origin?: { latitude: number; longitude: number };
    silent?: boolean;
    fit?: boolean;
  };
};

type RouteCacheEntry = {
  ts: number;
  points: Coord[];
  steps: any[];
  eta: string;
  totalDurationSec: number;
};

type Params = {
  apiKey: string;
  mapRef: React.RefObject<MapView | null>;

  stops: MapStop[];
  userLocation: UserLocation | null;
  userLocationRef: React.MutableRefObject<{
    latitude: number;
    longitude: number;
    speed?: number;
  } | null>;

  setRouteCoordinates: (points: Coord[]) => void;

  navigationStepsRef: React.MutableRefObject<GoogleDirectionsStep[]>;
  currentStepIndexRef: React.MutableRefObject<number>;
  routeTotalDurationSecRef: React.MutableRefObject<number>;

  applyTurnByTurnUiFromIndex: (idx: number) => void;
  setEtaText: (etaText: string) => void;
};

export function useRoutePlanning({
  apiKey,
  mapRef,
  stops,
  userLocation,
  userLocationRef,
  setRouteCoordinates,
  navigationStepsRef,
  currentStepIndexRef,
  routeTotalDurationSecRef,
  applyTurnByTurnUiFromIndex,
  setEtaText,
}: Params) {
  // Global Directions API guards (reduce overall quota burn)
  const routeRequestInFlightRef = useRef<boolean>(false);
  const pendingRouteRequestRef = useRef<PendingRouteRequest | null>(null);
  const directionsCooldownUntilRef = useRef<number>(0);
  const lastOverQueryAlertAtRef = useRef<number>(0);
  const directionsCacheRef = useRef<Map<string, RouteCacheEntry>>(new Map());

  const calculateRoute = useCallback(
    async function calculateRoute(
      destLat: number,
      destLng: number,
      retryCount = 0,
      options?: {
        origin?: { latitude: number; longitude: number };
        silent?: boolean;
        fit?: boolean;
      },
    ) {
      const applyRouteToState = (params: {
        points: Coord[];
        steps: GoogleDirectionsStep[];
        eta: string;
        totalDurationSec: number;
      }) => {
        setRouteCoordinates(params.points);
        navigationStepsRef.current = params.steps;
        currentStepIndexRef.current = 0;
        routeTotalDurationSecRef.current = params.totalDurationSec;

        if (navigationStepsRef.current.length > 0) {
          applyTurnByTurnUiFromIndex(0);
        }

        setEtaText(params.eta);
      };

      const scheduleRoute = (params: {
        destLat: number;
        destLng: number;
        retryCount: number;
        options?: {
          origin?: { latitude: number; longitude: number };
          silent?: boolean;
          fit?: boolean;
        };
        delayMs: number;
      }) => {
        setTimeout(() => {
          void calculateRoute(
            params.destLat,
            params.destLng,
            params.retryCount,
            params.options,
          );
        }, params.delayMs);
      };

      const nowMs = Date.now();

      const baseUserLoc = (() => {
        if (options?.origin) return options.origin;
        const loc = userLocationRef.current ?? userLocation;
        return loc
          ? { latitude: loc.latitude, longitude: loc.longitude }
          : null;
      })();

      const { outcome, pendingToRun } = await orchestrateRouteRequest({
        apiKey,
        destLat,
        destLng,
        retryCount,
        options,
        userLocation: baseUserLoc,
        stops,
        routeRequestInFlightRef,
        pendingRouteRequestRef,
        directionsCooldownUntilRef,
        directionsCacheRef,
        nowMs,
      });

      if (pendingToRun) {
        // Small delay to avoid immediate bursts
        scheduleRoute({
          destLat: pendingToRun.destLat,
          destLng: pendingToRun.destLng,
          retryCount: pendingToRun.retryCount,
          options: pendingToRun.options,
          delayMs: 250,
        });
      }

      switch (outcome.kind) {
        case "missing_key": {
          if (!options?.silent) {
            Alert.alert(
              "Missing Google Maps API Key",
              "The app is missing a Google Maps API key, so directions cannot be fetched. Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY or configure ios.config.googleMapsApiKey / android.config.googleMaps.apiKey in app.json.",
            );
          }
          return;
        }
        case "missing_origin": {
          if (!options?.silent) {
            Alert.alert(
              "Location Required",
              "Please enable location services to calculate route.",
              [{ text: "OK" }],
            );
          }
          return;
        }
        case "cooldown_active": {
          if (
            !options?.silent &&
            nowMs - lastOverQueryAlertAtRef.current > 8000
          ) {
            lastOverQueryAlertAtRef.current = nowMs;
            Alert.alert(
              "Directions Limit Reached",
              "Google Directions API quota was exceeded (OVER_QUERY_LIMIT). Please wait a bit and try again.",
              [{ text: "OK" }],
            );
          }
          return;
        }
        case "cache_hit": {
          applyRouteToState({
            points: outcome.cached.points,
            steps: outcome.cached.steps,
            eta: outcome.cached.eta,
            totalDurationSec: outcome.cached.totalDurationSec || 0,
          });
          return;
        }
        case "coalesced": {
          return;
        }
        case "zero_results": {
          if (!options?.silent) {
            Alert.alert(
              "No Route Found",
              "Unable to find a route to this destination. Please try a different location.",
              [{ text: "OK" }],
            );
          }
          return;
        }
        case "over_query_limit": {
          if (
            !options?.silent &&
            nowMs - lastOverQueryAlertAtRef.current > 8000
          ) {
            lastOverQueryAlertAtRef.current = nowMs;
            Alert.alert(
              "Directions Limit Reached",
              "Too many route requests right now (OVER_QUERY_LIMIT). Please wait ~1 minute and try again.",
              [{ text: "OK" }],
            );
          }
          return;
        }
        case "status_error": {
          if (!options?.silent) {
            Alert.alert(
              "Route Error",
              `Unable to calculate route (status: ${outcome.status}).`,
              [{ text: "OK" }],
            );
          }
          return;
        }
        case "retry": {
          if (__DEV__)
            console.log(
              `Retrying route calculation... (attempt ${outcome.nextRetryCount})`,
            );
          scheduleRoute({
            destLat,
            destLng,
            retryCount: outcome.nextRetryCount,
            options,
            delayMs: outcome.delayMs,
          });
          return;
        }
        case "error": {
          console.error("Error fetching route:", outcome.error);

          if (options?.silent) {
            return;
          }

          const errAny = outcome.error as any;
          const errorMessage =
            errAny?.name === "AbortError"
              ? "Request timed out. Please check your internet connection and try again."
              : "Unable to calculate route. Please check your internet connection.";

          Alert.alert("Connection Error", errorMessage, [
            { text: "Cancel", style: "cancel" },
            {
              text: "Retry",
              onPress: () => void calculateRoute(destLat, destLng, 0, options),
            },
          ]);
          return;
        }
        case "ok": {
          applyRouteToState({
            points: outcome.points,
            steps: outcome.steps,
            eta: outcome.eta,
            totalDurationSec: outcome.totalDurationSec,
          });
          break;
        }
        default: {
          return;
        }
      }

      if (options?.fit !== false) {
        fitMapToCoordinates({
          map: mapRef.current,
          points: outcome.points,
          edgePadding: { top: 100, right: 50, bottom: 300, left: 50 },
          animated: true,
        });
      }
    },
    [
      apiKey,
      mapRef,
      stops,
      userLocation,
      userLocationRef,
      setRouteCoordinates,
      navigationStepsRef,
      currentStepIndexRef,
      routeTotalDurationSecRef,
      applyTurnByTurnUiFromIndex,
      setEtaText,
    ],
  );

  const recalculateRouteToDestinationIfPresent = useCallback(
    async (destinationRef: React.MutableRefObject<MapDestination | null>) => {
      const destNow = destinationRef.current;
      if (!destNow) return;
      await calculateRoute(destNow.latitude, destNow.longitude);
    },
    [calculateRoute],
  );

  return {
    calculateRoute,
    recalculateRouteToDestinationIfPresent,

    // Expose these so future refactors (off-route throttling, debug) can share them.
    routeRequestInFlightRef,
    pendingRouteRequestRef,
    directionsCooldownUntilRef,
    directionsCacheRef,
  };
}
