const { chromium } = require('/home/myguy/leadership-guardrails/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, 'corridor-v3-live-check');
fs.mkdirSync(OUT, { recursive: true });

const URL = 'https://mishav333.github.io/hol-rooms-walkthrough-concept/index.html?forcecine=1';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + err.message));

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForFunction(() => window.__hol_debug !== undefined, { timeout: 15000 });
  await page.waitForTimeout(1200);

  const doc = await page.evaluate(() => ({ scrollHeight: document.documentElement.scrollHeight, innerHeight: window.innerHeight }));
  const maxScroll = doc.scrollHeight - doc.innerHeight;

  for (const t of [0, 0.66, 1.0]) {
    const y = Math.round(maxScroll * t);
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(200);
    const debug = await page.evaluate(() => window.__hol_debug());
    await page.screenshot({ path: path.join(OUT, `live_t${String(t).replace('.', '_')}.png`) });
    console.log(JSON.stringify({ t, approachExposureNow: debug.approachExposureNow, doorRevealNow: debug.doorRevealNow, weightPlaneAlpha: debug.weightPlaneAlpha }));
  }

  console.log('consoleErrors', consoleErrors.length, consoleErrors.slice(0, 10));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
