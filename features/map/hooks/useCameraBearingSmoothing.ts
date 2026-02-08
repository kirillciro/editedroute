import { useEffect } from "react";

import { computeNextCameraBearingDeg } from "@/utils/navigation/cameraBearing";
import { computeBearingEasingFactor } from "@/utils/navigation/cameraSmoothing";

type Params = {
  smoothedHeading: number;
  isNavigating: boolean;
  appState: string;
  userSpeedMps?: number;
  setCameraBearing: React.Dispatch<React.SetStateAction<number>>;
};

export function useCameraBearingSmoothing({
  smoothedHeading,
  isNavigating,
  appState,
  userSpeedMps,
  setCameraBearing,
}: Params) {
  // STAGE 4.2: Camera bearing smoothing with speed-based easing
  useEffect(() => {
    if (!isNavigating || appState !== "active") return; // STAGE 9.1: Pause when backgrounded

    const easingFactor = computeBearingEasingFactor(userSpeedMps || 0);

    const intervalId = setInterval(() => {
      setCameraBearing((prev) => {
        return computeNextCameraBearingDeg({
          currentDeg: prev,
          targetDeg: smoothedHeading,
          easingFactor,
        });
      });
    }, 50); // 20 FPS for camera (smoother, less battery intensive)

    return () => clearInterval(intervalId);
  }, [
    smoothedHeading,
    isNavigating,
    userSpeedMps,
    appState,
    setCameraBearing,
  ]);
}
