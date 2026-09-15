# Round 3 Technical QA Summary

Date: 2026-09-15
Build under test: Round 3 opening-light revision after commit 0546df0
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

- Opening to dark: 5.38
- Dark to Weight: 2.47
- Weight to resolve: 1.78

Gate threshold: less than 22.

## Defect 10, opening in light

My Girl's first independent 78-frame gate cleared defects 7, 8, and 9 but failed the opening treatment. Her evidence measured mean opening luminance 28.85 and only a narrow door-light strip, confirming that the restrained lift still read as a dark corridor.

The revision keeps the locked corridor-approach photograph intact underneath but adds an opening-specific broad warm illumination field and stronger ambient lift. The same treatment is present in the preloader, cinematic opening layer, and static fallback. The opening layer starts at opacity 1, holds through t 0.08, and eases to 0 by t 0.56. The treatment disappears before the locked corridor-between nocturne and Weight arrival, so the intended light-to-dark-to-bright arc is preserved.

Revised dense-capture measurements:

- Opening-frame mean luminance: 67.04, previously 29.94
- Pixels above luminance 100: 12.08%, previously 2.37%
- Exposure relative to locked approach reference: 3.34 times
- Exposure relative to dark-travel frame: 5.24 times
- Dark-travel mean luminance remains 12.79

The regression gate now requires all three conditions: opening mean luminance at least 60, at least 10% of pixels above luminance 100, and opening exposure at least 1.55 times the locked approach reference. The previously rejected frames fail all three gates; the revised frames pass all three.

## Defect 7, punctuation

The resolve card contains no em or en dashes. The visible page title, counter, and build badge were also cleaned.

## Automated checks

`node --test qa/round3-motion.test.mjs`: 5 passed, 0 failed.

`python3 qa/analyze_round3_frames.py`: PASS for 24 frames per transition, materially light opening, broad opening-light coverage, opening-to-reference exposure ratio, corridor luminance floor, and no single-frame discontinuity.

Status: revised technical candidate passed My Man's round-3 regression checks after the independent opening-light FAIL. My Girl's fresh independent dense-scrub visual judgment is still required before the representative room can be called PASS.
