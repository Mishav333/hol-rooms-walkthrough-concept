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

export function openingLightOpacity(progress) {
  return 1 - rangedSmootherstep(progress, 0.08, 0.56);
}

export function weightArrivalOpacity(progress) {
  return rangedSmootherstep(progress, 0.56, 0.80);
}

export function textEnvelope(progress, track) {
  const enter = rangedSmootherstep(progress, track.enterStart, track.enterEnd);
  const exit = 1 - rangedSmootherstep(progress, track.exitStart, track.exitEnd);
  return Math.min(enter, exit);
}
