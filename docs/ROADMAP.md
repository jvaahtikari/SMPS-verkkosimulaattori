# Jatkokehitys

Suunnitellut, mutta vielä toteuttamattomat asiat. Valmiit ominaisuudet on kuvattu README:ssä.

## Kouluttaja ja vikatilanteet

- **Kouluttajan rooli ja puhe (julkaistu 2.11.2026):** kouluttaja kolmantena laitteena, tutkan ja plotterin häiriöt, merkinnät purkuun, tauko kaikille, puheyhteys ja radiolähetys. Kokeiltava laajemmin oikeilla laitteilla ja verkoilla (iPhone, mobiiliverkko, TURN-tarve).
- **Kouluttajan jatko:** tehtävän anto kartalta (kohde navigoijalle), automaattiset hälytykset kouluttajalle (matalikko edessä, poikkeama reitiltä), ajastetut skenaariot, puheen tallenne purkuun (suostumuksella, vain kouluttajan laitteella), moottorin melu puheen taustalle.
- **Muut viat:** esimerkiksi toisen jetin menetys, ohjausvika tai GPS-katko liikemalliin ja plotteriin.

## Käsittelyharjoitus

- **Vaihe K1 (2.11.2026, kokeiluversio):** kolmen vapausasteen käsittelymalli (`kasittely.js`), Vectorstick TRANSIT ja DOCKING, Rolls-Roycen paneelit, kelluva ponttoni ja 2D-sivu (`kasittely.html`). Kalibroimaton.
- **K2, 3D-näkymä:** käsittelyharjoitus `sim.js`:n ja `nakyma.js`:n sisälle: ruorimiehen silmäpiste, kelluva ponttoni Naistenlahden asemalla laituriaineiston kohdalle, ohjaimet ja LCD-paneeli näkymän päälle, purku (kosketukset ja niiden nopeudet).
- **K3, ympäristö:** tuuli ja virtaus harjoitukseen säätiedosta, kiinteä laituri ja sen virtaus, köydet ja kiinnitys, lähtö laiturista.
- **K4, kouluttaja ja kalibrointi:** toisen jetin menetys ja BACKUP-ohjaus häiriöinä, kalibrointiajo oikealla veneellä (tyhjäkäyntinopeus, pysähtyminen kauhalla, kääntö paikallaan, sivuttaissiirto, ajelehtiminen, kääntöympyrät).
- **Avoimet oletukset:** tillerin ja joystickin jousipalautus, DOCKING-tilan kierrosrajoitus ja jakologiikka, suuttimen ohjausvoiman suunta peruutuksessa, suuttimen enimmäiskulma, peruutustyönnön osuus.

## Sää ja näkyvyys

- **Sumu omassa näkymässä:** näkyvyysasetus toimii nyt vain Google 3D -kerroksen päällä. Sama sumu omaan maisemaan, valoihin ja tutkan kuvaan.
- **Sade:** sateen näkyminen 3D-näkymässä ja tutkan sadeharson (`asetaSade`) kytkeminen sään valintaan ja nykyisen sään sääkoodiin.
- **Mitattu tuuli:** nykyinen sää on Open-Meteon mallista. Vaihtoehtona Ilmatieteen laitoksen lähin havaintoasema, jolloin tuuli on mitattu.
- **Puuskat:** tuulen vaihtelu puuskina (Open-Meteo antaa puuskan nopeuden).

## Malli ja kalibrointi

- **Kalibrointi oikealla veneellä:** liikemallin, tuulen, aallokon ja keinunnan arvot ovat arvioita (huippunopeus, kääntösäteet, sorto, kääntövaikutus, vasteen jäykkyydet). Mittaukset Repalla eri nopeuksilla ja keleillä.
- **Aallokon vaikutus ohjattavuuteen:** surffaus ja sortuminen myötäaallokossa, keulan kaivautuminen.
- **Valonheittimen kantama ja heijastimien näkyvyys:** arvioita (keila 900 m, heijastimet 3 km selkeällä).

## Aineisto ja alue

- **Siltojen alikulkukorkeudet:** nyt sillan alapinta on arvio (4 ... 5,7 m). Väyläviraston siltarekisteristä todelliset korkeudet aineistopakettiin ja alikulkuharjoitus.
- **Tampereen uusin rakennuskanta:** pintamallin keilaus on vuodelta 2008. Korjataan aineistopaketissa.
- **Muut alueet:** aineistopaketti kattaa vain Näsijärven. Uuden alueen paketti tehdään samalla tietoputkella (reittikartta-aineisto).

## Käyttöönotto

- **Seuran oma julkaisu:** Vercel-projekti seuran tilille, omat avaimet (Supabase, Google, MML) ja oma verkko-osoite.
- **Reittikartan yhteinen koodi:** Reittikartta on nyt kopio erillisestä projektista. Jos molempia kehitetään, kannattaa sopia, kumpi on päälähde.
