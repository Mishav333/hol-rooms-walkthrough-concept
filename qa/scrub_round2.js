const { chromium } = require('/home/myguy/leadership-guardrails/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, 'round2-frames');
fs.mkdirSync(OUT, { recursive: true });

const URL = 'http://127.0.0.1:8935/index.html?forcecine=1';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + err.message));

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__hol_debug !== undefined, { timeout: 15000 });
  await page.waitForTimeout(1200);

  const doc = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    innerHeight: window.innerHeight,
  }));
  const maxScroll = doc.scrollHeight - doc.innerHeight;
  console.log('maxScroll', maxScroll);

  // Dense through the reveal window (0.44-0.80), sparser elsewhere.
  const targets = [0, 0.1, 0.2, 0.3, 0.38, 0.44, 0.46, 0.48, 0.50, 0.52, 0.54, 0.56, 0.58, 0.60, 0.62, 0.64, 0.66, 0.68, 0.70, 0.72, 0.75, 0.78, 0.85, 0.9, 1.0];
  const report = [];
  for (const t of targets) {
    const y = Math.round(maxScroll * t);
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(220);
    const debug = await page.evaluate(() => window.__hol_debug());
    const fname = `t${String(t).replace('.', '_')}.png`;
    await page.screenshot({ path: path.join(OUT, fname) });
    report.push({ t, y, fname, debug });
  }

  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ report, consoleErrors }, null, 2));
  console.log('consoleErrors', consoleErrors.length, consoleErrors.slice(0, 10));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
