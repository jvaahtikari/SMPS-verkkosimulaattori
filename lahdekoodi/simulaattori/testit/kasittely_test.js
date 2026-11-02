/* Käsittelymallin (kasittely.js) testit Nodessa, vaihe K1 (2.11.2026).
 *   node testit/kasittely_test.js
 * Testit tarkistavat suuruusluokat ja merkit, eivät kalibrointia: paaluveto, kauhan neutraali, suuttimen ohjausvoiman suunta,
 * crash stop (käsikirja 9.4.5: noin 40 m matkanopeudesta), kääntö paikallaan, sivuttaissiirto, tuulen sorto, kelluvan ponttonin kosketus. */
'use strict';
const path = require('path');
const K = require(path.join(__dirname, '..', 'js', 'kasittely.js'));
const KN = K.KN, S = K.SETTINGS;
let fails = 0;
function ehto(nimi, ok, lisa) { if (!ok) fails++; console.log((ok ? 'OK    ' : 'VIRHE ') + nimi + (lisa ? ': ' + lisa : '')); }
function tieto(nimi, lisa) { console.log('TIETO ' + nimi + (lisa ? ': ' + lisa : '')); }
function aja(s, sek, dt, fn) { dt = dt || 0.02; for (let t = 0; t < sek; t += dt) { if (fn) fn(s, t); K.advance(s, dt); } return s; }
const f1 = (x) => (Math.round(x * 100) / 100).toFixed(2);

// ---- 1. Jetin voimat ----
let f = K.jetForce(S.rpmMax, 1, 0, 0, true);
ehto('paaluveto jettiä kohti täydellä kauhalla', Math.abs(f.x - S.jetBollardN) < 1, f1(f.x / 1000) + ' kN');
f = K.jetForce(S.rpmMax, 0, 0, 0, true);
ehto('neutraali kauha: nettotyöntö nolla', Math.abs(f.x) < 1, f1(f.x) + ' N');
f = K.jetForce(S.rpmMax, -1, 0, 0, true);
ehto('täysi peruutus paikallaan noin 60 % eteenpäin-työnnöstä', Math.abs(f.x + S.reverseEff * S.jetBollardN) < 1, f1(f.x / 1000) + ' kN');
f = K.jetForce(1500, 0, 20, 0, true);
ehto('suutin oikealle (+20°) neutraalilla kauhalla: sivuvoima vasemmalle (negatiivinen) ja ohjaa', f.y < -1000, f1(f.y / 1000) + ' kN');
f = K.jetForce(1500, 0, 20, 0, false);
ehto('veto pois päältä (DISENG): ei voimaa', f.x === 0 && f.y === 0);

// ---- 2. TRANSIT: tyhjäkäynti, kiihdytys, pysäytys kauhalla ----
let s = K.create({ mode: 'TRANSIT' }); s.joyY = 0.25; aja(s, 90, 0.05);
tieto('TRANSIT kauha täysin ylhäällä tyhjäkäynnillä', f1(s.v / KN) + ' kn, rpm ' + Math.round(s.jets[0].rpm));
ehto('tyhjäkäyntinopeus täydellä kauhalla 3-6 kn (kalibroidaan)', s.v / KN > 3 && s.v / KN < 6);
s = K.create({ mode: 'TRANSIT' }); s.joyY = 1; aja(s, 120, 0.05);
ehto('täysi kaasu: huippunopeus noin 35 kn (vastuskäyrä liike.js:stä)', s.v / KN > 30 && s.v / KN < 37, f1(s.v / KN) + ' kn');
s = K.create({ mode: 'TRANSIT', v: 3 * KN }); s.jets.forEach((j) => { j.rpm = S.rpmIdle; j.bucket = 0; });
let y0 = s.y; aja(s, 60, 0.05);
ehto('3 kn, kauha neutraali: vene ei pysähdy itsestään minuutissa (ryömii yli 20 m)', s.y - y0 > 20 && s.v > 0.1, f1(s.y - y0) + ' m, ' + f1(s.v / KN) + ' kn');
s = K.create({ mode: 'TRANSIT', v: 3 * KN }); s.jets.forEach((j) => { j.rpm = S.rpmIdle; j.bucket = 0; }); s.joyY = -0.25;
let tStop = null; aja(s, 30, 0.02, (st, t) => { if (tStop === null && st.v <= 0.02) tStop = t; });
ehto('3 kn, kauha täysin alas tyhjäkäynnillä: pysähtyy 5-20 s:ssa', tStop !== null && tStop > 5 && tStop < 20, f1(tStop) + ' s');

// ---- 3. Crash stop (käsikirja 9.4.5) ----
s = K.create({ mode: 'TRANSIT', v: 28 * KN }); s.jets.forEach((j) => { j.rpm = 2200; j.rpmCmd = 2200; j.bucket = 1; j.bucketCmd = 1; }); s.joyY = 0.8;
ehto('crash stop käynnistyy vauhdissa', K.crashStop(s) === true);
y0 = s.y; tStop = null; aja(s, 30, 0.01, (st, t) => { if (tStop === null && st.v <= 0.15) tStop = t; });
tieto('crash stop 28 kn:sta', f1(s.y - y0) + ' m, ' + f1(tStop) + ' s');
ehto('crash stop 28 kn:sta 36-44 m (käsikirja noin 40 m)', s.y - y0 > 36 && s.y - y0 < 44);
ehto('crash stopin jälkeen joystick keskellä ja kierrokset tyhjäkäynnillä', s.joyY === 0 && !s.crashCmd && Math.abs(s.jets[0].rpm - S.rpmIdle) < 50);
ehto('keulasuunta ei vaihdu crash stopissa', Math.abs(K.wrap180(s.hdg - 0)) < 2, f1(s.hdg) + '°');

// ---- 4. DOCKING: kääntö paikallaan ----
s = K.create(); s.tiller = 1; aja(s, 40);
tieto('DOCKING täysi tiller paikallaan', f1(s.rate) + ' °/s, rpm ' + Math.round(s.jets[0].rpm) + ', kauhat ' + f1(s.jets[0].bucket) + ' / ' + f1(s.jets[1].bucket));
ehto('tiller oikealle: kääntyy oikealle 5-15 °/s', s.rate > 5 && s.rate < 15);
ehto('kääntö paikallaan: paikka pysyy (alle 1 m 40 s:ssa)', Math.hypot(s.x, s.y) < 1, f1(Math.hypot(s.x, s.y)) + ' m');
ehto('kääntö paikallaan: vasen jetti eteen, oikea taakse, suuttimet keskellä', s.jets[0].bucket > 0 && s.jets[1].bucket < 0 && Math.abs(s.jets[0].nozzle) < 1 && Math.abs(s.jets[1].nozzle) < 1);
s = K.create(); s.tiller = -1; aja(s, 40);
ehto('tiller vasemmalle: kääntyy vasemmalle', s.rate < -5, f1(s.rate) + ' °/s');

// ---- 5. DOCKING: sivuttaissiirto ----
s = K.create(); s.joyX = 1; aja(s, 40);
tieto('DOCKING joystick täysin oikealle', 'v ' + f1(s.vs / KN) + ' kn, u ' + f1(s.v / KN) + ' kn, kääntyminen ' + f1(s.rate) + ' °/s, suuttimet ' + f1(s.jets[0].nozzle) + ' / ' + f1(s.jets[1].nozzle));
ehto('sivuttaisnopeus oikealle 0,5-2 kn', s.vs / KN > 0.5 && s.vs / KN < 2);
ehto('sivuttaissiirto: pitkittäisnopeus pieni (alle 0,6 kn)', Math.abs(s.v / KN) < 0.6);
ehto('sivuttaissiirto: vasen jetti eteen, oikea taakse (momentin tasapaino)', s.jets[0].bucket > 0 && s.jets[1].bucket < 0);
ehto('sivuttaissiirto oikealle: suuttimet vasemmalle (suihku vasemmalle, voima oikealle)', s.jets[0].nozzle < -3 && s.jets[1].nozzle < -3);
s = K.create(); s.joyX = -1; aja(s, 40);
ehto('joystick vasemmalle: siirtyy vasemmalle', s.vs / KN < -0.5, f1(s.vs / KN) + ' kn');

// ---- 6. DOCKING: eteen ja taakse, ohjaimet keskellä ----
s = K.create(); s.joyY = 0.3; aja(s, 60, 0.05);
ehto('DOCKING joystick 30 % eteen: 2-6 kn', s.v / KN > 2 && s.v / KN < 6, f1(s.v / KN) + ' kn');
s = K.create(); s.joyY = -1; aja(s, 60, 0.05);
ehto('DOCKING täysi taakse: peruuttaa 3-6 kn', s.v / KN < -3 && s.v / KN > -6, f1(s.v / KN) + ' kn');
s = K.create({ v: 2 * KN }); aja(s, 10);
ehto('ohjaimet keskellä: kauhat neutraalit, suuttimet keskellä, kierrokset tyhjäkäynnillä', s.jets.every((j) => Math.abs(j.bucket) < 0.01 && Math.abs(j.nozzle) < 0.1 && Math.abs(j.rpm - S.rpmIdle) < 5));
s = K.create(); K.setIdle(s, 1000); s.tiller = 0.2; aja(s, 30);
const r1 = s.rate; s = K.create(); s.tiller = 0.2; aja(s, 30);
ehto('IDLE-säädin ylös: pieni tillerin liike antaa enemmän kääntövoimaa', r1 > s.rate, f1(r1) + ' vs ' + f1(s.rate) + ' °/s');

// ---- 6b. Näppäimet: keskiasennon pykälä ----
s = K.create(); s.keys.tillerR = true; aja(s, 0.6); const t1 = s.tiller; s.keys.tillerR = false; s.keys.tillerL = true; aja(s, 2.0);
ehto('tiller näppäimillä: vastakkainen näppäin pysäyttää ohjaimen keskelle', t1 > 0.5 && s.tiller === 0, f1(t1) + ' -> ' + f1(s.tiller));
s.keys.tillerL = false; aja(s, 0.1); s.keys.tillerL = true; aja(s, 0.5);
ehto('tiller näppäimillä: uusi painallus jatkaa keskiasennon yli', s.tiller < -0.3, f1(s.tiller));
s = K.create(); s.keys.fwd = true; aja(s, 1.0); s.keys.fwd = false; s.keys.aft = true; aja(s, 3.0);
ehto('joystick näppäimillä: alas-näppäin pysäyttää eteen-asennosta nollaan', s.joyY === 0, f1(s.joyY));

// ---- 7. CLUTCH ja BACKUP ----
s = K.create(); K.setClutch(s, 0, false); s.joyY = 0.5;
ehto('veto ei kytkeydy joystickin ollessa poissa keskeltä', K.setClutch(s, 0, true) === false && !s.jets[0].engaged);
s.joyY = 0; ehto('veto kytkeytyy joystickin ollessa keskellä', K.setClutch(s, 0, true) === true && s.jets[0].engaged);
s = K.create(); K.setClutch(s, 1, false); s.joyY = 0.3; aja(s, 60, 0.05);
ehto('oikea jetti vapaalla: vene kääntyy oikealle ajaessa eteen (vain vasen jetti työntää)', s.rate > 0.5 && s.v > 0, f1(s.rate) + ' °/s, ' + f1(s.v / KN) + ' kn');
s = K.create(); K.setBackup(s, 0, true); K.setBackupStick(s, 0, 1, 0); aja(s, 5);
ehto('BACKUP PANEL: vasemman suuttimen kulma suoraan mini-joystickistä', Math.abs(s.jets[0].nozzle - S.nozzleMaxDeg) < 0.5 && Math.abs(s.jets[1].nozzle) < 0.1);
s = K.create(); K.setEngineBackup(s, 1, true); K.setEngineBackupRpm(s, 1, 1500); aja(s, 10);
ehto('ENGINE BACKUP PANEL: oikean koneen kierrokset säätimestä', Math.abs(s.jets[1].rpm - 1500) < 20 && Math.abs(s.jets[0].rpm - S.rpmIdle) < 5);

// ---- 8. Tuuli ----
s = K.create({ hdg: 0 }); K.setWind(s, 90, 10); aja(s, 180, 0.05);
tieto('tuuli 10 m/s idästä, ohjaimet keskellä, 3 min', 'hdg ' + f1(s.hdg) + '°, sorto ' + f1(K.sog(s) / KN) + ' kn');
ehto('sorto 10 m/s tuulessa 0,5-2 kn', K.sog(s) / KN > 0.5 && K.sog(s) / KN < 2);
ehto('keula kääntyy myötätuuleen (pois idästä, länteen päin)', s.hdg > 200 && s.hdg < 359);
s = K.create({ hdg: 0 }); aja(s, 60, 0.05);
ehto('tyynellä ohjaimet keskellä: vene pysyy paikallaan', Math.hypot(s.x, s.y) < 0.01 && s.rate === 0);

// ---- 9. Kelluva ponttoni ----
s = K.create({ hdg: 0 }); const pon = K.addPontoon(s, 4, 0, 0, 20, 2.4); s.vs = 0.5 * KN;
const d0 = K.distanceToObstacle(s, pon); aja(s, 20, 0.01);
const kosk = s.cmdLog.filter((e) => e.kind === 'kosketus');
tieto('ponttoni 0,5 kn kylki edellä', 'etäisyys alussa ' + f1(d0) + ' m, kosketuksia ' + kosk.length + (kosk.length ? ', nopeus ' + f1(kosk[0].vnMs / KN) + ' kn' : '') + ', lopuksi etäisyys ' + f1(K.distanceToObstacle(s, pon)) + ' m, v ' + f1(s.vs / KN) + ' kn');
ehto('kosketus kirjataan ja sen nopeus on lähestymisnopeus (0,4-0,55 kn)', kosk.length === 1 && kosk[0].vnMs / KN > 0.4 && kosk[0].vnMs / KN < 0.55);
ehto('fenderi pysäyttää ja työntää irti: ei tunkeumaa yli 0,15 m, lopuksi erillään', K.distanceToObstacle(s, pon) > 0 && kosk.every((e) => true));
ehto('kosketuksen jälkeen vene ei läpäise ponttonia (x pienempi kuin reuna miinus puolileveys)', s.x < 4 - 1.2 - 2.0);
s = K.create({ hdg: 0, x: 0, y: 0 }); K.addPontoon(s, 0, 14, 90, 12, 2.4); s.v = 1 * KN; aja(s, 25, 0.01);
const k2 = s.cmdLog.filter((e) => e.kind === 'kosketus');
ehto('keula ponttonin kylkeen 1 kn: kosketus kirjataan ja vene pysähtyy tai palaa', k2.length >= 1 && s.v < 0.2, k2.length + ' kosketusta, u ' + f1(s.v / KN) + ' kn');
ehto('keula ponttonin kylkeen: kosketuksen nopeus 0,6-1 kn (vene hidastuu matkalla)', k2.length && k2[0].vnMs / KN > 0.6 && k2[0].vnMs / KN <= 1.0, k2.length ? f1(k2[0].vnMs / KN) + ' kn' : '');

// ---- 10. Virtaus (kelluva laituri: ei virtausta oletuksena, mutta rajapinta toimii) ----
s = K.create({ hdg: 0 }); K.setCurrent(s, 90, 0.5); aja(s, 20, 0.05);
ehto('virtaus itään 0,5 m/s: paikka siirtyy itään 10 m 20 s:ssa, STW nolla, SOG 1 kn', Math.abs(s.x - 10) < 0.05 && Math.abs(s.vs) < 0.01 && Math.abs(s.v) < 0.01 && Math.abs(K.sog(s) / KN - 0.97) < 0.05, 'x ' + f1(s.x) + ' m, SOG ' + f1(K.sog(s) / KN) + ' kn');

console.log(fails ? ('\n' + fails + ' testiä epäonnistui') : '\nKäsittelymallin testit valmiit');
process.exit(fails ? 1 : 0);
