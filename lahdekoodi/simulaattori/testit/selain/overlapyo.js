const { chromium, devices } = require('playwright');
const SIM = process.env.SIM_URL || 'http://127.0.0.1:8154/simulaattori.html', AIN = process.env.AINEISTO_URL || 'http://127.0.0.1:8144/', OUT = process.env.OUT || require('path').join(__dirname, 'kuvat'); require('fs').mkdirSync(OUT, { recursive: true });
const fs = require('fs');
const ARGS = ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'];
// Googlen kirjaston tynkä: kartta "latautuu" eikä koskaan valmistu (merkissä tila + Oma näkymä -nappi)
const STUB = `(function(){var cb=new URL(document.currentScript.src).searchParams.get('callback');class M extends HTMLElement{constructor(o){super();Object.assign(this,o||{});}}customElements.define('gmp-map-3d-stub',M);window.google={maps:{importLibrary:function(){return Promise.resolve({Map3DElement:M});}}};setTimeout(function(){window[cb]();},50);})();`;
const DEV = [
  ['iphone_pysty', { ...devices['iPhone 14'] }], ['iphone_vaaka', { ...devices['iPhone 14 landscape'] }],
  ['ipad_pysty', { ...devices['iPad Pro 11'] }], ['ipad_vaaka', { ...devices['iPad Pro 11 landscape'] }],
  ['pc_1280x720', { viewport: { width: 1280, height: 720 } }], ['pc_1500x680', { viewport: { width: 1500, height: 680 } }], ['pc_1920x1080', { viewport: { width: 1920, height: 1080 } }]
];
const CHECK = `(() => {
  const sel = ['#bar > *:not([hidden])', '.hud', '#g3dBadge button', '.sn-panel', '.sn-tools', '#zoomBox', '.plot-info .ro', '.hud-scale', '.tutka-ui button', '#g3dNote', '#v3compass', '#cmd', '.pane.small', '#groundBanner', '#toast'];
  const vis = e => { if (!e || e.closest('[hidden]')) return false; const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false; const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2; };
  const els = []; sel.forEach(s => document.querySelectorAll(s).forEach(e => { if (vis(e) && !els.includes(e)) els.push(e); }));
  const name = e => (e.id ? '#' + e.id : e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\\s+/).join('.') : e.tagName) + (e.getAttribute('data-tutka') ? '[' + e.getAttribute('data-tutka') + ']' : '') + (e.textContent && e.textContent.trim().length < 16 ? ' "' + e.textContent.trim() + '"' : '');
  const pane = e => { const p = e.closest('.pane'); return p ? p.id : 'game'; };
  const out = [];
  for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
    const a = els[i], b = els[j]; if (a.contains(b) || b.contains(a)) continue;
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
    if (w > 1 && h > 1) {
      // pieni ikkuna peittää päänäkymän päällä: vain päänäkymän ohjaimet ovat ongelma, ei ruutujen omat taustat
      if ((a.classList.contains('pane') && a.classList.contains('small')) || (b.classList.contains('pane') && b.classList.contains('small'))) { const o = a.classList.contains('pane') ? b : a; if (pane(o) === (a.classList.contains('pane') ? a.id : b.id)) continue; }
      out.push(name(a) + ' (' + pane(a) + ') × ' + name(b) + ' (' + pane(b) + ') ' + Math.round(w) + '×' + Math.round(h));
    }
  }
  return out;
})()`;
(async () => {
  const b = await chromium.launch({ args: ARGS }); const report = {};
  for (const [dn, ctx] of DEV) for (const disp of ['plot', 'radar', 'both']) for (const g of ['oma', 'google']) {
    const c = await b.newContext(ctx); await c.route('https://maps.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: STUB }));
    const p = await c.newPage();
    await p.addInitScript((g) => { localStorage.setItem('sim.googleKey', 'TESTI'); localStorage.setItem('sim.maisema', g === 'google' ? 'google' : 'own'); }, g);
    await p.goto(SIM + '?aineisto=' + AIN + '&preserve=1'); await p.waitForTimeout(600);
    await p.click('#segDisp button[data-v="' + disp + '"]'); await p.fill('#clockIn','22:00'); await p.dispatchEvent('#clockIn','input'); await p.click('#startBtn'); await p.waitForTimeout(7500); await p.evaluate(() => { const b = document.getElementById('spotBtn'); if (b && !document.getElementById('spotBox').hidden) b.click(); });
    for (const main of ['oletus', 'vaihdettu']) {
      if (main === 'vaihdettu') { const sw = await p.$('#swapBtn:not([hidden])'); if (!sw) continue; await p.evaluate(() => document.getElementById('swapBtn').click()); await p.waitForTimeout(900); }
      const key = dn + ' / ' + disp + ' / ' + g + ' / ' + main;
      const o = await p.evaluate(CHECK); if (o.length) report[key] = o;
      if (o.length) await p.screenshot({ path: OUT + '/ov/' + key.replace(/[ \/]+/g, '_') + '.png' });
    }
    await c.close();
  }
  fs.writeFileSync(OUT + '/ov/raportti.json', JSON.stringify(report, null, 1));
  const n = Object.keys(report).length; console.log('tilanteita, joissa päällekkäisyyksiä:', n);
  const uniq = {}; Object.entries(report).forEach(([k, v]) => v.forEach(x => { const kk = x.replace(/ \\d+×\\d+$/, ''); (uniq[kk] = uniq[kk] || []).push(k); }));
  Object.entries(uniq).forEach(([k, v]) => console.log(v.length + '× ' + k + '   esim. ' + v[0]));
  await b.close();
})();
