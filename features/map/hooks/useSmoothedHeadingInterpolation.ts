import { useEffect } from "react";

import { smoothHeadingValue } from "@/utils/navigation/math";

type Params = {
  rawHeading: number;
  isSensorsActive: boolean;
  appState: string;
  setSmoothedHeading: React.Dispatch<React.SetStateAction<number>>;
};

export function useSmoothedHeadingInterpolation({
  rawHeading,
  isSensorsActive,
  appState,
  setSmoothedHeading,
}: Params) {
  // STAGE 4.1: Smooth heading interpolation with frame-based updates
  useEffect(() => {
    if (!isSensorsActive || appState !== "active") return; // STAGE 9.1: Pause when backgrounded

    const intervalId = setInterval(() => {
      setSmoothedHeading((prev) => smoothHeadingValue(rawHeading, prev));
    }, 16); // 60 FPS

    return () => clearInterval(intervalId);
  }, [rawHeading, isSensorsActive, appState, setSmoothedHeading]);
}
