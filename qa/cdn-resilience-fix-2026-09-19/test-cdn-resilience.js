const path = require('path');
const { chromium, devices } = require('/tmp/hol-final-check/node_modules/playwright');

const URL = 'http://localhost:8931/';

async function runCase(label, blockCdn, mockGpu) {
  const browser = await chromium.launch();
  const iPhone = devices['iPhone 13'];
  const context = await browser.newContext({ ...iPhone });
  const page = await context.newPage();

  if (mockGpu) {
    // This sandbox has no hardware-accelerated GPU (SwiftShader everywhere).
    // Mock the renderer string to a real capable Apple mobile GPU so we can
    // actually exercise the cineActive=true path, same technique as the
    // original t_7e7bd9f2 gate scripts (gate-check-gpu-logic.mjs).
    await page.addInitScript(() => {
      const origGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        const ctx = origGetContext.call(this, type, ...args);
        if (type === 'webgl2' && ctx) {
          const origGetParam = ctx.getParameter.bind(ctx);
          const origGetExt = ctx.getExtension.bind(ctx);
          ctx.getExtension = function (name) {
            if (name === 'WEBGL_debug_renderer_info') {
              return { UNMASKED_RENDERER_WEBGL: 0x9246, UNMASKED_VENDOR_WEBGL: 0x9245 };
            }
            return origGetExt(name);
          };
          ctx.getParameter = function (pname) {
            if (pname === 0x9246) return 'Apple GPU';
            return origGetParam(pname);
          };
        }
        return ctx;
      };
    });
  }

  if (blockCdn) {
    // Block ALL unpkg + esm.sh CDN requests (three, gsap, lenis, detect-gpu) -
    // the realistic "ad-blocker/privacy-browser/content-filter" scenario, not
    // just the one file from the original regression.
    await page.route('**://unpkg.com/**', route => route.abort('failed'));
    await page.route('**://esm.sh/**', route => route.abort('failed'));
  }

  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const logs = [];
  page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  const result = await page.evaluate(() => ({
    cineActive: document.body.classList.contains('cine-active'),
    fctActive: document.body.classList.contains('fct-active'),
    hasCanvas: !!document.querySelector('canvas'),
    roomSections: Array.from(document.querySelectorAll('.room')).map(s => s.id),
    devBadgeVisible: !!document.querySelector('.dev-badge.dev-visible'),
    fallbackTrackPresent: !!document.getElementById('fallback-corridor-track'),
  }));

  console.log(`=== ${label} ===`);
  console.log('Page errors (uncaught):', JSON.stringify(errors));
  console.log('Result:', JSON.stringify(result, null, 2));
  const relevantLogs = logs.filter(l => /error|Error|capability|hol-/.test(l));
  if (relevantLogs.length) console.log('Relevant console:\n' + relevantLogs.join('\n'));

  await page.screenshot({ path: `/tmp/hol-cdn-fix-${label.replace(/\s+/g,'-')}-top.png` });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(800);
  await page.screenshot({ path: `/tmp/hol-cdn-fix-${label.replace(/\s+/g,'-')}-bottom.png` });

  await browser.close();
  return { label, errors, result };
}

(async () => {
  const r1 = await runCase('CDN-BLOCKED-realistic-phone', true, true);
  const r2 = await runCase('CDN-OPEN-regression-check', false, true);

  console.log('\n=== SUMMARY ===');
  console.log('CDN blocked -> cineActive || fctActive must be true, never both false:',
    (r1.result.cineActive || r1.result.fctActive) ? 'PASS' : 'FAIL');
  console.log('CDN blocked -> zero uncaught page errors:', r1.errors.length === 0 ? 'PASS' : `FAIL (${r1.errors.length})`);
  console.log('CDN open -> cineActive true (normal path):', r2.result.cineActive ? 'PASS' : 'FAIL');
})();
