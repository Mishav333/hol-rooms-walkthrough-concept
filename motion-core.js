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

// Corridor v3: one continuous push through FOUR real photo beats
// (approach -> midpoint -> between -> through-the-door), each a crossfaded
// real 3D plane the camera dollies past. Every window overlaps its neighbour
// so at every t at least one corridor plane is fully opaque -- no black
// frame, no cut, matching Misha's "it just keeps going" direction.
export function approachPlaneAlpha(progress) {
  return 1 - rangedSmootherstep(progress, 0.16, 0.26);
}

export function midpointPlaneAlpha(progress) {
  const rise = rangedSmootherstep(progress, 0.16, 0.26);
  const fall = 1 - rangedSmootherstep(progress, 0.38, 0.48);
  return Math.min(rise, fall);
}

// The between plane rises like the others, holds through the reveal, then
// fades out ONLY after doorRevealProgress has fully completed (>=0.66) and
// the real Weight room plane (weightArrivalOpacity, full by 0.64) is already
// opaque behind it -- since both show the identical weight.webp photograph
// at that point (the composite shader's mask is fully open), the handoff
// from "between plane showing weight through its mask" to "the real Weight
// plane" is a same-image crossfade, not a content change, so it cannot pop.
export function betweenPlaneAlpha(progress) {
  const rise = rangedSmootherstep(progress, 0.38, 0.48);
  const fall = 1 - rangedSmootherstep(progress, 0.66, 0.78);
  return Math.min(rise, fall);
}

// Corridor v3, opening exposure fix: root cause was approachExposure(0)=1.7,
// a boost tuned for the retired DARK corridor-approach shot, still stacked
// on the now-BRIGHT locked asset (render mean 132 vs asset mean 104, +27%).
// Flat/natural exposure at every point in the journey -- the bright asset
// needs no artificial lift, and legacy lift is removed here (and from the
// opening layer / preloader / static fallback CSS, see index.html) rather
// than re-tuned, so it cannot reappear as a smaller stacked defect.
export function approachExposure() {
  return 1.0;
}

// Option A, "through the door": between.webp already carries a bright
// doorway aperture at its own natural exposure. doorRevealProgress grows a
// real feathered cutout hole in the between plane's shader, centered on
// that aperture, positioned/timed so it only starts opening once the
// between beat is the dominant plane on screen (0.48) and is fully open
// (radius covers the whole frame) once the push reaches the doorway
// threshold at 0.66 -- i.e. the reveal completes only at/after the
// threshold, never earlier, and stays open (no re-closing) for the dwell.
export function doorRevealProgress(progress) {
  return rangedSmootherstep(progress, 0.48, 0.66);
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
// Corridor v3 retime: this is the EARLY "crack of light draws the eye
// forward" beat, tied to the approach plane's own (now much earlier) window
// (fully visible 0.00-0.16, fading out by 0.26 -- see approachPlaneAlpha
// above). Compressed so the glow rises and clears entirely inside that
// window; it must never be visible once the approach plane itself has faded,
// or it would read as a floating light with nothing under it.
export function doorApproachCurve(progress) {
  const rise = rangedSmootherstep(progress, 0.02, 0.14);
  const fall = 1 - rangedSmootherstep(progress, 0.14, 0.25);
  return Math.min(rise, fall);
}

// Corridor v3, Option A ("through the door"): weight fades in on the SAME
// clock as doorRevealProgress (very slightly ahead of it) so the room is
// already resolving as the between plane's aperture cutout starts opening --
// no black gap ever shows inside the growing hole -- and is fully present
// (opacity 1) by the doorway threshold at t=0.66, matching doorRevealProgress
// exactly, then holds through the arrival dwell.
export function weightArrivalOpacity(progress) {
  return rangedSmootherstep(progress, 0.46, 0.64);
}

export function textEnvelope(progress, track) {
  const enter = rangedSmootherstep(progress, track.enterStart, track.enterEnd);
  const exit = 1 - rangedSmootherstep(progress, track.exitStart, track.exitEnd);
  return Math.min(enter, exit);
}
