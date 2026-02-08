import { useEffect } from "react";

import { computeNextNavMarkerPosition } from "@/utils/navigation/navMarkerSmoothing";

type LatLng = { latitude: number; longitude: number };

type Ref<T> = { current: T };

type AnimatedRegionLike = {
  setValue: (value: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  }) => void;
};

type Params = {
  isNavigating: boolean;
  appState: string;
  smoothedHeading: number;

  navTargetRef: Ref<LatLng | null>;
  navCurrentRef: Ref<LatLng | null>;
  navSpeedRef: Ref<number>;

  navRafIdRef: Ref<number | null>;
  navLastFrameTimeRef: Ref<number>;
  navMarkerRegionRef: Ref<AnimatedRegionLike | null>;

  tauSeconds?: number;
};

export function useNavMarkerSmoothingLoop({
  isNavigating,
  appState,
  smoothedHeading,
  navTargetRef,
  navCurrentRef,
  navSpeedRef,
  navRafIdRef,
  navLastFrameTimeRef,
  navMarkerRegionRef,
  tauSeconds = 0.12,
}: Params) {
  // Google-style smoothing for the navigation marker:
  // GPS updates set a target, and a 60fps render loop smoothly moves the marker.
  useEffect(() => {
    const stop = () => {
      if (navRafIdRef.current != null) {
        cancelAnimationFrame(navRafIdRef.current);
        navRafIdRef.current = null;
      }
      navLastFrameTimeRef.current = 0;
    };

    const start = () => {
      if (navRafIdRef.current != null) return;

      const tick = (now: number) => {
        if (!isNavigating || appState !== "active") {
          stop();
          return;
        }

        const target = navTargetRef.current;
        const current = navCurrentRef.current;
        const region = navMarkerRegionRef.current;

        if (target && current && region) {
          const res = computeNextNavMarkerPosition({
            nowMs: now,
            lastFrameAtMs: navLastFrameTimeRef.current,
            tauSeconds,
            current,
            target,
            headingDeg: smoothedHeading,
            speedMps: navSpeedRef.current,
          });

          navLastFrameTimeRef.current = res.nextLastFrameAtMs;
          navCurrentRef.current = res.next;
          region.setValue({
            latitude: res.next.latitude,
            longitude: res.next.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          });
        } else {
          navLastFrameTimeRef.current = now;
        }

        navRafIdRef.current = requestAnimationFrame(tick);
      };

      navRafIdRef.current = requestAnimationFrame(tick);
    };

    if (isNavigating && appState === "active") {
      start();
      return;
    }

    stop();
  }, [
    isNavigating,
    appState,
    smoothedHeading,
    navTargetRef,
    navCurrentRef,
    navSpeedRef,
    navRafIdRef,
    navLastFrameTimeRef,
    navMarkerRegionRef,
    tauSeconds,
  ]);
}
