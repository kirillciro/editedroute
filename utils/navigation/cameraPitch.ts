export function computeCameraPitchTargetDeg(speedMps: number): number {
  const safeSpeedMps =
    Number.isFinite(speedMps) && speedMps > 0 ? speedMps : 0;
  const speedKmh = safeSpeedMps * 3.6;

  if (speedKmh <= 10) {
    // 0-10 km/h: Linear interpolation from 0° to 15°
    return (speedKmh / 10) * 15;
  }

  if (speedKmh <= 50) {
    // 10-50 km/h: Linear interpolation from 15° to 30°
    return 15 + ((speedKmh - 10) / 40) * 15;
  }

  // 50+ km/h: Linear interpolation from 30° to 60° (cap at 100 km/h)
  const speedOver50 = Math.min(speedKmh - 50, 50);
  return 30 + (speedOver50 / 50) * 30;
}
