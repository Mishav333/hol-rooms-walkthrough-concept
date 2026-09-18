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

// Phase 1 (corridor), model 2 (RR-informed rebuild): the corridor plane is a
// real object the camera dollies past, not a screen overlay. It is fully
// visible from the very first frame, holds through the main approach, then
// clears well before Weight's own arrival window (0.56-0.80).
export function approachPlaneAlpha(progress) {
  return 1 - rangedSmootherstep(progress, 0.40, 0.50);
}

// Phase 1 (corridor), model 2: brightness only, no hue shift. A pure exposure
// (grayscale gain) lift on the corridor-approach plane's OWN material, so the
// "opens in light" requirement is delivered by a real object being genuinely
// brighter, not a full-frame color grade sitting on top of everything (that
// full-frame grade was the "weird golden tinge" defect, now removed
// entirely rather than re-tuned). Strong at t=0, eases to natural exposure
// by the same t=0.40 point the plane itself starts fading.
export function approachExposure(progress) {
  const boost = 1 - rangedSmootherstep(progress, 0.00, 0.40);
  return 1 + boost * 0.7;
}

// Phase 1 (corridor), model 2: the "crack of light" is now a real, positioned
// glow object at the doorway's actual location in the locked photograph.
// CORRECTED 2026-09-18: re-measured directly against the exact locked master
// (approach-r2-concept3-windows.png) at x=0.4978, y=0.4759 of frame — dead
// center, not the earlier x=0.52/y=0.41 estimate (which was never verified
// against this specific bright-register master and caused a look-at drift
// toward the left pillar gap around t=0.40). This single bump curve drives both the glow sprite's
// opacity and the camera's look-at lift toward that point, so the two stay
// locked together: rises as the corridor approach begins, peaks just before
// the threshold, and is fully gone by the time the plane itself has faded
// and we are through into the room.
export function doorApproachCurve(progress) {
  const rise = rangedSmootherstep(progress, 0.03, 0.28);
  const fall = 1 - rangedSmootherstep(progress, 0.32, 0.48);
  return Math.min(rise, fall);
}

export function weightArrivalOpacity(progress) {
  return rangedSmootherstep(progress, 0.56, 0.80);
}

export function textEnvelope(progress, track) {
  const enter = rangedSmootherstep(progress, track.enterStart, track.enterEnd);
  const exit = 1 - rangedSmootherstep(progress, track.exitStart, track.exitEnd);
  return Math.min(enter, exit);
}
