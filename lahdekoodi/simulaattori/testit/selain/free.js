const { chromium, devices } = require('playwright');
const SIM = process.env.SIM_URL || 'http://127.0.0.1:8154/simulaattori.html', AIN = process.env.AINEISTO_URL || 'http://127.0.0.1:8144/', OUT = process.env.OUT || require('path').join(__dirname, 'kuvat'); require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ ...devices['iPhone 14'] })).newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(SIM + '?aineisto=' + AIN + '&preserve=1&maisema=oma&ff=5'); await p.waitForTimeout(600);
  await p.click('#segWindSpd button[data-v="10"]'); await p.click('#segDisp button[data-v="plot"]'); await p.click('#startBtn'); await p.waitForTimeout(7000);
  const st = () => p.evaluate(() => { const S = __sim.S; return { x: S.x, y: S.y, hdg: +Liike.trueHdg(S).toFixed(0), sog: +(Liike.sog(S) / Liike.KN).toFixed(2), kasky: document.querySelector('#cmd .status div').textContent.replace(/\s+/g, ' ').trim(), nyt: document.getElementById('nowWind').textContent, nappi: document.getElementById('bFree').textContent, plotSOG: document.querySelector('.sn-panel [data-k=sog]').textContent }; });
  const a = await st(); await p.waitForTimeout(6000); const b1 = await st();
  console.log('kytketty 30 s (sim):', 'siirtymä', Math.hypot(b1.x - a.x, b1.y - a.y).toFixed(1), 'm', JSON.stringify({ ...b1, x: undefined, y: undefined }));
  await p.click('#bFree'); await p.waitForTimeout(12000); const c = await st();
  console.log('vapaa 60 s (sim):', 'siirtymä', Math.hypot(c.x - b1.x, c.y - b1.y).toFixed(1), 'm', JSON.stringify({ ...c, x: undefined, y: undefined }));
  await p.screenshot({ path: OUT + '/free.png' });
  await p.click('#bFree'); await p.waitForTimeout(6000); const d = await st(); await p.waitForTimeout(6000); const e = await st();
  console.log('kytke uudelleen:', 'siirtymä 30 s', Math.hypot(e.x - d.x, e.y - d.y).toFixed(1), 'm', JSON.stringify({ ...e, x: undefined, y: undefined }));
  console.log('loki:', await p.evaluate(() => __sim.S.cmdLog.filter(c => /vapaa|kytke/.test(c.kind)).map(c => Harjoitus.cmdText(c))), errs);
  await b.close();
})();
