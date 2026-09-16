const clamp01 = (value) => Math.min(1, Math.max(0, value));

export function smootherstep01(value) {
  const t = clamp01(value);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

export function rangedSmootherstep(value, start, end) {
  if (end <= start) return value >= end ? 1 : 0;
  return smootherstep01((value - start) / (end - start));
}

export function coverFit(imageAspect, frustumWidth, frustumHeight, overscan = 1) {
  const height = Math.max(frustumHeight, frustumWidth / imageAspect) * overscan;
  return { width: height * imageAspect, height };
}

export function dollyZAt(progress, startZ = 8, endZ = -5.25) {
  return startZ + (endZ - startZ) * smootherstep01(progress);
}

// Phase 1 (corridor): the corridor plane is a real object the camera dollies
// past, not a screen overlay. It is fully visible from the very first frame
// (the "generous door glow from frame one" requirement), holds through the
// main approach, then clears well before Weight's own arrival window
// (0.56-0.80) and well before the camera would physically reach its Z
// position, so there is no backface/clip artifact.
export function approachPlaneAlpha(progress) {
  return 1 - rangedSmootherstep(progress, 0.40, 0.50);
}

// Phase 1 (corridor): warmth is now a real grade on the rendered 3D frame
// (post pass), not a flat image parked in front of the canvas. Full warmth
// at the very first frame, receding to the earned nocturne by mid-journey,
// well before Weight's arrival so the two never mix.
export function corridorWarmth(progress) {
  return 1 - rangedSmootherstep(progress, 0.06, 0.42);
}

export function weightArrivalOpacity(progress) {
  return rangedSmootherstep(progress, 0.56, 0.80);
}

export function textEnvelope(progress, track) {
  const enter = rangedSmootherstep(progress, track.enterStart, track.enterEnd);
  const exit = 1 - rangedSmootherstep(progress, track.exitStart, track.exitEnd);
  return Math.min(enter, exit);
}
