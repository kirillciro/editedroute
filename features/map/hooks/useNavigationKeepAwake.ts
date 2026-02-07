import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useEffect, useRef } from "react";

export function useNavigationKeepAwake(params: {
  isNavigating: boolean;
  appState: string;
  tag?: string;
}) {
  const { isNavigating, appState, tag = "EditedRouteNavigation" } = params;
  const keepAwakeActiveRef = useRef(false);

  useEffect(() => {
    const shouldKeepAwake = isNavigating && appState === "active";
    if (shouldKeepAwake === keepAwakeActiveRef.current) return;
    keepAwakeActiveRef.current = shouldKeepAwake;

    if (shouldKeepAwake) {
      activateKeepAwakeAsync(tag).catch(() => undefined);
    } else {
      deactivateKeepAwake(tag).catch(() => undefined);
    }
  }, [isNavigating, appState, tag]);

  useEffect(() => {
    return () => {
      deactivateKeepAwake(tag).catch(() => undefined);
    };
  }, [tag]);
}
