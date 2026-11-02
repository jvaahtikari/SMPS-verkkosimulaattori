/* Repan käsittelyharjoitus – 2D-testisivu (kasittely.html, malli v0, kalibroimaton).
 *
 * Sivu on pelkkä käyttöliittymä liikemallin (kasittely.js, window.Kasittely) päällä: se ei laske liikettä itse. Näkymä on ylhäältä
 * piirretty canvas, ohjaimina ovat TILLER ja JOYSTICK (vedettävät, jäävät asentoonsa) sekä Rolls-Roycen paneelit englanninkielisine
 * nimineen. Mallin tila on s: s.x (itä, m), s.y (pohjoinen, m), s.hdg (aste, 0 = pohjoinen, myötäpäivään), s.v = u, s.vs = v,
 * s.rate = kääntymisnopeus (°/s). Kaikki toiminnot ovat myös napeilla, koska puhelimessa ei ole näppäimistöä. */
(function () {
  'use strict';
  var K = window.Kasittely;
  var KN = K.KN, SET = K.SETTINGS, RAD = Math.PI / 180;
  var PONTTONI = { x: 0, y: 0, hdg: 0, pituus: 20, leveys: 2.4 };   // kelluva ponttoni, pohjois-eteläsuuntainen
  var JETTI_SKAALA = 2.5 / 15000;                                   // työntönuoli: 15 kN = 2,5 m
  var ENNUSTE_S = 10;                                               // nopeusvektori: 10 s:n ennuste SOG:lla
  var RUUDUKKO_RAJA = 2.2;                                          // tätä pienemmällä zoomilla ruudukko on 25 m (5 m viivat menisivät liian tiheiksi)

  function $(id) { return document.getElementById(id); }
  function raja(v, a, b) { return v < a ? a : v > b ? b : v; }

  // ---- Lukujen muotoilu (suomalainen desimaalipilkku ja oikea miinusmerkki) ----
  function luku(x, d) {
    var r = Number(x.toFixed(d));
    var t = (r === 0 ? 0 : r).toFixed(d);
    return t.replace('-', '−').replace('.', ',');
  }
  function merkki(x, d) { var t = luku(x, d); return (x > 0 && t.charAt(0) !== '−' && Number(x.toFixed(d)) !== 0 ? '+' : '') + t; }
  function aikaTeksti(t) { var m = Math.floor(t / 60), sek = Math.floor(t % 60); return m + ':' + (sek < 10 ? '0' : '') + sek; }
  function suunta3(d) { var n = Math.round(((d % 360) + 360) % 360) % 360; return ('00' + n).slice(-3) + '°'; }
  function aseta(el, teksti) { if (el._t !== teksti) { el.textContent = teksti; el._t = teksti; } }

  // ---- Tila ----
  var s = null;                  // mallin tila (Kasittely.create)
  var este = null;               // ponttoni (tai null vapaassa vedessä)
  var tauko = false, kerroin = 1;
  var tuuli = { from: 0, speed: 0 };
  var nakyma = { k: 8, keula: false };
  var polku = [];                // ajettu jälki [[x, y], ...]
  var pidetty = {};              // näppäinten tila: tillerL, tillerR, fwd, aft, left, right
  var tillerVeto = null, joyVeto = null;   // käynnissä oleva sormiveto
  var lokiPituus = -1, kosketusMaara = 0, viimeisinKn = null;
  var toastAjastin = 0, viestiAjastin = 0;

  // ---------------------------------------------------------------------------------------------
  // Lähtötilanteet
  // ---------------------------------------------------------------------------------------------
  // Siirtää venettä suuntaa (dx, dy) vasten pisteestä (x0, y0), kunnes rungon etäisyys ponttoniin on tavoite
  function sijoitaEtaisyyteen(st, ob, x0, y0, dx, dy, tavoite) {
    var k = tavoite + 8, d, i;
    for (i = 0; i < 8; i++) {
      st.x = x0 - dx * k; st.y = y0 - dy * k;
      d = K.distanceToObstacle(st, ob);
      k += tavoite - d;
    }
  }

  function aloita() {
    var nimi = $('selTilanne').value, st;
    este = null;
    if (nimi === 'lahestyminen') {
      // vene 30 m ponttonista, keula kohti ponttonin länsikylkeä 45° kulmassa, nopeus nolla: vene on ponttonin luoteispuolella ja
      // keulasuunta on 135° (kaakkoon), jolloin ponttoni näkyy alhaalla oikealla eikä jää mittarien alle
      st = K.create({ hdg: 135, mode: 'DOCKING' });
      este = K.addPontoon(st, PONTTONI.x, PONTTONI.y, PONTTONI.hdg, PONTTONI.pituus, PONTTONI.leveys);
      sijoitaEtaisyyteen(st, este, -PONTTONI.leveys / 2, 0, Math.sin(135 * RAD), Math.cos(135 * RAD), 30);
    } else if (nimi === 'kylki') {
      // vene kiinni ponttonin länsikyljessä, keula pohjoiseen, etäisyys fenderiin 5 cm
      st = K.create({ hdg: 0, mode: 'DOCKING' });
      este = K.addPontoon(st, PONTTONI.x, PONTTONI.y, PONTTONI.hdg, PONTTONI.pituus, PONTTONI.leveys);
      st.x = -3.5; st.y = -2;
      for (var i = 0; i < 6; i++) st.x += K.distanceToObstacle(st, este) - 0.05;
    } else {
      st = K.create({ hdg: 0, mode: 'DOCKING' });
    }
    K.setWind(st, tuuli.from, tuuli.speed);
    st.speedFactor = kerroin;
    st.tiller = 0; st.joyX = 0; st.joyY = 0;
    s = st;
    polku = []; lokiPituus = -1; kosketusMaara = 0; viimeisinKn = null;
    // oletuszoom: lähestymisessä sekä vene että ponttonin keskikohta mahtuvat näkymään, muuten noin 40 m levyinen alue
    var m = Math.min(W, H) / 2;
    var ala = este ? Math.max(Math.abs(este.x - st.x), Math.abs(este.y - st.y) + 18) + 4 : 20;
    nakyma.k = raja(m / (nimi === 'kylki' ? 15 : Math.max(ala, 15)), 2, 60);
    synkronoiPaneelit();
    piilotaViesti();
  }

  // ---------------------------------------------------------------------------------------------
  // Canvas
  // ---------------------------------------------------------------------------------------------
  var cv = $('kanvas'), cx = cv.getContext('2d'), W = 300, H = 300, dpr = 1;
  function mitoita() {
    var r = cv.parentNode.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  }

  // Rungon koordinaatit (xb eteen painopisteestä, yb oikealle) maailmaan
  function rungosta(xb, yb) {
    var h = s.hdg * RAD, sh = Math.sin(h), ch = Math.cos(h);
    return [s.x + sh * xb + ch * yb, s.y + ch * xb - sh * yb];
  }
  function reitti(pts) {
    cx.beginPath();
    for (var i = 0; i < pts.length; i++) { if (i) cx.lineTo(pts[i][0], pts[i][1]); else cx.moveTo(pts[i][0], pts[i][1]); }
    cx.closePath();
  }
  function nuoli(x0, y0, x1, y1, vari, leveysPx, paaPx) {
    var k = nakyma.k, dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy);
    if (l < 1e-6) return;
    var ux = dx / l, uy = dy / l, ph = Math.min(paaPx / k, l * 0.6), lw = leveysPx / k;
    cx.strokeStyle = vari; cx.fillStyle = vari; cx.lineWidth = lw; cx.lineCap = 'round';
    cx.beginPath(); cx.moveTo(x0, y0); cx.lineTo(x1 - ux * ph * 0.7, y1 - uy * ph * 0.7); cx.stroke();
    cx.beginPath(); cx.moveTo(x1, y1);
    cx.lineTo(x1 - ux * ph + -uy * ph * 0.5, y1 - uy * ph + ux * ph * 0.5);
    cx.lineTo(x1 - ux * ph - -uy * ph * 0.5, y1 - uy * ph - ux * ph * 0.5);
    cx.closePath(); cx.fill();
  }

  function piirraRuudukko() {
    var k = nakyma.k, g = k >= RUUDUKKO_RAJA ? 5 : 25, R = Math.hypot(W, H) / 2 / k + g;
    var i0 = Math.ceil((s.x - R) / g), i1 = Math.floor((s.x + R) / g), j0 = Math.ceil((s.y - R) / g), j1 = Math.floor((s.y + R) / g), i, j, v;
    cx.lineWidth = 1 / k;
    for (i = i0; i <= i1; i++) {
      v = i * g; cx.strokeStyle = v % 25 === 0 ? 'rgba(255,255,255,.26)' : 'rgba(255,255,255,.13)';
      cx.beginPath(); cx.moveTo(v, s.y - R); cx.lineTo(v, s.y + R); cx.stroke();
    }
    for (j = j0; j <= j1; j++) {
      v = j * g; cx.strokeStyle = v % 25 === 0 ? 'rgba(255,255,255,.26)' : 'rgba(255,255,255,.13)';
      cx.beginPath(); cx.moveTo(s.x - R, v); cx.lineTo(s.x + R, v); cx.stroke();
    }
  }

  // Kelluva ponttoni fendereineen: harmaa, musta reuna, mustat fenderit pitkillä sivuilla ja päissä
  function piirraPonttoni(ob) {
    var k = nakyma.k, h = ob.hdg * RAD, sh = Math.sin(h), ch = Math.cos(h), L = ob.lengthM / 2, Wd = ob.widthM / 2, xl, sg;
    var lok = function (a, b) { return [ob.x + sh * a + ch * b, ob.y + ch * a - sh * b]; };
    reitti(K.obstaclePolygon(ob));
    cx.fillStyle = '#8f969c'; cx.fill();
    cx.strokeStyle = '#111'; cx.lineWidth = Math.max(2 / k, 0.06); cx.lineJoin = 'round'; cx.stroke();
    // laudoituksen keskiviiva
    cx.strokeStyle = 'rgba(0,0,0,.25)'; cx.lineWidth = 1 / k;
    cx.beginPath(); var a = lok(-L, 0), b = lok(L, 0); cx.moveTo(a[0], a[1]); cx.lineTo(b[0], b[1]); cx.stroke();
    // fenderit: kapeat mustat palkit reunan sisäpuolella, niin että reunan kosketus on fenderin kosketus
    cx.fillStyle = '#0a0a0a';
    for (sg = -1; sg <= 1; sg += 2) {
      for (xl = -L + 1; xl <= L - 0.9; xl += 2) {
        reitti([lok(xl - 0.4, sg * Wd), lok(xl + 0.4, sg * Wd), lok(xl + 0.4, sg * (Wd - 0.2)), lok(xl - 0.4, sg * (Wd - 0.2))]); cx.fill();
      }
    }
    for (sg = -1; sg <= 1; sg += 2) { reitti([lok(sg * L, -0.45), lok(sg * L, 0.45), lok(sg * (L - 0.2), 0.45), lok(sg * (L - 0.2), -0.45)]); cx.fill(); }
  }

  function piirraJalki() {
    if (polku.length < 2) return;
    cx.strokeStyle = 'rgba(255,255,255,.6)'; cx.lineWidth = 1.3 / nakyma.k; cx.lineJoin = 'round';
    cx.beginPath(); cx.moveTo(polku[0][0], polku[0][1]);
    for (var i = 1; i < polku.length; i++) cx.lineTo(polku[i][0], polku[i][1]);
    cx.lineTo(s.x, s.y); cx.stroke();
  }

  // Kansi: rungon ääriviiva sisäänpäin siirrettynä
  function kansiReuna(inset) {
    var o = SET.hullOutline, lcg = SET.lcgFromTransomM, pts = [], i, xb, yb, n = o.length;
    for (i = n - 1; i >= 1; i--) {
      xb = o[i][0] - lcg - (i === n - 1 ? 0.5 : 0) + (i === 1 ? 0.3 : 0); yb = Math.max(0, o[i][1] - inset);
      pts.push(rungosta(xb, yb));
    }
    for (i = 1; i < n; i++) {
      xb = o[i][0] - lcg - (i === n - 1 ? 0.5 : 0) + (i === 1 ? 0.3 : 0); yb = Math.max(0, o[i][1] - inset);
      pts.push(rungosta(xb, -yb));
    }
    return pts;
  }

  function piirraRunko() {
    var k = nakyma.k, P = K.hullPolygon(s);
    // valkoinen runko
    reitti(P); cx.fillStyle = '#ffffff'; cx.fill();
    // kapea punainen raita reunassa (viiva leikataan rungon sisälle, joten näkyvä leveys on puolet)
    cx.save(); reitti(P); cx.clip();
    cx.strokeStyle = '#c62828'; cx.lineWidth = Math.max(0.5, 3.6 / k); cx.lineJoin = 'round'; cx.stroke();
    cx.restore();
    // vaaleanharmaa kansi
    reitti(kansiReuna(0.38)); cx.fillStyle = '#d3d8dc'; cx.fill();
    cx.strokeStyle = 'rgba(0,0,0,.25)'; cx.lineWidth = 1 / k; cx.stroke();
    // ohjaamo: oranssinpunainen suorakaide 5–8,5 m peräpeilistä
    var xa = 5 - SET.lcgFromTransomM, xe = 8.5 - SET.lcgFromTransomM, hw = 1.3;
    reitti([rungosta(xa, -hw), rungosta(xe, -hw), rungosta(xe, hw), rungosta(xa, hw)]);
    cx.fillStyle = '#d4501f'; cx.fill(); cx.strokeStyle = '#6e260d'; cx.lineWidth = Math.max(1.5 / k, 0.05); cx.lineJoin = 'round'; cx.stroke();
    // tuulilasi ohjaamon etureunassa
    reitti([rungosta(xe - 0.55, -hw + 0.15), rungosta(xe - 0.12, -hw + 0.15), rungosta(xe - 0.12, hw - 0.15), rungosta(xe - 0.55, hw - 0.15)]);
    cx.fillStyle = 'rgba(30,58,78,.85)'; cx.fill();
    // ääriviiva
    reitti(P); cx.strokeStyle = '#1b1b1b'; cx.lineWidth = Math.max(1.6 / k, 0.05); cx.lineJoin = 'round'; cx.stroke();
    // painopiste
    var c = rungosta(0, 0), r = 3 / k;
    cx.strokeStyle = 'rgba(0,0,0,.55)'; cx.lineWidth = 1 / k;
    cx.beginPath(); cx.moveTo(c[0] - r, c[1]); cx.lineTo(c[0] + r, c[1]); cx.moveTo(c[0], c[1] - r); cx.lineTo(c[0], c[1] + r); cx.stroke();
    // kosketus: punainen reunus rungon ympärillä
    if (s.inContact) {
      reitti(P); cx.strokeStyle = '#ff2a2a'; cx.lineWidth = Math.max(5 / k, 0.2); cx.stroke();
    }
  }

  // Jettien suuttimet ja työntövektorit perässä: vihreä eteen, punainen taakse
  function piirraJetit() {
    var k = nakyma.k, i, yb, p, f, F, ps, dx, dy, fx, fy, nz, h = s.hdg * RAD, sh = Math.sin(h), ch = Math.cos(h);
    for (i = 0; i < 2; i++) {
      yb = i === 0 ? -SET.jetYM : SET.jetYM;
      p = rungosta(SET.nozzleXFromCgM, yb);
      nz = s.jets[i].nozzle * RAD;
      // suuttimen asento: lyhyt tanko suihkun suuntaan (+ = suihku oikealle)
      var e = rungosta(SET.nozzleXFromCgM - Math.cos(nz) * 0.9, yb + Math.sin(nz) * 0.9);
      cx.strokeStyle = s.jets[i].engaged ? '#222' : '#999'; cx.lineWidth = Math.max(0.22, 3 / k); cx.lineCap = 'round';
      cx.beginPath(); cx.moveTo(p[0], p[1]); cx.lineTo(e[0], e[1]); cx.stroke();
      f = s.forces.jets[i]; fx = f.x; fy = f.y;
      F = Math.hypot(fx, fy);
      if (F < 150) continue;
      dx = sh * fx + ch * fy; dy = ch * fx - sh * fy;      // rungon voima maailmaan
      ps = F * JETTI_SKAALA;
      nuoli(p[0], p[1], p[0] + dx / F * ps, p[1] + dy / F * ps, fx >= 0 ? '#1fbf3f' : '#e53030', 3.5, 11);
    }
  }

  // Nopeusvektori: sininen käyrä painopisteestä, 10 s:n ennuste nykyisillä nopeuksilla u, v ja r (kaartuu käännöksessä, pituus = SOG x 10 s).
  // Lisäksi ohut valkoinen keulaviiva, josta sorron eli COG:n ja keulasuunnan eron näkee. Nuolenpää on käyrän lopussa, viimeisen pätkän suuntaan.
  function piirraNopeus() {
    var k = nakyma.k, sog = K.sog(s), L = sog * ENNUSTE_S;
    // keulaviiva (pituus kuten vektori, vähintään 8 m)
    var hl = Math.max(8, L), h0 = s.hdg * RAD;
    cx.strokeStyle = 'rgba(255,255,255,.55)'; cx.lineWidth = Math.max(0.06, 1.2 / k); cx.setLineDash([0.8, 0.6]);
    cx.beginPath(); cx.moveTo(s.x, s.y); cx.lineTo(s.x + Math.sin(h0) * hl, s.y + Math.cos(h0) * hl); cx.stroke(); cx.setLineDash([]);
    if (L < 0.2) return;
    var n = 20, dt = ENNUSTE_S / n, x = s.x, y = s.y, psi = h0, r = s.rate * RAD, u = s.v, w = s.vs, ce = s.currentE || 0, cn = s.currentN || 0, px, py, i;
    cx.strokeStyle = '#2f8bff'; cx.fillStyle = '#2f8bff'; cx.lineWidth = Math.max(0.08, 2.6 / k); cx.lineCap = 'round'; cx.lineJoin = 'round';
    cx.beginPath(); cx.moveTo(x, y);
    for (i = 0; i < n; i++) {
      var pm = psi + 0.5 * r * dt;
      px = x; py = y;
      x += (u * Math.sin(pm) + w * Math.cos(pm) + ce) * dt;
      y += (u * Math.cos(pm) - w * Math.sin(pm) + cn) * dt;
      psi += r * dt;
      cx.lineTo(x, y);
    }
    cx.stroke();
    // nuolenpää viimeisen pätkän suuntaan, koko pikseleinä
    var dx = x - px, dy = y - py, dl = Math.hypot(dx, dy) || 1, ux = dx / dl, uy = dy / dl, ph = Math.min(9 / k, L * 0.6);
    cx.beginPath(); cx.moveTo(x + ux * ph * 0.3, y + uy * ph * 0.3);
    cx.lineTo(x - ux * ph * 0.7 - uy * ph * 0.5, y - uy * ph * 0.7 + ux * ph * 0.5);
    cx.lineTo(x - ux * ph * 0.7 + uy * ph * 0.5, y - uy * ph * 0.7 - ux * ph * 0.5);
    cx.closePath(); cx.fill();
  }

  function piirraKompassi() {
    var x = W / 2, y = 30, r = 17, h = s.hdg * RAD, a = nakyma.keula ? -h : 0;
    cx.save(); cx.translate(x, y);
    cx.fillStyle = 'rgba(10,22,32,.66)'; cx.beginPath(); cx.arc(0, 0, r + 4, 0, 6.2832); cx.fill();
    cx.rotate(a);
    cx.fillStyle = '#ff5a4d'; cx.beginPath(); cx.moveTo(0, -r); cx.lineTo(5.5, 3); cx.lineTo(0, 0); cx.lineTo(-5.5, 3); cx.closePath(); cx.fill();
    cx.fillStyle = '#e8eef2'; cx.beginPath(); cx.moveTo(0, r); cx.lineTo(4, 3); cx.lineTo(0, 0); cx.lineTo(-4, 3); cx.closePath(); cx.fill();
    cx.restore();
    // N-kirjain kompassin pohjoispuolella
    var nx = x + Math.sin(a) * (r + 10), ny = y - Math.cos(a) * (r + 10);
    cx.font = '700 11px system-ui,sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.fillStyle = '#fff'; cx.fillText('N', nx, ny);
    // tuuli: keltainen nuoli kompassin sisällä osoittaa suuntaan, johon tuuli puhaltaa
    if (s.windSpeed > 0) {
      var wa = (s.windFrom + 180) * RAD + a;
      cx.save(); cx.translate(x, y); cx.rotate(wa); cx.strokeStyle = '#ffd400'; cx.fillStyle = '#ffd400'; cx.lineWidth = 2;
      cx.beginPath(); cx.moveTo(0, 9); cx.lineTo(0, -9); cx.stroke();
      cx.beginPath(); cx.moveTo(0, -13); cx.lineTo(4.5, -6); cx.lineTo(-4.5, -6); cx.closePath(); cx.fill();
      cx.restore();
    }
    cx.font = '10px system-ui,sans-serif'; cx.fillStyle = 'rgba(255,255,255,.75)';
    cx.fillText('ruudukko ' + (nakyma.k >= RUUDUKKO_RAJA ? '5' : '25') + ' m', x, y + r + 14);
  }

  function piirra() {
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.fillStyle = '#2a6684'; cx.fillRect(0, 0, W, H);
    cx.save();
    cx.translate(W / 2, H / 2);
    if (nakyma.keula) cx.rotate(-s.hdg * RAD);       // keula ylös: maailma kierretään keulasuunnan verran vastapäivään
    cx.scale(nakyma.k, -nakyma.k);                    // metriä -> pikseliä, y pohjoiseen ylös
    cx.translate(-s.x, -s.y);
    piirraRuudukko();
    if (este) piirraPonttoni(este);
    piirraJalki();
    piirraRunko();
    piirraJetit();
    piirraNopeus();
    cx.restore();
    piirraKompassi();
  }

  // ---------------------------------------------------------------------------------------------
  // Mittarit
  // ---------------------------------------------------------------------------------------------
  var el = {};
  ['gHdg', 'gSog', 'gU', 'gV', 'gR', 'gEtaisyys', 'gTuuli', 'gAika', 'gKosketus', 'gEtaisyysLaatikko', 'gKosketusLaatikko'].forEach(function (id) { el[id] = $(id); });
  function paivitaMittarit() {
    aseta(el.gHdg, suunta3(s.hdg));
    aseta(el.gSog, luku(K.sog(s) / KN, 1) + ' kn');
    aseta(el.gU, merkki(s.v / KN, 1) + ' kn');
    aseta(el.gV, merkki(s.vs / KN, 1) + ' kn');
    aseta(el.gR, merkki(s.rate, 1) + ' °/s');
    if (este) {
      var d = K.distanceToObstacle(s, este);
      aseta(el.gEtaisyys, luku(d, 2) + ' m');
      el.gEtaisyysLaatikko.classList.toggle('vaara', d < 0.5);
    } else { aseta(el.gEtaisyys, '–'); el.gEtaisyysLaatikko.classList.remove('vaara'); }
    aseta(el.gTuuli, s.windSpeed > 0 ? suunta3(s.windFrom) + ' ' + luku(s.windSpeed, 1) + ' m/s' : 'tyyni');
    aseta(el.gAika, aikaTeksti(s.t));
    aseta(el.gKosketus, kosketusMaara + (viimeisinKn === null ? '' : ' · ' + luku(viimeisinKn, 2) + ' kn'));
    el.gKosketusLaatikko.classList.toggle('varoitus', !!s.inContact);
  }

  // ---------------------------------------------------------------------------------------------
  // Loki
  // ---------------------------------------------------------------------------------------------
  var LOKI_NIMET = {
    mode: function (e) { return 'Tila ' + e.value; },
    tiller0: function () { return 'TILLER keskelle'; },
    joy0: function () { return 'JOYSTICK keskelle'; },
    engage: function (e) { return 'ENGAGE ' + (e.value ? 'STBD' : 'PORT'); },
    diseng: function (e) { return 'DISENG ' + (e.value ? 'STBD' : 'PORT'); },
    backup: function (e) { return 'BACKUP PANEL BACKUP ' + (e.value ? 'STBD' : 'PORT'); },
    auto: function (e) { return 'BACKUP PANEL AUTO ' + (e.value ? 'STBD' : 'PORT'); },
    engbackup: function (e) { return 'ENGINE BACKUP PANEL BACKUP ' + (e.value ? 'STBD' : 'PORT'); },
    engauto: function (e) { return 'ENGINE BACKUP PANEL AUTO ' + (e.value ? 'STBD' : 'PORT'); },
    crash: function () { return 'CRASH STOP'; }
  };
  function arvio(kn) { return kn < 0.3 ? ['pehmeä', 'pehmea'] : kn <= 0.6 ? ['tuntuva', 'tuntuva'] : ['kova', 'kova']; }

  // Mallin loki voi kirjata saman osuman usealle rungon pisteelle samalla askeleella: ne yhdistetään yhdeksi kosketukseksi (suurin nopeus)
  function kosketukset() {
    var out = [], log = s.cmdLog, i, e;
    for (i = 0; i < log.length; i++) {
      e = log[i];
      if (e.kind !== 'kosketus') continue;
      var kn = (e.vnMs || 0) / KN, last = out[out.length - 1];
      if (last && Math.abs(last.t - e.t) < 1e-6) { if (kn > last.kn) last.kn = kn; } else out.push({ t: e.t, kn: kn });
    }
    return out;
  }
  function paivitaLoki() {
    var log = s.cmdLog;
    if (log.length === lokiPituus) return;
    lokiPituus = log.length;
    var ko = kosketukset();
    kosketusMaara = ko.length; viimeisinKn = ko.length ? ko[ko.length - 1].kn : null;
    var rivit = [], i, e, last = null;
    for (i = 0; i < log.length; i++) {
      e = log[i];
      if (e.kind === 'kosketus') {
        if (last && last.kosk && Math.abs(last.t - e.t) < 1e-6) continue;
        last = { t: e.t, kosk: true };
        var kn = 0;
        for (var j = 0; j < ko.length; j++) if (Math.abs(ko[j].t - e.t) < 1e-6) kn = ko[j].kn;
        var a = arvio(kn);
        rivit.push('<li><span class="lt">' + aikaTeksti(e.t) + '</span><span class="lk">Kosketus</span><span class="lv">' + luku(kn, 2) + ' kn</span><span class="arvio ' + a[1] + '">' + a[0] + '</span></li>');
      } else {
        last = null;
        var f = LOKI_NIMET[e.kind];
        rivit.push('<li><span class="lt">' + aikaTeksti(e.t) + '</span><span class="lk">' + (f ? f(e) : e.kind) + '</span></li>');
      }
    }
    rivit.reverse();
    $('loki').innerHTML = rivit.join('');
    $('lokiTyhja').hidden = rivit.length > 0;
    aseta($('lokiMaara'), '(' + rivit.length + ')');
  }

  // ---------------------------------------------------------------------------------------------
  // Ilmoitukset
  // ---------------------------------------------------------------------------------------------
  function ilmoita(teksti, kytkinViesti) {
    var t = $('toast'); t.textContent = teksti; t.hidden = false;
    clearTimeout(toastAjastin); toastAjastin = setTimeout(function () { t.hidden = true; }, 3200);
    if (kytkinViesti) {
      var v = $('clutchViesti'); v.textContent = teksti;
      clearTimeout(viestiAjastin); viestiAjastin = setTimeout(function () { v.textContent = ''; }, 5000);
    }
  }
  function piilotaViesti() { $('toast').hidden = true; $('clutchViesti').textContent = ''; }

  // ---------------------------------------------------------------------------------------------
  // TILLER ja JOYSTICK: sormiveto (pointer events), ohjaimet jäävät asentoonsa
  // ---------------------------------------------------------------------------------------------
  var tRaide = $('tillerRaide'), tNuppi = $('tillerNuppi'), jKentta = $('joyKentta'), jNuppi = $('joyNuppi');

  function tillerMitat() { var r = tRaide.getBoundingClientRect(), n = tNuppi.offsetWidth || 46; return { l: r.left + n / 2, w: Math.max(1, r.width - n) }; }
  function tillerLiike(e) {
    var m = tillerMitat(), v = ((e.clientX + tillerVeto.siirto - m.l) / m.w) * 2 - 1;
    v = raja(v, -1, 1); if (Math.abs(v) < 0.03) v = 0;
    tillerVeto.arvo = v; K.setTiller(s, v);
  }
  tRaide.addEventListener('pointerdown', function (e) {
    if (e.button > 0 || tillerVeto) return;
    e.preventDefault();
    var m = tillerMitat(), nx = m.l + (s.tiller + 1) / 2 * m.w;
    tillerVeto = { id: e.pointerId, siirto: Math.abs(nx - e.clientX) <= 32 ? nx - e.clientX : 0, arvo: s.tiller };
    try { tRaide.setPointerCapture(e.pointerId); } catch (x) { /* ei tarvita */ }
    tRaide.classList.add('veto'); tillerLiike(e);
  });
  tRaide.addEventListener('pointermove', function (e) { if (tillerVeto && tillerVeto.id === e.pointerId) tillerLiike(e); });
  function tillerLopeta(e) { if (tillerVeto && tillerVeto.id === e.pointerId) { tillerVeto = null; tRaide.classList.remove('veto'); } }
  tRaide.addEventListener('pointerup', tillerLopeta);
  tRaide.addEventListener('pointercancel', tillerLopeta);

  function joyMitat() {
    var r = jKentta.getBoundingClientRect(), n = jNuppi.offsetWidth || 50;
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, rx: Math.max(1, r.width / 2 - n / 2 - 2), ry: Math.max(1, r.height / 2 - n / 2 - 2) };
  }
  function joyLiike(e) {
    var m = joyMitat(), x = (e.clientX + joyVeto.sx - m.cx) / m.rx, y = -(e.clientY + joyVeto.sy - m.cy) / m.ry;
    if (s.mode !== 'DOCKING') x = 0;
    var l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    if (Math.abs(x) < 0.04) x = 0;
    if (Math.abs(y) < 0.04) y = 0;
    joyVeto.x = x; joyVeto.y = y; K.setJoystick(s, x, y);
  }
  jKentta.addEventListener('pointerdown', function (e) {
    if (e.button > 0 || joyVeto) return;
    e.preventDefault();
    var m = joyMitat(), nx = m.cx + s.joyX * m.rx, ny = m.cy - s.joyY * m.ry, near = Math.hypot(nx - e.clientX, ny - e.clientY) <= 36;
    joyVeto = { id: e.pointerId, sx: near ? nx - e.clientX : 0, sy: near ? ny - e.clientY : 0, x: s.joyX, y: s.joyY };
    try { jKentta.setPointerCapture(e.pointerId); } catch (x) { /* ei tarvita */ }
    jKentta.classList.add('veto'); joyLiike(e);
  });
  jKentta.addEventListener('pointermove', function (e) { if (joyVeto && joyVeto.id === e.pointerId) joyLiike(e); });
  function joyLopeta(e) { if (joyVeto && joyVeto.id === e.pointerId) { joyVeto = null; jKentta.classList.remove('veto'); } }
  jKentta.addEventListener('pointerup', joyLopeta);
  jKentta.addEventListener('pointercancel', joyLopeta);

  // Nuppien sijainti ja lukemat seuraavat mallin tilaa joka ruudussa (näppäimet, CRASH STOP ja tilanvaihto muuttavat ohjaimia)
  function paivitaOhjaimet() {
    var tm = tillerMitat(), jm = joyMitat(), jr = jKentta.getBoundingClientRect();
    var tt = 'translateX(' + ((s.tiller + 1) / 2 * tm.w).toFixed(1) + 'px)';
    if (tNuppi._tr !== tt) { tNuppi.style.transform = tt; tNuppi._tr = tt; }
    var jw = jNuppi.offsetWidth || 50;
    var jt = 'translate(' + (jr.width / 2 + s.joyX * jm.rx - jw / 2).toFixed(1) + 'px,' + (jr.height / 2 - s.joyY * jm.ry - jw / 2).toFixed(1) + 'px)';
    if (jNuppi._tr !== jt) { jNuppi.style.left = '0'; jNuppi.style.top = '0'; jNuppi.style.transform = jt; jNuppi._tr = jt; }
    aseta($('oTiller'), merkki(s.tiller * 100, 0) + ' %');
    tRaide.setAttribute('aria-valuenow', String(Math.round(s.tiller * 100)));
    aseta($('oJoy'), s.mode === 'DOCKING' ? 'X ' + merkki(s.joyX * 100, 0) + ' Y ' + merkki(s.joyY * 100, 0) : 'Y ' + merkki(s.joyY * 100, 0) + ' %');
    jKentta.classList.toggle('transit', s.mode === 'TRANSIT');
    for (var i = 0; i < tilaNapit.length; i++) {
      var on = tilaNapit[i].getAttribute('data-tila') === s.mode;
      tilaNapit[i].classList.toggle('on', on); tilaNapit[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }
  var tilaNapit = document.querySelectorAll('.tilat button');

  // ---------------------------------------------------------------------------------------------
  // Paneelit
  // ---------------------------------------------------------------------------------------------
  function puoli(el0) { var n = el0.closest('[data-puoli]'); return n ? Number(n.getAttribute('data-puoli')) : 0; }
  function kytke(ryhma, attr, arvo) {
    var bs = ryhma.querySelectorAll('button[' + attr + ']');
    for (var i = 0; i < bs.length; i++) bs[i].classList.toggle('on', bs[i].getAttribute(attr) === String(arvo));
  }

  // CLUTCH PANEL
  document.querySelectorAll('#pClutch [data-clutch]').forEach(function (b) {
    b.addEventListener('click', function () {
      var side = puoli(b), eng = b.getAttribute('data-clutch') === '1';
      var ok = K.setClutch(s, side, eng);
      if (!ok) ilmoita('ENGAGE ei onnistu ' + (side ? 'STBD' : 'PORT') + ' jetille, koska JOYSTICK ei ole keskellä. Palauta JOYSTICK keskelle ja yritä uudelleen.', true);
      else $('clutchViesti').textContent = '';
    });
  });
  document.querySelectorAll('#pClutch [data-bf]').forEach(function (b) {
    b.addEventListener('click', function () {
      b.classList.add('vilkkuu'); clearTimeout(b._ajastin);
      b._ajastin = setTimeout(function () { b.classList.remove('vilkkuu'); }, 3000);   // BACKFLUSH vilkkuu 3 s, ei vaikuta malliin
    });
  });
  $('rIdle').addEventListener('input', function () { K.setIdle(s, Number(this.value)); $('oIdle').textContent = Math.round(s.idleRpm) + ' rpm'; });

  // TRIM–ROLL PANEL: AUTO/BACKUP (säätimet vain näyttönä)
  document.querySelectorAll('#pTrim [data-trimauto]').forEach(function (b) {
    b.addEventListener('click', function () { s.trimRollAuto = b.getAttribute('data-trimauto') === '1'; });
  });

  // BACKUP PANEL
  function backupSauva(side) {
    var nz = Number($('rBkNoz' + side).value), ku = Number($('rBkKau' + side).value);
    K.setBackupStick(s, side, nz / SET.nozzleMaxDeg, ku / 100);
    aseta($('oBkNoz' + side), merkki(nz, 0) + '°'); aseta($('oBkKau' + side), merkki(ku, 0) + ' %');
  }
  document.querySelectorAll('#pBackup [data-backup]').forEach(function (b) {
    b.addEventListener('click', function () { var side = puoli(b); K.setBackup(s, side, b.getAttribute('data-backup') === '1'); backupSauva(side); });
  });
  document.querySelectorAll('#pBackup [data-int]').forEach(function (b) {
    b.addEventListener('click', function () { K.setBackupSelector(s, puoli(b), b.getAttribute('data-int') === '1'); });
  });
  [0, 1].forEach(function (side) {
    $('rBkNoz' + side).addEventListener('input', function () { backupSauva(side); });
    $('rBkKau' + side).addEventListener('input', function () { backupSauva(side); });
  });

  // ENGINE BACKUP PANEL
  document.querySelectorAll('#pEngine [data-engbackup]').forEach(function (b) {
    b.addEventListener('click', function () { var side = puoli(b); K.setEngineBackup(s, side, b.getAttribute('data-engbackup') === '1'); K.setEngineBackupRpm(s, side, Number($('rEngRpm' + side).value)); });
  });
  [0, 1].forEach(function (side) {
    $('rEngRpm' + side).addEventListener('input', function () { K.setEngineBackupRpm(s, side, Number(this.value)); aseta($('oEngRpm' + side), String(Math.round(s.jets[side].engineBackupRpm))); });
  });

  // Paneelien napit ja säätimet seuraavat mallin tilaa (kutsutaan joka ruudussa); elementit haetaan kerran
  var paneeliEl = [0, 1].map(function (i) {
    var q = function (sel) { return document.querySelector(sel); };
    return {
      engage: q('#pClutch [data-puoli="' + i + '"] [data-clutch="1"]'), diseng: q('#pClutch [data-puoli="' + i + '"] [data-clutch="0"]'),
      backup: q('#pBackup [data-puoli="' + i + '"]'), engine: q('#pEngine [data-puoli="' + i + '"]'),
      noz: $('rBkNoz' + i), kau: $('rBkKau' + i), rpm: $('rEngRpm' + i), kauNimi: $('lBkKau' + i)
    };
  });
  function paivitaPaneelitRuudussa() {
    for (var i = 0; i < 2; i++) {
      var j = s.jets[i], e = paneeliEl[i];
      e.engage.classList.toggle('on', j.engaged); e.diseng.classList.toggle('on', !j.engaged);
      kytke(e.backup, 'data-backup', j.backup ? 1 : 0); kytke(e.backup, 'data-int', j.backupInt ? 1 : 0);
      e.noz.disabled = !j.backup; e.kau.disabled = !j.backup;
      var nk = (i ? 'STBD ' : 'PORT ') + (j.backupInt ? 'INTERCEPTOR' : 'BUCKET') + ' ';
      if (e.kauNimi._n !== nk) { e.kauNimi.firstChild.nodeValue = nk; e.kauNimi._n = nk; }
      kytke(e.engine, 'data-engbackup', j.engineBackup ? 1 : 0);
      e.rpm.disabled = !j.engineBackup;
    }
    kytke($('pTrim'), 'data-trimauto', s.trimRollAuto ? 1 : 0);
  }
  // Nollauksessa säätimet palautetaan lähtöasentoon
  function synkronoiPaneelit() {
    $('rIdle').value = String(Math.round(s.idleRpm)); $('oIdle').textContent = Math.round(s.idleRpm) + ' rpm';
    for (var i = 0; i < 2; i++) {
      $('rBkNoz' + i).value = '0'; $('rBkKau' + i).value = '0'; $('rEngRpm' + i).value = String(SET.rpmIdle);
      $('oBkNoz' + i).textContent = '0°'; $('oBkKau' + i).textContent = '0 %'; $('oEngRpm' + i).textContent = String(SET.rpmIdle);
    }
    paivitaPaneelitRuudussa();
  }

  // LCD DISPLAY AND ALARM PANEL: palkit PORT TAB, PORT BUCKET, STBD BUCKET, STBD TAB sekä PORT NOZZLE ja STBD NOZZLE
  function lcdPystyyn(i, arvo, kauha) {   // kauha: keskeltä ylös eteen ja alas taakse, TAB: alhaalta ylös
    var f = $('lcdF' + i), pct = Math.round(arvo * 100), h, t;
    if (kauha) {
      h = Math.abs(arvo) * 50; t = 'h' + h.toFixed(1) + (arvo < 0 ? 'a' : 'e');
      if (f._t !== t) {
        f.style.height = h.toFixed(1) + '%';
        if (arvo < 0) { f.style.bottom = 'auto'; f.style.top = '50%'; f.classList.add('taakse'); } else { f.style.top = 'auto'; f.style.bottom = '50%'; f.classList.remove('taakse'); }
        f._t = t;
      }
    } else {
      h = arvo * 100; t = 'h' + h.toFixed(1);
      if (f._t !== t) { f.style.height = h.toFixed(1) + '%'; f._t = t; }
    }
    aseta($('lcdV' + i), (kauha ? merkki(pct, 0) : String(pct)) + ' %');
  }
  function lcdVaaka(i, aste) {
    var f = $('lcdF' + i), w = Math.abs(aste) / SET.nozzleMaxDeg * 50, t = 'w' + w.toFixed(1) + (aste < 0 ? 'l' : 'r');
    if (f._t !== t) {
      f.style.width = w.toFixed(1) + '%';
      if (aste < 0) { f.style.left = 'auto'; f.style.right = '50%'; } else { f.style.right = 'auto'; f.style.left = '50%'; }
      f._t = t;
    }
    aseta($('lcdV' + i), merkki(aste, 1) + '°');
  }
  function paivitaLcd() {
    if (!$('pLcd').open || !$('paneelit').open) return;
    var p = K.panel(s);
    lcdPystyyn(0, raja(p[0].tab, 0, 1), false); lcdPystyyn(1, raja(p[0].bucket, -1, 1), true);
    lcdPystyyn(2, raja(p[1].bucket, -1, 1), true); lcdPystyyn(3, raja(p[1].tab, 0, 1), false);
    lcdVaaka(4, p[0].nozzle); lcdVaaka(5, p[1].nozzle);
    aseta($('lcdRpm0'), String(p[0].rpm)); aseta($('lcdRpm1'), String(p[1].rpm));
    var lamput = '';
    for (var i = 0; i < 2; i++) {
      var n = i ? 'STBD' : 'PORT';
      if (!p[i].engaged) lamput += '<span class="lamppu hael">' + n + ' DISENG</span>';
      if (p[i].backup) lamput += '<span class="lamppu">' + n + ' BACKUP</span>';
      if (p[i].engineBackup) lamput += '<span class="lamppu">' + n + ' ENG BACKUP</span>';
    }
    var lp = $('lcdLamput');
    if (lp._h !== lamput) { lp.innerHTML = lamput; lp._h = lamput; }
  }

  // ---------------------------------------------------------------------------------------------
  // Yläpalkki, näkymä ja napit
  // ---------------------------------------------------------------------------------------------
  function asetaTauko(t) {
    tauko = t;
    $('bTauko').setAttribute('aria-pressed', t ? 'true' : 'false');
    $('bTauko').firstChild.nodeValue = t ? 'Jatka ' : 'Tauko ';
    $('taukoMerkki').hidden = !t;
  }
  function asetaKerroin(k) {
    kerroin = k; s.speedFactor = k;
    document.querySelectorAll('#segNopeus button').forEach(function (b) {
      var on = Number(b.getAttribute('data-v')) === k; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  function asetaNakyma(keula) {
    nakyma.keula = keula;
    document.querySelectorAll('.nakyma-napit [data-n]').forEach(function (b) {
      var on = (b.getAttribute('data-n') === 'keula') === keula; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  function zoomaa(f) { nakyma.k = raja(nakyma.k * f, 2, 60); }
  function vaihdaTila() { K.setMode(s, s.mode === 'DOCKING' ? 'TRANSIT' : 'DOCKING'); }
  function pysayta() {
    if (!K.crashStop(s)) ilmoita('CRASH STOP vaatii eteenpäin-vauhtia. Vene kulkee eteenpäin alle 0,3 kn.');
  }

  $('bTauko').addEventListener('click', function () { asetaTauko(!tauko); });
  $('bNollaa').addEventListener('click', aloita);
  document.querySelectorAll('#segNopeus button').forEach(function (b) { b.addEventListener('click', function () { asetaKerroin(Number(b.getAttribute('data-v'))); }); });
  $('selTilanne').addEventListener('change', function () { aloita(); sulje(); });
  document.querySelectorAll('.nakyma-napit [data-n]').forEach(function (b) { b.addEventListener('click', function () { asetaNakyma(b.getAttribute('data-n') === 'keula'); }); });
  $('bZoomIn').addEventListener('click', function () { zoomaa(1.25); });
  $('bZoomUt').addEventListener('click', function () { zoomaa(0.8); });
  $('bTillerKeskelle').addEventListener('click', function () { K.centreTiller(s); });
  $('bJoyKeskelle').addEventListener('click', function () { K.centreJoystick(s); });
  $('bCrash').addEventListener('click', pysayta);
  document.querySelectorAll('.tilat button').forEach(function (b) { b.addEventListener('click', function () { K.setMode(s, b.getAttribute('data-tila')); }); });
  $('cbJousi').addEventListener('change', function () { SET.tillerSpring = this.checked; });
  $('bLokiTyhjenna').addEventListener('click', function () { s.cmdLog.length = 0; lokiPituus = -1; paivitaLoki(); });

  // Tuuli ja lähtötilanne (puhelimessa avattava lista, leveällä näytöllä aina palkissa)
  function tuuliMuutos() {
    tuuli.from = Number($('rTuuliSuunta').value); tuuli.speed = Number($('rTuuliNopeus').value);
    K.setWind(s, tuuli.from, tuuli.speed);
    $('oTuuliSuunta').textContent = Math.round(tuuli.from) + '°';
    $('oTuuliNopeus').textContent = tuuli.speed > 0 ? luku(tuuli.speed, 1) + ' m/s' : 'tyyni';
  }
  $('rTuuliSuunta').addEventListener('input', tuuliMuutos);
  $('rTuuliNopeus').addEventListener('input', tuuliMuutos);
  function sulje() { $('aset').classList.remove('auki'); $('asetBtn').setAttribute('aria-expanded', 'false'); }
  $('asetBtn').addEventListener('click', function () {
    var auki = !$('aset').classList.contains('auki');
    $('aset').classList.toggle('auki', auki); this.setAttribute('aria-expanded', auki ? 'true' : 'false');
  });
  document.addEventListener('pointerdown', function (e) {
    if ($('aset').classList.contains('auki') && !e.target.closest('#aset') && !e.target.closest('#asetBtn')) sulje();
  });

  // Napit eivät jää kohdistetuiksi, jotta välilyönti (CRASH STOP) ei aktivoi viimeksi painettua nappia
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('button') : null;
    if (b && e.detail > 0) b.blur();
  });
  document.querySelectorAll('input[type=range]').forEach(function (r) {
    r.addEventListener('change', function () { r.blur(); });
  });

  // Canvas: hiiren rulla ja kahden sormen nipistys
  cv.addEventListener('wheel', function (e) { e.preventDefault(); zoomaa(Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015))); }, { passive: false });
  var osoittimet = {}, nipistys = 0;
  cv.addEventListener('pointerdown', function (e) {
    osoittimet[e.pointerId] = { x: e.clientX, y: e.clientY }; nipistys = 0;
    try { cv.setPointerCapture(e.pointerId); } catch (x) { /* ei tarvita */ }
  });
  cv.addEventListener('pointermove', function (e) {
    if (!osoittimet[e.pointerId]) return;
    osoittimet[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(osoittimet);
    if (ids.length === 2) {
      var a = osoittimet[ids[0]], b = osoittimet[ids[1]], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (nipistys > 0 && d > 0) zoomaa(d / nipistys);
      nipistys = d;
    }
  });
  function osoitinPois(e) { delete osoittimet[e.pointerId]; nipistys = 0; }
  cv.addEventListener('pointerup', osoitinPois);
  cv.addEventListener('pointercancel', osoitinPois);
  // iOS Safari: estä sivun oma nipistyszoomi
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (t) { document.addEventListener(t, function (e) { e.preventDefault(); }); });

  // ---------------------------------------------------------------------------------------------
  // Näppäimistö
  // ---------------------------------------------------------------------------------------------
  var NAPPAIMET = { KeyQ: 'tillerL', KeyE: 'tillerR', ArrowUp: 'fwd', ArrowDown: 'aft', ArrowLeft: 'left', ArrowRight: 'right' };
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target, tag = t && t.tagName, c = e.code;
    if (tag === 'SELECT' || tag === 'TEXTAREA' || (tag === 'INPUT' && t.type !== 'checkbox')) return;   // säätimet ja valikot saavat omat näppäimensä
    if (NAPPAIMET[c]) { pidetty[NAPPAIMET[c]] = true; e.preventDefault(); return; }
    if (c === 'Space') { e.preventDefault(); if (!e.repeat) pysayta(); return; }
    if (e.repeat) return;
    switch (c) {
      case 'KeyS': K.centreTiller(s); break;
      case 'KeyX': K.centreJoystick(s); break;
      case 'KeyD': vaihdaTila(); break;
      case 'KeyP': asetaTauko(!tauko); break;
      case 'KeyR': aloita(); break;
      case 'Digit1': case 'Numpad1': asetaKerroin(1); break;
      case 'Digit2': case 'Numpad2': asetaKerroin(2); break;
      case 'Digit5': case 'Numpad5': asetaKerroin(5); break;
      default: return;
    }
    e.preventDefault();
  });
  document.addEventListener('keyup', function (e) {
    if (NAPPAIMET[e.code]) { pidetty[NAPPAIMET[e.code]] = false; e.preventDefault(); }
    else if (e.code === 'Space') e.preventDefault();
  });
  window.addEventListener('blur', function () { pidetty = {}; });

  // ---------------------------------------------------------------------------------------------
  // Silmukka
  // ---------------------------------------------------------------------------------------------
  var edellinen = 0, polkuKello = 0;
  function ruutu(nyt) {
    var dt = edellinen ? Math.min(0.25, (nyt - edellinen) / 1000) : 0;
    edellinen = nyt;
    var k = s.keys;
    k.tillerL = !!pidetty.tillerL; k.tillerR = !!pidetty.tillerR; k.fwd = !!pidetty.fwd; k.aft = !!pidetty.aft; k.left = !!pidetty.left; k.right = !!pidetty.right;
    if (!tauko) {
      if (tillerVeto) K.setTiller(s, tillerVeto.arvo);   // sormiveto voittaa jousipalautuksen ja näppäimet
      if (joyVeto) K.setJoystick(s, joyVeto.x, joyVeto.y);
      var kulunut = dt > 0 ? K.stepFrame(s, dt) : 0;
      if (tillerVeto) K.setTiller(s, tillerVeto.arvo);
      if (joyVeto) K.setJoystick(s, joyVeto.x, joyVeto.y);
      if (kulunut > 0) {
        var l = polku[polku.length - 1];
        if (!l || Math.hypot(s.x - l[0], s.y - l[1]) > 0.2) { polku.push([s.x, s.y]); if (polku.length > 4000) polku.shift(); }
      }
    }
    paivitaMittarit(); paivitaOhjaimet(); paivitaLoki(); paivitaPaneelitRuudussa(); paivitaLcd();
    piirra();
    requestAnimationFrame(ruutu);
  }

  // ---------------------------------------------------------------------------------------------
  // Käynnistys
  // ---------------------------------------------------------------------------------------------
  mitoita();
  if (typeof ResizeObserver === 'function') new ResizeObserver(mitoita).observe(cv.parentNode); else window.addEventListener('resize', mitoita);
  SET.tillerSpring = false;
  aloita();
  requestAnimationFrame(ruutu);

  // Testikäyttö: Playwright-testit lukevat ja ohjaavat tilaa tätä kautta
  window.__kas = {
    tila: function () { return s; }, ponttoni: function () { return este; }, nakyma: nakyma, K: K,
    aloita: aloita, tauko: function () { return tauko; }, kosketukset: kosketukset
  };
})();
