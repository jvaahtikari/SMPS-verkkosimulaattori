# Selaintestit (Playwright, Chromium)

Kehityksen aikana käytetyt tarkistukset. Ne ajavat simulaattoria oikeassa selaimessa ja tulostavat tuloksen konsoliin sekä kuvat kansioon `kuvat/`.

Käynnistä ensin kaksi paikallista palvelinta:

```bash
cd lahdekoodi && python3 -m http.server 8154
```

```bash
python3 lahdekoodi/simulaattori/testit/selain/cors.py 8144 /polku/aineistopakettiin
```

Aineistopaketti on [reittikartta-aineisto](https://github.com/jvaahtikari/reittikartta-aineisto) (PMTiles), tai tyhjä kansio, jolloin maasto puuttuu mutta käyttöliittymä toimii. Osoitteet voi vaihtaa ympäristömuuttujilla `SIM_URL`, `AINEISTO_URL` ja `OUT`.

```bash
node lahdekoodi/simulaattori/testit/selain/overlap.js
```

| Skripti | Mitä tarkistaa |
|---|---|
| `overlap.js` | Käyttöliittymän päällekkäisyydet seitsemällä laitekoolla (iPhone, iPad, työpöytä), kaikki näyttötilat. Google 3D korvataan tyngällä. |
| `overlapyo.js` | Sama yöaikaan valonheitinnapit näkyvissä |
| `snp.js` | Plotterin SARNav-tietopalstan mahtuminen eri ruuduilla |
| `crewspot.js` | Miehistötila kahdella välilehdellä: valonheittimien välitys |
| `free.js` | Jetit kytketty tai vapaalla: paikallaan pito ja ajelehtiminen |
| `wind.js` | Tuuli, sorto, COG ja SOG plotterissa |
| `live.js` | Nykyinen sää (Open-Meteo korvataan tyngällä) |
| `yo3.js` | Yön valot, valonheittimet ja heijastimet |
| `head.js` | Kameran keinunta ja pään vakautus omassa näkymässä ja Google-tilassa |
| `radar.js` | Tutkan merivälke ja SEA-säätö eri keleillä |
| `water2.js`, `water3.js`, `foamcov.js` | Vedenpinta ylhäältä ja ohjaamosta, vaahtopäiden peitto |
| `cors.py` | Paikallinen palvelin aineistopaketille (CORS ja Range-pyynnöt) |
