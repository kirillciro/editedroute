export function computeNextCameraBearingDeg(params: {
  currentDeg: number;
  targetDeg: number;
  easingFactor: number;
}): number {
  const { currentDeg, targetDeg, easingFactor } = params;

  // Calculate shortest-path delta in degrees
  let delta = targetDeg - currentDeg;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;

  const safeEasing = Number.isFinite(easingFactor) ? easingFactor : 0;
  const next = currentDeg + delta * safeEasing;

  // Normalize to [0, 360)
  return ((next % 360) + 360) % 360;
}
