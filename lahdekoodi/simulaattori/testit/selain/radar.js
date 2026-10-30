const { chromium } = require('playwright');
const SIM = process.env.SIM_URL || 'http://127.0.0.1:8154/simulaattori.html', AIN = process.env.AINEISTO_URL || 'http://127.0.0.1:8144/', OUT = process.env.OUT || require('path').join(__dirname, 'kuvat'); require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const shots = [];
  for (const [w, sea] of [['0', 0], ['6', 0], ['14', 0], ['14', -1]]) {
    const p = await (await b.newContext({ viewport: { width: 1300, height: 700 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
    await p.goto(SIM + '?aineisto=' + AIN + '&preserve=1&maisema=oma'); await p.waitForTimeout(600);
    await p.click('#segWxMode button[data-v="oma"]'); await p.click('#segWindSpd button[data-v="' + w + '"]'); if (w !== '0') await p.selectOption('#windDir', '0');
    await p.click('#segDisp button[data-v="radar"]'); await p.click('#startBtn'); await p.waitForTimeout(8000);
    await p.evaluate(s => { __radar.asetaAlue(0.75); __radar.asetaSea(s); }, sea); await p.waitForTimeout(6000);
    const info = await p.evaluate(() => ({ sea: __radar.tila().sea, nappi: document.querySelector('[data-tutka=sea]').textContent }));
    const c = await p.$('#paneR canvas, .tutka-canvas, canvas[data-tutka]');
    const f = OUT + '/radar_' + w + '_' + sea + '.png'; await p.screenshot({ path: f, clip: await (async () => { const bb = await p.evaluate(() => { const el = document.querySelector('[data-tutka=sea]').closest('.tutka-ui'); const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }); return bb; })() });
    console.log(w + ' m/s SEA ' + sea, JSON.stringify(info), errs); await p.close();
  }
  await b.close();
})();
