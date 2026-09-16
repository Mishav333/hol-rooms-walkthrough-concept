import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  coverFit,
  dollyZAt,
  approachPlaneAlpha,
  approachExposure,
  doorApproachCurve,
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
  const track = { enterStart: 0.62, enterEnd: 0.82, exitStart: 0.90, exitEnd: 1.0 };
  approx(textEnvelope(0.60, track), 0);
  approx(textEnvelope(0.82, track), 1);
  approx(textEnvelope(0.88, track), 1);
  approx(textEnvelope(1.0, track), 0);
  const samples = Array.from({ length: 241 }, (_, i) => textEnvelope(i / 240, track));
  const maxDelta = Math.max(...samples.slice(1).map((v, i) => Math.abs(v - samples[i])));
  assert.ok(maxDelta < 0.08, `text join too abrupt: ${maxDelta}`);
});

test('phase 1 corridor: approach plane is a real object, visible from frame one, cleared before Weight arrival', () => {
  approx(approachPlaneAlpha(0), 1);
  approx(approachPlaneAlpha(0.20), 1);
  approx(approachPlaneAlpha(0.40), 1);
  approx(approachPlaneAlpha(0.50), 0);
  // no overlap with Weight's own arrival light
  approx(weightArrivalOpacity(0.50), 0);
  const samples = Array.from({ length: 501 }, (_, i) => approachPlaneAlpha(i / 500));
  for (let i = 1; i < samples.length; i++) assert.ok(samples[i] <= samples[i - 1] + 1e-9, 'approach plane must not re-brighten');
});

test('phase 1 corridor: warmth is a real exposure lift with no hue shift, receding before Weight arrival', () => {
  approx(approachExposure(0), 1.7);
  approx(approachExposure(0.40), 1.0);
  approx(weightArrivalOpacity(0.40), 0);
  const samples = Array.from({ length: 501 }, (_, i) => approachExposure(i / 500));
  for (let i = 1; i < samples.length; i++) assert.ok(samples[i] <= samples[i - 1] + 1e-9, 'exposure must recede monotonically, no re-flash');
});

test('phase 1 corridor: doorway glow rises then clears before the plane fades, so it lands as a real object not a screen wash', () => {
  approx(doorApproachCurve(0), 0);
  approx(doorApproachCurve(0.28), 1);
  approx(doorApproachCurve(0.48), 0);
  // must be fully cleared before the approach plane itself starts fading at t=0.40
  approx(approachPlaneAlpha(0.32), 1);
  const samples = Array.from({ length: 501 }, (_, i) => doorApproachCurve(i / 500));
  const maxDelta = Math.max(...samples.slice(1).map((v, i) => Math.abs(v - samples[i])));
  assert.ok(maxDelta < 0.03, `doorway glow join too abrupt: ${maxDelta}`);
});

test('Misha-facing resolve card contains no em or en dashes', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const card = html.match(/<section class="room" id="next-rooms"[\s\S]*?<\/section>/)?.[0] || '';
  assert.ok(card.length > 0, 'resolve card missing');
  assert.ok(!/[—–]/.test(card), 'resolve card contains a banned dash');
});
