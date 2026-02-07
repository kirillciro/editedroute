import { AnimatedRegion } from "react-native-maps";

import type { CameraApplyMode } from "@/types/mapUi";
import {
  computeNavLookAheadMeters,
  offsetCoordinate,
} from "@/utils/navigation/camera";
import { applyMapCamera } from "@/utils/navigation/mapCameraApply";

type LatLng = { latitude: number; longitude: number };

type Ref<T> = { current: T };

type PendingNavCameraFix = {
  latitude: number;
  longitude: number;
  speedMps: number;
};

type NavCameraPosition = {
  center: LatLng;
  heading: number;
  pitch: number;
  zoom: number;
};

export function seedNavAndCamera(params: {
  coords: LatLng;
  speedMps: number;
  durationMs: number;

  setUserLocation: (loc: { latitude: number; longitude: number; speed: number }) => void;

  navSpeedRef: Ref<number>;
  navLatestSpeedMpsRef: Ref<number>;
  navTargetRef: Ref<LatLng | null>;
  navCurrentRef: Ref<LatLng | null>;
  navMarkerRegionRef: Ref<AnimatedRegion | null>;

  cameraBearing: number;
  smoothedHeading: number;
  distanceToNextTurnMeters: number;

  mapReady: boolean;
  mapRefCurrent: unknown | null;
  cameraZoom: number;
  cameraApplyMode: CameraApplyMode;

  navCameraHoldUntilRef: Ref<number>;

  navLastCameraCenterRef: Ref<LatLng | null>;
  navLastCameraBearingAppliedRef: Ref<number>;
  navLastCameraPitchAppliedRef: Ref<number>;
  navLastCameraZoomAppliedRef: Ref<number>;
  navCameraCurrentRef: Ref<NavCameraPosition | null>;
  navCameraLastFrameAtRef: Ref<number>;

  didApplyNavCameraFixRef: Ref<boolean>;
  pendingNavCameraFixRef: Ref<PendingNavCameraFix | null>;
}) {
  const {
    coords,
    speedMps,
    durationMs,
    setUserLocation,
    navSpeedRef,
    navLatestSpeedMpsRef,
    navTargetRef,
    navCurrentRef,
    navMarkerRegionRef,
    cameraBearing,
    smoothedHeading,
    distanceToNextTurnMeters,
    mapReady,
    mapRefCurrent,
    cameraZoom,
    cameraApplyMode,
    navCameraHoldUntilRef,
    navLastCameraCenterRef,
    navLastCameraBearingAppliedRef,
    navLastCameraPitchAppliedRef,
    navLastCameraZoomAppliedRef,
    navCameraCurrentRef,
    navCameraLastFrameAtRef,
    didApplyNavCameraFixRef,
    pendingNavCameraFixRef,
  } = params;

  const { latitude, longitude } = coords;

  setUserLocation({ latitude, longitude, speed: speedMps });

  // Seed smooth marker system right away
  navSpeedRef.current = speedMps;
  navLatestSpeedMpsRef.current = speedMps;
  navTargetRef.current = { latitude, longitude };
  if (!navCurrentRef.current) {
    navCurrentRef.current = { latitude, longitude };
  }
  if (!navMarkerRegionRef.current) {
    navMarkerRegionRef.current = new AnimatedRegion({
      latitude,
      longitude,
      latitudeDelta: 0.0038,
      longitudeDelta: 0.0038,
    });
  }

  // Immediate camera move (or queue it until map is ready)
  const base = { latitude, longitude };
  const bearing = cameraBearing || smoothedHeading;
  const lookAheadCenter = offsetCoordinate(
    base,
    bearing,
    computeNavLookAheadMeters(speedMps, distanceToNextTurnMeters),
  );

  if (mapReady && mapRefCurrent) {
    // Prevent the follow loop from fighting this explicit snap.
    navCameraHoldUntilRef.current = Date.now() + durationMs + 150;

    const zoom = cameraZoom || 17.2;
    const pitch = 45;

    applyMapCamera({
      mapAny: mapRefCurrent as any,
      mode: cameraApplyMode,
      camera: {
        center: lookAheadCenter,
        heading: bearing,
        pitch,
        zoom,
      },
      durationMs,
    });

    // Seed camera state so the follow loop continues smoothly.
    navLastCameraCenterRef.current = lookAheadCenter;
    navLastCameraBearingAppliedRef.current = bearing;
    navLastCameraPitchAppliedRef.current = pitch;
    navLastCameraZoomAppliedRef.current = zoom;
    navCameraCurrentRef.current = {
      center: lookAheadCenter,
      heading: bearing,
      pitch,
      zoom,
    };
    navCameraLastFrameAtRef.current = 0;
    didApplyNavCameraFixRef.current = true;
    pendingNavCameraFixRef.current = null;
  } else {
    pendingNavCameraFixRef.current = { latitude, longitude, speedMps };
    didApplyNavCameraFixRef.current = false;
  }
}
