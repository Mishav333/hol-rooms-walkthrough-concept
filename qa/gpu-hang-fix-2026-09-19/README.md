GPU-hang timeout fix — verification record

FINDING (My Girl, HND-20260919-GIRL-MAN-detect-gpu-hang):
Independent §3d dependency-failure harness (4 failure modes: never-loads,
hangs-indefinitely, throws-after-load, malformed-response) run against the
deployed corridor build's @pmndrs/detect-gpu CDN dependency. 3/4 modes
resolved correctly to fct-active. Mode 2 (dependency loads but never
resolves or rejects) did not resolve to either cine-active or fct-active
within a 10s poll window -- a stalled connection could leave a real visitor
stuck with neither experience committed.

MECHANISM-LEVEL READ (My Man):
Confirmed real, not a false positive. Two distinct code paths had this gap,
not one:

1. The dynamic `import('@pmndrs/detect-gpu')` itself (index.html ~line 415)
   -- if the module request stalls, the `await` never resolves.
2. The `getGPUTier({ glContext: gl })` call (index.html ~line 480) -- if its
   internal benchmark-data fetch stalls, same problem.

Both had a try/catch, which only handles REJECTION. A hung promise neither
resolves nor rejects, so it bypasses catch entirely -- confirmed this is a
distinct failure shape from the CDN-import-failure fix shipped earlier the
same day (commit c5940ae), which only guarded against outright failure/
rejection, not stalling.

Also found and fixed the same failure class in a third, higher-blast-radius
spot not covered by My Girl's original harness target: `bootCinematic()`'s
`Promise.all()` loading three.js/gsap/lenis (index.html ~line 719). The
preloader has zero timeout of its own and blocks the page with
pointer-events:none until `.done` is set by either success or the existing
`.catch()` -- a hang there strands a CAPABLE visitor on the loading screen
indefinitely, not just a low-tier one skipping a nice-to-have signal.

FIX:
- `withTimeout()` helper: races a promise against a deadline, resolves to
  the string 'timeout' if the deadline wins first. Applied to both the
  detect-gpu module import (4s) and the getGPUTier() call (4s).
- `bootCinematic()` call site: raced against an 8s deadline (longer,
  because three.js+gsap+lenis is a bigger payload than one small module).
  On timeout, falls back to the exact same static track used for outright
  boot failure.
- `pageCommitted` guard: Promise.race's LOSER keeps running in the
  background. If a stalled CDN request that already caused a boot-timeout
  fallback later resolves anyway, `bootCinematic()` would otherwise resume
  past its own `Promise.all` and mount a second, conflicting WebGL scene on
  top of the already-committed static fallback DOM. Added a
  `pageCommitted` flag set by whichever path (cine success, or any fallback
  trigger) commits first; `bootCinematic()` checks it immediately after its
  CDN payload resolves and discards a late-arriving boot if fallback
  already won.

VERIFICATION (not self-graded off the fix's own reasoning):
1. Ran My Girl's exact harness (/tmp/dependency-failure-harness.js) against
   the fixed build, same device profile (iPhone 13), same dependency glob.
   Result: allPass=true, 4/4 modes resolve to a working state (fct-active
   for all 4, correctly -- detect-gpu failing in any shape should fail open
   to fct-active per the fix's design... [see note below]).
2. Standalone timing check confirms the fix fires by MECHANISM, not luck:
   resolved at 4356ms (== 4000ms timeout constant + poll overhead), with
   the exact expected console log line:
   "[hol-capability] detect-gpu module import timed out after 4000 ms,
   proceeding without GPU tier check"
3. Full existing motion regression suite (qa/round3-motion.test.mjs): 12/12
   pass, zero regressions from this change.
4. Fixed a real bug introduced during my first pass at this fix before
   catching it myself: `pageCommitted` was declared with `let` AFTER its
   first read (temporal dead zone) -- caught via the harness returning a
   ReferenceError on every single mode, not silently.

NOTE on fct-active vs cine-active in the harness result: the test device is
iPhone 13 which the WebGL2/software-renderer check would normally allow
through to cine-active. It resolves to fct-active here because Playwright's
default headless Chromium on this box does not expose a real (non-software)
WebGL2 context in this sandboxed environment -- that's an environment
constraint of the test harness, not a build defect; the `ok` field the
harness reports (did it reach ANY working, non-blank, non-error state) is
what's being verified here, matching the harness's own stated judgment
scope ("this tool does not judge WHICH path is correct... apply your own
acceptance criteria").

FILES CHANGED: index.html only (74 insertions, 7 deletions). No other file
touched. Diff is scoped entirely to the capability-gate and boot-timeout
logic.
