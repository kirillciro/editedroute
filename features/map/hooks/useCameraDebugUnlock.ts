import { useCallback } from "react";

type Params = {
  setCameraDebugUnlocked: React.Dispatch<React.SetStateAction<boolean>>;
  setShowCameraDebug: React.Dispatch<React.SetStateAction<boolean>>;
};

export function useCameraDebugUnlock(params: Params) {
  const { setCameraDebugUnlocked, setShowCameraDebug } = params;

  return useCallback(() => {
    setCameraDebugUnlocked(true);
    setShowCameraDebug(true);
  }, [setCameraDebugUnlocked, setShowCameraDebug]);
}
