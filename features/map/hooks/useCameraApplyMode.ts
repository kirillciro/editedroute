import { useEffect, useRef, useState } from "react";

import type { CameraApplyMode } from "@/types/mapUi";

export function useCameraApplyMode(initial: CameraApplyMode = "animate160") {
  const [cameraApplyMode, setCameraApplyMode] =
    useState<CameraApplyMode>(initial);
  const cameraApplyModeRef = useRef<CameraApplyMode>(initial);

  useEffect(() => {
    cameraApplyModeRef.current = cameraApplyMode;
  }, [cameraApplyMode]);

  return { cameraApplyMode, setCameraApplyMode, cameraApplyModeRef };
}
