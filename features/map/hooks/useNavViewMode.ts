import { useCallback, useEffect, useRef, useState } from "react";

import type { NavViewMode } from "@/types/mapUi";

export function useNavViewMode(initial: NavViewMode = "follow") {
  const [navViewMode, setNavViewMode] = useState<NavViewMode>(initial);
  const navViewModeRef = useRef<NavViewMode>(initial);

  useEffect(() => {
    navViewModeRef.current = navViewMode;
  }, [navViewMode]);

  const setNavViewModeImmediate = useCallback((mode: NavViewMode) => {
    navViewModeRef.current = mode;
    setNavViewMode(mode);
  }, []);

  return {
    navViewMode,
    setNavViewMode,
    navViewModeRef,
    setNavViewModeImmediate,
  };
}
