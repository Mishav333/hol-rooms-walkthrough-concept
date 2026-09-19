const { chromium, devices } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await context.newPage();
  const logs = [];
  page.on('console', (m) => logs.push(m.text()));
  await page.route('**://unpkg.com/@pmndrs/detect-gpu**', () => {});
  const t0 = Date.now();
  await page.goto('http://localhost:8903/index.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
  let resolvedAt = null;
  for (let i = 0; i < 30; i++) {
    const resolved = await page.evaluate(() => document.body.classList.contains('fct-active') || document.body.classList.contains('cine-active')).catch(() => false);
    if (resolved) { resolvedAt = Date.now() - t0; break; }
    await page.waitForTimeout(300);
  }
  console.log('Resolved after ms:', resolvedAt);
  console.log('Relevant logs:', logs.filter(l => l.includes('hol-capability') || l.includes('timed out')));
  await browser.close();
})();
