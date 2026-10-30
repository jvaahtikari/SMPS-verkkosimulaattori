const { chromium } = require('playwright');
const SIM = process.env.SIM_URL || 'http://127.0.0.1:8154/simulaattori.html', AIN = process.env.AINEISTO_URL || 'http://127.0.0.1:8144/', OUT = process.env.OUT || require('path').join(__dirname, 'kuvat'); require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const c = await b.newContext({ viewport: { width: 1300, height: 760 } }); let calls = 0;
  await c.route('https://api.open-meteo.com/**', r => { calls++; r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ current: { time: '2026-10-29T14:15', interval: 900, wind_speed_10m: 7.4, wind_direction_10m: 312, wind_gusts_10m: 12.8, cloud_cover: 88, weather_code: 61 } }) }); });
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(SIM + '?aineisto=' + AIN + '&preserve=1&maisema=oma'); await p.waitForTimeout(700);
  await p.click('#segWxMode button[data-v="live"]'); await p.waitForTimeout(800);
  console.log('live:', await p.textContent('#liveWx')); console.log('tuulivihje:', await p.textContent('#windHint'), '| sää:', await p.textContent('#segWeather .on'));
  await p.locator('#lblWxMode').scrollIntoViewIfNeeded(); await p.screenshot({ path: OUT + '/live_start.png' });
  await p.click('#segDisp button[data-v="plot"]'); await p.click('#startBtn'); await p.waitForTimeout(9000);
  console.log('ajo:', JSON.stringify(await p.evaluate(() => ({ wind: [__sim.S.windFrom, __sim.S.windSpeed], weather: __sim.S.weather, view: __view.getWind(), vw: __view.weather().weather, aallot: __sim.aallot.tila(), sea: __view.sea(), nyt: document.getElementById('nowWind').textContent }))));
  // virhe: hakua ei saada
  await c.unroute('https://api.open-meteo.com/**'); await c.route('https://api.open-meteo.com/**', r => r.abort());
  const p2 = await c.newPage(); await p2.goto(SIM + '?aineisto=' + AIN + '&preserve=1&maisema=oma'); await p2.waitForTimeout(1500);
  console.log('virhe:', await p2.textContent('#liveWx'));
  console.log('kutsuja', calls, errs); await b.close();
})();
