import { useEffect } from "react";

import { pickNavBaseCoordinate } from "@/utils/navigation/navCoordinate";
import { applyMapCamera } from "@/utils/navigation/mapCameraApply";
import {
  computeNavCameraApplyDecision,
  computeNavCameraDtSeconds,
} from "@/utils/navigation/navCameraLoop";
import { smoothNavCameraPosition } from "@/utils/navigation/navCameraSmoothing";
import { computeNavCameraTargets } from "@/utils/navigation/navCameraTargets";
import type { CameraApplyMode } from "@/types/mapUi";

type LatLng = { latitude: number; longitude: number };

type CameraPosition = {
  center: LatLng;
  heading: number;
  pitch: number;
  zoom: number;
};

type Ref<T> = { current: T };

type NavCameraTuning = {
  applyMinIntervalMs: number;
  tauCenterS: number;
  tauHeadingS: number;
  tauPitchS: number;
  tauZoomS: number;
  centerDeadbandM: number;
  bearingDeadbandDeg: number;
  pitchDeadbandDeg: number;
  zoomDeadband: number;
};

type Params = {
  isNavigating: boolean;
  appState: string;
  mapReady: boolean;

  mapRef: Ref<any>;

  navViewModeRef: Ref<"follow" | "free" | "overview">;

  navCameraRafIdRef: Ref<number | null>;
  navCameraHoldUntilRef: Ref<number>;
  navCameraLastFrameAtRef: Ref<number>;
  navCameraLastApplyAtRef: Ref<number>;

  navCameraCurrentRef: Ref<CameraPosition | null>;

  navLastCameraCenterRef: Ref<LatLng | null>;
  navLastCameraBearingAppliedRef: Ref<number>;
  navLastCameraPitchAppliedRef: Ref<number>;
  navLastCameraZoomAppliedRef: Ref<number>;

  navCameraTuningRef: Ref<NavCameraTuning>;

  destinationRef: Ref<LatLng | null>;
  isInArrivalZoneRef: Ref<boolean>;

  navCurrentRef: Ref<LatLng | null>;
  navTargetRef: Ref<LatLng | null>;
  userLocationRef: Ref<(LatLng & { speed?: number }) | null>;
  navSpeedRef: Ref<number>;
  distanceToNextTurnRef: Ref<number>;

  cameraBearingRef: Ref<number>;
  cameraPitchRef: Ref<number>;
  cameraZoomRef: Ref<number>;

  cameraApplyModeRef: Ref<CameraApplyMode>;
};

export function useNavCameraFollowLoop({
  isNavigating,
  appState,
  mapReady,
  mapRef,
  navViewModeRef,
  navCameraRafIdRef,
  navCameraHoldUntilRef,
  navCameraLastFrameAtRef,
  navCameraLastApplyAtRef,
  navCameraCurrentRef,
  navLastCameraCenterRef,
  navLastCameraBearingAppliedRef,
  navLastCameraPitchAppliedRef,
  navLastCameraZoomAppliedRef,
  navCameraTuningRef,
  destinationRef,
  isInArrivalZoneRef,
  navCurrentRef,
  navTargetRef,
  userLocationRef,
  navSpeedRef,
  distanceToNextTurnRef,
  cameraBearingRef,
  cameraPitchRef,
  cameraZoomRef,
  cameraApplyModeRef,
}: Params) {
  useEffect(() => {
    if (!isNavigating || appState !== "active") return;
    if (!mapReady || !mapRef.current) return;

    // Google Maps-style camera controller:
    // - compute a target CameraPosition
    // - smooth it every frame
    // - apply via setCamera (no overlapping animations)
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;

      // If the user is exploring the map (free/overview), pause camera follow.
      if (navViewModeRef.current !== "follow") {
        navCameraRafIdRef.current = requestAnimationFrame(tick);
        return;
      }

      // During explicit snaps/recenters, avoid fighting the ongoing animation.
      if (Date.now() < navCameraHoldUntilRef.current) {
        // Reset frame timing so we don't get a big dt spike after a hold.
        navCameraLastFrameAtRef.current = 0;
        navCameraRafIdRef.current = requestAnimationFrame(tick);
        return;
      }

      const now = Date.now();
      const tuning = navCameraTuningRef.current;
      const APPLY_MIN_INTERVAL_MS = tuning.applyMinIntervalMs;
      const TAU_CENTER_S = tuning.tauCenterS;
      const TAU_HEADING_S = tuning.tauHeadingS;
      const TAU_PITCH_S = tuning.tauPitchS;
      const TAU_ZOOM_S = tuning.tauZoomS;
      const CENTER_DEADBAND_M = tuning.centerDeadbandM;
      const BEARING_DEADBAND_DEG = tuning.bearingDeadbandDeg;
      const PITCH_DEADBAND_DEG = tuning.pitchDeadbandDeg;
      const ZOOM_DEADBAND = tuning.zoomDeadband;
      const destNow = destinationRef.current;
      const inArrival = isInArrivalZoneRef.current && destNow;

      const base = inArrival
        ? { latitude: destNow!.latitude, longitude: destNow!.longitude }
        : pickNavBaseCoordinate({
            navCurrent: navCurrentRef.current,
            navTarget: navTargetRef.current,
            userLocation: userLocationRef.current,
          });

      if (base) {
        const bearingTarget = cameraBearingRef.current;
        const speedMps = inArrival
          ? 0
          : navSpeedRef.current || userLocationRef.current?.speed || 0;

        const { centerTarget, pitchTarget, zoomTarget } = computeNavCameraTargets(
          {
            base,
            bearingDeg: bearingTarget,
            speedMps,
            distanceToNextTurnMeters: distanceToNextTurnRef.current,
            inArrival: !!inArrival,
            cameraPitchDeg: cameraPitchRef.current,
            cameraZoom: cameraZoomRef.current || 17.2,
          },
        );

        const frame = computeNavCameraDtSeconds({
          nowMs: now,
          lastFrameAtMs: navCameraLastFrameAtRef.current,
        });
        navCameraLastFrameAtRef.current = frame.nextLastFrameAtMs;

        navCameraCurrentRef.current = smoothNavCameraPosition({
          current: navCameraCurrentRef.current,
          centerTarget,
          headingTarget: bearingTarget,
          pitchTarget,
          zoomTarget,
          dtS: frame.dtS,
          tauCenterS: TAU_CENTER_S,
          tauHeadingS: TAU_HEADING_S,
          tauPitchS: TAU_PITCH_S,
          tauZoomS: TAU_ZOOM_S,
        });

        const curNow = navCameraCurrentRef.current;
        if (curNow) {
          const decision = computeNavCameraApplyDecision({
            nowMs: now,
            lastApplyAtMs: navCameraLastApplyAtRef.current,
            applyMinIntervalMs: APPLY_MIN_INTERVAL_MS,
            nextCamera: curNow,
            lastAppliedCenter: navLastCameraCenterRef.current,
            lastAppliedHeadingDeg: navLastCameraBearingAppliedRef.current,
            lastAppliedPitchDeg: navLastCameraPitchAppliedRef.current,
            lastAppliedZoom: navLastCameraZoomAppliedRef.current,
            centerDeadbandM: CENTER_DEADBAND_M,
            bearingDeadbandDeg: BEARING_DEADBAND_DEG,
            pitchDeadbandDeg: PITCH_DEADBAND_DEG,
            zoomDeadband: ZOOM_DEADBAND,
          });

          if (decision.shouldApply) {
            navCameraLastApplyAtRef.current = now;
            const mapAny = mapRef.current as any;

            applyMapCamera({
              mapAny,
              mode: cameraApplyModeRef.current,
              camera: {
                center: curNow.center,
                heading: curNow.heading,
                pitch: curNow.pitch,
                zoom: curNow.zoom,
              },
              durationMs: 0,
              nowMs: now,
              onHoldUntilMs: (holdUntil) => {
                navCameraHoldUntilRef.current = holdUntil;
              },
            });

            navLastCameraCenterRef.current = curNow.center;
            navLastCameraBearingAppliedRef.current = curNow.heading;
            navLastCameraPitchAppliedRef.current = curNow.pitch;
            navLastCameraZoomAppliedRef.current = curNow.zoom;
          }
        }
      }

      navCameraRafIdRef.current = requestAnimationFrame(tick);
    };

    navCameraRafIdRef.current = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      if (navCameraRafIdRef.current != null) {
        cancelAnimationFrame(navCameraRafIdRef.current);
        navCameraRafIdRef.current = null;
      }
    };
  }, [
    isNavigating,
    appState,
    mapReady,
    mapRef,
    navViewModeRef,
    navCameraRafIdRef,
    navCameraHoldUntilRef,
    navCameraLastFrameAtRef,
    navCameraLastApplyAtRef,
    navCameraCurrentRef,
    navLastCameraCenterRef,
    navLastCameraBearingAppliedRef,
    navLastCameraPitchAppliedRef,
    navLastCameraZoomAppliedRef,
    navCameraTuningRef,
    destinationRef,
    isInArrivalZoneRef,
    navCurrentRef,
    navTargetRef,
    userLocationRef,
    navSpeedRef,
    distanceToNextTurnRef,
    cameraBearingRef,
    cameraPitchRef,
    cameraZoomRef,
    cameraApplyModeRef,
  ]);
}
