import * as Location from "expo-location";

export type NavGpsTier = 0 | 1 | 2;

export const pickNavGpsTier = (speedMps: number, currentTier: NavGpsTier) => {
  const speedKmh = (speedMps || 0) * 3.6;
  // Hysteresis to avoid flapping between tiers.
  if (currentTier === 0) {
    if (speedKmh > 4) return 1;
    return 0;
  }
  if (currentTier === 1) {
    if (speedKmh < 1.5) return 0;
    if (speedKmh > 30) return 2;
    return 1;
  }
  // currentTier === 2
  if (speedKmh < 20) return 1;
  return 2;
};

export const navGpsOptionsForTier = (tier: NavGpsTier) => {
  // NOTE: Keep BestForNavigation for correctness; just reduce cadence.
  if (tier === 0) {
    return {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 1500,
      distanceInterval: 8,
    };
  }
  if (tier === 2) {
    return {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 500,
      distanceInterval: 2,
    };
  }
  return {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 800,
    distanceInterval: 4,
  };
};
