import { useEffect } from "react";
import type MapView from "react-native-maps";

import type {
  CameraApplyMode,
  CameraTuningPreset,
  MapLayerType,
  NavViewMode,
} from "@/types/mapUi";

export type CameraDebugSnapshot = {
  now: number;
  mode: CameraApplyMode;
  preset: CameraTuningPreset;
  hasSetCamera: boolean;
  hasAnimateCamera: boolean;
  navViewMode: NavViewMode;
  holdMs: number;
  speedMps: number;
  distToTurnM: number;
  remainingRouteM: number | null;
  etaSeconds: number | null;
  etaSource: string;
  zoomTarget: number;
  bearingTarget: number;
  pitchTarget: number;
  centerTarget?: { latitude: number; longitude: number };
  centerApplied?: { latitude: number; longitude: number };
  zoomApplied?: number;
  headingApplied?: number;
  pitchApplied?: number;
  mapType?: MapLayerType;
  showsTraffic?: boolean;
  showsBuildings?: boolean;
  showsIndoors?: boolean;
  showsCompass?: boolean;
};

type Coord = { latitude: number; longitude: number };

type NavCameraState = {
  center: Coord;
  heading: number;
  pitch: number;
  zoom: number;
};

type Params = {
  enabled: boolean;

  mapRef: React.RefObject<MapView | null>;
  navCameraCurrentRef: React.MutableRefObject<NavCameraState | null>;
  cameraApplyModeRef: React.MutableRefObject<CameraApplyMode>;

  cameraTuningPreset: CameraTuningPreset;
  navViewMode: NavViewMode;

  navCameraHoldUntilRef: React.MutableRefObject<number>;
  navSpeedRef: React.MutableRefObject<number>;
  userLocationRef: React.MutableRefObject<(Coord & { speed?: number }) | null>;
  distanceToNextTurnRef: React.MutableRefObject<number>;

  dynamicRemainingRouteMetersRef: React.MutableRefObject<number | null>;
  dynamicEtaSecondsRef: React.MutableRefObject<number | null>;
  dynamicEtaSourceRef: React.MutableRefObject<string>;

  cameraZoomRef: React.MutableRefObject<number>;
  cameraBearingRef: React.MutableRefObject<number>;
  cameraPitchRef: React.MutableRefObject<number>;
  navTargetRef: React.MutableRefObject<Coord | null>;

  mapType: MapLayerType;
  showsTraffic: boolean;
  showsBuildings: boolean;
  showsIndoors: boolean;
  showsCompass: boolean;

  setCameraDebugSnapshot: React.Dispatch<
    React.SetStateAction<CameraDebugSnapshot | null>
  >;
};

export function useCameraDebugSnapshot(params: Params) {
  const {
    enabled,
    mapRef,
    navCameraCurrentRef,
    cameraApplyModeRef,
    cameraTuningPreset,
    navViewMode,
    navCameraHoldUntilRef,
    navSpeedRef,
    userLocationRef,
    distanceToNextTurnRef,
    dynamicRemainingRouteMetersRef,
    dynamicEtaSecondsRef,
    dynamicEtaSourceRef,
    cameraZoomRef,
    cameraBearingRef,
    cameraPitchRef,
    navTargetRef,
    mapType,
    showsTraffic,
    showsBuildings,
    showsIndoors,
    showsCompass,
    setCameraDebugSnapshot,
  } = params;

  useEffect(() => {
    if (!enabled) return;

    const id = setInterval(() => {
      const now = Date.now();
      const mapAny = mapRef.current as any;
      const cur = navCameraCurrentRef.current;

      setCameraDebugSnapshot({
        now,
        mode: cameraApplyModeRef.current,
        preset: cameraTuningPreset,
        hasSetCamera: !!mapAny?.setCamera,
        hasAnimateCamera: !!mapAny?.animateCamera,
        navViewMode,
        holdMs: Math.max(0, navCameraHoldUntilRef.current - now),
        speedMps: navSpeedRef.current || userLocationRef.current?.speed || 0,
        distToTurnM: distanceToNextTurnRef.current || 0,
        remainingRouteM: dynamicRemainingRouteMetersRef.current,
        etaSeconds: dynamicEtaSecondsRef.current,
        etaSource: dynamicEtaSourceRef.current,
        zoomTarget: cameraZoomRef.current || 0,
        bearingTarget: cameraBearingRef.current || 0,
        pitchTarget: cameraPitchRef.current || 0,
        centerTarget: navTargetRef.current || undefined,
        centerApplied: cur?.center,
        zoomApplied: cur?.zoom,
        headingApplied: cur?.heading,
        pitchApplied: cur?.pitch,
        mapType,
        showsTraffic,
        showsBuildings,
        showsIndoors,
        showsCompass,
      });
    }, 250);

    return () => clearInterval(id);
  }, [
    enabled,
    mapRef,
    navCameraCurrentRef,
    cameraApplyModeRef,
    cameraTuningPreset,
    navViewMode,
    navCameraHoldUntilRef,
    navSpeedRef,
    userLocationRef,
    distanceToNextTurnRef,
    dynamicRemainingRouteMetersRef,
    dynamicEtaSecondsRef,
    dynamicEtaSourceRef,
    cameraZoomRef,
    cameraBearingRef,
    cameraPitchRef,
    navTargetRef,
    mapType,
    showsTraffic,
    showsBuildings,
    showsIndoors,
    showsCompass,
    setCameraDebugSnapshot,
  ]);
}
