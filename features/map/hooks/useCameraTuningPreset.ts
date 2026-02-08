import { useEffect, useRef, useState } from "react";

import type { CameraTuningPreset } from "@/types/mapUi";
import {
  navCameraTuningForPreset,
  type NavCameraTuning,
} from "@/utils/navigation/cameraTuning";

export function useCameraTuningPreset(initialPreset: CameraTuningPreset) {
  const [cameraTuningPreset, setCameraTuningPreset] =
    useState<CameraTuningPreset>(initialPreset);

  const navCameraTuningRef = useRef<NavCameraTuning>(
    navCameraTuningForPreset(initialPreset),
  );

  useEffect(() => {
    navCameraTuningRef.current = navCameraTuningForPreset(cameraTuningPreset);
  }, [cameraTuningPreset]);

  return {
    cameraTuningPreset,
    setCameraTuningPreset,
    navCameraTuningRef,
  };
}
