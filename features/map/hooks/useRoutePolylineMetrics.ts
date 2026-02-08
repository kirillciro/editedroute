import { useEffect } from "react";

import { computePolylineCumulativeMeters } from "@/utils/geo/polylineCumulative";

type LatLng = { latitude: number; longitude: number };

type Ref<T> = { current: T };

type Params = {
  routeCoordinates: LatLng[];
  routeCoordinatesRef: Ref<LatLng[]>;

  routePolylineCumulativeMetersRef: Ref<number[]>;
  routePolylineTotalMetersRef: Ref<number>;

  lastClosestRouteIndexRef: Ref<number>;
};

export function useRoutePolylineMetrics({
  routeCoordinates,
  routeCoordinatesRef,
  routePolylineCumulativeMetersRef,
  routePolylineTotalMetersRef,
  lastClosestRouteIndexRef,
}: Params) {
  useEffect(() => {
    routeCoordinatesRef.current = routeCoordinates;

    // Reset hint when route changes significantly
    lastClosestRouteIndexRef.current = 0;

    // Precompute cumulative distance along the polyline for fast remaining-distance queries.
    const cumulative = computePolylineCumulativeMeters(routeCoordinates);
    routePolylineCumulativeMetersRef.current = cumulative.cumulativeMeters;
    routePolylineTotalMetersRef.current = cumulative.totalMeters;
  }, [
    routeCoordinates,
    routeCoordinatesRef,
    routePolylineCumulativeMetersRef,
    routePolylineTotalMetersRef,
    lastClosestRouteIndexRef,
  ]);
}
