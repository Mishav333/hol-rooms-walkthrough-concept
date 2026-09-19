// Proves the CORE fix: a touchscreen device (iPhone 13 UA + touch input,
// pointer:coarse=true) with a REAL capable GPU renderer string now mounts
// the cinematic engine instead of being auto-excluded by pointer type.
// This sandbox has no hardware GPU (SwiftShader everywhere), so we mock
// WEBGL_debug_renderer_info's UNMASKED_RENDERER_WEBGL to report a real
// iPhone 13-class Apple GPU renderer, which is what a real device would
// report. This isolates and tests the GATE LOGIC (does the code still key
// off pointer:coarse? no) independent of the sandbox's lack of hardware
// acceleration.
import { chromium, devices } from '/tmp/hol-final-check/node_modules/playwright/index.mjs';

const browser = await chromium.launch();
const context = await browser.newContext({ ...devices['iPhone 13'] });
const page = await context.newPage();

// Confirm pointer:coarse really is true for this device profile (so we are
// genuinely testing the touchscreen case the bug was about).
await page.goto('about:blank');
const coarse = await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches);
console.log('pointer:coarse on iPhone13 profile =', coarse);

// Mock the renderer string to a real Apple mobile GPU (A15, iPhone 13 class)
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
        if (pname === 0x9246) return 'Apple GPU'; // matches Safari's real masked string on iOS
        return origGetParam(pname);
      };
    }
    return ctx;
  };
});

const consoleMsgs = [];
page.on('console', (msg) => consoleMsgs.push(msg.text()));

await page.goto('http://localhost:8791/index.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const result = await page.evaluate(() => ({
  cineActive: document.body.classList.contains('cine-active'),
  fctActive: document.body.classList.contains('fct-active'),
}));

console.log('pointer:coarse still true for this profile:', coarse);
console.log('result with mocked capable Apple GPU renderer:', JSON.stringify(result, null, 2));
console.log('fallback console messages:', consoleMsgs.filter(m => m.includes('fallback_served')));
console.log('capability warn messages (fail-open path):', consoleMsgs.filter(m => m.includes('hol-capability')));
console.log('all console:', consoleMsgs);

await browser.close();
