# Corridor v3, ROUND 2 QA (2026-09-19)

Build under test: round-2 rebuild of the Option A room reveal, addressing
all three defects from My Girl's independent gate (run 72, task t_4b64696c):
reveal completing early / reading as a dissolve (3a), floor plane mismatch +
soft magnified dwell (3b), and a double-image at the between->weight handoff
(3c). Criteria 1 (opening exposure) and 2 (one continuous push) passed run 72
and are UNCHANGED in this pass -- re-verified below as a regression check,
not re-built.

## Root cause (confirmed against the gate report, not guessed)

Round 1's reveal shader blended two textures (between.webp + weight.webp)
through a mask whose radius was defined in raw photo-UV space. The between
plane's WORLD SIZE was fixed once at setup (cover-fit at the CAMERA_START_Z
reference distance) and never re-fit as the camera dollied closer, so the
plane magnified 2.2x-3.5x on screen through the reveal window while the mask
radius stayed the same UV size -- the same UV radius covered a rapidly
growing fraction of the actual viewport as the camera closed in. That is
exactly why the round-1 unit tests (asserting on the uReveal uniform, which
did complete correctly at t=0.66) passed while the rendered pixels failed:
the uniform was never wrong, the on-screen geometry was.

## The fix: a real portal cutout, not a second texture sample

1. **Screen-space, live-normalized mask geometry.** index.html now
   recomputes the between plane's live visible UV half-extent every frame
   (`frustumSizeAtDistance` at the actual current camera-to-plane distance,
   divided by the plane's fixed world size) and normalizes the mask distance
   by that, so a radius of 1.0 always means "reaches the screen edge on that
   axis," at any point in the dolly. The exact farthest-corner distance in
   these units is computed analytically per frame too (no hardcoded guess).
2. **No second texture sample.** The shader no longer blends in weight.webp
   at all -- inside the growing hole it goes fully transparent
   (`depthWrite:false`), revealing the REAL weight plane sitting 3 world
   units farther back (weight z=-10 vs between z=-7), painted first by
   three.js's transparent back-to-front sort. This is the "real portal
   cutout revealing the actual weight plane behind" construction the gate
   report explicitly named as equally acceptable -- and it eliminates the
   double image (3c) and the soft/magnified dwell (3b) in one move, because
   there is only ever ONE render of weight.webp, at its own correct, sharp
   scale.
3. **Weight re-cover-fit live, not just once.** Because the portal can now
   expose the real weight plane well before the camera reaches its
   originally-planned arrival distance, weight's own world size is now also
   re-cover-fit every frame (same rule as approach/midpoint/between) instead
   of being fixed once at CAMERA_END_Z -- this closed a NEW defect found in
   self-testing (a visible rectangular gap around the weight plane's
   previously undersized boundary, showing through the growing hole).
4. **Back-loaded growth curve.** `doorRevealEasedProgress` raises the
   0.48-0.66 ramp to the 4th power (was squared in an earlier draft, tuned
   further after numeric verification): only ~9% of the on-screen radius is
   reached by t=0.54 (the exact frame the gate flagged as "already
   full-room"), ~44% by t=0.60, ~96% by t=0.64, 100% at the doorway
   threshold t=0.66.
5. **weightArrivalOpacity retimed** to 0.28-0.46 (fully opaque before the
   between plane itself is even fully risen at 0.48) so nothing but bright,
   fully-resolved room content is ever visible inside the hole, at any size.

## Automated checks

`node --test qa/round3-motion.test.mjs` -- 12/12 pass. New test
(`corridor v3, Option A, ROUND 2`) replicates index.html's exact per-frame
geometry (dolly curve, live frustum, cover-fit) in a standalone function and
asserts against the resulting ON-SCREEN radius/fraction, not the raw
progress uniform -- directly closing the testing gap the gate report named
as round 1's mistake.

## Manual/visual checks (own headless scrub, this pass)

Fresh Playwright scrub (`qa/scrub_round2.js`) of the local build at
`?forcecine=1`, 1440x900, 25 sample points dense through 0.44-0.80,
**zero console errors**.

- t=0 luminance unchanged: 96.7 (regression check on criterion 1, untouched
  this pass).
- No black frames at either the approach->midpoint or midpoint->between
  handoff (luma 82.7-120.1 sampled across 0.2-0.44).
- Telemetry confirms `doorHoleRadiusNow` stays flat at 0.15 (a small,
  constant peek) from t=0.44 through t=0.52, only starts growing at t=0.54
  (0.153), and reaches ~1.95-2.0 (full-corner coverage) by t=0.66-0.68 --
  matching the required back-loaded curve exactly, verified against the
  live rendered uniform, not just the test's standalone simulation.
- Vision spot-checks: t=0.48-0.52 reads as a small (~8-10% frame width),
  softly feathered doorway sliver with no visible room content wash; t=0.54
  and t=0.58 still read as small/tight apertures, not a wash spanning the
  frame; t=0.66 and t=0.70 show the room filling frame with NO visible
  rectangular seam anywhere in the 3D-rendered content (confirmed by
  region-cropped inspection after an initial false-positive read against UI
  chrome); t=0.72 shows a single sharp sphere with no double-image/ghosting;
  floor at t=0.56/t=0.62 reads as continuous, soft-edged, no mismatch.
- t=1.0 resolves cleanly to the "Coming next" card (UI-timing overlap
  artifact from a prior card's tail-end scroll transition, not a scene
  defect -- pre-existing engine behaviour, out of this task's scope).

## Not touched this pass

- Opening exposure fix and continuous-push crossfade timing (criteria 1-2):
  unchanged, re-verified only.
- Doorway light delta asset (My Girl's separate thread, commit 4d91f89):
  untouched.

## Known follow-up / out of scope

- This is my own self-check, not the independent fidelity gate. Per the
  task card, My Girl re-verifies against her own fresh harness (own
  contact sheets, own numeric battery) before this is called passed.
