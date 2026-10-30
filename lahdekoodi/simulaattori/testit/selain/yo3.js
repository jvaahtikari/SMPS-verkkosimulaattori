const { chromium } = require('playwright');
const SIM = process.env.SIM_URL || 'http://127.0.0.1:8154/simulaattori.html', AIN = process.env.AINEISTO_URL || 'http://127.0.0.1:8144/', OUT = process.env.OUT || require('path').join(__dirname, 'kuvat'); require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 1500, height: 680 } })).newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (!/404|Failed to load/.test(m.text())) errs.push(m.text().slice(0, 200)); });
  await p.goto(SIM + '?aineisto=' + AIN + '&preserve=1&maisema=oma'); await p.waitForTimeout(800);
  await p.fill('#clockIn', '22:00'); await p.dispatchEvent('#clockIn', 'input');
  await p.click('#segDisp button[data-v="plot"]'); await p.click('#startBtn'); await p.waitForTimeout(8000);
  await p.evaluate(() => {
    const S = __sim.S, h = S.hdg * Math.PI / 180, at = (d, s) => ({ x: S.x + Math.sin(h) * d + Math.cos(h) * s, y: S.y + Math.cos(h) * d - Math.sin(h) * s });
    const R = [[300, 0, [1, .16, .1]], [1500, -40, [.15, 1, .35]], [2600, 60, [1, .85, .12]], [4000, 0, [1, 1, 1]], [800, 500, [1, .16, .1]]].map(([d, s, c]) => Object.assign(at(d, s), { z: 1.75, rgb: c }));
    __view.aids.heijastimet = () => R;
  });
  console.log('napit:', await p.evaluate(() => [...document.querySelectorAll('#spotBox button')].map(b => b.textContent + (b.hidden ? '(piilo)' : '') + ':' + b.getAttribute('aria-pressed'))));
  await p.screenshot({ path: OUT + '/yo3a.png' });
  await p.click('#spotBtn'); await p.waitForTimeout(300); await p.click('#spot2Btn'); await p.waitForTimeout(300);
  await p.keyboard.press('k'); await p.waitForTimeout(1200);
  console.log('tila:', JSON.stringify(await p.evaluate(() => __sim.valot.tila())), await p.textContent('#spotLbl'));
  await p.screenshot({ path: OUT + '/yo3b.png' });
  console.log('virheet:', errs, await p.evaluate(() => __view.renderer.getContext().isContextLost())); await b.close();
})();
