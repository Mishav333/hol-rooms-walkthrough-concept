# Corridor v3 QA Summary (2026-09-19)

Build under test: corridor v3 (exposure fix + one continuous push through four
beats + Option A room reveal), motion-core.js + index.html.
Task: t_4b64696c ("Corridor v3: opening exposure fix + one continuous push +
Option A room reveal (Misha approved 'Definitely A')").

## What changed

1. Opening exposure fix: `approachExposure()` no longer applies the legacy
   1.7x boost tuned for the retired dark corridor shot; it is flat 1.0 at
   every point in the journey. The same legacy overlay (radial 0.58 +
   linear 0.30/0.08) was cut down to a genuinely subtle warmth (radial 0.10,
   linear 0.06/0.03) on `#opening-light`, `#intro`, and `#preloader` — all
   three were carrying the identical over-lift. Added a real scrim
   (`.intro-copy`) behind the intro text block so it holds contrast without
   relying on blown highlights.

2. One continuous push: added `corridor-midpoint` and `corridor-between` as
   real fixed 3D photo planes (same construction as the existing approach
   plane), positioned along the same forward Z track, crossfaded on
   overlapping alpha windows (`approachPlaneAlpha`, `midpointPlaneAlpha`,
   `betweenPlaneAlpha`) so at every point up to the doorway threshold at
   least one corridor plane is fully opaque. No fade-to-black, no cut.

3. Option A room reveal: a single composite shader on the `corridor-between`
   plane (`doorwayRevealMat`) blends between.webp and weight.webp through a
   growing, feathered radial mask centered on the between photo's own
   measured doorway aperture (UV 0.485, 0.42). The mask grows from a small
   peek to full-frame coverage between t=0.48 and t=0.66 (the doorway
   threshold), matching "small at first ... aperture grows ... you're
   through." No second plane, no picture-in-picture rectangle.

## Automated checks

`node --test qa/round3-motion.test.mjs` — 11/11 pass. Covers: crossfade
sum-to-one invariant at both handoffs (no black gap), monotonic fades, flat
exposure at every t, door reveal only completes at/after the threshold
(never early), Weight room fully opaque by the same threshold the reveal
completes at (no black shows through the growing hole), doorway glow beat
compressed inside the approach plane's own window.

## Manual/visual checks (this pass, self-check only — not the final gate)

Headless Playwright scrub (`qa/scrub_corridor_v3.js`) of the live build at
`?forcecine=1`, 1440x900, 21 sample points from t=0 to t=1, zero console
errors or page errors across the full scrub.

- t=0 measured mean luminance (`qa/check_frame_luma.py`): 96.7, within the
  95-115 acceptance range (vs the old defect's 132); 0.000% pixels above
  luma 240.
- t=0.66 (doorway threshold): mean luminance 101.6, in range.
- Vision spot-checks at t=0.32/0.38 confirm continuous corridor space, no
  black frame or scene cut, through the midpoint/between handoff.
- Vision spot-checks at t=0.46/0.48/0.52/0.56/0.6/0.64/0.66 confirm the
  reveal grows progressively (blown-out doorway light -> soft variation ->
  visible sphere/room) with soft/feathered edges, no hard rectangular seam
  or floating-card read, full room fills frame by t=0.64-0.66.
- Final frame (t=1) resolves cleanly to the "coming next" card, no stuck
  mid-transition state.

## Known follow-up / not touched this pass

- The doorway light delta asset (`door-light-delta-v5.webp`, My Girl's
  targeting-anchor work on commit 4d91f89) is untouched and still wired to
  the approach plane only, per the task's explicit instruction not to
  clobber that separate thread. It plays inside the compressed early beat
  (t=0.02-0.25) and is fully cleared before the approach plane itself fades.
- This is my own self-check, not the independent fidelity gate. My Girl
  hash-checks the live corridor assets against source and headless-renders
  the full push herself before this is called passed, per the task card.
