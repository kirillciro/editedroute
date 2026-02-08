import { useEffect } from "react";

import {
  computeDynamicEtaSeconds,
  formatEtaFromSeconds,
  type DynamicEtaSource,
} from "@/utils/navigation/eta";

type LatLng = { latitude: number; longitude: number };

type UserLoc = LatLng & { speed?: number };

type Ref<T> = { current: T };

type Params = {
  isNavigating: boolean;
  appState: string;

  userLocationRef: Ref<UserLoc | null>;

  computeRemainingRouteMeters: (p: LatLng) => number | null;

  routeTotalDurationSecRef: Ref<number>;
  routePolylineTotalMetersRef: Ref<number>;

  lastDynamicEtaMinutesRef: Ref<number | null>;
  dynamicEtaSecondsRef: Ref<number | null>;
  dynamicRemainingRouteMetersRef: Ref<number | null>;
  dynamicEtaSourceRef: Ref<DynamicEtaSource>;

  setEtaText: React.Dispatch<React.SetStateAction<string>>;
};

export function useDynamicEta({
  isNavigating,
  appState,
  userLocationRef,
  computeRemainingRouteMeters,
  routeTotalDurationSecRef,
  routePolylineTotalMetersRef,
  lastDynamicEtaMinutesRef,
  dynamicEtaSecondsRef,
  dynamicRemainingRouteMetersRef,
  dynamicEtaSourceRef,
  setEtaText,
}: Params) {
  // Dynamic ETA: update during navigation based on remaining route distance + real speed.
  // This mimics Google Maps behavior (31 → 30 → 29 min as you progress).
  useEffect(() => {
    if (!isNavigating || appState !== "active") {
      dynamicEtaSecondsRef.current = null;
      dynamicRemainingRouteMetersRef.current = null;
      dynamicEtaSourceRef.current = "none";
      return;
    }

    const id = setInterval(() => {
      const loc = userLocationRef.current;
      if (!loc) return;

      const remainingM = computeRemainingRouteMeters({
        latitude: loc.latitude,
        longitude: loc.longitude,
      });
      dynamicRemainingRouteMetersRef.current = remainingM;
      if (remainingM == null) {
        dynamicEtaSecondsRef.current = null;
        dynamicEtaSourceRef.current = "none";
        return;
      }

      const speedMpsRaw = loc.speed ?? 0;
      const speedMps =
        Number.isFinite(speedMpsRaw) && speedMpsRaw > 0 ? speedMpsRaw : 0;

      const computed = computeDynamicEtaSeconds({
        remainingRouteMeters: remainingM,
        speedMps,
        routeTotalDurationSec: routeTotalDurationSecRef.current,
        routeTotalMeters: routePolylineTotalMetersRef.current,
      });
      dynamicEtaSecondsRef.current = computed.etaSeconds;
      dynamicEtaSourceRef.current = computed.source;
      if (computed.etaSeconds == null || !Number.isFinite(computed.etaSeconds)) {
        dynamicEtaSourceRef.current = "none";
        return;
      }

      const minutes = Math.max(1, Math.round(computed.etaSeconds / 60));
      if (lastDynamicEtaMinutesRef.current === minutes) return;
      lastDynamicEtaMinutesRef.current = minutes;
      setEtaText(formatEtaFromSeconds(minutes * 60));
    }, 1000);

    return () => clearInterval(id);
  }, [
    isNavigating,
    appState,
    userLocationRef,
    computeRemainingRouteMeters,
    routeTotalDurationSecRef,
    routePolylineTotalMetersRef,
    lastDynamicEtaMinutesRef,
    dynamicEtaSecondsRef,
    dynamicRemainingRouteMetersRef,
    dynamicEtaSourceRef,
    setEtaText,
  ]);
}
