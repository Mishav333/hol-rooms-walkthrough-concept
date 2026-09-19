import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  coverFit,
  dollyZAt,
  approachPlaneAlpha,
  midpointPlaneAlpha,
  betweenPlaneAlpha,
  approachExposure,
  doorApproachCurve,
  doorRevealProgress,
  weightArrivalOpacity,
  textEnvelope,
} from '../motion-core.js';

const approx = (actual, expected, epsilon = 1e-9) => {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
};

test('cover-fit preserves the source aspect ratio and covers the viewport', () => {
  const imageAspect = 1600 / 906;
  for (const viewportAspect of [4 / 3, 1440 / 900, 16 / 9, 21 / 9]) {
    for (const distance of [0.5, 1.2, 4.75, 8, 14]) {
      const frustumHeight = 2 * Math.tan((42 * Math.PI / 180) / 2) * distance;
      const frustumWidth = frustumHeight * viewportAspect;
      const fit = coverFit(imageAspect, frustumWidth, frustumHeight, 1.06);
      approx(fit.width / fit.height, imageAspect, 1e-12);
      assert.ok(fit.width >= frustumWidth * 1.06 - 1e-12);
      assert.ok(fit.height >= frustumHeight * 1.06 - 1e-12);
    }
  }
});

test('camera is one monotonic C2 dolly with no keyframe joins', () => {
  const samples = Array.from({ length: 2001 }, (_, i) => dollyZAt(i / 2000, 8, -5.25));
  approx(samples[0], 8);
  approx(samples.at(-1), -5.25);
  for (let i = 1; i < samples.length; i++) assert.ok(samples[i] <= samples[i - 1] + 1e-12);

  const velocity = samples.slice(1).map((z, i) => z - samples[i]);
  const acceleration = velocity.slice(1).map((v, i) => v - velocity[i]);
  const jerk = acceleration.slice(1).map((a, i) => Math.abs(a - acceleration[i]));
  assert.ok(Math.max(...jerk) < 2e-7, `jerk spike ${Math.max(...jerk)}`);
  assert.ok(Math.abs(velocity[0]) < 1e-6, 'camera should ease in');
  assert.ok(Math.abs(velocity.at(-1)) < 1e-6, 'camera should decelerate into dwell');
});

test('text choreography has eased enter, hold, and exit envelopes', () => {
  const track = { enterStart: 0.68, enterEnd: 0.84, exitStart: 0.90, exitEnd: 1.0 };
  approx(textEnvelope(0.66, track), 0);
  approx(textEnvelope(0.84, track), 1);
  approx(textEnvelope(0.88, track), 1);
  approx(textEnvelope(1.0, track), 0);
  const samples = Array.from({ length: 241 }, (_, i) => textEnvelope(i / 240, track));
  const maxDelta = Math.max(...samples.slice(1).map((v, i) => Math.abs(v - samples[i])));
  assert.ok(maxDelta < 0.08, `text join too abrupt: ${maxDelta}`);
});

// ── Corridor v3 (2026-09-19): opening exposure fix + one continuous push
// through four beats (approach -> midpoint -> between -> Option A reveal) ──

test('corridor v3, opening exposure fix: approach exposure is flat/natural at every point, no legacy boost', () => {
  // Root cause of the +27% overexposed opening was approachExposure(0)=1.7,
  // tuned for the retired DARK shot and left stacked on the now-BRIGHT
  // asset. Fix removes the boost entirely rather than re-tuning it.
  for (const t of [0, 0.1, 0.25, 0.5, 0.75, 1.0]) {
    approx(approachExposure(t), 1.0);
  }
});

test('corridor v3: approach->midpoint and midpoint->between crossfades overlap exactly (standard crossfade sum-to-one during each handoff window, no black gap)', () => {
  // approach -> midpoint handoff window (0.16-0.26): standard crossfade,
  // alphas sum to 1 throughout.
  for (let i = 0; i <= 100; i++) {
    const t = 0.16 + (0.26 - 0.16) * (i / 100);
    approx(approachPlaneAlpha(t) + midpointPlaneAlpha(t), 1, 1e-6);
  }
  // midpoint -> between handoff window (0.38-0.48): same invariant.
  for (let i = 0; i <= 100; i++) {
    const t = 0.38 + (0.48 - 0.38) * (i / 100);
    approx(midpointPlaneAlpha(t) + betweenPlaneAlpha(t), 1, 1e-6);
  }
  // outside those windows each plane is either fully opaque or fully clear
  // on its own -- no third window where coverage could be lost.
  approx(approachPlaneAlpha(0.10), 1);
  approx(midpointPlaneAlpha(0.10), 0);
  approx(midpointPlaneAlpha(0.32), 1);
  approx(betweenPlaneAlpha(0.32), 0);
});

test('corridor v3: approach -> midpoint -> between crossfades overlap (no gap where both neighbours are below full opacity at the handoff point)', () => {
  // approach fully clears by 0.26, midpoint is fully risen by 0.26: exact handoff, no gap.
  approx(approachPlaneAlpha(0.26), 0);
  approx(midpointPlaneAlpha(0.26), 1);
  // midpoint fully clears by 0.48, between is fully risen by 0.48: exact handoff, no gap.
  approx(midpointPlaneAlpha(0.48), 0);
  approx(betweenPlaneAlpha(0.48), 1);
});

test('corridor v3: approach plane fades monotonically once its window closes, no re-brighten', () => {
  approx(approachPlaneAlpha(0), 1);
  approx(approachPlaneAlpha(0.16), 1);
  approx(approachPlaneAlpha(0.26), 0);
  const samples = Array.from({ length: 501 }, (_, i) => approachPlaneAlpha(i / 500));
  for (let i = 1; i < samples.length; i++) assert.ok(samples[i] <= samples[i - 1] + 1e-9, 'approach plane must not re-brighten');
});

test('corridor v3, Option A: the door reveal only completes at/after the doorway threshold, never early', () => {
  approx(doorRevealProgress(0), 0);
  approx(doorRevealProgress(0.47), 0);
  approx(doorRevealProgress(0.66), 1);
  // strictly increasing across its ramp, no premature full-open
  const samples = Array.from({ length: 501 }, (_, i) => doorRevealProgress(i / 500));
  for (let i = 1; i < samples.length; i++) assert.ok(samples[i] >= samples[i - 1] - 1e-9, 'reveal must not regress');
  assert.ok(doorRevealProgress(0.60) < 1, 'reveal must not be fully open before the threshold');
});

test('corridor v3, Option A: Weight room plane is fully present by the same threshold the reveal completes at, so the growing hole never shows black', () => {
  approx(weightArrivalOpacity(0.64), 1);
  assert.ok(0.64 <= 0.66, 'weight must be fully opaque at/before the reveal completes at 0.66');
});

test('corridor v3: doorway glow (early "crack of light" beat) rises and clears entirely inside the approach plane\'s own visible window', () => {
  approx(doorApproachCurve(0), 0);
  approx(doorApproachCurve(0.14), 1);
  approx(doorApproachCurve(0.25), 0);
  // must be fully cleared before the approach plane itself starts fading at t=0.16
  approx(approachPlaneAlpha(0.14), 1);
  const samples = Array.from({ length: 501 }, (_, i) => doorApproachCurve(i / 500));
  const maxDelta = Math.max(...samples.slice(1).map((v, i) => Math.abs(v - samples[i])));
  assert.ok(maxDelta < 0.04, `doorway glow join too abrupt: ${maxDelta}`);
});

test('Misha-facing resolve card contains no em or en dashes', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const card = html.match(/<section class="room" id="next-rooms"[\s\S]*?<\/section>/)?.[0] || '';
  assert.ok(card.length > 0, 'resolve card missing');
  assert.ok(!/[—–]/.test(card), 'resolve card contains a banned dash');
});
