import { useState } from "react";

import { useCameraDebugUnlock } from "@/features/map/hooks/useCameraDebugUnlock";

export function useCameraDebugUi(initialUnlocked: boolean) {
  const [showCameraDebug, setShowCameraDebug] = useState(false);
  const [cameraDebugUnlocked, setCameraDebugUnlocked] =
    useState(initialUnlocked);

  const unlockCameraDebug = useCameraDebugUnlock({
    setCameraDebugUnlocked,
    setShowCameraDebug,
  });

  return {
    showCameraDebug,
    setShowCameraDebug,
    cameraDebugUnlocked,
    unlockCameraDebug,
  };
}
