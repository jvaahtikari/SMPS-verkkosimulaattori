const { chromium } = require('playwright');
const SIM = process.env.SIM_URL || 'http://127.0.0.1:8154/simulaattori.html', AIN = process.env.AINEISTO_URL || 'http://127.0.0.1:8144/', OUT = process.env.OUT || require('path').join(__dirname, 'kuvat'); require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] }); const p = await (await b.newContext({ viewport: { width: 1300, height: 760 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(SIM + '?aineisto=' + AIN + '&preserve=1&maisema=oma&ff=5'); await p.waitForTimeout(700);
  await p.click('#segWindSpd button[data-v="10"]'); await p.selectOption('#windDir', '0');
  console.log('vihje:', await p.textContent('#windHint'));
  await p.locator('#lblWind').scrollIntoViewIfNeeded(); await p.screenshot({ path: OUT + '/wind_start.png' });
  await p.click('#segDisp button[data-v="both"]'); await p.click('#startBtn'); await p.waitForTimeout(7000);
  const st = () => p.evaluate(() => { const S = __sim.S; return { hdg: +Liike.trueHdg(S).toFixed(1), cog: +Liike.cogTrue(S).toFixed(1), stw: +(S.v / Liike.KN).toFixed(2), vs: +(S.vs / Liike.KN).toFixed(2), sog: +(Liike.sog(S) / Liike.KN).toFixed(2), nyt: document.querySelector('#cmd .now').textContent.replace(/\s+/g, ' '), plotCOG: document.querySelector('.sn-panel [data-k=cog]').textContent }; });
  await p.waitForTimeout(6000); console.log('paikallaan', JSON.stringify(await st()));
  await p.evaluate(() => { const x = [...document.querySelectorAll('#cmd button')].find(b => b.textContent.trim() === '6'); x.click(); }); await p.waitForTimeout(8000);
  console.log('6 kn', JSON.stringify(await st()));
  await p.screenshot({ path: OUT + '/wind_run.png' });
  console.log(errs); await b.close();
})();
