const { chromium } = require('/home/myguy/leadership-guardrails/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, 'corridor-v3-frames');
fs.mkdirSync(OUT, { recursive: true });

const URL = 'http://127.0.0.1:8934/index.html?forcecine=1';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + err.message));

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__hol_debug !== undefined, { timeout: 15000 });
  await page.waitForTimeout(1200); // let preloader/scene-ready settle

  const doc = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    innerHeight: window.innerHeight,
  }));
  const maxScroll = doc.scrollHeight - doc.innerHeight;
  console.log('maxScroll', maxScroll);

  const targets = [0, 0.05, 0.1, 0.16, 0.2, 0.26, 0.32, 0.38, 0.42, 0.46, 0.48, 0.52, 0.56, 0.60, 0.64, 0.66, 0.70, 0.75, 0.80, 0.90, 1.0];
  const report = [];
  for (const t of targets) {
    const y = Math.round(maxScroll * t);
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(180);
    const debug = await page.evaluate(() => window.__hol_debug());
    const fname = `t${String(t).replace('.', '_')}.png`;
    await page.screenshot({ path: path.join(OUT, fname) });
    report.push({ t, y, fname, debug });
  }

  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ report, consoleErrors }, null, 2));
  console.log('consoleErrors', consoleErrors.length, consoleErrors.slice(0, 10));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
