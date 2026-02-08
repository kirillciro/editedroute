import { useEffect } from "react";
import type React from "react";
import type MapView from "react-native-maps";

import type { CameraApplyMode } from "@/types/mapUi";
import {
  computeNavLookAheadMeters,
  offsetCoordinate,
} from "@/utils/navigation/camera";
import { applyMapCamera } from "@/utils/navigation/mapCameraApply";

type PendingNavCameraFix = {
  latitude: number;
  longitude: number;
  speedMps: number;
};

type NavCameraState = {
  center: { latitude: number; longitude: number };
  heading: number;
  pitch: number;
  zoom: number;
};

type Params = {
  isNavigating: boolean;
  mapReady: boolean;
  mapRef: React.RefObject<MapView | null>;

  didApplyNavCameraFixRef: React.MutableRefObject<boolean>;
  pendingNavCameraFixRef: React.MutableRefObject<PendingNavCameraFix | null>;

  navCameraHoldUntilRef: React.MutableRefObject<number>;
  navCameraCurrentRef: React.MutableRefObject<NavCameraState | null>;
  navCameraLastFrameAtRef: React.MutableRefObject<number>;
  navLastCameraCenterRef: React.MutableRefObject<
    { latitude: number; longitude: number } | null
  >;
  navLastCameraBearingAppliedRef: React.MutableRefObject<number>;
  navLastCameraPitchAppliedRef: React.MutableRefObject<number>;
  navLastCameraZoomAppliedRef: React.MutableRefObject<number>;

  cameraBearing: number;
  smoothedHeading: number;
  cameraZoomRef: React.MutableRefObject<number>;
  distanceToNextTurnRef: React.MutableRefObject<number>;
  cameraApplyModeRef: React.MutableRefObject<CameraApplyMode>;
};

export function useEnterNavigationCameraFix({
  isNavigating,
  mapReady,
  mapRef,
  didApplyNavCameraFixRef,
  pendingNavCameraFixRef,
  navCameraHoldUntilRef,
  navCameraCurrentRef,
  navCameraLastFrameAtRef,
  navLastCameraCenterRef,
  navLastCameraBearingAppliedRef,
  navLastCameraPitchAppliedRef,
  navLastCameraZoomAppliedRef,
  cameraBearing,
  smoothedHeading,
  cameraZoomRef,
  distanceToNextTurnRef,
  cameraApplyModeRef,
}: Params) {
  useEffect(() => {
    if (!isNavigating || !mapReady || !mapRef.current) return;
    if (didApplyNavCameraFixRef.current) return;
    const pending = pendingNavCameraFixRef.current;
    if (!pending) return;

    const bearing = cameraBearing || smoothedHeading;

    const lookAheadCenter = offsetCoordinate(
      { latitude: pending.latitude, longitude: pending.longitude },
      bearing,
      computeNavLookAheadMeters(pending.speedMps, distanceToNextTurnRef.current),
    );

    const durationMs = 650;

    // Hold the follow loop while this animation plays to prevent camera fights.
    navCameraHoldUntilRef.current = Date.now() + durationMs + 150;

    const zoom = cameraZoomRef.current || 17.2;

    // Google Maps-style: animate a single CameraPosition (center + bearing + tilt + zoom).
    applyMapCamera({
      mapAny: mapRef.current as any,
      mode: cameraApplyModeRef.current,
      camera: {
        center: lookAheadCenter,
        heading: bearing,
        pitch: 45,
        zoom,
      },
      durationMs,
      nowMs: Date.now(),
    });

    // Seed last-known applied state so the follow loop doesn't immediately "snap back".
    navLastCameraCenterRef.current = lookAheadCenter;
    navLastCameraBearingAppliedRef.current = bearing;
    navLastCameraPitchAppliedRef.current = 45;
    navLastCameraZoomAppliedRef.current = zoom;
    navCameraCurrentRef.current = {
      center: lookAheadCenter,
      heading: bearing,
      pitch: 45,
      zoom,
    };
    navCameraLastFrameAtRef.current = 0;

    didApplyNavCameraFixRef.current = true;
    pendingNavCameraFixRef.current = null;
  }, [
    isNavigating,
    mapReady,
    mapRef,
    didApplyNavCameraFixRef,
    pendingNavCameraFixRef,
    cameraBearing,
    smoothedHeading,
    cameraZoomRef,
    distanceToNextTurnRef,
    cameraApplyModeRef,
    navCameraHoldUntilRef,
    navLastCameraCenterRef,
    navLastCameraBearingAppliedRef,
    navLastCameraPitchAppliedRef,
    navLastCameraZoomAppliedRef,
    navCameraCurrentRef,
    navCameraLastFrameAtRef,
  ]);
}
