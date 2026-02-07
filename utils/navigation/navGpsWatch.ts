import type * as ExpoLocation from "expo-location";

import { navGpsOptionsForTier, pickNavGpsTier } from "@/utils/navigation/gpsTier";

type Ref<T> = { current: T };

type Tier = 0 | 1 | 2;

export async function startAdaptiveNavGpsWatch(params: {
  Location: typeof import("expo-location");
  onNavLocationUpdate: (
    location: ExpoLocation.LocationObject,
  ) => void | Promise<void>;

  locationSubscriptionRef: Ref<ExpoLocation.LocationSubscription | null>;
  navGpsResubInFlightRef: Ref<boolean>;
  navGpsTierRef: Ref<Tier>;
  navLastGpsResubAtRef: Ref<number>;
  navGpsTierIntervalRef: Ref<ReturnType<typeof setInterval> | null>;
  navLatestSpeedMpsRef: Ref<number>;

  initialSpeedMps: number;
  minResubMs?: number;
  adjustEveryMs?: number;
}) {
  const {
    Location,
    onNavLocationUpdate,
    locationSubscriptionRef,
    navGpsResubInFlightRef,
    navGpsTierRef,
    navLastGpsResubAtRef,
    navGpsTierIntervalRef,
    navLatestSpeedMpsRef,
    initialSpeedMps,
    minResubMs = 6000,
    adjustEveryMs = 2000,
  } = params;

  const startNavGpsWatch = async (tier: Tier) => {
    if (navGpsResubInFlightRef.current) return;
    navGpsResubInFlightRef.current = true;
    try {
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
        locationSubscriptionRef.current = null;
      }

      const options = navGpsOptionsForTier(tier);
      const sub = await Location.watchPositionAsync(options, onNavLocationUpdate);
      locationSubscriptionRef.current = sub;
      navGpsTierRef.current = tier;
      navLastGpsResubAtRef.current = Date.now();
    } finally {
      navGpsResubInFlightRef.current = false;
    }
  };

  // Start GPS tracking (adaptive cadence)
  const initialTier = pickNavGpsTier(initialSpeedMps, navGpsTierRef.current);
  await startNavGpsWatch(initialTier);

  // Periodically adjust tier based on latest speed with cooldown to avoid thrash.
  if (navGpsTierIntervalRef.current) {
    clearInterval(navGpsTierIntervalRef.current);
    navGpsTierIntervalRef.current = null;
  }

  navGpsTierIntervalRef.current = setInterval(() => {
    const now = Date.now();
    if (now - navLastGpsResubAtRef.current < minResubMs) return;

    const desired = pickNavGpsTier(
      navLatestSpeedMpsRef.current,
      navGpsTierRef.current,
    );
    if (desired !== navGpsTierRef.current) {
      void startNavGpsWatch(desired);
    }
  }, adjustEveryMs);
}
