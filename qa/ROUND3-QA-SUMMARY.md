# Round 3 Technical QA Summary

Date: 2026-09-15
Build under test: local working tree after commit 60bb28a
Viewport: 1440 by 900
Cinematic override: enabled for QA only

## Required dense scrub

Captured 72 rendered frames:

- Opening light to corridor dark: 24 frames, journey t 0.06 to 0.58
- Corridor dark to Weight arrival: 24 frames, journey t 0.52 to 0.84
- Weight dwell to resolve: 24 frames, journey t 0.82 to 1.00

Local evidence folder: qa/round3-frames/. This folder is intentionally gitignored because it contains approximately 100 MB of generated screenshots.

## Defect 8, sphere warp

Before fix, the 33-frame browser regression sweep measured a maximum Weight plane aspect error of 9.4%. The rendered ratio moved from the source ratio 1.7660044 toward the viewport ratio 1.6.

After fix, all 72 dense-scrub frames measured rendered plane width divided by height at exactly 1.7660044150110374, matching the locked 1600 by 906 derivative. Maximum aspect error: 0% at browser debug precision.

The camera remains level and normal to the image plane. Weight scale is applied uniformly to both axes from one scalar, including the subtle dwell breath. Cropping happens at the viewport edge only.

## Defect 9, motion quality

The piecewise linear camera keyframes were removed. The full trip now uses one quintic smootherstep position function from Z 8 to Z -5.25. It is monotonic and has continuous position, velocity, and acceleration, with zero endpoint velocity.

Text is no longer animated by separate ScrollTrigger timelines. Intro, Weight, and resolve text use eased envelopes evaluated on the same journey clock as the camera. Weight copy enters during camera deceleration, holds through arrival, and crossfades into the resolve copy during final dwell.

Dense-frame image analysis found no single-frame discontinuity. Maximum consecutive-frame RMSE step change:

- Opening to dark: 7.54
- Dark to Weight: 2.47
- Weight to resolve: 1.78

Gate threshold: less than 22.

## Defect 10, opening in light

The preloader and opening state now use corridor-approach.webp with a restrained warm lift. The opening fixed layer starts at opacity 1, holds through t 0.08, and eases to 0 by t 0.56. The locked corridor-between image is then exposed before Weight begins its bright arrival.

Measured opening-frame luminance: 29.94. Corridor-approach derivative reference: 20.05. Darkest captured travel frame: 12.73, above 50% of the corridor-between reference floor of 18.59.

## Defect 7, punctuation

The resolve card contains no em or en dashes. The visible page title, counter, and build badge were also cleaned.

## Automated checks

`node --test qa/round3-motion.test.mjs`: 5 passed, 0 failed.

`python3 qa/analyze_round3_frames.py`: PASS for 24 frames per transition, opening-light register, corridor luminance floor, and no single-frame discontinuity.

Status: technical candidate passed My Man's round-3 regression checks. My Girl's independent dense-scrub visual judgment is still required before the representative room can be called PASS.
