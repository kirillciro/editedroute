import type * as ExpoLocation from "expo-location";

import type { LatLng } from "@/types/navigation";

type LocationModule = typeof import("expo-location");

type LogFn = (message: string, error?: unknown) => void;

type SeedFn = (coords: LatLng, speedMps: number, durationMs: number) => void;

export async function runInitialNavCameraFixes(params: {
  Location: LocationModule;

  seed: SeedFn;
  didApplyNavCameraFix: () => boolean;

  getExistingBase: () => LatLng | null;
  getExistingSpeedMps: () => number;

  getCurrentUserLocation: () => LatLng | null;
  distanceMetersBetween: (a: LatLng, b: LatLng) => number;

  onSeedWithoutResnap: (coords: LatLng, speedMps: number) => void;

  logDev?: LogFn;
}): Promise<void> {
  const {
    Location,
    seed,
    didApplyNavCameraFix,
    getExistingBase,
    getExistingSpeedMps,
    getCurrentUserLocation,
    distanceMetersBetween,
    onSeedWithoutResnap,
    logDev,
  } = params;

  // 1) Snap immediately from whatever we already know (prevents “press location first”).
  try {
    const base = getExistingBase();
    if (base) {
      seed(base, getExistingSpeedMps(), 550);
    }
  } catch (e) {
    logDev?.("Immediate nav camera snap (existing) failed", e);
  }

  // 2) Try last-known position (fast, cached)
  try {
    const last = await (Location as typeof ExpoLocation).getLastKnownPositionAsync({
      maxAge: 20000,
      requiredAccuracy: 80,
    });

    if (last?.coords) {
      const curLoc = getCurrentUserLocation();
      const distM = curLoc
        ? distanceMetersBetween(curLoc, {
            latitude: last.coords.latitude,
            longitude: last.coords.longitude,
          })
        : Infinity;

      // Only resnap if we haven't snapped yet, or if cached is meaningfully different.
      if (!didApplyNavCameraFix() || distM > 12) {
        seed(
          {
            latitude: last.coords.latitude,
            longitude: last.coords.longitude,
          },
          last.coords.speed || 0,
          450,
        );
      }
    }
  } catch (e) {
    logDev?.("Last-known nav camera snap failed", e);
  }

  // 3) Finally, get a fresh GPS fix (slower but most accurate)
  try {
    const initial = await (Location as typeof ExpoLocation).getCurrentPositionAsync({
      accuracy: (Location as typeof ExpoLocation).Accuracy.BestForNavigation,
    });

    const { latitude, longitude, speed } = initial.coords;
    const curLoc = getCurrentUserLocation();

    const distM = curLoc ? distanceMetersBetween(curLoc, { latitude, longitude }) : Infinity;

    const didApply = didApplyNavCameraFix();
    if (!didApply || distM > 12) {
      seed(
        { latitude, longitude },
        speed || 0,
        didApply ? 350 : 700,
      );
      return;
    }

    // Still seed marker/speed so smoothing starts correctly.
    onSeedWithoutResnap({ latitude, longitude }, speed || 0);
  } catch (e) {
    // If the one-shot fix fails, navigation will still start and camera will follow on watchPosition.
    logDev?.("Initial navigation camera fix failed", e);
  }
}
