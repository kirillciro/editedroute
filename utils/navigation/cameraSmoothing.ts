export const computeBearingEasingFactor = (speedMps: number) => {
  const speed = Number.isFinite(speedMps) && speedMps > 0 ? speedMps : 0;
  const speedKmh = speed * 3.6;

  // Calculate easing factor based on speed
  // Low speed (0-10 km/h): slow easing (0.02-0.05)
  // Medium speed (10-50 km/h): medium easing (0.05-0.15)
  // High speed (50+ km/h): fast easing (0.15-0.25)
  let easingFactor = 0.02; // Default: very slow
  if (speedKmh > 50) {
    easingFactor = 0.25; // Fast easing at highway speeds
  } else if (speedKmh > 10) {
    easingFactor = 0.05 + ((speedKmh - 10) / 40) * 0.1; // 0.05..0.15
  } else if (speedKmh > 0) {
    easingFactor = 0.02 + (speedKmh / 10) * 0.03; // 0.02..0.05
  }

  return easingFactor;
};

export const PITCH_EASING_FACTOR = 0.1;
export const ZOOM_EASING_FACTOR = 0.07;

export const applyScalarEasing = (
  current: number,
  target: number,
  easingFactor: number,
) => current + (target - current) * easingFactor;
