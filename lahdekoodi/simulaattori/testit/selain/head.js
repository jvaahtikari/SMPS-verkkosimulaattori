const { chromium } = require('playwright');
const SIM = process.env.SIM_URL || 'http://127.0.0.1:8154/simulaattori.html', AIN = process.env.AINEISTO_URL || 'http://127.0.0.1:8144/', OUT = process.env.OUT || require('path').join(__dirname, 'kuvat'); require('fs').mkdirSync(OUT, { recursive: true });
const STUB = require('fs').readFileSync(__dirname + '/overlap.js', 'utf8').match(/const STUB = `([^`]*)`/)[1];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  for (const mode of ['oma', 'google']) {
    const c = await b.newContext({ viewport: { width: 1100, height: 620 } }); await c.route('https://maps.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: STUB }));
    const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
    await p.addInitScript(m => { localStorage.setItem('sim.googleKey', 'TESTI'); localStorage.setItem('sim.maisema', m === 'google' ? 'google' : 'own'); }, mode);
    await p.goto(SIM + '?aineisto=' + AIN + '&preserve=1'); await p.waitForTimeout(600);
    await p.click('#segWxMode button[data-v="oma"]'); await p.click('#segWindSpd button[data-v="14"]'); await p.selectOption('#windDir', '180');
    await p.click('#segDisp button[data-v="plot"]'); await p.click('#startBtn'); await p.waitForTimeout(9000);
    await p.evaluate(() => Liike.setFree(__sim.S, true)); await p.waitForTimeout(8000);
    const out = [];
    for (let i = 0; i < 6; i++) {
      await p.waitForTimeout(450);
      out.push(await p.evaluate(() => { const v = __view, w = __sim.S.wave || {}, ct = v.camTilt(), cam = v.camera.getWorldPosition(new THREE.Vector3()), eye = v.rig.localToWorld(new THREE.Vector3(v.settings.eyeX - v.settings.pivotX, 2.72, v.settings.eyeY)); const el = __sim.g3 && __sim.g3.element(); return { veneKall: +(w.roll || 0).toFixed(1), kameraKall: +ct.rollDeg.toFixed(1), veneNyok: +(w.pitch || 0).toFixed(1), kameraNyok: +ct.pitchDeg.toFixed(1), silmaEro_m: +cam.distanceTo(eye).toFixed(2), ext: __sim.ext, css: el ? el.style.transform : '' }; }));
    }
    console.log(mode); out.forEach(o => console.log(' ', JSON.stringify(o)));
    await p.screenshot({ path: OUT + '/head_' + mode + '.png', clip: { x: 0, y: 80, width: 1100, height: 330 } });
    console.log(' virheet', errs); await c.close();
  }
  await b.close();
})();
