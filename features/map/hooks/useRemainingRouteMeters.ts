import { useCallback } from "react";

import { computeRemainingRouteMetersOnPolyline } from "@/utils/navigation/remainingRoute";

type LatLng = { latitude: number; longitude: number };

type Ref<T> = { current: T };

type Params = {
  routeCoordinatesRef: Ref<LatLng[]>;
  routePolylineCumulativeMetersRef: Ref<number[]>;
  routePolylineTotalMetersRef: Ref<number>;
  lastClosestRouteIndexRef: Ref<number>;
  closestPointOnPolylineMeters: (
    p: LatLng,
    poly: LatLng[],
    indexHint: number,
  ) => { point: LatLng; distanceM: number; index: number };
};

export function useRemainingRouteMeters({
  routeCoordinatesRef,
  routePolylineCumulativeMetersRef,
  routePolylineTotalMetersRef,
  lastClosestRouteIndexRef,
  closestPointOnPolylineMeters,
}: Params) {
  const computeRemainingRouteMeters = useCallback(
    (p: LatLng): number | null => {
      const polyline = routeCoordinatesRef.current;
      const cumulativeMeters = routePolylineCumulativeMetersRef.current;
      const totalMeters = routePolylineTotalMetersRef.current;

      const res = computeRemainingRouteMetersOnPolyline({
        position: p,
        polyline,
        cumulativeMeters,
        totalMeters,
        lastClosestIndex: lastClosestRouteIndexRef.current,
        closestPointOnPolylineMeters,
      });
      lastClosestRouteIndexRef.current = res.nextClosestIndex;
      return res.remainingMeters;
    },
    [
      routeCoordinatesRef,
      routePolylineCumulativeMetersRef,
      routePolylineTotalMetersRef,
      lastClosestRouteIndexRef,
      closestPointOnPolylineMeters,
    ],
  );

  return { computeRemainingRouteMeters };
}
