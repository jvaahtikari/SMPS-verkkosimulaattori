// Miehistötila kolmella välilehdellä (ruorimies, navigoija, kouluttaja): puheyhteydet, kouluttajan häiriöt, merkinnät ja tauko (testiversio, 30.10.2026).
// Mikrofonina Chromiumin valelaite, joten testi ei tarvitse oikeaa mikrofonia.
const { chromium } = require('playwright');
const SIM = process.env.SIM_URL || 'http://127.0.0.1:8154/simulaattori.html', AIN = process.env.AINEISTO_URL || 'http://127.0.0.1:8144/', OUT = process.env.OUT || require('path').join(__dirname, 'kuvat'); require('fs').mkdirSync(OUT, { recursive: true });
const URL = SIM + '?aineisto=' + AIN + '&preserve=1&maisema=oma';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
  const c = await b.newContext({ viewport: { width: 1300, height: 700 }, permissions: ['microphone'] });
  const A = await c.newPage(), B = await c.newPage(), K = await c.newPage(), errs = [];
  [['ruori', A], ['navi', B], ['koul', K]].forEach(([n, p]) => p.on('pageerror', e => errs.push(n + ' ' + e)));
  for (const p of [A, B, K]) await p.goto(URL);
  await A.waitForTimeout(800);
  await A.click('#segCrew button[data-v="helm"]'); await A.waitForTimeout(300);
  const code = await A.textContent('#crewCode');
  await B.click('#segCrew button[data-v="nav"]'); await B.fill('#crewIn', code); await B.click('#crewJoin');
  await K.click('#segCrew button[data-v="koul"]'); await K.fill('#crewIn', code); await K.click('#crewJoin');
  await A.waitForTimeout(6000);
  const voice = p => p.evaluate(() => __sim.puhe ? __sim.puhe.status() : null);
  console.log('puhe ennen ajoa', JSON.stringify({ ruori: (await voice(A)).peers, navi: (await voice(B)).peers, koul: (await voice(K)).peers }));
  console.log('aloitusnäytön tila', await K.textContent('#crewVoiceSt'));
  await A.click('#startBtn');
  await A.waitForTimeout(12000);
  const mode = p => p.evaluate(() => __sim.mode);
  console.log('tilat', await mode(A), await mode(B), await mode(K));
  // kouluttaja: tutkan kohina (hiljaa) ja plotteri pimeä (ilmoitettuna)
  await K.click('#koulFaults button[data-k="kohina"]');
  await K.check('#koulIlm'); await K.click('#koulFaults button[data-k="plotteri"]');
  await K.click('#koulMarks button[data-v="huomio"]');
  await A.waitForTimeout(1500);
  const fz = p => p.evaluate(() => ({ hairio: __sim.hairio, plotFault: !document.getElementById('plotFault').hidden, kohina: __sim.radar ? __sim.radar.lue().hairio || null : null, toast: document.getElementById('toast').hidden ? '' : document.getElementById('toast').textContent }));
  console.log('ruori', JSON.stringify(await fz(A))); console.log('navi', JSON.stringify(await fz(B))); console.log('koul', JSON.stringify(await fz(K)));
  // kouluttaja: tauko kaikille
  await K.click('#koulPause'); await A.waitForTimeout(1200);
  console.log('tauko', await A.evaluate(() => __sim.paused), await B.evaluate(() => __sim.paused), await K.textContent('#koulPause'));
  await K.click('#koulPause'); await A.waitForTimeout(800);
  // kouluttajan puhetila
  await K.click('#koulVoice button[data-v="radio"]'); await K.waitForTimeout(500);
  console.log('koulun puhe', JSON.stringify(await voice(K)));
  const st = p => p.evaluate(() => __sim.puhe.stats());
  const k1 = await st(K); await K.waitForTimeout(2000); const k2 = await st(K);
  console.log('kouluttaja radio: lähetetty 2 s aikana', JSON.stringify({ helm: k2.helm.ulos - k1.helm.ulos, nav: k2.nav.ulos - k1.nav.ulos }));
  await K.click('#koulVoice button[data-v="kuuntele"]'); await K.waitForTimeout(1000);
  const k3 = await st(K); await K.waitForTimeout(2000); const k4 = await st(K);
  console.log('kouluttaja kuuntelee: lähetetty', JSON.stringify({ helm: k4.helm.ulos - k3.helm.ulos, nav: k4.nav.ulos - k3.nav.ulos }), 'vastaanotettu', JSON.stringify({ helm: k4.helm.sisaan - k3.helm.sisaan, nav: k4.nav.sisaan - k3.nav.sisaan }));
  await K.click('#koulVoice button[data-v="puhu"]'); await K.check('#koulNavOnly'); await K.waitForTimeout(1000);
  const k5 = await st(K); await K.waitForTimeout(2000); const k6 = await st(K);
  console.log('kouluttaja puhuu vain navigoijalle: lähetetty', JSON.stringify({ helm: k6.helm.ulos - k5.helm.ulos, nav: k6.nav.ulos - k5.nav.ulos }));
  await A.click('#voiceBtn'); await A.waitForTimeout(1000);
  const a1 = await st(A); await A.waitForTimeout(2000); const a2 = await st(A);
  console.log('ruorimies mykistetty: lähetetty', JSON.stringify({ nav: a2.nav.ulos - a1.nav.ulos, koul: a2.koul.ulos - a1.koul.ulos }), await A.textContent('#voiceBtn'));
  console.log('loki (koul)', await K.evaluate(() => [...document.querySelectorAll('#koulLog li')].map(l => l.textContent)));
  console.log('badget', await A.textContent('#crewBadge'), '|', await B.textContent('#crewBadge'), '|', await K.textContent('#crewBadge'));
  await K.screenshot({ path: OUT + '/kouluttaja.png' }); await B.screenshot({ path: OUT + '/kouluttaja_navi.png' });
  // purku
  await A.evaluate(() => { document.getElementById('mAbort').click(); }); await A.waitForTimeout(2500);
  console.log('purku', await mode(A), await mode(B), await mode(K));
  console.log('purun loki (navi)', await B.evaluate(() => [...document.querySelectorAll('#dbCmds td:nth-child(2)')].map(t => t.textContent).filter(t => /Kouluttaja/.test(t))));
  console.log('virheet', errs); await b.close();
})();
