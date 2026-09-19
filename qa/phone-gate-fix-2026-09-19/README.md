# Phone capability gate fix — self-check record (2026-09-19)

Kanban task t_7e7bd9f2. Fixes real GPU tier gate, fallback content parity, debug text strip.
This is MY self-check only — My Girl runs her own independent gate per the card, not
taking this as final.

## What changed (index.html + importmap only, motion-core.js untouched)

1. capabilityCheck() no longer excludes on `pointer:coarse`. It now uses
   @pmndrs/detect-gpu (`getGPUTier`) against the real WebGL2 renderer string and
   only falls back on tier 0 (or genuine no-webgl2 / reduced-motion / save-data /
   slow-connection / low-device-memory, all unchanged). Fails OPEN to cinematic if
   the GPU-tier fetch itself errors (network/CSP), since a real non-software
   WebGL2 context already passed.
2. Fallback path content parity: new `#fallback-corridor-track` (hidden unless
   `.fct-active` is set on body — i.e. only when the cinematic layer did NOT
   mount) drives the same four corridor beats (approach -> midpoint -> between ->
   weight) as a scroll-position CSS opacity crossfade, reusing motion-core's
   `rangedSmootherstep`. No shader/portal engine, just position:sticky + JS.
3. `.dev-badge` (internal build-state note) is `display:none` by default and only
   gets `.dev-visible` added when `?forcecine=1` is present. Plain URL = zero dev
   copy in the rendered page.

## Self-check evidence (this directory)

- `gate-check-gpu-logic.mjs`: iPhone 13 Playwright profile (pointer:coarse=true,
  confirmed true), WebGL2 renderer string mocked to `Apple GPU` (the real masked
  string iOS Safari reports for A15/iPhone 13). Result: `cineActive: true`,
  `fctActive: false`, zero fallback_served events. Proves touchscreen alone no
  longer forces fallback.
- `gate-check-weak-gpu.mjs`: same iPhone 13 profile, renderer string mocked to a
  real known-weak mobile GPU (`Adreno (TM) 306`, well below the tier-1 15fps
  floor in detect-gpu's own benchmark dataset). Result: `cineActive: false`,
  `fallback_served` reason `low-gpu-tier:BENCHMARK`. Proves genuinely weak
  hardware still correctly falls back — this is a real tier check, not "always
  allow touch".
- `gate-check-corridor-phone.mjs`: PLAIN URL (zero query params) under real
  iPhone 13 emulation (unmocked — this sandbox has no hardware GPU, so it
  naturally hits `no-webgl2` here) plus two other constrained profiles
  (`low-device-memory`, forced `no-webgl2`). All three: `hasDevCopy: false`,
  `devBadgeVisible: false`, and `fctSamples` shows a clean four-beat crossfade
  across the fallback track's scroll range with no shared-zero frame between
  neighbours (each beat handoff overlaps the next) — see
  `fallback-parity-results.json`.
- `gate-check-forcecine.mjs`: `?forcecine=1` desktop path still mounts the
  cinematic engine (`cineActive: true`) and the dev badge is visible there only,
  confirming the QA override still works and the badge-hiding change didn't
  break it.

## Caveats for the independent gate

- This sandbox environment has no hardware-accelerated GPU (SwiftShader
  everywhere), so the "real iPhone 13 gets a real capable renderer string in
  practice" claim could not be exercised end-to-end without mocking the
  renderer string. `gate-check-gpu-logic.mjs` isolates and proves the GATE
  LOGIC itself (does it still key off pointer:coarse? no) independent of
  hardware limits here. A real-device or cloud-real-GPU check is recommended
  as a secondary confirmation if available to My Girl's environment.
- detect-gpu's benchmark data is fetched from unpkg by default
  (`https://unpkg.com/@pmndrs/detect-gpu@6.0.22/dist/benchmarks`). If that CDN
  is blocked/unreachable for a real visitor, the gate fails OPEN (see fix #1
  above) rather than wrongly excluding a capable device.
- Playwright used for these scripts came from an existing local install at
  `/tmp/hol-final-check/node_modules/playwright` (not part of this repo's own
  dependencies — the repo has no package.json / npm toolchain of its own).
