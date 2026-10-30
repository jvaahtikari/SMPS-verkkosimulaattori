// Simulaattorin kaksinpelin (miehistötila) yhteysasetukset.
// Supabase-projektin osoite ja julkinen (publishable) avain luetaan Vercelin ympäristömuuttujista: avain SIMU, osoite SIMU_URL (valinnainen).
// Puheyhteyden ICE-palvelimet (testiversio): SIMU_ICE on JSON-taulukko RTCPeerConnectionin muodossa, esim. [{"urls":"turn:...","username":"...","credential":"..."}] (valinnainen).
// Publishable-avain on tarkoitettu selaimeen, eikä sillä pääse tietokantaan ilman erikseen sallittuja oikeuksia. Vastaus annetaan vain saman sivuston sivulle.
module.exports = async function handler(req, res) {
  const key = process.env.SIMU;
  const url = process.env.SIMU_URL || 'https://uiwvkqpbmnocylonupvs.supabase.co';
  res.setHeader('Cache-Control', 'no-store');
  if (!key) { res.status(503).json({ error: 'SIMU puuttuu Vercelin asetuksista' }); return; }
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '');
  const ref = String(req.headers.referer || req.headers.origin || '');
  if (!host || !ref || ref.indexOf('://' + host) < 0) { res.status(403).json({ error: 'vain oman sivuston käyttöön' }); return; }
  let ice = null;
  try { ice = process.env.SIMU_ICE ? JSON.parse(process.env.SIMU_ICE) : null; } catch (e) { ice = null; }
  res.status(200).json({ url: url, key: key, ice: Array.isArray(ice) ? ice : null });
};
