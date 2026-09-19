import { chromium } from '/tmp/hol-final-check/node_modules/playwright/index.mjs';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors = [];
page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + err.message));

await page.goto('http://localhost:8791/index.html?forcecine=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const result = await page.evaluate(() => ({
  cineActive: document.body.classList.contains('cine-active'),
  devBadgeVisible: (() => {
    const b = document.querySelector('.dev-badge');
    return b && getComputedStyle(b).display !== 'none';
  })(),
  devBadgeText: document.querySelector('.dev-badge')?.textContent,
}));
console.log(JSON.stringify(result, null, 2));
console.log('console errors:', consoleErrors);
await browser.close();
