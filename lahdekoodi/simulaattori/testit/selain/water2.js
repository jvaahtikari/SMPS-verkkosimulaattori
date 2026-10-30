const { chromium } = require('playwright');
const SIM = process.env.SIM_URL || 'http://127.0.0.1:8154/simulaattori.html', AIN = process.env.AINEISTO_URL || 'http://127.0.0.1:8144/', OUT = process.env.OUT || require('path').join(__dirname, 'kuvat'); require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  for (const [w, d] of [['10', '0'], ['14', '0']]) {
    const p = await (await b.newContext({ viewport: { width: 1300, height: 700 } })).newPage();
    await p.goto(SIM + '?aineisto=' + AIN + '&preserve=1&maisema=oma'); await p.waitForTimeout(600);
    await p.click('#segWxMode button[data-v="oma"]'); await p.click('#segWindSpd button[data-v="' + w + '"]'); await p.selectOption('#windDir', d);
    await p.click('#segDisp button[data-v="plot"]'); await p.click('#startBtn'); await p.waitForTimeout(9000);
    await p.evaluate(() => { const S = __sim.S; __view.setFree([S.x + 40, 45, -S.y], [S.x + 40, 0, -S.y - 0.5], 70); }); await p.waitForTimeout(1500);
    await p.screenshot({ path: OUT + '/wtop_' + w + '_' + d + '.png', clip: { x: 300, y: 90, width: 700, height: 320 } });
    await p.close();
  }
  await b.close();
})();
