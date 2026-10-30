const { chromium, devices } = require('playwright');
const SIM = process.env.SIM_URL || 'http://127.0.0.1:8154/simulaattori.html', AIN = process.env.AINEISTO_URL || 'http://127.0.0.1:8144/', OUT = process.env.OUT || require('path').join(__dirname, 'kuvat'); require('fs').mkdirSync(OUT, { recursive: true });
const DEV = [['ipad11_pysty', devices['iPad Pro 11']], ['ipad11_vaaka', devices['iPad Pro 11 landscape']], ['ipad_mini', devices['iPad Mini']], ['iphone_pysty', devices['iPhone 14']], ['iphone_vaaka', devices['iPhone 14 landscape']], ['pc', { viewport: { width: 1280, height: 720 } }], ['pc_iso', { viewport: { width: 1920, height: 1080 } }]];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  for (const [nm, d] of DEV) for (const disp of ['plot', 'both']) {
    const p = await (await b.newContext({ ...d })).newPage();
    await p.goto(SIM + '?aineisto=' + AIN + '&preserve=1&maisema=oma'); await p.waitForTimeout(600);
    await p.click('#segDisp button[data-v="' + disp + '"]'); await p.click('#startBtn'); await p.waitForTimeout(7000);
    // suuntima päälle, jotta työkalukenttä näkyy
    await p.evaluate(() => { __pl.setEV(true); __pl.setEBL(340); __pl.setVRM(0.6); });
    for (const sw of [false, true]) {
      if (sw) { const s = await p.$('#swapBtn:not([hidden])'); if (!s) continue; await p.evaluate(() => document.getElementById('swapBtn').click()); await p.waitForTimeout(900); }
      await p.waitForTimeout(600);
      const r = await p.evaluate(() => {
        const P = document.querySelector('.sn-panel'); if (!P || P.hidden || !P.offsetWidth) return 'ei palstaa';
        const pr = P.getBoundingClientRect(), bad = [];
        P.querySelectorAll('b,span,i').forEach(e => { if (!e.offsetWidth) return; const r = e.getBoundingClientRect(); if (r.left < pr.left + 1 || r.right > pr.right + 0.5 || r.bottom > pr.bottom + 0.5 || r.top < pr.top) bad.push((e.dataset.k || e.textContent).slice(0, 10) + ' ' + Math.round(r.left - pr.left) + '/' + Math.round(pr.bottom - r.bottom)); });
        return Math.round(pr.width) + 'x' + Math.round(pr.height) + ' ' + P.className + ' ' + (bad.length ? 'YLI: ' + bad.join(', ') : 'ok');
      });
      console.log(nm, disp, sw ? 'vaihdettu' : '', r);
      if (nm === 'ipad11_pysty' && disp === 'both' && !sw) await p.screenshot({ path: OUT + '/snp.png' });
    }
    await p.close();
  }
  await b.close();
})();
