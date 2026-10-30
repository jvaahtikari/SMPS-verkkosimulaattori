const { chromium } = require('playwright');
const SIM = process.env.SIM_URL || 'http://127.0.0.1:8154/simulaattori.html', AIN = process.env.AINEISTO_URL || 'http://127.0.0.1:8144/', OUT = process.env.OUT || require('path').join(__dirname, 'kuvat'); require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  for (const [w, wx] of [['6', 'puoli'], ['10', 'puoli'], ['14', 'puoli']]) {
    const p = await (await b.newContext({ viewport: { width: 1300, height: 700 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', x => { if (/shader|WebGL|THREE/i.test(x.text()) && x.type() !== 'log') errs.push(x.text().slice(0, 600)); });
    await p.goto(SIM + '?aineisto=' + AIN + '&preserve=1&maisema=oma'); await p.waitForTimeout(600);
    await p.click('#segWxMode button[data-v="oma"]'); await p.click('#segWeather button[data-v="' + wx + '"]'); await p.click('#segWindSpd button[data-v="' + w + '"]'); if (w !== '0') await p.selectOption('#windDir', '270');
    await p.click('#segDisp button[data-v="plot"]'); await p.click('#startBtn'); await p.waitForTimeout(9000);
    await p.screenshot({ path: OUT + '/w3_' + w + '.png', clip: { x: 0, y: 80, width: 1300, height: 330 } });
    console.log(w, wx, errs); await p.close();
  }
  await b.close();
})();
