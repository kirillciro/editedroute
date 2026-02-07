import { useEffect } from "react";

import { applyScalarEasing, ZOOM_EASING_FACTOR } from "@/utils/navigation/cameraSmoothing";
import { computeNavZoomTarget } from "@/utils/navigation/zoom";

type Params = {
  isNavigating: boolean;
  appState: string;
  speedMps: number;
  distanceToNextTurnMeters: number;
  setCameraZoom: React.Dispatch<React.SetStateAction<number>>;
  resetZoom?: number;
};

export function useNavigationZoomSmoothing(params: Params) {
  const {
    isNavigating,
    appState,
    speedMps,
    distanceToNextTurnMeters,
    setCameraZoom,
    resetZoom = 16.8,
  } = params;

  // Dynamic camera zoom (Google Maps style): combine speed-based zoom-out and
  // distance-to-next-maneuver zoom-out, so long straight segments zoom out more.
  useEffect(() => {
    if (!isNavigating || appState !== "active") {
      setCameraZoom(resetZoom); // Reset when not navigating
      return;
    }

    const targetZoom = computeNavZoomTarget({
      speedMps,
      distanceToNextTurnMeters,
    });

    // Smooth transition to target zoom
    const intervalId = setInterval(() => {
      setCameraZoom((prev) => {
        return applyScalarEasing(prev, targetZoom, ZOOM_EASING_FACTOR);
      });
    }, 100); // 10 FPS for zoom (subtle changes)

    return () => clearInterval(intervalId);
  }, [
    isNavigating,
    appState,
    speedMps,
    distanceToNextTurnMeters,
    resetZoom,
    setCameraZoom,
  ]);
}
