# SMPS-verkkosimulaattori

Selaimessa toimiva navigointisimulaattori meripelastajien koulutukseen. Harjoitusalus on Meripelastusseuran Pv417 Repa ja alue Näsijärvi. Navigoija antaa käskyt SARNavin näköisen plotterin ja tutkan avulla, ja simuloitu ruorimies toteuttaa ne. Mukana on Reittikartta, jolla reitti luonnostellaan ja tuodaan simulaattoriin.

Simulaattori toimii tietokoneella, tabletilla ja puhelimella ilman asennusta ja tunnuksia.

**Ei navigointikäyttöön.** Kartta- ja maastoaineistot ovat avointa dataa, joka ei täytä merikartan vaatimuksia.

**Ei Meripelastusseuran virallinen ohjelma.** Sovellus on tehty vapaaehtoisena harrastustyönä, eikä se sisällä SARNavin koodia eikä grafiikkaa. Lähdekoodi on julkinen ja annettu Meripelastusseuran käyttöön korvauksetta.

## Sisällys

- [Mitä simulaattorissa voi tehdä](#mitä-simulaattorissa-voi-tehdä)
- [Käyttö](#käyttö)
- [Komennot ja näppäimet](#komennot-ja-näppäimet)
- [Reittikartta](#reittikartta)
- [Mallit lyhyesti](#mallit-lyhyesti)
- [Repon rakenne](#repon-rakenne)
- [Julkaisu](#julkaisu)
- [Kulut](#kulut)
- [Kehitys ja testaus](#kehitys-ja-testaus)
- [Aineistot ja lisenssit](#aineistot-ja-lisenssit)
- [Lisenssi](#lisenssi)
- [Jatkokehitys](#jatkokehitys)

## Mitä simulaattorissa voi tehdä

**Harjoitus ja reitit**

- Demoreitti, vapaa ajo Mustalahdesta tai oma reitti Reittikartasta tai GPX-tiedostosta. Reittikartan sivuutukset, suuntanuotit ja käännökset näkyvät plotterissa.
- Lähtö reitin alusta tai lopusta, alus lähtee levosta.
- Ajon jälkeen purku: ajettu reitti kartalla, aika, matka ja keskinopeus, väyläalueen sisällä ajettu osuus, käskyloki, pohjakosketukset, törmäykset ja kosketukset esteisiin, aallokko ja aaltoiskut sekä tuuli.

**Näkymät**

- 3D-näkymä ohjaamosta navigoijan (vasen) tai ruorimiehen (oikea) paikalta. Maasto, rakennukset, metsä, laiturit, sillat, maamerkit, turvalaitteet ja ilmakuvasta tunnistetut kiinnitetyt veneet. Katse kääntyy sivuille, ja mukana on 7x50-kiikari.
- Valinnainen Google 3D -maisema (fotorealistinen), jonka päälle piirretään oma vesi, vene ja merkit. Hämärässä ja yöllä käytetään omaa maisemaa, koska Googlen kuva on päivänvalokuva.
- Plotteri SARNavin tapaan: tietopalsta (HDG, SOG, COG, sijainti, kello), harppi, suuntima (EBL/VRM, lukittava), vektori, sivuutukset ja suuntanuotit, yönäyttö.
- Tutka: kaikumalli maastosta, rakennuksista, puustosta, laitureista, silloista, turvalaitteista ja veneistä. RANGE, EBL ja VRM, offset, suunta ylös tai pohjoinen ylös, jälki, sadesuodatin, SEA-säätö (merivälkkeen vaimennus) ja viritys.

**Ohjaus ja liikemalli**

- Navigoija antaa suunta- ja nopeuskäskyt, simuloitu ruorimies toteuttaa ne 0,8 s viiveellä. Loiva käännös, peruutus perän käskyin, crash stop.
- Jetit kytketty tai vapaalla: kytkettynä nopeudella 0 ruorimies pitää aluksen paikallaan ja keulan suunnassa, vapaalla alus ajelehtii tuulen ja aallokon mukana.
- Liukuvarungon käytös: liukukynnys, trimmi, kallistus käännöksessä, pohjakosketus ja törmäykset.

**Sää, valo ja meri**

- Kello ohjaa auringon, hämärän ja yön. Yöllä loistot palavat valotunnustensa ja sektoriensa mukaan, plotteri vaihtuu yönäyttöön ja käytössä on kaksi valonheitintä (navigoijan ja ruorimiehen yläpuolella). Viittojen ja poijujen heijastimet välähtävät keilassa.
- Sää (selkeä, puolipilvinen, pilvinen) ja kuu (kalenterin mukaan, täysikuu, ei kuuta) määräävät yön pimeyden. Taivaalla näkyvät kuu ja tähdet.
- Tuuli (tyyni ... 14 m/s) ja suunta: sorto, nopeuden muutos ja kääntövaikutus.
- Aallokko pyyhkäisymatkan mukaan: rannan ja saarten suojassa tyyntä, ulapalla aallokkoa. Epäsäännöllinen meri, liukuvarungon vaste (hitaasti myötäilee, liu'ussa iskee), terävät järviaallot ja vaahtopäät.
- Nykyinen sää: tuuli ja pilvisyys Tampereelta (Open-Meteo), päivittyy ajon aikana.
- Kelin vaikutus tutkaan: merivälke aallonkorkeuden ja tuulen suunnan mukaan.

**Miehistötila**

- Kaksi laitetta samassa veneessä: ruorimies aloittaa istunnon ja antaa koodin, navigoija liittyy koodilla. Navigoijalla ovat plotteri ja tutka säätöineen, ruorimiehellä komennot ja navigoijan mittarit ilman säätöjä. Komennot annetaan puheella. Valonheittimet ja tutkan SEA-asetus välittyvät.
- **Testiversio (haara `testi`):** kolmantena laitteena kouluttaja, joka liittyy samalla koodilla. Hän näkee navigoijan plotterin ja tutkan ja 3D-näkymän navigoijan paikalta, käynnistää laitehäiriöt (tutkan kohina, heikko lähetin, suuntavirhe, tutka pimeä, plotteri pimeä, hiljaa tai miehistölle ilmoittaen), tekee merkintöjä purkuun ja pitää tauon kaikille. Häiriöt ja merkinnät näkyvät purun komentolokissa.
- **Testiversio: puheyhteys** selaimen kautta (WebRTC, `puhe.js`). Ääni kulkee laitteiden välillä suoraan, Supabasen kanavalla kulkee vain yhteyden avaus. Ruorimiehellä ja navigoijalla on mikrofonin mykistys, kouluttajalla tilat Kuuntele, Puhu ja Radio (VHF:n kaltainen ääni), ja puheen voi rajata vain navigoijalle.

## Käyttö

1. Avaa simulaattori selaimessa. Aloitusnäytössä valitaan miehistö (yksin, navigoija tai ruorimies), reitti, lähtöpaikka, näytöt, silmäpiste, kello, sää ja tuuli sekä maisema.
2. Aloita. Anna nopeus ja suunta komentopalstan napeilla tai näppäimillä.
3. Valikosta (≡) löytyvät mm. koko näyttö, ulkonäkymän vaihto, plotterin ja tutkan asetukset, grafiikan laatu ja ajon lopetus.
4. Ajon lopuksi purku.

Puhelimessa yksi mittari (plotteri tai tutka) ja 3D-näkymä vaihtavat päänäkymää napilla. Leveällä näytöllä kaikki ovat rinnakkain. iPhonella sivun voi lisätä kotivalikkoon, jolloin se avautuu ilman selaimen palkkeja.

## Komennot ja näppäimet

| Näppäin | Toiminto |
|---|---|
| Nuolet vasen ja oikea | Suunta 5° (Shift 10°), peruutuksessa perä vasen ja oikea |
| Nuolet ylös ja alas | Nopeus 2 kn, alle nollan peruutus 2 ja 4 kn |
| L | Loiva käännös, peruutuksessa Suoraan |
| Välilyönti | Crash stop |
| N | Jetit vapaalle tai kytketyksi |
| Q ja E | Katse sivulle |
| B | Kiikari |
| H, Shift+H | Valonheitin päälle tai pois (yöllä), J ja K kääntävät |
| Tab | Näkymän vaihto |
| R | Plotteri, tutka tai molemmat |
| C | Plotteri keskittää aluksen |
| M | Harppi |
| V | Vektorin aika |
| P | Tauko |
| 1, 2, 5, 0 | Aikakerroin 1×, 2×, 5×, 10× |
| O | Tutkan offset |
| S | Tutkan SEA-säätö (pois, 1, 2, 3, AUTO) |
| Pilkku ja piste, hakasulut | EBL ja VRM |

## Reittikartta

Reittikartta on reittien luonnosteluun tarkoitettu kartta (paikkahaku, reititys väylää pitkin kulkusyvyyden mukaan, suuntanuotit, sivuutus- ja käännösetäisyydet, GPX SARNaviin). Se julkaistaan simulaattorin rinnalla osoitteessa `/reittikartta.html`. Koska molemmat ovat samassa osoitteessa, Reittikartassa tallennetut reitit näkyvät simulaattorin reittilistassa suoraan (selaimen muisti, avain `reittikartta.v1`). Reitin voi myös viedä GPX-tiedostona ja tuoda simulaattoriin.

Reittikartan oma kuvaus on tiedostossa [docs/REITTIKARTTA.md](docs/REITTIKARTTA.md). Reittikartta on kopio erillisestä [reittikartta](https://github.com/jvaahtikari/reittikartta)-projektista.

## Mallit lyhyesti

- **Liikemalli** (`liike.js`): voimamalli työnnöstä ja vastuskäyrästä, jossa on liukukynnys (huippu noin 12 kn, liuku noin 17 kn). Huippunopeus 35 kn, matkanopeus 28 kn, crash stop 28 kn:sta noin 40 m. Kääntösäde nopeuden mukaan, paikallaan kääntyminen 10 °/s.
- **Tuuli** (`liike.js`): näennäinen tuuli, tuulen voima sivu- ja keulaprofiilille, sorto veden sivuvastusta ja vauhdin mukana kasvavaa nostovoimaa vastaan, kääntövaikutus. Esimerkiksi 10 m/s sivutuulessa jetit vapaalla noin 1,2 kn ajelehtiminen, 20 kn ajossa sorron kulma alle 1°.
- **Aallokko** (`aallot.js`): JONSWAP-kaavat tuulen nopeudesta ja pyyhkäisymatkasta (maastomallista tuulen suuntaisena ruudukkona). Merenkäynti on 16 aallon summa, ja aluksen nousu, nyökkäys ja kallistus ovat jousi-vaimenninvasteita, jotka vaihtuvat uppoumasta liukuun. Liu'ussa iso vasta-aallokko heittää rungon ilmaan.
- **Tutka** (`tutka.js`): säteet marssitaan maa- ja korkeusruudukossa, näkölinja ja varjot, kaiun voimakkuus rinteen ja materiaalin mukaan, merivälke, sade ja häiriöt. Tarkempi kuvaus: [docs/TUTKA.md](docs/TUTKA.md).
- **Valo** (`nakyma.js`, `valot3d.js`): auringon ja kuun paikka, kuun vaihe, yön valoisuus sään mukaan, loistojen rytmit valotunnuksista (F, Fl, LFl, Q, VQ, Iso, Oc, Mo).

## Repon rakenne

| Polku | Sisältö |
|---|---|
| `index.html` | Simulaattori yhtenä tiedostona (tuotettu, `lahdekoodi/build.py`) |
| `reittikartta.html` | Reittikartta yhtenä tiedostona (tuotettu) |
| `simulaattori.webmanifest` | Kotivalikkoon lisätyn sivun asetukset |
| `api/` | Vercelin palvelinfunktiot: `google.js` (Google-avain), `simu.js` (miehistötilan Supabase-avain), `mml.js` (Maanmittauslaitoksen välityspalvelu Reittikartalle) |
| `lahdekoodi/simulaattori.html` | Simulaattorin lähdesivu |
| `lahdekoodi/simulaattori/js/` | Simulaattorin moduulit (alla) |
| `lahdekoodi/simulaattori/lib/` | three.js r128 ja supabase-js |
| `lahdekoodi/simulaattori/testit/` | Yksikkötestit (Node), Playwright-testit (`*_pw.py`) ja selaintestit (`selain/`) |
| `lahdekoodi/index.html`, `js/`, `css/`, `lib/`, `tests/` | Reittikartan lähdekoodi ja testit |
| `lahdekoodi/build.py` | Kokoaa `index.html`:n ja `reittikartta.html`:n repon juureen |
| `docs/` | Tutkan kuvaus, Reittikartan kuvaus ja jatkokehityksen lista |

Simulaattorin moduulit:

| Moduuli | Tehtävä |
|---|---|
| `sim.js` | Sovellus: aloitusnäyttö, näkymät, komennot, yö, sää, miehistötila, purku |
| `liike.js` | Liikemalli, ruorimies, tuuli, jetit ja paikallaan pito |
| `aallot.js` | Aallokko pyyhkäisymatkan mukaan, merenkäynti ja aluksen vaste |
| `nakyma.js` | 3D-näkymä (three.js): taivas, aurinko, kuu, vesi, kamera ja keinunta |
| `valot3d.js` | Loistot, valonheittimet ja heijastimet |
| `plotteri.js` | Plotteri ja SARNav-tyylinen tietopalsta |
| `tutka.js` | Tutkanäkymä ja kaikumalli |
| `harjoitus.js` | Harjoitukset, reitit (Reittikartta, GPX), automaattiohjaus, tallenne ja purku |
| `maasto.js` | Maasto, rakennukset ja metsä |
| `merkit.js`, `merkit3d.js`, `merimerkit3d.js` | Turvalaitteet ja vesiliikennemerkit, 3D-mallit |
| `laiturit3d.js`, `sillat3d.js`, `maamerkit3d.js`, `veneet3d.js` | Laiturit, sillat, maamerkit ja kiinnitetyt veneet |
| `tormays.js`, `pohja.js` | Törmäykset ja pohjakosketus |
| `google3d.js`, `vesimaski3d.js`, `kalibrointi.js` | Google 3D -maisema, oma vesi sen päällä ja kalibrointityökalu (`?kalibrointi=1`) |
| `miehisto.js` | Miehistötilan yhteys (Supabase Realtime, paikallisesti BroadcastChannel) |
| `puhe.js` | Miehistötilan puheyhteys (WebRTC, testiversio) |
| `aineisto.js`, `mvt.js`, `paikka.js` | Aineistopaketin luku (PMTiles, MVT, Terrain-RGB) ja koordinaatit |
| `runko.js` | Repan runkomalli |

## Julkaisu

Sovellus julkaistaan Verceliin sellaisenaan: Vercel tarjoilee repon juuren tiedostot ja `api/`-funktiot, eikä palvelimella ajeta koontivaihetta. `vercel.json` julkaisee vain `main`-haaran, ja `.vercelignore` jättää lähdekoodin ja dokumentaation pois julkaisusta.

1. Luo Vercel-projekti tästä reposta (Framework: Other, ei koontikomentoa).
2. Lisää ympäristömuuttujat:

| Muuttuja | Mihin | Pakollinen |
|---|---|---|
| `SIMU` | Supabasen julkinen avain (publishable key) miehistötilaan | Miehistötilaan |
| `SIMU_URL` | Supabase-projektin osoite (oletus nykyinen projekti) | Ei |
| `GOOGLE_API` | Google Maps -avain Google 3D -maisemaan, rajattu sivuston osoitteeseen | Google 3D:hen |
| `MML_API_KEY` | Maanmittauslaitoksen avoimen rajapinnan avain Reittikartan haulle | Reittikartan MML-hakuun |
| `SIMU_ICE` | Puheyhteyden ICE-palvelimet JSON-taulukkona, esim. TURN-palvelin rajoittavia verkkoja varten (testiversio). Ilman sitä käytetään julkista STUN-palvelinta. | Ei |

Ilman avaimia simulaattori toimii omalla maisemallaan yksin ajaen.

Maasto-, tutka- ja veneaineisto luetaan erillisestä aineistopaketista [reittikartta-aineisto](https://github.com/jvaahtikari/reittikartta-aineisto) (GitHub Pages, PMTiles). Osoitteen voi vaihtaa parametrilla `?aineisto=`.

## Kulut

Tavallinen koulutuskäyttö mahtuu palveluiden ilmaisiin tasoihin.

| Palvelu | Mihin | Ilmaiseksi | Laajassa käytössä |
|---|---|---|---|
| Vercel | Julkaisu | Hobby-taso (henkilökohtainen käyttö) | Organisaation käyttöön oma tili, Pro noin 20 $/kk |
| GitHub Pages | Aineistopaketti | Noin 100 Gt/kk | Riittää |
| Supabase | Miehistötila | 2 milj. viestiä/kk, noin 80 tuntia kaksinpeliä | Pro noin 25 $/kk |
| Google Maps | Google 3D -maisema (valinnainen) | Kuukausittainen ilmaisosuus, avaimelle asetettu päiväraja | Oma avain ja laskutus |
| Open-Meteo, Digitraffic, MML | Sää, AIS, kartat | Ei-kaupalliseen käyttöön | Ilmaisia |

Kun Googlen päiväraja täyttyy, simulaattori siirtyy omaan maisemaan ja kertoo syyn.

## Kehitys ja testaus

Muokkaa lähdekoodia hakemistossa `lahdekoodi/` ja kokoa julkaistavat tiedostot:

```bash
python3 lahdekoodi/build.py
```

Kehityksen aikana sivun voi avata lähdetiedostoista paikallisella palvelimella:

```bash
cd lahdekoodi && python3 -m http.server 8154
```

Avaa `http://127.0.0.1:8154/simulaattori.html`. Hyödyllisiä parametreja: `?maisema=oma` (ei Googlea), `?aineisto=<osoite>` (aineistopaketti), `?ff=5` (aikakerroin), `?preserve=1` (kuvakaappaukset).

Yksikkötestit (Node, ei riippuvuuksia):

```bash
for t in lahdekoodi/simulaattori/testit/*_test.js; do node "$t"; done
```

Liike-, tuuli-, aalto-, peruutus-, harjoitus- ja Google-kameran testit toimivat ilman verkkoa. `mvt`, `sillat3d`, `tormays` ja `veneet3o` lukevat aineistopakettia verkosta.

Testiversio julkaistaan Vercelin haaraosoitteeseen (`<projekti>-git-testi-<tili>.vercel.app`): `vercel.json` rakentaa haarat `main` ja `testi`. Haaraosoitteessa aloitusnäytöllä näkyy merkintä Testiversio.

Selaintestit (Playwright ja Chromium) ovat hakemistossa `lahdekoodi/simulaattori/testit/selain/`, ja niiden käyttö on kuvattu tiedostossa [LUE.md](lahdekoodi/simulaattori/testit/selain/LUE.md). Tärkein on päällekkäisyystesti `overlap.js`, joka tarkistaa käyttöliittymän seitsemällä laitekoolla. Vanhemmat Playwright-testit ovat Python-skripteinä (`*_pw.py`), ja Reittikartan testit hakemistossa `lahdekoodi/tests/`.

Kun muutat Reittikartan lähdekoodia, sama muutos kannattaa viedä myös erilliseen reittikartta-projektiin, tai päinvastoin.

## Aineistot ja lisenssit

| Aineisto | Lähde | Lisenssi |
|---|---|---|
| Maasto, rakennukset, puusto, laiturit ja korkeusmalli | Maanmittauslaitos (aineistopaketti) | CC BY 4.0 |
| Turvalaitteet, väylät, valot ja sektorit, vesiliikennemerkit, sillat | Väylävirasto | CC BY 4.0 |
| Syvyysalueet ja merikartat | Traficom | Ei-kaupallisesti ja muuhun kuin navigointiin |
| Kiinnitettyjen veneiden paikat | Tunnistettu MML:n ortokuvasta 2023 | CC BY 4.0 (lähdeaineisto) |
| AIS (Reittikartta) | Fintraffic, Digitraffic | CC BY 4.0 |
| Nykyinen sää | Open-Meteo.com | CC BY 4.0 |
| Google 3D -maisema | Google Maps Platform | Googlen ehdot, lähdemerkintä näkyvissä |
| three.js r128 | three.js-tekijät | MIT |
| supabase-js | Supabase | MIT |
| Leaflet, pmtiles, protomaps-leaflet (Reittikartta) | | BSD-2, BSD-3 |

Traficomin edellyttämä merkintä: *Lähde: Liikenne- ja viestintävirasto. Ei navigointikäyttöön. Ei täytä asianmukaisen merikartan vaatimuksia.*

## Lisenssi

Sovelluksen oma koodi on lisensoitu ehdoilla **PolyForm Noncommercial 1.0.0** ([LICENSE.md](LICENSE.md)). Koodia saa käyttää, kopioida, muokata ja jakaa ei-kaupalliseen tarkoitukseen. Yleishyödylliset yhteisöt, kuten Meripelastusseura ja sen yhdistykset, voivat käyttää ja kehittää sitä ilman erillistä lupaa ja korvauksetta. Ei-kaupallinen rajaus vastaa käytetyn aineiston ehtoja (Traficomin syvyysaineisto). Kaupallinen käyttö vaatii luvan tekijältä.

## Jatkokehitys

Toteuttamattomat ja suunnitellut asiat: [docs/ROADMAP.md](docs/ROADMAP.md).
