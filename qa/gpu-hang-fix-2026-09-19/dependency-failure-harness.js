#!/usr/bin/env node
/**
 * dependency-failure-harness.js — live-build-visual-qa §3d enforcement tool.
 *
 * Runs the FOUR mandatory failure modes against a named external dependency
 * URL pattern, on a live URL, under a real device profile. Exists so §3d is a
 * command you run, not a checklist you have to remember to do by hand.
 *
 * USAGE:
 *   node dependency-failure-harness.js <live-url> <dependency-url-glob> [device]
 *
 * EXAMPLE:
 *   node dependency-failure-harness.js \
 *     "https://mishav333.github.io/hol-rooms-walkthrough-concept/" \
 *     "**://unpkg.com/@pmndrs/detect-gpu**" \
 *     "iPhone 13"
 *
 * Requires playwright already installed and reachable — reuse an existing
 * local install per skill §2 item 1 rather than `npm install` in unattended
 * sessions (blocked by the security scanner there).
 *
 * OUTPUT: prints a JSON report, one entry per failure mode, each with
 * { mode, ok, cineActive, fctActive, hadFatalError, consoleErrors, note }.
 * ok=true means the page resolved to SOME working state (cinematic OR
 * fallback) rather than a dead/blank shell. This tool does not judge WHICH
 * path is correct for your build — read the report and apply your own
 * acceptance criteria (e.g. "must fail open to cinematic" vs "must fail safe
 * to fallback" — both are valid ok=true depending on the brief).
 */
const { chromium, devices } = require('playwright');

const [, , liveUrl, depGlob, deviceName] = process.argv;
if (!liveUrl || !depGlob) {
  console.error('Usage: node dependency-failure-harness.js <live-url> <dependency-url-glob> [device]');
  process.exit(1);
}
const device = deviceName ? devices[deviceName] : devices['iPhone 13'];
if (deviceName && !device) {
  console.error(`Unknown device "${deviceName}". See Playwright's devices list.`);
  process.exit(1);
}

async function runCase(mode, routeHandler) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ ...device });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));

  if (routeHandler) await page.route(depGlob, routeHandler);

  // 'networkidle' is the WRONG wait condition for the "hangs indefinitely" case
  // by definition: a permanently-hanging request means the network is never
  // idle, so networkidle would time out on every build regardless of whether
  // the build itself handles the hang correctly. Use 'domcontentloaded' (fires
  // once the DOM is parsed, independent of in-flight requests) then poll for
  // the app's own resolved state for a bounded window — this tests "does the
  // build reach a working state within a real user's patience", not "does the
  // network ever go quiet".
  let hadFatalError = false;
  try {
    await page.goto(liveUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
  } catch (e) {
    hadFatalError = true;
    consoleErrors.push(`NAVIGATION_FAILED: ${e.message}`);
  }
  // Poll up to 10s for either resolved-state class to appear, instead of a
  // single fixed sleep — catches both "resolves fast" and "resolves late but
  // still resolves" without waiting the full window on every case.
  if (!hadFatalError) {
    for (let i = 0; i < 20; i++) {
      const resolved = await page.evaluate(() =>
        document.body.classList.contains('cine-active') ||
        document.body.classList.contains('fct-active')
      ).catch(() => false);
      if (resolved) break;
      await page.waitForTimeout(500);
    }
  }

  let cineActive = false, fctActive = false, bodyEmpty = true;
  try {
    const result = await page.evaluate(() => ({
      cineActive: document.body.classList.contains('cine-active'),
      fctActive: document.body.classList.contains('fct-active'),
      bodyText: (document.body.innerText || '').trim(),
    }));
    cineActive = result.cineActive;
    fctActive = result.fctActive;
    bodyEmpty = result.bodyText.length < 20;
  } catch (e) {
    hadFatalError = true;
  }

  await browser.close();

  const ok = !hadFatalError && (cineActive || fctActive) && !bodyEmpty;
  return {
    mode,
    ok,
    cineActive,
    fctActive,
    hadFatalError,
    bodyEmpty,
    consoleErrors: consoleErrors.slice(0, 5),
    pageErrors: pageErrors.slice(0, 5),
  };
}

(async () => {
  const results = [];

  // 1. Never loads at all (blocked / DNS fail / ad-blocker)
  results.push(await runCase(
    '1-never-loads',
    (route) => route.abort('failed')
  ));

  // 2. Loads but hangs indefinitely (never resolves within a real timeout window)
  results.push(await runCase(
    '2-hangs-indefinitely',
    (route) => { /* never call route.continue/fulfill/abort -> request hangs */ }
  ));

  // 3. Loads but throws/errors after resolving (the case everyone remembers)
  results.push(await runCase(
    '3-throws-after-load',
    (route) => route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: 'throw new Error("simulated runtime failure after dependency load");',
    })
  ));

  // 4. Loads with a malformed / partial / unexpected response
  results.push(await runCase(
    '4-malformed-response',
    (route) => route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: 'export const getGPUTier = ',  // truncated, syntactically broken
    })
  ));

  const summary = {
    liveUrl,
    depGlob,
    device: deviceName || 'iPhone 13',
    allPass: results.every((r) => r.ok),
    results,
  };
  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.allPass ? 0 : 1);
})();
