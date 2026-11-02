"""Käsittelyharjoituksen (kasittely.html) selaintesti: puhelin pystyssä (iPhone WebKit, Pixel Chromium) ja tietokone 1440x900.
Palvelin: cd lahdekoodi && python3 -m http.server 8154 (osoite SIM-ympäristömuuttujassa).
Ajo: python3 kasittely_pw.py [iphone|iphone844|pixel|desktop|kaikki]   Kuvat: KUVAT-ympäristömuuttujan hakemistoon (oletus ../shots).
Tarkistaa: sivu latautuu ilman konsolivirheitä, ei vaakavieritystä, ohjainten veto ja näppäimet liikuttavat venettä, paneelit avautuvat ja
toimivat, kosketus ponttoniin kirjautuu lokiin, ei päällekkäisiä elementtejä ja kosketuskohteet ovat vähintään 44 px."""
import os
import sys
import time

from playwright.sync_api import sync_playwright

SIM = os.environ.get('SIM', 'http://127.0.0.1:8154/')
OUT = os.environ.get('KUVAT', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'shots'))
os.makedirs(OUT, exist_ok=True)
tulokset = []


def ok(ehto, teksti):
    tulokset.append((bool(ehto), teksti))
    print(('OK    ' if ehto else 'VIRHE ') + teksti)
    return bool(ehto)


PROFIILIT = {
    'iphone': dict(nimi='iPhone 15 (WebKit)', laite='iPhone 15', moottori='webkit', kuva='iphone', kosketus=True),
    'iphone844': dict(nimi='iPhone 390x844 (WebKit)', laite='iPhone 15', moottori='webkit', kuva='iphone844', kosketus=True, nakyma={'width': 390, 'height': 844}),
    'pixel': dict(nimi='Pixel 7 (Chromium)', laite='Pixel 7', moottori='chromium', kuva='pixel', kosketus=True),
    'desktop': dict(nimi='Tietokone 1440x900 (Chromium)', laite=None, moottori='chromium', kuva='tietokone', kosketus=False, nakyma={'width': 1440, 'height': 900}),
}


class Sivu:
    def __init__(self, pw, prof):
        self.prof = prof
        self.virheet = []
        bt = getattr(pw, prof['moottori'])
        self.b = bt.launch()
        if prof['laite']:
            dev = dict(pw.devices[prof['laite']])
        else:
            dev = {}
        if prof.get('nakyma'):
            dev['viewport'] = prof['nakyma']
            dev['screen'] = prof['nakyma']
        self.c = self.b.new_context(**dev)
        self.p = self.c.new_page()
        self.p.on('console', lambda m: self.virheet.append(('console.' + m.type, m.text)) if m.type in ('error', 'warning') else None)
        self.p.on('pageerror', lambda e: self.virheet.append(('pageerror', str(e))))
        self.cdp = self.c.new_cdp_session(self.p) if prof['moottori'] == 'chromium' and prof['kosketus'] else None
        self.touch = prof['kosketus']

    def sulje(self):
        self.b.close()

    def ev(self, js, arg=None):
        return self.p.evaluate(js, arg)

    def tila(self, kentta):
        return self.ev('(k) => window.__kas.tila()[k]', kentta)

    def klik(self, sel):
        if self.touch:
            self.p.tap(sel)
        else:
            self.p.click(sel)
        self.p.wait_for_timeout(120)

    def laatikko(self, sel):
        return self.p.locator(sel).bounding_box()

    def kuva(self, nimi):
        self.p.wait_for_timeout(250)
        polku = os.path.join(OUT, '%s_%s.png' % (nimi, self.prof['kuva']))
        self.p.screenshot(path=polku)
        return polku

    def veto(self, x0, y0, x1, y1, askelia=10, pito=0):
        """Sormiveto (Chromiumissa oikea kosketus CDP:llä, WebKitissä hiirellä, joka tuottaa saman pointer-tapahtuman)."""
        if self.cdp:
            self.cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x0, 'y': y0, 'id': 1}]})
            for i in range(1, askelia + 1):
                self.cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x0 + (x1 - x0) * i / askelia, 'y': y0 + (y1 - y0) * i / askelia, 'id': 1}]})
            if pito:
                self.p.wait_for_timeout(pito)
            self.cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
        else:
            self.p.mouse.move(x0, y0)
            self.p.mouse.down()
            for i in range(1, askelia + 1):
                self.p.mouse.move(x0 + (x1 - x0) * i / askelia, y0 + (y1 - y0) * i / askelia)
            if pito:
                self.p.wait_for_timeout(pito)
            self.p.mouse.up()
        self.p.wait_for_timeout(150)

    def pidä(self, nappain, ms):
        self.p.keyboard.down(nappain)
        self.p.wait_for_timeout(ms)
        self.p.keyboard.up(nappain)
        self.p.wait_for_timeout(80)

    def nollaa(self, tilanne='lahestyminen'):
        self.ev('(t) => { document.getElementById("selTilanne").value = t; window.__kas.aloita(); }', tilanne)
        self.p.wait_for_timeout(200)


def pienet_kohteet(s):
    return s.ev("""() => {
      const out = [];
      document.querySelectorAll('button, select, summary, input[type=range], [role=slider], [role=application], label.valinta').forEach(e => {
        const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
        if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || cs.display === 'none') return;
        if (e.closest('[hidden]') || e.closest('#aset:not(.auki)') && getComputedStyle(document.getElementById('aset')).display === 'none') return;
        if (r.width < 43.5 || r.height < 43.5) out.push((e.id || e.textContent.trim().slice(0, 16) || e.className) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
      });
      return out; }""")


def leikkaa(s, a, b):
    r = s.ev("""([a, b]) => {
      const x = document.querySelector(a), y = document.querySelector(b);
      if (!x || !y) return null;
      const p = x.getBoundingClientRect(), q = y.getBoundingClientRect();
      if (!p.width || !q.width) return null;
      const w = Math.min(p.right, q.right) - Math.max(p.left, q.left), h = Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top);
      return w > 1 && h > 1 ? Math.round(w) + 'x' + Math.round(h) : 0; }""", [a, b])
    return r


def aja(pw, avain):
    prof = PROFIILIT[avain]
    s = Sivu(pw, prof)
    p = s.p
    nimi = prof['nimi']
    leveä = avain == 'desktop'
    print('=' * 70, nimi)
    p.goto(SIM + 'kasittely.html')
    p.wait_for_function('window.__kas && window.__kas.tila()', timeout=15000)
    p.wait_for_timeout(1200)
    ok(not s.virheet, '%s: sivu latautuu ilman konsolivirheitä %s' % (nimi, s.virheet if s.virheet else ''))
    ok(s.ev('document.documentElement.scrollWidth <= innerWidth + 1'), '%s: ei vaakavieritystä' % nimi)
    ok(s.ev('document.documentElement.scrollHeight <= innerHeight + 1'), '%s: sivu ei vieritä (vieritys on ohjainsarakkeessa)' % nimi)
    ok('Repa – käsittelyharjoitus (malli v0, kalibroimaton)' in p.inner_text('#otsikko'), '%s: otsikko oikein' % nimi)
    kuva_ensin = s.kuva('puhelin_pysty' if not leveä else 'tietokone')

    # ---- asettelu ----
    vh = s.ev('innerHeight')
    nk = s.laatikko('#nakyma')
    if not leveä:
        osuus = nk['height'] / vh
        ok(0.38 <= osuus <= 0.52, '%s: canvas noin 45 %% korkeudesta (%.0f %%)' % (nimi, osuus * 100))
        ok(s.laatikko('#ohjaimet')['y'] >= nk['y'] + nk['height'] - 1, '%s: ohjaimet canvasin alla' % nimi)
        tl, cr, jl = s.laatikko('#tillerLaatikko'), s.laatikko('#bCrash'), s.laatikko('#joyLaatikko')
        ok(tl['x'] < cr['x'] < jl['x'], '%s: tiller vasemmalla, CRASH STOP välissä, joystick oikealla' % nimi)
    else:
        sv = s.laatikko('#sivu')
        ok(nk['x'] < sv['x'] and nk['width'] > sv['width'], '%s: canvas vasemmalla ja ohjainsarake oikealla' % nimi)
    pari = [('#nakyma', '#sivu'), ('#tillerLaatikko', '.keski'), ('.keski', '#joyLaatikko'), ('#tillerLaatikko', '#joyLaatikko'), ('#mitVas', '#mitOik'),
            ('.nakyma-napit.vas', '.nakyma-napit.oik'), ('#mitVas', '.nakyma-napit.vas'), ('#mitOik', '.nakyma-napit.oik'), ('#bar', '#nakyma')]
    pk = [(a, b, leikkaa(s, a, b)) for a, b in pari]
    ok(all(not x[2] for x in pk), '%s: ei päällekkäisiä elementtejä %s' % (nimi, [x for x in pk if x[2]]))
    ps = pienet_kohteet(s)
    ok(not ps, '%s: kosketuskohteet vähintään 44 px (pienet: %s)' % (nimi, ps))

    # ---- lähtötilanteet ----
    s.nollaa('lahestyminen')
    d = s.ev('window.__kas.K.distanceToObstacle(window.__kas.tila(), window.__kas.ponttoni())')
    ok(abs(d - 30) < 0.2 and abs(s.tila('hdg') - 135) < 0.01 and s.tila('v') == 0, '%s: Lähestyminen: etäisyys %.2f m, hdg %.0f, nopeus 0' % (nimi, d, s.tila('hdg')))
    s.nollaa('kylki')
    d = s.ev('window.__kas.K.distanceToObstacle(window.__kas.tila(), window.__kas.ponttoni())')
    ok(0 <= d < 0.2, '%s: Kylki ponttonissa: etäisyys %.2f m' % (nimi, d))
    s.nollaa('vapaa')
    ok(s.ev('window.__kas.ponttoni() === null') and p.inner_text('#gEtaisyys') == '–', '%s: Vapaa vesi: ei ponttonia' % nimi)

    # ---- tiller: veto, jää asentoonsa, näppäimet ----
    s.nollaa('vapaa')
    tb = s.laatikko('#tillerRaide')
    cx0, cy0 = tb['x'] + tb['width'] / 2, tb['y'] + tb['height'] / 2
    s.veto(cx0, cy0, cx0 + tb['width'] * 0.3, cy0, 8)
    t1 = s.tila('tiller')
    ok(t1 > 0.3, '%s: tillerin veto oikealle liikuttaa tilleriä (%.2f)' % (nimi, t1))
    p.wait_for_timeout(500)
    ok(abs(s.tila('tiller') - t1) < 1e-6, '%s: tiller jää asentoonsa kun sormi irtoaa' % nimi)
    ok('+' in p.inner_text('#oTiller'), '%s: tillerin lukema näkyy (%s)' % (nimi, p.inner_text('#oTiller')))
    s.klik('#bTillerKeskelle')
    ok(s.tila('tiller') == 0, '%s: Keskelle-nappi palauttaa tillerin nollaan' % nimi)
    s.pidä('KeyQ', 500)
    ok(s.tila('tiller') < -0.3, '%s: Q-näppäin kääntää tilleriä vasemmalle (%.2f)' % (nimi, s.tila('tiller')))
    s.pidä('KeyE', 400)
    e1 = s.tila('tiller')
    ok(e1 > -0.5, '%s: E-näppäin kääntää oikealle (%.2f)' % (nimi, e1))
    p.keyboard.press('KeyS')
    ok(s.tila('tiller') == 0, '%s: S palauttaa tillerin keskelle' % nimi)

    # ---- jousipalautus (asetus) ja kosketuseleiden esto ohjaimissa ----
    s.klik('#cbJousi')
    ok(s.ev('window.__kas.K.SETTINGS.tillerSpring === true'), '%s: Tiller jousipalautus -valinta asettaa SETTINGS.tillerSpring' % nimi)
    s.veto(cx0, cy0, cx0 + tb['width'] * 0.3, cy0, 8)
    p.wait_for_timeout(1600)
    ok(abs(s.tila('tiller')) < 0.05, '%s: jousipalautus palauttaa tillerin keskelle sormen irrottua (%.2f)' % (nimi, s.tila('tiller')))
    s.klik('#cbJousi')
    ok(s.ev('window.__kas.K.SETTINGS.tillerSpring === false'), '%s: jousipalautus pois päältä' % nimi)
    ta = s.ev('''() => ['tillerRaide', 'joyKentta', 'kanvas'].map(id => getComputedStyle(document.getElementById(id)).touchAction)''')
    ok(all(x == 'none' for x in ta), '%s: ohjaimilla ja canvasilla touch-action: none (%s)' % (nimi, ta))

    # ---- joystick DOCKING: veto eteen, vene liikkuu ----
    s.nollaa('vapaa')
    jb = s.laatikko('#joyKentta')
    jx, jy = jb['x'] + jb['width'] / 2, jb['y'] + jb['height'] / 2
    s.veto(jx, jy, jx, jy - jb['height'] * 0.35, 8)
    y1 = s.tila('joyY')
    ok(y1 > 0.4, '%s: joystickin veto ylös antaa eteen-käskyn (%.2f)' % (nimi, y1))
    p.wait_for_timeout(300)
    ok(abs(s.tila('joyY') - y1) < 1e-6, '%s: joystick jää asentoonsa' % nimi)
    p.keyboard.press('Digit5')
    p.wait_for_timeout(1800)
    ok(s.tila('speedFactor') == 5, '%s: aikakerroin 5x (näppäin 5)' % nimi)
    ok(s.tila('v') > 0.3, '%s: DOCKING: joystick eteen liikuttaa venettä eteenpäin (u %.2f kn)' % (nimi, s.tila('v') / 0.514444))
    ok(s.ev('Math.hypot(window.__kas.tila().x, window.__kas.tila().y)') > 3, '%s: vene on siirtynyt (%s)' % (nimi, p.inner_text('#gSog')))
    kuva_ajo = s.kuva('ajo')
    s.klik('#bJoyKeskelle')
    ok(s.tila('joyY') == 0 and s.tila('joyX') == 0, '%s: JOYSTICK Keskelle-nappi' % nimi)
    s.veto(jx, jy, jx + jb['width'] * 0.35, jy, 8)
    ok(s.tila('joyX') > 0.3, '%s: DOCKING: joystickin veto sivulle antaa sivuttaiskäskyn (%.2f)' % (nimi, s.tila('joyX')))
    s.klik('[data-tila="TRANSIT"]')
    ok(s.tila('mode') == 'TRANSIT' and s.tila('joyX') == 0, '%s: TRANSIT-kytkin napista, joystick keskelle' % nimi)
    s.veto(jx, jy, jx + jb['width'] * 0.3, jy - jb['height'] * 0.3, 8)
    ok(s.tila('joyX') == 0 and s.tila('joyY') > 0.3, '%s: TRANSIT: sivuttaisakselilla ei vaikutusta (x %.2f, y %.2f)' % (nimi, s.tila('joyX'), s.tila('joyY')))
    p.keyboard.press('KeyD')
    ok(s.tila('mode') == 'DOCKING', '%s: D vaihtaa tilaa' % nimi)
    p.keyboard.press('KeyX')
    ok(s.tila('joyY') == 0, '%s: X palauttaa joystickin keskelle' % nimi)
    s.pidä('ArrowUp', 300)
    ok(s.tila('joyY') > 0.1, '%s: nuoli ylös siirtää joystickia eteen' % nimi)
    s.pidä('ArrowRight', 300)
    ok(s.tila('joyX') > 0.1, '%s: nuoli oikealle siirtää joystickia sivuttain DOCKING-tilassa' % nimi)

    # ---- tauko, nollaus ja aikakertoimet ----
    p.keyboard.press('KeyP')
    t_a = s.tila('t'); p.wait_for_timeout(500); t_b = s.tila('t')
    ok(s.ev('window.__kas.tauko()') and abs(t_b - t_a) < 1e-9, '%s: P pysäyttää simulaation' % nimi)
    p.keyboard.press('KeyP')
    p.wait_for_timeout(400)
    ok(s.tila('t') > t_b, '%s: P jatkaa simulaatiota' % nimi)
    s.klik('#bTauko'); ok(s.ev('window.__kas.tauko()'), '%s: Tauko-nappi' % nimi); s.klik('#bTauko')
    s.klik('#segNopeus [data-v="2"]'); ok(s.tila('speedFactor') == 2, '%s: 2x-nappi' % nimi)
    p.keyboard.press('Digit1'); ok(s.tila('speedFactor') == 1, '%s: näppäin 1' % nimi)
    p.keyboard.press('Digit2'); ok(s.tila('speedFactor') == 2, '%s: näppäin 2' % nimi)
    p.keyboard.press('KeyR'); p.wait_for_timeout(200)
    ok(s.tila('t') < 1 and s.tila('joyY') == 0, '%s: R nollaa tilanteen' % nimi)

    # ---- CRASH STOP ----
    s.nollaa('vapaa')
    s.klik('#bCrash')
    ok(p.is_visible('#toast'), '%s: CRASH STOP paikallaan antaa ilmoituksen (%s)' % (nimi, p.inner_text('#toast')))
    s.ev('() => { const s = window.__kas.tila(); s.v = 4; }')
    p.keyboard.press('Space')
    p.wait_for_timeout(200)
    ok(s.ev("window.__kas.tila().cmdLog.some(e => e.kind === 'crash')") and s.tila('mode') == 'TRANSIT', '%s: välilyönti käynnistää CRASH STOPin' % nimi)
    p.wait_for_timeout(2500)
    s.klik('#lokiD > summary')
    ok('CRASH STOP' in p.inner_text('#loki'), '%s: loki näyttää CRASH STOPin' % nimi)
    s.klik('#lokiD > summary')

    # ---- zoom ja näkymän suunta ----
    k0 = s.ev('window.__kas.nakyma.k')
    s.klik('#bZoomIn'); k1 = s.ev('window.__kas.nakyma.k')
    s.klik('#bZoomUt'); s.klik('#bZoomUt'); k2 = s.ev('window.__kas.nakyma.k')
    ok(k1 > k0 and k2 < k1, '%s: zoom + ja − (%.2f, %.2f, %.2f px/m)' % (nimi, k0, k1, k2))
    if leveä:
        nb = s.laatikko('#kanvas')
        p.mouse.move(nb['x'] + nb['width'] / 2, nb['y'] + nb['height'] / 2)
        ka = s.ev('window.__kas.nakyma.k'); p.mouse.wheel(0, -300); p.wait_for_timeout(150)
        ok(s.ev('window.__kas.nakyma.k') > ka, '%s: hiiren rulla zoomaa' % nimi)
    if s.cdp:
        nb = s.laatikko('#kanvas'); mx, my = nb['x'] + nb['width'] / 2, nb['y'] + nb['height'] / 2
        ka = s.ev('window.__kas.nakyma.k')
        s.cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': mx - 30, 'y': my, 'id': 1}, {'x': mx + 30, 'y': my, 'id': 2}]})
        for i in range(1, 7):
            s.cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': mx - 30 - 10 * i, 'y': my, 'id': 1}, {'x': mx + 30 + 10 * i, 'y': my, 'id': 2}]})
        s.cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
        p.wait_for_timeout(150)
        ok(s.ev('window.__kas.nakyma.k') > ka * 1.5, '%s: kahden sormen nipistys zoomaa (%.2f -> %.2f)' % (nimi, ka, s.ev('window.__kas.nakyma.k')))
    else:
        ok(True, '%s: nipistystä ei voi simuloida WebKitissä, zoom-napit ja rulla testattu' % nimi)
    s.klik('[data-n="keula"]')
    ok(s.ev('window.__kas.nakyma.keula'), '%s: Keula ylös -valinta' % nimi)
    s.kuva('keula_ylos')
    s.klik('[data-n="pohjoinen"]')

    # ---- tuuli ja asetukset ----
    if not leveä:
        ok(not p.is_visible('#aset'), '%s: asetukset ovat aluksi piilossa' % nimi)
        s.klik('#asetBtn')
        ok(p.is_visible('#aset'), '%s: Asetukset-nappi avaa lähtötilanteen ja tuulen' % nimi)
        ok(not pienet_kohteet(s), '%s: asetusvalikon kosketuskohteet vähintään 44 px (%s)' % (nimi, pienet_kohteet(s)))
    p.locator('#rTuuliSuunta').fill('270')
    p.locator('#rTuuliNopeus').fill('8')
    ok(s.tila('windFrom') == 270 and s.tila('windSpeed') == 8, '%s: tuuli 270° 8 m/s' % nimi)
    p.wait_for_timeout(200)
    ok('270° 8,0 m/s' in p.inner_text('#gTuuli'), '%s: tuulimittari (%s)' % (nimi, p.inner_text('#gTuuli')))
    if not leveä:
        s.kuva('asetukset')
    p.locator('#rTuuliNopeus').fill('0')
    p.wait_for_timeout(200)
    ok('tyyni' in p.inner_text('#gTuuli'), '%s: tyyni tuuli' % nimi)
    if not leveä:
        s.klik('#asetBtn')

    # ---- paneelit ----
    s.nollaa('vapaa')
    s.klik('#paneelit > summary')
    ok(p.is_visible('#pLcd'), '%s: Paneelit avautuu' % nimi)
    for pid in ('#pClutch', '#pTrim', '#pBackup', '#pEngine'):
        if not p.evaluate('(q) => document.querySelector(q).open', pid):
            s.klik(pid + ' > summary')
    ok(all(p.evaluate('(q) => document.querySelector(q).open', q) for q in ('#pLcd', '#pClutch', '#pTrim', '#pBackup', '#pEngine')), '%s: kaikki viisi paneelia avautuvat' % nimi)
    txt = p.inner_text('#paneelit')
    for nimi_p in ('CLUTCH PANEL', 'TRIM–ROLL PANEL', 'BACKUP PANEL', 'ENGINE BACKUP PANEL', 'LCD DISPLAY AND ALARM PANEL', 'ENGAGE', 'DISENG', 'BACKFLUSH', 'IDLE',
                   'AUTO', 'BACKUP', 'INT', 'WJ', 'PORT RPM', 'STBD RPM', 'PORT TAB', 'PORT BUCKET', 'STBD BUCKET', 'STBD TAB', 'PORT NOZZLE', 'STBD NOZZLE', 'VECTOR Controls'):
        if nimi_p.upper() not in txt.upper():
            ok(False, '%s: paneelissa puuttuu teksti %s' % (nimi, nimi_p))
    ok(True, '%s: paneelien englanninkieliset nimet löytyvät' % nimi)
    ok(not pienet_kohteet(s), '%s: paneelien kosketuskohteet vähintään 44 px (%s)' % (nimi, pienet_kohteet(s)))
    ok(s.ev('document.documentElement.scrollWidth <= innerWidth + 1'), '%s: ei vaakavieritystä paneelit auki' % nimi)
    # CLUTCH PANEL: DISENG, ENGAGE vain joystick keskellä
    p.evaluate('document.querySelector("#sivu").scrollTop = 0')
    s.klik('#pClutch [data-puoli="0"] [data-clutch="0"]')
    ok(s.ev('!window.__kas.tila().jets[0].engaged'), '%s: DISENG irrottaa PORT-jetin' % nimi)
    s.ev('() => { window.__kas.tila().joyY = 0.5; }')
    s.klik('#pClutch [data-puoli="0"] [data-clutch="1"]')
    ok(s.ev('!window.__kas.tila().jets[0].engaged') and 'ENGAGE ei onnistu' in p.inner_text('#clutchViesti'), '%s: ENGAGE ei onnistu joystickin ollessa pois keskeltä, ilmoitus näkyy' % nimi)
    s.klik('#bJoyKeskelle')
    s.klik('#pClutch [data-puoli="0"] [data-clutch="1"]')
    ok(s.ev('window.__kas.tila().jets[0].engaged'), '%s: ENGAGE onnistuu joystickin ollessa keskellä' % nimi)
    s.klik('#pClutch [data-bf="1"]')
    ok(p.evaluate('document.querySelector("#pClutch [data-bf=\\"1\\"]").classList.contains("vilkkuu")'), '%s: BACKFLUSH vilkkuu' % nimi)
    p.locator('#rIdle').fill('900')
    ok(s.tila('idleRpm') == 900 and '900 rpm' in p.inner_text('#oIdle'), '%s: IDLE-säädin 900 rpm' % nimi)
    # BACKUP PANEL
    s.klik('#pBackup [data-puoli="0"] [data-backup="1"]')
    ok(not p.is_disabled('#rBkNoz0'), '%s: BACKUP PANEL BACKUP avaa liukusäätimet' % nimi)
    p.locator('#rBkNoz0').fill('20'); p.locator('#rBkKau0').fill('-50')
    ok(abs(s.ev('window.__kas.tila().jets[0].backupX') - 20 / 30) < 0.01 and abs(s.ev('window.__kas.tila().jets[0].backupY') + 0.5) < 0.01, '%s: BACKUP PANEL suutin 20° ja kauha −50 %%' % nimi)
    s.klik('#pBackup [data-puoli="0"] [data-int="1"]')
    ok(s.ev('window.__kas.tila().jets[0].backupInt'), '%s: INT/WJ-kytkin' % nimi)
    # ENGINE BACKUP PANEL
    s.klik('#pEngine [data-puoli="1"] [data-engbackup="1"]')
    p.locator('#rEngRpm1').fill('1500')
    ok(s.ev('window.__kas.tila().jets[1].engineBackup') and s.ev('window.__kas.tila().jets[1].engineBackupRpm') == 1500, '%s: ENGINE BACKUP PANEL STBD RPM 1500' % nimi)
    p.wait_for_timeout(2500)
    ok(abs(s.ev('window.__kas.tila().jets[1].rpm') - 1500) < 60, '%s: STBD-kone seuraa säädintä (%d rpm)' % (nimi, s.ev('window.__kas.tila().jets[1].rpm')))
    ok(p.inner_text('#lcdRpm1') != '650', '%s: LCD näyttää STBD RPM:n (%s)' % (nimi, p.inner_text('#lcdRpm1')))
    s.klik('#pTrim [data-trimauto="0"]')
    ok(not s.ev('window.__kas.tila().trimRollAuto'), '%s: TRIM–ROLL PANEL BACKUP' % nimi)
    # LCD-palkit: TRANSIT, joystick eteen -> kauhapalkki nousee
    s.nollaa('vapaa')
    p.keyboard.press('KeyD')
    s.ev('() => { window.__kas.tila().joyY = 0.25; }')
    p.wait_for_timeout(1800)
    h = s.ev('document.getElementById("lcdF1").style.height')
    ok(h and float(h.strip('%')) > 40, '%s: LCD PORT BUCKET -palkki nousee kauhan mukana (%s)' % (nimi, h))
    # kuva: paneelit auki, vieritetty LCD:n kohdalle
    s.nollaa('vapaa')
    if not leveä:
        p.evaluate('(() => { const a = document.querySelector("#sivu"), b = document.querySelector("#paneelit"); a.scrollTop += b.getBoundingClientRect().top - a.getBoundingClientRect().top - 4; })()')
    s.kuva('puhelin_paneelit' if not leveä else 'tietokone_paneelit')
    p.evaluate('(() => { const a = document.querySelector("#sivu"), b = document.querySelector("#pClutch"); a.scrollTop += b.getBoundingClientRect().top - a.getBoundingClientRect().top - 4; })()')
    s.kuva('paneelit_clutch')

    # ---- kosketus ponttoniin ja loki ----
    for pid in ('#pLcd', '#pClutch', '#pTrim', '#pBackup', '#pEngine'):
        p.evaluate('(q) => { document.querySelector(q).open = false; }', pid)
    s.klik('#paneelit > summary')
    s.nollaa('kylki')
    s.ev('() => { window.__kas.tila().speedFactor = 1; }')
    s.klik('#lokiD > summary')
    ok(p.is_visible('#loki') or p.is_visible('#lokiTyhja'), '%s: Loki avautuu' % nimi)
    # lähdetään ensin irti ja ajetaan sitten sivuttain ponttoniin
    p.keyboard.press('Digit5')
    s.pidä('ArrowLeft', 1500)
    s.klik('#bJoyKeskelle')
    p.wait_for_timeout(2500)
    ok(s.tila('inContact') is False, '%s: kosketus puuttuu ennen sivuttaisajoa' % nimi)
    s.p.keyboard.down('ArrowRight')
    t_alku = time.time()
    while time.time() - t_alku < 25 and not s.ev("window.__kas.tila().cmdLog.some(e => e.kind === 'kosketus')"):
        p.wait_for_timeout(100)
    s.p.keyboard.up('ArrowRight')
    p.wait_for_timeout(300)
    n = s.ev("window.__kas.tila().cmdLog.filter(e => e.kind === 'kosketus').length")
    ok(n >= 1, '%s: kosketus ponttoniin kirjautuu s.cmdLog:iin (%d merkintää)' % (nimi, n))
    vn = s.ev("(window.__kas.tila().cmdLog.filter(e => e.kind === 'kosketus')[0] || {vnMs: 0}).vnMs / 0.514444")
    p.wait_for_timeout(300)
    rivit = p.locator('#loki li').count()
    ok(rivit >= 1 and 'Kosketus' in p.inner_text('#loki'), '%s: loki näyttää kosketuksen (%s)' % (nimi, p.inner_text('#loki').replace('\n', ' | ')[:80]))
    arv = p.inner_text('#loki li').lower()
    odotus = 'pehmeä' if vn < 0.3 else 'tuntuva' if vn <= 0.6 else 'kova'
    ok(odotus in arv, '%s: kosketuksen arvio "%s" nopeudella %.2f kn' % (nimi, odotus, vn))
    ok(p.inner_text('#gKosketus').startswith('1 ·'), '%s: kosketusten määrä ja viimeisin nopeus mittarissa (%s)' % (nimi, p.inner_text('#gKosketus')))
    s.kuva('kosketus')
    # punainen reunus: työnnetään runko hieman fenderin sisään ja pysäytetään simulaatio heti
    p.keyboard.press('Digit1')
    s.ev('''() => { const st = window.__kas.tila(), K = window.__kas.K; st.joyX = 0; st.joyY = 0; st.vs = 0; st.v = 0; st.rate = 0;
      for (let i = 0; i < 6; i++) st.x += K.distanceToObstacle(st, window.__kas.ponttoni()) + 0.04; }''')
    p.wait_for_timeout(100)
    p.keyboard.press('KeyP')
    p.wait_for_timeout(200)
    print('TIETO kosketustila: inContact=%s tauko=%s etäisyys=%s' % (s.tila('inContact'), s.ev('window.__kas.tauko()'), s.ev('window.__kas.K.distanceToObstacle(window.__kas.tila(), window.__kas.ponttoni())')))
    ok(s.tila('inContact') is True and s.ev('window.__kas.tauko()'), '%s: kosketuksessa s.inContact on tosi (punainen reunus piirretään)' % nimi)
    s.kuva('kosketus_reunus')
    p.keyboard.press('KeyP')
    jaljella = s.ev('''() => { document.getElementById("bLokiTyhjenna").click(); return [window.__kas.tila().cmdLog.length, document.querySelectorAll("#loki li").length, document.getElementById("lokiMaara").textContent]; }''')
    ok(jaljella[0] == 0 and jaljella[1] == 0, '%s: Tyhjennä tyhjentää lokin (%s)' % (nimi, jaljella))
    p.wait_for_timeout(500)
    print('TIETO loki tyhjennyksen jälkeen: %s, kosketus: %s' % (p.inner_text('#loki').replace('\n', ' | '), p.inner_text('#gKosketus')))
    ok(not [e for e in s.virheet], '%s: ei konsolivirheitä koko kierroksella %s' % (nimi, s.virheet))
    s.sulje()


if __name__ == '__main__':
    arg = sys.argv[1] if len(sys.argv) > 1 else 'kaikki'
    avaimet = list(PROFIILIT) if arg == 'kaikki' else [arg]
    with sync_playwright() as pw:
        for a in avaimet:
            try:
                aja(pw, a)
            except Exception as e:
                print('KAATUI', a, repr(e)[:300])
                tulokset.append((False, 'testi kaatui profiilissa %s' % a))
    viat = [t for o, t in tulokset if not o]
    print('\nTarkistuksia %d, virheitä %d' % (len(tulokset), len(viat)))
    for v in viat:
        print('  VIRHE: ' + v)
    sys.exit(1 if viat else 0)
