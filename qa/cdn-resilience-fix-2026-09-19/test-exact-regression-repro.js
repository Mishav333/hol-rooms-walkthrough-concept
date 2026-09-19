const { chromium, devices } = require('/tmp/hol-final-check/node_modules/playwright');

(async () => {
  const browser = await chromium.launch();
  const iPhone = devices['iPhone 13'];
  const context = await browser.newContext({ ...iPhone });
  const page = await context.newPage();

  // Mock GPU renderer to a real capable Apple GPU (sandbox has no HW GPU)
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

  // EXACT original regression repro: block ONLY the detect-gpu CDN import,
  // three.js/gsap/lenis still load fine.
  await page.route('**://unpkg.com/@pmndrs/detect-gpu**', route => route.abort('failed'));

  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const logs = [];
  page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));

  await page.goto('http://localhost:8931/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  const result = await page.evaluate(() => ({
    cineActive: document.body.classList.contains('cine-active'),
    fctActive: document.body.classList.contains('fct-active'),
    hasCanvas: !!document.querySelector('canvas'),
  }));

  console.log('=== EXACT ORIGINAL REGRESSION REPRO (detect-gpu CDN only blocked, real capable GPU) ===');
  console.log('Page errors (uncaught):', JSON.stringify(errors));
  console.log('Result:', JSON.stringify(result, null, 2));
  console.log('Relevant console:', logs.filter(l => /capability|hol-/.test(l)).join('\n'));
  console.log('EXPECTATION: cineActive:true (fail-open, preferred per acceptance criteria) =>',
    result.cineActive ? 'PASS' : 'FAIL');

  await browser.close();
})();
