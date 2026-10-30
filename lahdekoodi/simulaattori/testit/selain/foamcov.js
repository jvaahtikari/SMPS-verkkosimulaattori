const { chromium } = require('playwright');
const SIM = process.env.SIM_URL || 'http://127.0.0.1:8154/simulaattori.html', AIN = process.env.AINEISTO_URL || 'http://127.0.0.1:8144/', OUT = process.env.OUT || require('path').join(__dirname, 'kuvat'); require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  for (const w of ['6', '10', '14']) {
    const p = await (await b.newContext({ viewport: { width: 1300, height: 700 } })).newPage();
    await p.goto(SIM + '?aineisto=' + AIN + '&preserve=1&maisema=oma'); await p.waitForTimeout(600);
    await p.click('#segWxMode button[data-v="oma"]'); await p.click('#segWeather button[data-v="puoli"]'); await p.click('#segWindSpd button[data-v="' + w + '"]'); await p.selectOption('#windDir', '270');
    await p.click('#segDisp button[data-v="plot"]'); await p.click('#startBtn'); await p.waitForTimeout(9000);
    // ylhäältä: vaahdon osuus kuvan valkoisista pikseleistä
    await p.evaluate(() => { const S = __sim.S; __view.setFree([S.x + 60, 40, -S.y], [S.x + 60, 0, -S.y - 0.5], 60); }); await p.waitForTimeout(1200);
    await p.screenshot({ path: OUT + '/fc_' + w + '.png', clip: { x: 400, y: 120, width: 500, height: 250 } });
    await p.evaluate(() => __view.clearFree()); await p.waitForTimeout(800);
    await p.screenshot({ path: OUT + '/w3_' + w + '.png', clip: { x: 0, y: 80, width: 1300, height: 330 } });
    await p.close();
  }
  await b.close();
})();
