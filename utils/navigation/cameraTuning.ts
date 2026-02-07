import type { CameraTuningPreset } from "@/types/mapUi";

export type NavCameraTuning = {
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

export function navCameraTuningForPreset(
  preset: CameraTuningPreset,
): NavCameraTuning {
  if (preset === "smooth") {
    return {
      applyMinIntervalMs: 1000 / 24,
      tauCenterS: 0.55,
      tauHeadingS: 0.35,
      tauPitchS: 0.55,
      tauZoomS: 0.7,
      centerDeadbandM: 0.35,
      bearingDeadbandDeg: 0.6,
      pitchDeadbandDeg: 0.45,
      zoomDeadband: 0.03,
    };
  }

  if (preset === "snappy") {
    return {
      applyMinIntervalMs: 1000 / 40,
      tauCenterS: 0.22,
      tauHeadingS: 0.18,
      tauPitchS: 0.24,
      tauZoomS: 0.3,
      centerDeadbandM: 0.18,
      bearingDeadbandDeg: 0.3,
      pitchDeadbandDeg: 0.22,
      zoomDeadband: 0.015,
    };
  }

  // balanced
  return {
    applyMinIntervalMs: 1000 / 30,
    tauCenterS: 0.35,
    tauHeadingS: 0.25,
    tauPitchS: 0.35,
    tauZoomS: 0.45,
    centerDeadbandM: 0.25,
    bearingDeadbandDeg: 0.4,
    pitchDeadbandDeg: 0.3,
    zoomDeadband: 0.02,
  };
}
