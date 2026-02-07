import { angleDeltaDegrees, lerp } from "@/utils/navigation/math";

type LatLng = { latitude: number; longitude: number };

export type NavCameraPosition = {
  center: LatLng;
  heading: number;
  pitch: number;
  zoom: number;
};

export function smoothNavCameraPosition(params: {
  current: NavCameraPosition | null;

  centerTarget: LatLng;
  headingTarget: number;
  pitchTarget: number;
  zoomTarget: number;

  dtS: number;
  tauCenterS: number;
  tauHeadingS: number;
  tauPitchS: number;
  tauZoomS: number;
}): NavCameraPosition {
  const {
    current,
    centerTarget,
    headingTarget,
    pitchTarget,
    zoomTarget,
    dtS,
    tauCenterS,
    tauHeadingS,
    tauPitchS,
    tauZoomS,
  } = params;

  const alphaCenter = 1 - Math.exp(-dtS / tauCenterS);
  const alphaHeading = 1 - Math.exp(-dtS / tauHeadingS);
  const alphaPitch = 1 - Math.exp(-dtS / tauPitchS);
  const alphaZoom = 1 - Math.exp(-dtS / tauZoomS);

  if (!current) {
    return {
      center: centerTarget,
      heading: headingTarget,
      pitch: pitchTarget,
      zoom: zoomTarget,
    };
  }

  const nextCenter = {
    latitude: lerp(current.center.latitude, centerTarget.latitude, alphaCenter),
    longitude: lerp(
      current.center.longitude,
      centerTarget.longitude,
      alphaCenter,
    ),
  };

  const headingDelta = angleDeltaDegrees(headingTarget, current.heading);
  const nextHeading =
    (((current.heading + headingDelta * alphaHeading) % 360) + 360) % 360;

  return {
    center: nextCenter,
    heading: nextHeading,
    pitch: lerp(current.pitch, pitchTarget, alphaPitch),
    zoom: lerp(current.zoom, zoomTarget, alphaZoom),
  };
}
