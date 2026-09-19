// Gate check for t_7e7bd9f2: real iPhone 13 emulation against the PLAIN
// live-equivalent URL (zero query params) must NOT hit the fallback.
// A genuinely constrained profile (deviceMemory forced low) must still
// correctly fall back. Also verifies: zero dev-badge text on plain URL,
// and (constrained profile) the fallback crossfade track becomes visible
// and covers all four beats across the scroll range.
import { chromium, devices } from '/tmp/hol-final-check/node_modules/playwright/index.mjs';

const BASE = 'http://localhost:8791/index.html';
const results = {};

async function run(label, { deviceName, forceLowMemory, forceLowGpu }) {
  const browser = await chromium.launch();
  const deviceCfg = devices[deviceName];
  const context = await browser.newContext({ ...deviceCfg });
  const page = await context.newPage();

  if (forceLowMemory) {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'deviceMemory', { get: () => 2 });
    });
  }
  if (forceLowGpu) {
    // Simulate no usable GPU: force WebGL2 context creation to fail.
    await page.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        if (type === 'webgl2') return null;
        return orig.call(this, type, ...args);
      };
    });
  }

  const consoleMsgs = [];
  page.on('console', (msg) => consoleMsgs.push(msg.text()));

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const cineActive = await page.evaluate(() => document.body.classList.contains('cine-active'));
  const fctActive = await page.evaluate(() => document.body.classList.contains('fct-active'));
  const canvasOpacity = await page.evaluate(() => {
    const c = document.getElementById('webgl');
    return c ? getComputedStyle(c).opacity : null;
  });
  const devBadgeVisible = await page.evaluate(() => {
    const b = document.querySelector('.dev-badge');
    if (!b) return false;
    const cs = getComputedStyle(b);
    return cs.display !== 'none';
  });
  const bodyText = await page.evaluate(() => document.body.innerText);
  const hasDevCopy = /MY MAN|CORRIDOR V3|EXPOSURE FIX|CONTINUOUS PUSH/i.test(bodyText);

  results[label] = {
    cineActive, fctActive, canvasOpacity, devBadgeVisible, hasDevCopy,
    fallbackMsgs: consoleMsgs.filter(m => m.includes('fallback_served')),
    warnMsgs: consoleMsgs.filter(m => m.includes('hol-capability')),
  };

  // For the fallback profile: scroll through and sample fct-layer opacities
  if (fctActive) {
    const track = await page.$('#fallback-corridor-track');
    const trackBox = track ? await track.boundingBox() : null;
    const samples = [];
    if (trackBox) {
      const { trackTop, totalScroll } = await page.evaluate(() => {
        const el = document.getElementById('fallback-corridor-track');
        const top = el.getBoundingClientRect().top + window.scrollY;
        return { trackTop: top, totalScroll: el.offsetHeight - window.innerHeight };
      });
      for (const frac of [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1.0]) {
        await page.evaluate((y) => window.scrollTo(0, y), Math.round(trackTop + totalScroll * frac));
        await page.waitForTimeout(80);
        const op = await page.evaluate(() => {
          const layers = document.querySelectorAll('.fct-layer');
          const out = {};
          layers.forEach(l => out[l.dataset.beat] = parseFloat(getComputedStyle(l).opacity).toFixed(2));
          return out;
        });
        samples.push({ frac, op });
      }
    }
    results[label].fctSamples = samples;
  }

  await browser.close();
}

await run('iphone13_plain', { deviceName: 'iPhone 13' });
await run('constrained_lowmemory', { deviceName: 'iPhone 13', forceLowMemory: true });
await run('constrained_nowebgl2', { deviceName: 'iPhone 13', forceLowGpu: true });

console.log(JSON.stringify(results, null, 2));
