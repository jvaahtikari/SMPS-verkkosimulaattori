# Jatkokehitys

Suunnitellut, mutta vielä toteuttamattomat asiat. Valmiit ominaisuudet on kuvattu README:ssä.

## Kouluttaja ja vikatilanteet

- **Kouluttajan rooli ja puhe (testiversiossa, haara `testi`):** kouluttaja kolmantena laitteena, tutkan ja plotterin häiriöt, merkinnät purkuun, tauko kaikille ja puheyhteys. Kokeiltava oikeilla laitteilla ja verkoilla (iPhone, mobiiliverkko, TURN-tarve) ennen tuotantoon vientiä.
- **Kouluttajan jatko:** tehtävän anto kartalta (kohde navigoijalle), automaattiset hälytykset kouluttajalle (matalikko edessä, poikkeama reitiltä), ajastetut skenaariot, puheen tallenne purkuun (suostumuksella, vain kouluttajan laitteella), moottorin melu puheen taustalle.
- **Muut viat:** esimerkiksi toisen jetin menetys, ohjausvika tai GPS-katko liikemalliin ja plotteriin.

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
