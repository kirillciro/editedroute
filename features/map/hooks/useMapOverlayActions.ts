import { router } from "expo-router";
import { useCallback } from "react";

type Params = {
  cameraDebugUnlocked: boolean;
  unlockCameraDebug: () => void;
  setShowCameraDebug: React.Dispatch<React.SetStateAction<boolean>>;

  cameraApplyMode: "auto" | "setCamera" | "animate0" | "animate160";
  setCameraApplyMode: React.Dispatch<
    React.SetStateAction<"auto" | "setCamera" | "animate0" | "animate160">
  >;

  cameraTuningPreset: "balanced" | "smooth" | "snappy";
  setCameraTuningPreset: React.Dispatch<
    React.SetStateAction<"balanced" | "smooth" | "snappy">
  >;

  setShowsTraffic: React.Dispatch<React.SetStateAction<boolean>>;
  setShowsBuildings: React.Dispatch<React.SetStateAction<boolean>>;
  setShowsIndoors: React.Dispatch<React.SetStateAction<boolean>>;
  setShowsCompass: React.Dispatch<React.SetStateAction<boolean>>;

  setShowStopsPanel: React.Dispatch<React.SetStateAction<boolean>>;
};

export function useMapOverlayActions({
  cameraDebugUnlocked,
  unlockCameraDebug,
  setShowCameraDebug,
  cameraApplyMode,
  setCameraApplyMode,
  cameraTuningPreset,
  setCameraTuningPreset,
  setShowsTraffic,
  setShowsBuildings,
  setShowsIndoors,
  setShowsCompass,
  setShowStopsPanel,
}: Params) {
  const onPressDebug = useCallback(() => {
    if (!cameraDebugUnlocked) {
      unlockCameraDebug();
      return;
    }
    setShowCameraDebug((v) => !v);
  }, [cameraDebugUnlocked, setShowCameraDebug, unlockCameraDebug]);

  const onCloseCameraDebug = useCallback(() => {
    setShowCameraDebug(false);
  }, [setShowCameraDebug]);

  const onCycleApplyMode = useCallback(() => {
    const order: (typeof cameraApplyMode)[] = [
      "auto",
      "setCamera",
      "animate0",
      "animate160",
    ];
    const idx = Math.max(0, order.indexOf(cameraApplyMode));
    setCameraApplyMode(order[(idx + 1) % order.length]);
  }, [cameraApplyMode, setCameraApplyMode]);

  const onCycleTuningPreset = useCallback(() => {
    const order: (typeof cameraTuningPreset)[] = [
      "balanced",
      "smooth",
      "snappy",
    ];
    const idx = Math.max(0, order.indexOf(cameraTuningPreset));
    setCameraTuningPreset(order[(idx + 1) % order.length]);
  }, [cameraTuningPreset, setCameraTuningPreset]);

  const onToggleTraffic = useCallback(() => {
    setShowsTraffic((v) => !v);
  }, [setShowsTraffic]);

  const onToggleBuildings = useCallback(() => {
    setShowsBuildings((v) => !v);
  }, [setShowsBuildings]);

  const onToggleIndoors = useCallback(() => {
    setShowsIndoors((v) => !v);
  }, [setShowsIndoors]);

  const onToggleCompass = useCallback(() => {
    setShowsCompass((v) => !v);
  }, [setShowsCompass]);

  const onToggleStopsPanel = useCallback(() => {
    setShowStopsPanel((v) => !v);
  }, [setShowStopsPanel]);

  const onCloseStopsPanel = useCallback(() => {
    setShowStopsPanel(false);
  }, [setShowStopsPanel]);

  const onOpenStats = useCallback(() => {
    router.push("/(main)/stats");
  }, []);

  return {
    onPressDebug,
    onCloseCameraDebug,
    onCycleApplyMode,
    onCycleTuningPreset,
    onToggleTraffic,
    onToggleBuildings,
    onToggleIndoors,
    onToggleCompass,
    onToggleStopsPanel,
    onCloseStopsPanel,
    onOpenStats,
  };
}
