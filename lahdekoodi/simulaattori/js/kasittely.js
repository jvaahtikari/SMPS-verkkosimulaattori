/* Simulaattori – Repan käsittelymalli (vaihe K1, 2.11.2026): kolmen vapausasteen liikemalli hitaaseen ajoon ja laituriin ajoon.
 *
 * Tämä on erillinen malli, jota käsittelyharjoitus käyttää liike.js:n sijaan. liike.js on navigoijan harjoituksen kinemaattinen
 * malli (ruorimies toteuttaa suunta- ja nopeuskäskyt). Tässä pelaaja on itse ruorimies ja ohjaa Rolls-Roycen Vectorstick-järjestelmää:
 * TILLER (keulasuunta) ja JOYSTICK, jonka valintakytkin on asennossa TRANSIT (joystick on kaasu) tai DOCKING (joystick liikuttaa
 * alusta eteen, taakse ja sivuttain, tiller kääntää keulaa). Käsikirja 25.6.2014 luvut 9.4 ja 9.5.
 *
 * Liikeyhtälöt (runkokoordinaatisto: x keulaan, y oikealle, kääntyminen myötäpäivään positiivinen; Fossen, 3 DOF):
 *   (m + mx) du/dt = X_runko + X_jetit + X_tuuli + X_kosketus + m v r
 *   (m + my) dv/dt = Y_runko + Y_jetit + Y_tuuli + Y_kosketus - m u r
 *   (Iz + Jz) dr/dt = N_runko + N_jetit + N_tuuli + N_kosketus
 * u = pitkittäisnopeus (surge), v = poikittaisnopeus (sway, + oikealle), r = kääntymisnopeus (yaw, rad/s). Nopeudet ovat nopeuksia
 * veden suhteen (STW); virtaus (vesimassan nopeus) lisätään paikan integrointiin, SOG- ja COG-funktioihin ja kosketuksen nopeuteen,
 * joten virtaus voidaan ottaa mukaan myöhemmin pelkällä setCurrent-kutsulla (tuulen näennäinen tuuli lasketaan vielä STW:stä). Tuuli on mukana liike.js:n tapaan (näennäinen tuuli, sivu- ja keulaprofiili) ja
 * lisäksi kääntömomenttina, koska tuulen painekeskiö on vedenalaisen sivupinnan keskiön edessä (keula kaatuu myötätuuleen).
 *
 * Runkovoimat hitaassa ajossa ovat poikkivirtausvastusta (cross-flow drag, Hooft): runko jaetaan pitkittäin kaistoihin, joilla on
 * runkomallin mittataulukosta (runko.js, hull_offsets) laskettu syväys, ja jokaisen kaistan poikittaisnopeus v + x r antaa voiman
 * -1/2 rho Cd T(x) dx (v + x r) |v + x r|. Tämä tuottaa yhtä aikaa sway-vastuksen, kääntövaimennuksen ja niiden kytkennän oikealla
 * vaikutuspisteellä (vedenalaisen sivupinnan keskiö 4,76 m peräpeilistä, painopiste 3,78 m). Vauhdissa lisätään lineaariset
 * nostovoimatermit (Yv, Yr, Nv, Nr kertaa |u|, Clarken ym. 1983 regressiokaavat), jotka antavat kurssivakavuuden ja kaarevan
 * käännöksen: ilman niitä suuttimen sivuvoima pyöräyttäisi veneen paikallaan myös vauhdissa. Pitkittäisvastus on liike.js:n liukukynnyskäyrä ilman sen keinotekoista hitaan
 * nopeuden termiä: 14 tonnin vene ei pysähdy itsestään, vaan kauhalla.
 *
 * Hydrostatiikka runkomallista suunnitteluvesiviivalla (Ta 0,942 m, Tf 0,615 m): uppouma 14,16 m3, LCB 3,78 m peräpeilistä
 * (painoarvion lastattu painopiste 4,984 m on perän referenssistä 1,208 m peräpeilin takaa, eli sama 3,78 m), Lwl 10,75 m,
 * Bwl 3,81 m, vedenalainen sivupinta 8,07 m2, vesiviivapinta 31 m2. Operointipaino 14 t (perehdytysmateriaali).
 *
 * Vesijetit (2 x Rolls-Royce FF340): kummallakin kierrosluku n, kauha b ja ohjaussuutin delta. Suihkun liikemäärätyöntö T = Tb (n/nmax)^2,
 * paaluveto noin 3 000 kg eli 15 kN jettiä kohti (perehdytys). Kauha b = +1 täysin ylhäällä (koko suihku taakse, täysi eteenpäin-
 * työntö), b = 0 neutraali eli nettotyöntö nolla (suihku jaettu, LCD:n keskiasento), b = -1 täysi peruutus. Peruutustyöntö on
 * paikallaan noin 60 % eteenpäin-työnnöstä (reverseEff, oletus) ja kasvaa vauhdissa, koska kauha kääntää myös rungon mukana
 * tulevan virtauksen (crash stop 28 kn:sta noin 40 m, käsikirja 9.4.5, kalibroitu reverseSpeedGain-kertoimella). Suuttimen
 * kääntö delta (+ = suihku oikealle, enintään nozzleMaxDeg 30°, oletus) antaa sivuvoiman -T sin(delta) kertaa kauhakerroin
 * 0,8 + 0,2 b: neutraalissakin kauhassa suihku on olemassa ja ohjaa (siksi IDLE-säädin lisää ohjausvoimaa, käsikirja 9.4.4).
 * Sivuvoiman merkki ei vaihdu peruutettaessa (kauha kääntää virtauksen eteen ja alas, ei toiselle sivulle), joten sama suuttimen
 * asento kääntää keulaa samaan suuntaan eteen- ja taaksepäin ajossa; tämä on oletus, joka tarkistetaan veneellä.
 * Työnnön vaikutuspiste on suutin peräpeilin takana, 4,4 m painopisteen takana, y = ±0,77 m (painoarvio ±0,75, runkomalli ±0,79).
 *
 * Vectorstick DOCKING: joystick antaa halutun voiman (X eteen, Y sivulle) ja tiller halutun momentin N. Jakaja (control allocation)
 * ratkaisee jettien voimat: yhteinen X jaetaan tasan, momentti ja sivuvoima vaativat pitkittäisvoimien eron
 * dX = (N - xn Y) / d, jossa xn = -4,4 m ja d = 0,77 m, eli puhdas sivuttaissiirto vaatii toisen jetin eteen ja toisen taakse
 * noin 2,9-kertaisella voimalla sivuvoimaan nähden ja suuttimet noin 7-10° samaan suuntaan. Peruutustyöntö rajoittaa
 * sivuttaissiirtoa (noin 0,2 x jettityöntö). Kierrosluku nousee tarpeen mukaan tyhjäkäynniltä docking-rajaan (dockRpm). Jaon
 * logiikka on oma oletus Kamewan järjestelmän kuvauksen pohjalta ("joystick movements correspond to vessel movements"), ei
 * valmistajan algoritmi.
 * Vectorstick TRANSIT: tiller antaa molempien suuttimien kulman, joystickin pitkittäisakseli on yhdistetty kaasu (combinator):
 * ensimmäinen neljännes liikkeestä kääntää kauhan neutraalista täyteen (eteen tai taakse), loppu nostaa kierroksia tyhjäkäynniltä
 * täysille (peruutuksessa reverseRpmMax). Sivuttaisakselilla ei ole vaikutusta.
 * Paneelit: CLUTCH PANEL (ENGAGE/DISENG kummallekin jetille, IDLE-säädin), TRIM-ROLL PANEL (AUTO/BACKUP, näytetään),
 * BACKUP PANEL (AUTO/BACKUP kummallekin jetille: BACKUP ohittaa Vectorstickin ja mini-joystick asettaa suuttimen (x) ja
 * kauhan tai interceptorin (y, INT/WJ-kytkin) suoraan), ENGINE BACKUP PANEL (AUTO/BACKUP, PORT RPM ja STBD RPM).
 * Toimilaitteilla on hydrauliviive: suutin 30°/s, kauha neutraalista ääriasentoon 1 s, kierrosluku 1. kertaluvun viive 1,0 s.
 *
 * Kosketus (laituri, kelluva ponttoni): esteet ovat suorakaiteita maailmakoordinaatistossa. Rungon ääriviiva (kansiviiva
 * törmäyskumeineen, runkomalli) ja esteen kulmat tarkistetaan molempiin suuntiin, ja tunkeuma antaa jousi-vaimenninvoiman
 * normaalin suuntaan sekä kitkan tangentin suuntaan. Kelluva ponttoni ei välitä virtauksesta eikä sillä ole vuorovesivaihtelua.
 * Kosketukset kirjataan (nopeus, normaalinopeus, kohta) purkua varten.
 *
 * Kaikki luvut ovat SETTINGS-oliossa ja ne ovat kalibroimattomia arvioita, kunnes malli on ajettu oikealla veneellä.
 * Moduuli toimii selaimessa (window.Kasittely) ja Nodessa (module.exports). Tila on samanniminen kuin liike.js:ssä
 * (x, y, hdg, conv, v, vs, rate, trim, roll, t, clockMs, dist, cmdLog), joten plotteri ja 3D-näkymä voivat lukea sen sellaisenaan. */
(function (root) {
  'use strict';
  var KN = 1852 / 3600;
  var RAD = Math.PI / 180;

  var SETTINGS = {
    // massa ja hitaus (operointipaino 14 t, perehdytysmateriaali; Iz = m (0,25 Loa)^2)
    massKg: 14000, izKgm2: 131000,
    addedMassX: 0.05, addedMassY: 0.9, addedInertia: 0.8,   // lisätty massa osuutena massasta ja hitausmomentista (arvio, liukurunko B/T noin 4,5)
    waterRho: 1000, airRho: 1.225,
    // runko (runkomallista): painopiste peräpeilistä, kaistat [x peräpeilistä, syväys m] 0,5 m välein
    lcgFromTransomM: 3.78,
    hullStrips: [[0, 0.923], [0.5, 0.909], [1, 0.896], [1.5, 0.882], [2, 0.887], [2.5, 0.873], [3, 0.86], [3.5, 0.846], [4, 0.832], [4.5, 0.818], [5, 0.805], [5.5, 0.791], [6, 0.777], [6.5, 0.762], [7, 0.745], [7.5, 0.728], [8, 0.705], [8.5, 0.669], [9, 0.619], [9.5, 0.548], [10, 0.481], [10.5, 0.232]],
    stripDxM: 0.5,
    crossFlowCd: 1.0,                 // poikkivirtausvastuksen kerroin (kova palle, V-pohja; kalibroidaan)
    // lineaariset nostovoimatermit vauhdissa (Clarke ym. 1983, L 10,75 m, T 0,85 m, B 3,8 m, Cb 0,41): Y = |u| (yvLin v + yrLin r),
    // N = |u| (nvLin v + nrLin r); yksiköt N per (m/s)^2, N s, Nm per (m/s)^2 ja Nm s. Antavat kurssivakavuuden vauhdissa
    // (Yv' -0,034, Yr' +0,0016, Nv' -0,0135, Nr' -0,0044; Yv ja Nr kerrottu 1,2:lla, jotta käännös 5 kn:ssa ei ole pelkkä pyörähdys)
    yvLin: -2360, yrLin: 1000, nvLin: -8380, nrLin: -35300,
    // pieni lineaarinen vaimennus hitaassa liikkeessä, jotta tönäisyn jälkeinen kierto ja sorto asettuvat (ei neliöllisen poikkivirtausvastuksen puute)
    yLin0: 300, nLin0: 5000,
    // liukuvan rungon sivuttaisjäykkyys vauhdissa: Y = -yv2 u^2 v, N = -nr2 u^2 r. Täydellä tillerillä kääntösäde noin 8 m 4,5 kn:ssa, 9 m 9 kn:ssa,
    // 60 m 27 kn:ssa ja 84 m 31 kn:ssa (liike.js: 12 m 5 kn:ssa, 70 m 30 kn:ssa); nopeus putoaa käännöksessä 20-45 %
    yv2: 500, nr2: 0,
    // pitkittäisvastus: liike.js:n liukukynnyskäyrä ilman keinotekoista rLowN-termiä, lisäksi pieni lineaarinen termi (viskoosi, epästationaarinen)
    rHumpN: 16000, humpKn: 12, rPlaneN: 12000, planeKn: 17, rTopN: 21000, topKn: 35, planeExp: 1.3,
    rLinearNsPerM: 200,               // N per m/s
    reverseDragFactor: 2.5,
    // vesijetit
    jetBollardN: 15000,               // paaluveto jettiä kohti (perehdytys: noin 3 000 kg yhteensä)
    thrustSpeedLoss: 0.3, thrustRefKn: 35,   // eteenpäin-työnnön väheneminen vauhdissa (liike.js)
    reverseEff: 0.6,                  // peruutustyöntö paikallaan osuutena eteenpäin-työnnöstä (oletus)
    reverseSpeedGain: 3.5,            // peruutustyöntö kasvaa vauhdissa: kerroin (1 + gain * u / vRef) (kalibroitu: crash stop 28 kn:sta noin 40 m, 6 s)
    lateralBucketBase: 0.8, lateralBucketSlope: 0.2,   // sivuvoiman kerroin 0,8 + 0,2 b (neutraali kauha ohjaa 80 %:lla)
    nozzleMaxDeg: 30,                 // suuttimen enimmäiskulma (oletus)
    nozzleRateDegPerSec: 30, bucketRatePerSec: 1.0, rpmLagSec: 1.0, rpmRateMaxPerSec: 1200,   // kauha neutraalista ääriasentoon 1 s, täydestä eteen täyteen peruutukseen 2 s
    nozzleXFromCgM: -4.4, jetYM: 0.77,
    rpmMax: 2500, rpmIdle: 650, rpmIdleMax: 1100,   // CAT C9 2500 rpm; tyhjäkäynti ja IDLE-säätimen yläraja (oletus)
    reverseRpmMax: 1.0,               // peruutuksessa kierrokset enintään tämä osuus täysistä (oletus 100 %: crash stop vaatii täydet)
    dockRpmMax: 1500,                 // DOCKING-tilan kierrosluvun yläraja (oletus, 60 %: jettityöntö 5,4 kN, sivuttaissiirto noin 1 kn, kääntö paikallaan noin 9 °/s)
    combinatorBucketFrac: 0.25,       // TRANSIT: joystickin liikkeestä ensimmäinen neljännes on kauhaa, loppu kierroksia
    // ohjainten liikenopeudet näppäimistöllä (osuutta koko liikkeestä sekunnissa) ja tillerin jousipalautus
    tillerRatePerSec: 1.0, joystickRatePerSec: 0.8, tillerSpring: false, joystickSpringDocking: false,
    // tuuli (liike.js:n arvot) ja tuulen painekeskiö painopisteestä eteenpäin (päällysrakenne edessä)
    windSideAreaM2: 25, windFrontAreaM2: 12, windCy: 1.0, windCx: 0.6, windCpXFromCgM: 2.2,
    // kosketus (fenderit, D-kumi 100 mm): jousi N/m, vaimennin Ns/m, kitka (14 t, 0,5 kn kylki edellä: huippuvoima noin 15 kN, painuma noin 5 cm)
    contactK: 100000, contactC: 15000, contactMu: 0.4, contactLogMinMs: 0.05, contactLogGapSec: 1.0,   // kosketus kirjataan kerran, uusi merkintä vasta sekunnin erillään olon jälkeen
    crashEndMs: 0.4,                  // crash stop: ruorimies palauttaa joystickin keskelle, kun nopeus on tämän alle (kauha ehtii neutraaliin liikkeen loppuessa)
    // rungon ääriviiva [x peräpeilistä, puolileveys] (kansiviiva + törmäyskumi 0,04 m)
    hullOutline: [[-0.3, 1.2], [0, 2.245], [2, 2.247], [4, 2.249], [5, 2.242], [6, 2.206], [7, 2.123], [8, 1.98], [9, 1.773], [10, 1.503], [11, 1.152], [11.5, 0.923], [12, 0.579], [12.25, 0.06]],
    // trimmi ja kallistus näkymää varten (liike.js)
    trimPoints: [[0, 0], [6, 0.4], [10, 4.6], [12, 5], [14, 5], [17, 4.2], [22, 3.2], [28, 2.5], [35, 2.5]],
    trimLagSec: 1.0, heelMaxDeg: 8, heelRefAccel: 3.0, heelLagSec: 0.6,
    maxSubStep: 0.02
  };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function norm360(d) { return ((d % 360) + 360) % 360; }
  function wrap180(d) { return ((d + 180) % 360 + 360) % 360 - 180; }
  function trueHdg(s) { return norm360(s.hdg + s.conv); }

  // Pitkittäisvastus N nopeudella u (m/s) veden suhteen; negatiivinen u = perä edellä
  function resistance(u) {
    var S = SETTINGS, kn = Math.abs(u) / KN, r;
    if (kn <= S.humpKn) r = S.rHumpN * Math.pow(kn / S.humpKn, 2);
    else if (kn <= S.planeKn) r = lerp(S.rHumpN, S.rPlaneN, (kn - S.humpKn) / (S.planeKn - S.humpKn));
    else r = S.rPlaneN + (S.rTopN - S.rPlaneN) * Math.pow(Math.min(1.2, (kn - S.planeKn) / (S.topKn - S.planeKn)), S.planeExp);
    if (u < 0) r = S.reverseDragFactor * S.rHumpN * Math.pow(kn / S.humpKn, 2);
    r += S.rLinearNsPerM * Math.abs(u);
    return u < 0 ? -r : r;
  }
  function trimTarget(u) {
    var p = SETTINGS.trimPoints, kn = Math.max(0, u) / KN;
    if (kn <= p[0][0]) return p[0][1];
    for (var i = 1; i < p.length; i++) if (kn <= p[i][0]) return lerp(p[i - 1][1], p[i][1], (kn - p[i - 1][0]) / (p[i][0] - p[i - 1][0]));
    return p[p.length - 1][1];
  }

  // Jetin suihkun liikemäärätyöntö (N) kierrosluvulla n (rpm): eteenpäin ja peruutuksessa, veden suhteellisella pitkittäisnopeudella u
  function jetThrustFwd(n, u) {
    var S = SETTINGS, nu = clamp(n / S.rpmMax, 0, 1), f = u >= 0 ? Math.max(0, 1 - S.thrustSpeedLoss * u / (S.thrustRefKn * KN)) : 1 + S.thrustSpeedLoss * Math.min(1, -u / (S.thrustRefKn * KN));
    return S.jetBollardN * nu * nu * f;
  }
  function jetThrustRev(n, u) {
    var S = SETTINGS, nu = clamp(n / S.rpmMax, 0, 1), f = u >= 0 ? 1 + S.reverseSpeedGain * u / (S.thrustRefKn * KN) : Math.max(0, 1 - S.thrustSpeedLoss * -u / (S.thrustRefKn * KN));
    return S.reverseEff * S.jetBollardN * nu * nu * f;
  }
  function lateralFactor(b) { return SETTINGS.lateralBucketBase + SETTINGS.lateralBucketSlope * b; }
  // Yhden jetin voima runkokoordinaatistossa: { x, y } (N). b kauha -1..1, nozzleDeg suuttimen kulma (+ suihku oikealle), n rpm, u pitkittäisnopeus
  function jetForce(n, b, nozzleDeg, u, engaged) {
    if (!engaged) return { x: 0, y: 0, t: 0 };
    var d = nozzleDeg * RAD, tf = jetThrustFwd(n, u), tr = jetThrustRev(n, u);
    var x = (b >= 0 ? b * tf : b * tr) * Math.cos(d);
    var y = -Math.sin(d) * lateralFactor(b) * tf;
    return { x: x, y: y, t: tf };
  }

  // ---------------------------------------------------------------------------------------------
  // Tila
  // ---------------------------------------------------------------------------------------------
  function create(init) {
    init = init || {};
    var S = SETTINGS;
    var jet = function () { return { rpm: S.rpmIdle, rpmCmd: S.rpmIdle, bucket: 0, bucketCmd: 0, nozzle: 0, nozzleCmd: 0, tab: 0, engaged: true, backup: false, backupInt: false, backupX: 0, backupY: 0, engineBackup: false, engineBackupRpm: S.rpmIdle }; };
    return {
      t: 0, clockMs: init.clockMs || Date.now(),
      x: init.x || 0, y: init.y || 0, hdg: init.hdg || 0, conv: init.conv || 0,
      v: init.v || 0, vs: init.vs || 0, rate: 0,              // u, v (m/s) ja r (aste/s), samat nimet kuin liike.js:ssä
      trim: 0, roll: 0, dist: 0, speedFactor: 1,
      windFrom: init.windFrom || 0, windSpeed: init.windSpeed || 0,
      currentTo: 0, currentSpeed: 0,                           // virtaus: tosisuunta, johon virtaa (aste) ja nopeus (m/s); oletus 0 (kelluva laituri, ei virtausta)
      mode: init.mode || 'DOCKING',                            // JOYSTICK-ohjaimen valintakytkin: 'TRANSIT' tai 'DOCKING'
      tiller: 0, joyX: 0, joyY: 0,                             // ohjaimet -1..1: tiller (+ oikealle), joystick sivuttain (+ oikealle) ja eteen (+)
      keys: { tillerL: false, tillerR: false, fwd: false, aft: false, left: false, right: false },   // näppäinten tila (pidä pohjassa)
      idleRpm: S.rpmIdle,                                      // CLUTCH PANELin IDLE-säädin
      trimRollAuto: true, trimKnob: 0, rollKnob: 0,
      jets: [jet(), jet()],                                    // [PORT, STBD]
      demand: { X: 0, Y: 0, N: 0 },                            // DOCKING: jakajan tavoite (N, N, Nm)
      forces: { X: 0, Y: 0, N: 0, jets: [{ x: 0, y: 0 }, { x: 0, y: 0 }], hull: { X: 0, Y: 0, N: 0 }, wind: { X: 0, Y: 0, N: 0 }, contact: { X: 0, Y: 0, N: 0 } },
      obstacles: [],                                           // esteet: { kind: 'ponttoni', x, y, hdg, lengthM, widthM } (keskipiste, suunta asteina)
      contacts: [], inContact: false, crashCmd: false,
      cmdLog: []
    };
  }
  function logCmd(s, kind, value, extra) {
    var e = { t: s.t, clockMs: s.clockMs, kind: kind, value: value, x: s.x, y: s.y, hdg: s.hdg, hdgTrue: trueHdg(s), v: s.v, vs: s.vs };
    if (extra) for (var k in extra) e[k] = extra[k];
    s.cmdLog.push(e);
  }

  // ---------------------------------------------------------------------------------------------
  // Ohjaimet ja paneelit
  // ---------------------------------------------------------------------------------------------
  function setMode(s, mode) {
    mode = mode === 'TRANSIT' ? 'TRANSIT' : 'DOCKING';
    if (s.mode === mode) return;
    s.mode = mode; s.joyX = 0; s.joyY = 0;   // tilan vaihto: joystick keskelle (järjestelmä vaatii neutraalin, oletus)
    logCmd(s, 'mode', mode);
  }
  function setTiller(s, v) { s.tiller = clamp(v, -1, 1); }
  function setJoystick(s, x, y) { s.joyX = s.mode === 'DOCKING' ? clamp(x, -1, 1) : 0; s.joyY = clamp(y, -1, 1); }
  function centreTiller(s) { s.tiller = 0; logCmd(s, 'tiller0', 0); }
  function centreJoystick(s) { s.joyX = 0; s.joyY = 0; logCmd(s, 'joy0', 0); }
  function setIdle(s, rpm) { s.idleRpm = clamp(rpm, SETTINGS.rpmIdle, SETTINGS.rpmIdleMax); }
  // CLUTCH PANEL: kytkeminen onnistuu vain joystickin ollessa keskellä (käsikirja: vain merkkivalon vilkkuessa)
  function setClutch(s, side, engaged) {
    var j = s.jets[side]; engaged = !!engaged;
    if (engaged && (Math.abs(s.joyX) > 0.05 || Math.abs(s.joyY) > 0.05)) return false;
    if (j.engaged === engaged) return true;
    j.engaged = engaged; logCmd(s, engaged ? 'engage' : 'diseng', side);
    return true;
  }
  function setBackup(s, side, backup) { s.jets[side].backup = !!backup; logCmd(s, backup ? 'backup' : 'auto', side); }
  function setBackupSelector(s, side, intMode) { s.jets[side].backupInt = !!intMode; }
  function setBackupStick(s, side, x, y) { var j = s.jets[side]; j.backupX = clamp(x, -1, 1); j.backupY = clamp(y, -1, 1); }
  function setEngineBackup(s, side, backup) { s.jets[side].engineBackup = !!backup; logCmd(s, backup ? 'engbackup' : 'engauto', side); }
  function setEngineBackupRpm(s, side, rpm) { s.jets[side].engineBackupRpm = clamp(rpm, SETTINGS.rpmIdle, SETTINGS.rpmMax); }
  function setWind(s, fromDeg, speed) { s.windFrom = norm360(Number(fromDeg) || 0); s.windSpeed = Math.max(0, Number(speed) || 0); }
  function setCurrent(s, toDeg, speed) { s.currentTo = norm360(Number(toDeg) || 0); s.currentSpeed = Math.max(0, Number(speed) || 0); }
  // Crash stop (käsikirja 9.4.5): TRANSIT-tilassa joystick taakse ääriasentoon; kun eteenpäin liike loppuu, joystick keskelle
  function crashStop(s) {
    if (s.v <= SETTINGS.crashEndMs) return false;
    if (s.mode !== 'TRANSIT') setMode(s, 'TRANSIT');
    s.crashCmd = true; s.joyY = -1; s.joyX = 0; logCmd(s, 'crash', 1);
    return true;
  }
  // Näppäimen liike yhdellä akselilla, keskiasennossa pykälä (detent): kun ohjain tulee näppäimellä keskelle, se pysähtyy nollaan,
  // ja keskiasennon yli jatkaminen vaatii näppäimen vapautuksen ja uuden painalluksen. Näin ohjaimen saa näppäimillä tarkasti nollaan.
  // st on akselin painallustila { dir, start } (näppäimen suunta ja ohjaimen puoli painalluksen alussa).
  function keyAxis(value, dir, rate, dt, st) {
    if (!dir) { st.dir = 0; return value; }
    if (st.dir !== dir) { st.dir = dir; st.start = value > 0 ? 1 : value < 0 ? -1 : 0; }
    if (st.start * dir < 0 && value * st.start <= 0) return 0;   // keskellä: pysyy nollassa saman painalluksen ajan
    var nv = clamp(value + dir * rate * dt, -1, 1);
    if (st.start * dir < 0 && nv * st.start <= 0) return 0;      // ylitti keskiasennon tällä askeleella: pysähtyy nollaan
    return nv;
  }
  // Näppäinten vaikutus ohjaimiin (pidä pohjassa): tiller ja joystick liikkuvat rajoitetulla nopeudella ja jäävät asentoonsa
  function applyKeys(s, dt) {
    var S = SETTINGS, k = s.keys, st = s.keyState || (s.keyState = { t: {}, x: {}, y: {} });
    var td = (k.tillerR ? 1 : 0) - (k.tillerL ? 1 : 0);
    if (td) s.tiller = keyAxis(s.tiller, td, S.tillerRatePerSec, dt, st.t);
    else { st.t.dir = 0; if (S.tillerSpring) s.tiller -= clamp(s.tiller, -S.tillerRatePerSec * dt, S.tillerRatePerSec * dt); }
    var yd = (k.fwd ? 1 : 0) - (k.aft ? 1 : 0), xd = (k.right ? 1 : 0) - (k.left ? 1 : 0);
    if (yd) s.joyY = keyAxis(s.joyY, yd, S.joystickRatePerSec, dt, st.y); else st.y.dir = 0;
    if (s.mode === 'DOCKING') {
      if (xd) s.joyX = keyAxis(s.joyX, xd, S.joystickRatePerSec, dt, st.x); else st.x.dir = 0;
      if (!xd && S.joystickSpringDocking) s.joyX -= clamp(s.joyX, -S.joystickRatePerSec * dt, S.joystickRatePerSec * dt);
      if (!yd && S.joystickSpringDocking) s.joyY -= clamp(s.joyY, -S.joystickRatePerSec * dt, S.joystickRatePerSec * dt);
    } else { s.joyX = 0; st.x.dir = 0; }
    if (s.crashCmd && yd > 0) s.crashCmd = false;
  }

  // ---------------------------------------------------------------------------------------------
  // Vectorstick: ohjainten käskyt jettien tavoitteiksi (rpmCmd, bucketCmd, nozzleCmd)
  // ---------------------------------------------------------------------------------------------
  function bucketFromForce(x, tf, tr) { return x >= 0 ? clamp(x / Math.max(1, tf), 0, 1) : clamp(x / Math.max(1, tr), -1, 0); }
  function vectorstick(s) {
    var S = SETTINGS, nMax = S.nozzleMaxDeg, idle = s.idleRpm, u = s.v;
    var P = s.jets[0], Q = s.jets[1], i, j;
    if (s.mode === 'TRANSIT') {
      // combinator: ensimmäinen neljännes kauhaa, loppu kierroksia
      var jy = s.joyY, f = S.combinatorBucketFrac, a = Math.abs(jy), b = clamp(jy / f, -1, 1);
      var rpm = idle + (S.rpmMax * (jy < 0 ? S.reverseRpmMax : 1) - idle) * clamp((a - f) / (1 - f), 0, 1);
      if (s.crashCmd && u <= S.crashEndMs) { s.crashCmd = false; s.joyY = 0; b = 0; rpm = idle; logCmd(s, 'joy0', 0); }
      for (i = 0; i < 2; i++) { j = s.jets[i]; j.rpmCmd = rpm; j.bucketCmd = b; j.nozzleCmd = s.tiller * nMax; }
      s.demand = { X: 0, Y: 0, N: 0 };
    } else {
      // DOCKING: haluttu voima ja momentti, jakaja
      var xn = S.nozzleXFromCgM, d = S.jetYM, nDock = S.dockRpmMax;
      var tDock = jetThrustFwd(nDock, u), trDock = jetThrustRev(nDock, u);
      // ohjainten ääriasentojen voimat: eteen molemmat jetit täydellä docking-työnnöllä, sivulle ja kääntöön peruutustyöntö rajoittaa
      // (sivuttaissiirto X = 0, N = 0: X2 = -(xn/d) Y / 2 = -trDock -> Ycap = 2 trDock d / -xn; kääntö paikallaan: dX = 2 trDock -> Ncap = 2 d trDock)
      var Xcap = 2 * tDock, Ycap = 2 * trDock * d / -xn, Ncap = 2 * d * trDock;
      var X = s.joyY * Xcap, Y = s.joyX * Ycap, N = s.tiller * Ncap;
      s.demand = { X: X, Y: Y, N: N };
      // momentin jako: paikallaan (joystick keskellä) tiller tuottaa momentin jettien työntöerolla ilman sivuvoimaa; kun joystick on eteen tai taakse,
      // osuus fNoz momentista tehdään suuttimilla kuten ruorilla (sivuvoima perässä), mikä on vauhdissa 2,9-kertaisesti tehokkaampaa (xn / d)
      var fNoz = clamp(Math.abs(X) / (0.5 * Xcap), 0, 1), Ynoz = fNoz * N / xn;
      Y += Ynoz;
      var dX = (N - xn * Y) / d, X1 = (X + dX) / 2, X2 = (X - dX) / 2, Y1 = Y / 2, Y2 = Y / 2;
      // tarvittava jettityöntö ja kierrosluku
      var req = 0, xs = [X1, X2], ys = [Y1, Y2];
      for (i = 0; i < 2; i++) {
        var rx = xs[i] >= 0 ? xs[i] / 1 : -xs[i] / S.reverseEff;
        var ry = Math.abs(ys[i]) / (lateralFactor(xs[i] >= 0 ? 1 : -1) * Math.sin(nMax * RAD));
        req = Math.max(req, rx, ry);
      }
      var rpmReq = S.rpmMax * Math.sqrt(req / S.jetBollardN), rpmT = clamp(rpmReq, idle, nDock);
      var tAv = jetThrustFwd(rpmT, u), trAv = jetThrustRev(rpmT, u), scale = 1;
      // jos tarve ylittää docking-rajan, skaalataan koko voimavektori (suunta säilyy)
      if (req > tAv * 1.0001 && req > 0) scale = tAv / req;
      for (i = 0; i < 2; i++) {
        j = s.jets[i];
        var fx = xs[i] * scale, fy = ys[i] * scale, bk = bucketFromForce(fx, tAv, trAv), dl = 0;
        for (var it = 0; it < 3; it++) {
          dl = clamp(-Math.asin(clamp(fy / Math.max(1, lateralFactor(bk) * tAv), -1, 1)) / RAD, -nMax, nMax);
          bk = bucketFromForce(fx / Math.max(0.5, Math.cos(dl * RAD)), tAv, trAv);
        }
        j.rpmCmd = rpmT; j.bucketCmd = bk; j.nozzleCmd = dl;
      }
      // ohjaimet keskellä: neutraali kauha, suuttimet keskelle, tyhjäkäynti
      if (!X && !Y && !N) for (i = 0; i < 2; i++) { j = s.jets[i]; j.rpmCmd = idle; j.bucketCmd = 0; j.nozzleCmd = 0; }
    }
    // BACKUP PANEL ja ENGINE BACKUP PANEL ohittavat automatiikan
    for (i = 0; i < 2; i++) {
      j = s.jets[i];
      if (j.backup) { j.nozzleCmd = j.backupX * nMax; if (j.backupInt) j.tab = clamp(j.backupY, 0, 1); else j.bucketCmd = j.backupY; }
      if (j.engineBackup) j.rpmCmd = j.engineBackupRpm;
      if (!j.engaged) j.rpmCmd = Math.max(j.rpmCmd, idle);
    }
  }
  // Toimilaitteiden seuranta: suutin ja kauha nopeusrajoitettuina, kierrosluku viiveellä ja nopeusrajalla
  function actuators(s, dt) {
    var S = SETTINGS;
    for (var i = 0; i < 2; i++) {
      var j = s.jets[i], mx = S.nozzleRateDegPerSec * dt, mb = S.bucketRatePerSec * dt;
      j.nozzle += clamp(j.nozzleCmd - j.nozzle, -mx, mx);
      j.bucket += clamp(j.bucketCmd - j.bucket, -mb, mb);
      var dr = (j.rpmCmd - j.rpm) * (1 - Math.exp(-dt / S.rpmLagSec)), mr = S.rpmRateMaxPerSec * dt;
      j.rpm += clamp(dr, -mr, mr);
      if (s.trimRollAuto && !j.backup) j.tab = clamp((s.v / KN - 8) / 14, 0, 1) * 0.6;   // interceptorit AUTO: seuraavat vauhtia (vain näyttöä varten)
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Voimat
  // ---------------------------------------------------------------------------------------------
  // Runkovoimat veden suhteellisilla nopeuksilla ur, vr (m/s) ja r (rad/s)
  function hullForces(ur, vr, r) {
    var S = SETTINGS, q = 0.5 * S.waterRho * S.crossFlowCd, Y = 0, N = 0;
    for (var i = 0; i < S.hullStrips.length; i++) {
      var st = S.hullStrips[i], xb = st[0] + S.stripDxM / 2 - S.lcgFromTransomM, vc = vr + xb * r;
      var dy = -q * st[1] * S.stripDxM * vc * Math.abs(vc);
      Y += dy; N += xb * dy;
    }
    var au = Math.abs(ur);
    var u2 = ur * ur;
    Y += au * (S.yvLin * vr + S.yrLin * r) - S.yLin0 * vr - S.yv2 * u2 * vr;
    N += au * (S.nvLin * vr + S.nrLin * r) - S.nLin0 * r - S.nr2 * u2 * r;
    return { X: -resistance(ur), Y: Y, N: N };
  }
  // Tuulen voimat ja momentti runkokoordinaatistossa (liike.js:n kaava, lisäksi momentti painekeskiöstä)
  function windForces(s) {
    var S = SETTINGS;
    if (!(s.windSpeed > 0) && !s.v && !s.vs) return { X: 0, Y: 0, N: 0, app: 0, rel: 0 };
    var h = trueHdg(s) * RAD, to = (s.windFrom + 180) * RAD;
    var we = Math.sin(to) * s.windSpeed, wn = Math.cos(to) * s.windSpeed;
    var wf = we * Math.sin(h) + wn * Math.cos(h), wr = we * Math.cos(h) - wn * Math.sin(h);
    var ax = wf - s.v, ay = wr - s.vs, aa = Math.hypot(ax, ay), q = 0.5 * S.airRho;
    var X = q * S.windCx * S.windFrontAreaM2 * (ax * aa - (-s.v) * Math.abs(s.v));   // pitkittäisvoimasta vain ero tyyneen (vastuskäyrä sisältää ilmanvastuksen)
    var Y = q * S.windCy * S.windSideAreaM2 * ay * aa;
    return { X: X, Y: Y, N: S.windCpXFromCgM * Y, app: aa, rel: norm360(Math.atan2(-ay, -ax) / RAD) };
  }

  // Rungon ääriviiva maailmakoordinaatistossa [[x, y], ...] myötäpäivään keulasta
  function hullPolygon(s) {
    var S = SETTINGS, o = S.hullOutline, pts = [], h = s.hdg * RAD, sh = Math.sin(h), ch = Math.cos(h), lcg = S.lcgFromTransomM;
    var add = function (xb, yb) { pts.push([s.x + sh * xb + ch * yb, s.y + ch * xb - sh * yb]); };
    for (var i = o.length - 1; i >= 0; i--) add(o[i][0] - lcg, o[i][1]);      // oikea kylki keulasta perään
    for (i = 0; i < o.length; i++) add(o[i][0] - lcg, -o[i][1]);             // vasen kylki perästä keulaan
    return pts;
  }
  function obstaclePolygon(ob) {
    var h = ob.hdg * RAD, sh = Math.sin(h), ch = Math.cos(h), L = ob.lengthM / 2, W = ob.widthM / 2, pts = [];
    [[L, W], [L, -W], [-L, -W], [-L, W]].forEach(function (p) { pts.push([ob.x + sh * p[0] + ch * p[1], ob.y + ch * p[0] - sh * p[1]]); });
    return pts;
  }
  function pointInPoly(p, poly) {
    var inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  // Lähin reuna monikulmion sisällä olevalle pisteelle: { dist, nx, ny } (normaali ulospäin)
  function nearestEdge(p, poly) {
    var best = null;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var ax = poly[j][0], ay = poly[j][1], bx = poly[i][0], by = poly[i][1], ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey || 1e-9;
      var t = clamp(((p[0] - ax) * ex + (p[1] - ay) * ey) / l2, 0, 1), cx = ax + t * ex, cy = ay + t * ey, d = Math.hypot(p[0] - cx, p[1] - cy);
      if (!best || d < best.dist) { var nx = cx - p[0], ny = cy - p[1], nl = Math.hypot(nx, ny) || 1; best = { dist: d, nx: nx / nl, ny: ny / nl, cx: cx, cy: cy }; }
    }
    return best;
  }
  // Kosketusvoimat: rungon pisteet esteessä ja esteen kulmat rungossa. Palauttaa runkokoordinaatiston { X, Y, N } ja kirjaa kosketukset.
  function contactForces(s, dt) {
    var S = SETTINGS, X = 0, Y = 0, N = 0, any = false, logged = false;
    if (!s.obstacles.length) { s.inContact = false; return { X: 0, Y: 0, N: 0 }; }
    var hull = hullPolygon(s), h = s.hdg * RAD, sh = Math.sin(h), ch = Math.cos(h), r = s.rate * RAD;
    var apply = function (px, py, nx, ny, pen) {
      // pisteen nopeus maailmassa (runko + kierto), normaali (nx, ny) osoittaa pisteestä ulos esteestä eli voiman suuntaan rungolle
      var rx = px - s.x, ry = py - s.y, vwx = s.v * sh + s.vs * ch + s.currentE, vwy = s.v * ch - s.vs * sh + s.currentN;
      vwx += r * ry; vwy += -r * rx;   // kierto myötäpäivään (hdg kasvaa myötäpäivään): piste keulassa (pohjoisessa) liikkuu itään, nopeus r * (ry, -rx)
      var vn = vwx * nx + vwy * ny;    // normaalinopeus (+ erkanee)
      var fn = S.contactK * pen - S.contactC * Math.min(0, vn); if (fn < 0) fn = 0;
      var tx = -ny, ty = nx, vt = vwx * tx + vwy * ty, ft = -S.contactMu * fn * clamp(vt / 0.05, -1, 1);
      var fx = fn * nx + ft * tx, fy = fn * ny + ft * ty;
      var bx = fx * sh + fy * ch, by = fx * ch - fy * sh;   // maailmasta runkoon: eteen = (sin h, cos h), oikealle = (cos h, -sin h)
      var rbx = rx * sh + ry * ch, rby = rx * ch - ry * sh;
      X += bx; Y += by; N += rbx * by - rby * bx; any = true;
      if (!logged && !s.inContact && -vn > S.contactLogMinMs && s.t - (s.lastContactT || -1e9) > S.contactLogGapSec) {
        logged = true; s.lastContactT = s.t;
        logCmd(s, 'kosketus', Math.round(-vn / KN * 100) / 100, { vnMs: -vn, speedKn: Math.hypot(s.v, s.vs) / KN, px: px, py: py });
      }
    };
    for (var k = 0; k < s.obstacles.length; k++) {
      var poly = obstaclePolygon(s.obstacles[k]), i, p, e;
      // rungon piste esteen sisällä: lähin reuna osoittaa esteestä ulos, voima rungolle samaan suuntaan
      for (i = 0; i < hull.length; i++) { p = hull[i]; if (pointInPoly(p, poly)) { e = nearestEdge(p, poly); apply(p[0], p[1], e.nx, e.ny, e.dist); } }
      // esteen kulma rungon sisällä: lähin reuna osoittaa rungosta ulos (kulman poistumissuunta), runkoa työnnetään vastakkaiseen suuntaan
      for (i = 0; i < poly.length; i++) { p = poly[i]; if (pointInPoly(p, hull)) { e = nearestEdge(p, hull); apply(p[0], p[1], -e.nx, -e.ny, e.dist); } }
    }
    if (any) s.lastContactT = s.t;   // kosketuksen kesto: erillään olon laskenta alkaa, kun kosketus päättyy
    s.inContact = any;
    return { X: X, Y: Y, N: N };
  }

  // ---------------------------------------------------------------------------------------------
  // Integrointi
  // ---------------------------------------------------------------------------------------------
  function stepOnce(s, dt) {
    var S = SETTINGS, m = S.massKg, mx = m * (1 + S.addedMassX), my = m * (1 + S.addedMassY), iz = S.izKgm2 * (1 + S.addedInertia);
    applyKeys(s, dt);
    vectorstick(s);
    actuators(s, dt);
    // virtaus itä-pohjoinen: s.v ja s.vs ovat nopeuksia veden suhteen (STW), virtaus lisätään paikan integrointiin ja kosketuksen nopeuteen
    var ct = s.currentTo * RAD; s.currentE = Math.sin(ct) * s.currentSpeed; s.currentN = Math.cos(ct) * s.currentSpeed;
    var h = s.hdg * RAD;
    var ur = s.v, vr = s.vs, r = s.rate * RAD;
    // voimat
    var H = hullForces(ur, vr, r), W = windForces(s), C = contactForces(s, dt);
    var JX = 0, JY = 0, JN = 0, jf = [];
    for (var i = 0; i < 2; i++) {
      var j = s.jets[i], f = jetForce(j.rpm, j.bucket, j.nozzle, ur, j.engaged), yj = i === 0 ? -S.jetYM : S.jetYM;
      JX += f.x; JY += f.y; JN += S.nozzleXFromCgM * f.y - yj * f.x; jf.push({ x: f.x, y: f.y, t: f.t });
    }
    var X = H.X + JX + W.X + C.X, Y = H.Y + JY + W.Y + C.Y, N = H.N + JN + W.N + C.N;
    s.forces = { X: X, Y: Y, N: N, jets: jf, hull: H, wind: { X: W.X, Y: W.Y, N: W.N }, contact: C, app: W.app, rel: W.rel };
    // kiihtyvyydet: jäykän kappaleen Coriolis-termit massalla m; lisätyn massan Munk-vaikutukset sisältyvät lineaarisiin derivaattoihin (Nv)
    var du = (X + m * s.vs * r) / mx, dv = (Y - m * s.v * r) / my, dr = N / iz;
    var u0 = s.v;
    s.v += du * dt; s.vs += dv * dt; r += dr * dt;
    // pysähtyminen: pieni ryömintä nollataan, jos työntö ja ulkoiset voimat puuttuvat (numeerinen siisteys, ei fysiikkaa)
    if (Math.abs(JX) < 1 && Math.abs(W.X) < 1 && !C.X && Math.abs(s.v) < 0.003 && !s.currentSpeed) s.v = 0;
    if (Math.abs(JY) < 1 && Math.abs(W.Y) < 1 && !C.Y && Math.abs(s.vs) < 0.003 && !s.currentSpeed) s.vs = 0;
    if (Math.abs(JN) < 1 && Math.abs(W.N) < 1 && !C.N && Math.abs(r) < 0.0005) r = 0;
    s.rate = r / RAD;
    // paikka: nopeus veden suhteen + virtaus
    var hm = h + 0.5 * r * dt, ds = s.v * dt, dsl = s.vs * dt;
    s.hdg = norm360(s.hdg + s.rate * dt);
    s.x += Math.sin(hm) * ds + Math.cos(hm) * dsl + s.currentE * dt;
    s.y += Math.cos(hm) * ds - Math.sin(hm) * dsl + s.currentN * dt;
    s.dist += Math.hypot(ds, dsl);
    // trimmi ja kallistus (näkymä): keskihakukiihtyvyys ja sivuttaiskiihtyvyys
    s.trim += (trimTarget(s.v) - s.trim) * (1 - Math.exp(-dt / S.trimLagSec));
    var ac = s.v * r + dv;
    s.roll += (clamp(ac / S.heelRefAccel, -1, 1) * S.heelMaxDeg - s.roll) * (1 - Math.exp(-dt / S.heelLagSec));
    s.t += dt; s.clockMs += dt * 1000;
  }
  function advance(s, dt) {
    var n = Math.max(1, Math.ceil(dt / SETTINGS.maxSubStep)), h = dt / n;
    for (var i = 0; i < n; i++) stepOnce(s, h);
  }
  function stepFrame(s, realDt) {
    if (!(s.speedFactor > 0)) return 0;
    var dt = Math.min(realDt, 0.25) * s.speedFactor;
    advance(s, dt);
    return dt;
  }

  // ---------------------------------------------------------------------------------------------
  // Apufunktiot käyttöliittymälle ja testeille
  // ---------------------------------------------------------------------------------------------
  function sog(s) { var e = s.v * Math.sin(s.hdg * RAD) + s.vs * Math.cos(s.hdg * RAD) + (s.currentE || 0), n = s.v * Math.cos(s.hdg * RAD) - s.vs * Math.sin(s.hdg * RAD) + (s.currentN || 0); return Math.hypot(e, n); }
  function cogTrue(s) { var e = s.v * Math.sin(s.hdg * RAD) + s.vs * Math.cos(s.hdg * RAD) + (s.currentE || 0), n = s.v * Math.cos(s.hdg * RAD) - s.vs * Math.sin(s.hdg * RAD) + (s.currentN || 0); return Math.hypot(e, n) > 0.02 ? norm360(Math.atan2(e, n) / RAD + s.conv) : trueHdg(s); }
  function cogGrid(s) { return norm360(cogTrue(s) - s.conv); }
  // Esteet: kelluva ponttoni (keskipiste, suunta, pituus, leveys)
  function addPontoon(s, x, y, hdgDeg, lengthM, widthM) { var ob = { kind: 'ponttoni', x: x, y: y, hdg: norm360(hdgDeg), lengthM: lengthM, widthM: widthM }; s.obstacles.push(ob); return ob; }
  function clearObstacles(s) { s.obstacles = []; s.inContact = false; }
  // Lyhin etäisyys rungon ääriviivasta esteeseen (m, negatiivinen = sisällä) näyttöä varten
  function distanceToObstacle(s, ob) {
    var hull = hullPolygon(s), poly = obstaclePolygon(ob), best = Infinity, i, e;
    for (i = 0; i < hull.length; i++) { e = nearestEdge(hull[i], poly); var d = pointInPoly(hull[i], poly) ? -e.dist : e.dist; if (d < best) best = d; }
    for (i = 0; i < poly.length; i++) { e = nearestEdge(poly[i], hull); d = pointInPoly(poly[i], hull) ? -e.dist : e.dist; if (d < best) best = d; }
    return best;
  }
  // Ohjaimet lukuina LCD-paneelia varten
  function panel(s) {
    return s.jets.map(function (j, i) { return { side: i === 0 ? 'PORT' : 'STBD', rpm: Math.round(j.rpm), bucket: j.bucket, nozzle: j.nozzle, tab: j.tab, engaged: j.engaged, backup: j.backup, engineBackup: j.engineBackup }; });
  }
  function speedText(s) { return (s.v / KN).toFixed(1) + ' kn'; }

  var api = {
    KN: KN, SETTINGS: SETTINGS, create: create, stepOnce: stepOnce, advance: advance, stepFrame: stepFrame,
    setMode: setMode, setTiller: setTiller, setJoystick: setJoystick, centreTiller: centreTiller, centreJoystick: centreJoystick, setIdle: setIdle,
    setClutch: setClutch, setBackup: setBackup, setBackupSelector: setBackupSelector, setBackupStick: setBackupStick, setEngineBackup: setEngineBackup, setEngineBackupRpm: setEngineBackupRpm,
    setWind: setWind, setCurrent: setCurrent, crashStop: crashStop, addPontoon: addPontoon, clearObstacles: clearObstacles, distanceToObstacle: distanceToObstacle,
    hullPolygon: hullPolygon, obstaclePolygon: obstaclePolygon, panel: panel, trueHdg: trueHdg, wrap180: wrap180, sog: sog, cogTrue: cogTrue, cogGrid: cogGrid,
    resistance: resistance, jetThrustFwd: jetThrustFwd, jetThrustRev: jetThrustRev, jetForce: jetForce, hullForces: hullForces, windForces: windForces, trimTarget: trimTarget, speedText: speedText
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Kasittely = api;
})(typeof window !== 'undefined' ? window : globalThis);
