// Miehistötila kolmella välilehdellä (ruorimies, navigoija, kouluttaja): puheyhteydet, radiolähetys, kouluttajan häiriöt, merkinnät ja tauko (testiversio).
// Mikrofonina Chromiumin valelaite, joten testi ei tarvitse oikeaa mikrofonia. Ajona vapaa ajo, kaikilla molemmat mittarit.
const { chromium } = require('playwright');
const SIM = process.env.SIM_URL || 'http://127.0.0.1:8154/simulaattori.html', AIN = process.env.AINEISTO_URL || 'http://127.0.0.1:8144/', OUT = process.env.OUT || require('path').join(__dirname, 'kuvat'); require('fs').mkdirSync(OUT, { recursive: true });
const URL = SIM + '?aineisto=' + AIN + '&preserve=1&maisema=oma&naytot=both';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
  const c = await b.newContext({ viewport: { width: 1600, height: 1150 }, permissions: ['microphone'] });
  const A = await c.newPage(), B = await c.newPage(), K = await c.newPage(), errs = [];
  [['ruori', A], ['navi', B], ['koul', K]].forEach(([n, p]) => p.on('pageerror', e => errs.push(n + ' ' + e)));
  for (const p of [A, B, K]) await p.goto(URL);
  await A.waitForTimeout(800);
  await A.click('#segEx button[data-v="free"]');
  await A.click('#segCrew button[data-v="helm"]'); await A.waitForTimeout(300);
  const code = await A.textContent('#crewCode');
  await B.click('#segCrew button[data-v="nav"]'); await B.fill('#crewIn', code); await B.click('#crewJoin');
  await K.click('#segCrew button[data-v="koul"]'); await K.fill('#crewIn', code); await K.click('#crewJoin');
  await A.waitForTimeout(6000);
  const voice = p => p.evaluate(() => __sim.puhe ? __sim.puhe.status() : null);
  console.log('puhe ennen ajoa', JSON.stringify({ ruori: (await voice(A)).peers, navi: (await voice(B)).peers, koul: (await voice(K)).peers }));
  await A.click('#startBtn');
  await A.waitForTimeout(14000);
  const mode = p => p.evaluate(() => __sim.mode);
  console.log('tilat', await mode(A), await mode(B), await mode(K));
  await K.screenshot({ path: OUT + '/koul_0.png' });
  // kouluttaja: plotteri pimeä (hiljainen), tutkan kohina (näkyy miehistölle), suuntavirhe +5 +1 = +6°
  await K.click('#koulFaults button[data-k="plotteri"]');
  await K.check('#koulIlm'); await K.click('#koulFaults button[data-k="kohina"]');
  await K.click('#koulSuunta button[data-d="5"]'); await K.click('#koulSuunta button[data-d="1"]');
  await K.click('#koulMarks button[data-v="huomio"]');
  await A.waitForTimeout(2500);
  const fz = p => p.evaluate(() => ({ hairio: __sim.hairio, plotFault: !document.getElementById('plotFault').hidden, tutka: __sim.radar ? __sim.radar.lue().hairio : null,
    tagP: document.getElementById('faultTagP').hidden ? '' : document.getElementById('faultTagP').textContent, tagR: document.getElementById('faultTagR').hidden ? '' : document.getElementById('faultTagR').textContent,
    v3: getComputedStyle(document.getElementById('pane3d')).display + ' ' + document.getElementById('pane3d').getBoundingClientRect().width }));
  console.log('ruori', JSON.stringify(await fz(A))); console.log('navi', JSON.stringify(await fz(B))); console.log('koul', JSON.stringify(await fz(K)));
  await K.screenshot({ path: OUT + '/koul_1.png' }); await B.screenshot({ path: OUT + '/koul_navi_1.png' });
  // tauko kaikille
  await K.click('#koulPause'); await A.waitForTimeout(1200);
  console.log('tauko', await A.evaluate(() => __sim.paused), await B.evaluate(() => __sim.paused), await K.textContent('#koulPause'));
  await K.click('#koulPause'); await A.waitForTimeout(800);
  // äänen reititys: tavut 2 s aikana
  const st = p => p.evaluate(() => __sim.puhe.stats());
  async function bytes(p, ms) { const a = await st(p); await p.waitForTimeout(ms || 2000); const z = await st(p); const o = {}; for (const r in z) o[r] = { ulos: z[r].ulos - a[r].ulos, sisaan: z[r].sisaan - a[r].sisaan }; return o; }
  console.log('kouluttaja kuuntelee', JSON.stringify(await bytes(K)));
  // kouluttajan radiolähetys napista (pidä pohjassa)
  const box = await K.locator('#koulVhf').boundingBox();
  await K.mouse.move(box.x + 20, box.y + 10); await K.mouse.down(); await K.waitForTimeout(700);
  console.log('ruorimies näkee', await A.evaluate(() => document.getElementById('vhfInd').hidden ? '' : document.getElementById('vhfInd').textContent));
  console.log('kouluttaja lähettää radiolla', JSON.stringify(await bytes(K)));
  await K.mouse.up(); await K.waitForTimeout(700);
  console.log('lähetys loppui, ruorimies näkee', JSON.stringify(await A.evaluate(() => document.getElementById('vhfInd').hidden ? '' : document.getElementById('vhfInd').textContent)));
  // navigoija mykistää ja vastaa radiolla T-näppäimellä
  await B.click('#voiceBtn'); await B.waitForTimeout(800);
  console.log('navigoija mykistetty', JSON.stringify(await bytes(B)));
  await B.keyboard.down('t'); await B.waitForTimeout(700);
  console.log('kouluttaja näkee', await K.evaluate(() => document.getElementById('vhfInd').hidden ? '' : document.getElementById('vhfInd').textContent));
  console.log('navigoija lähettää radiolla', JSON.stringify(await bytes(B)));
  await B.keyboard.up('t'); await B.waitForTimeout(500);
  console.log('loki (koul)', await K.evaluate(() => [...document.querySelectorAll('#koulLog li')].map(l => l.textContent)));
  // häiriöt pois: kaikki näkymät palautuvat
  await K.click('#koulFaults button[data-k="plotteri"]'); await K.click('#koulFaults button[data-k="kohina"]'); await K.click('#koulSuunta button[data-d="0"]'); await A.waitForTimeout(2500);
  console.log('häiriöt pois, navi', JSON.stringify(await fz(B)));
  await K.screenshot({ path: OUT + '/koul_2.png' });
  await A.evaluate(() => { document.getElementById('mAbort').click(); }); await A.waitForTimeout(2500);
  console.log('purku', await mode(A), await mode(B), await mode(K));
  console.log('purun loki (navi)', await B.evaluate(() => [...document.querySelectorAll('#dbCmds td:nth-child(2)')].map(t => t.textContent).filter(t => /Kouluttaja/.test(t))));
  console.log('virheet', errs); await b.close();
})();
