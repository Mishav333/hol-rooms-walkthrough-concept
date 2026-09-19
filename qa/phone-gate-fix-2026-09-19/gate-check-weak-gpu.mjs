// Verify a device with WebGL2 present but a genuinely LOW-TIER GPU (old,
// weak Android chip) still correctly falls back via the tier check, not
// just the webgl2-presence check -- proving the fix isn't "always allow
// touchscreens" but "use a real capability signal".
import { chromium, devices } from '/tmp/hol-final-check/node_modules/playwright/index.mjs';

const browser = await chromium.launch();
const context = await browser.newContext({ ...devices['iPhone 13'] });
const page = await context.newPage();

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
        // A real known-weak mobile GPU renderer string from the detect-gpu
        // blocklist / low-tier dataset (old Adreno, well below 15fps class).
        if (pname === 0x9246) return 'Adreno (TM) 306';
        return origGetParam(pname);
      };
    }
    return ctx;
  };
});

const consoleMsgs = [];
page.on('console', (msg) => consoleMsgs.push(msg.text()));

await page.goto('http://localhost:8791/index.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

const result = await page.evaluate(() => ({
  cineActive: document.body.classList.contains('cine-active'),
  fctActive: document.body.classList.contains('fct-active'),
}));

console.log('result with mocked WEAK renderer:', JSON.stringify(result, null, 2));
console.log('fallback console messages:', consoleMsgs.filter(m => m.includes('fallback_served')));

await browser.close();
