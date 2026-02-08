import { useEffect } from "react";

import { computeCameraPitchTargetDeg } from "@/utils/navigation/cameraPitch";
import { applyScalarEasing, PITCH_EASING_FACTOR } from "@/utils/navigation/cameraSmoothing";

type Params = {
  isNavigating: boolean;
  appState: string;
  userSpeedMps?: number;
  setCameraPitch: React.Dispatch<React.SetStateAction<number>>;
};

export function useDynamicCameraPitch({
  isNavigating,
  appState,
  userSpeedMps,
  setCameraPitch,
}: Params) {
  // STAGE 4.3: Dynamic camera pitch based on speed
  useEffect(() => {
    if (!isNavigating || appState !== "active") {
      // STAGE 9.1: Pause when backgrounded
      setCameraPitch(0); // Reset to 0 when not navigating or backgrounded
      return;
    }

    const targetPitch = computeCameraPitchTargetDeg(userSpeedMps || 0);

    // Smooth transition to target pitch
    const intervalId = setInterval(() => {
      setCameraPitch((prev) => {
        return applyScalarEasing(prev, targetPitch, PITCH_EASING_FACTOR);
      });
    }, 50); // 20 FPS

    return () => clearInterval(intervalId);
  }, [isNavigating, userSpeedMps, appState, setCameraPitch]);
}
