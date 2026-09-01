// ============================================================
//  Prezzo medio nazionale carburante (Italia) — dati ufficiali MISE
//  Endpoint: GET /api/prezzo-italia
//
//  Fonte: Osservatorio Prezzi Carburanti (mimit.gov.it), aggiornato dal
//  Ministero circa una volta al giorno. Il file sorgente elenca il prezzo
//  di OGNI distributore in Italia (decine di migliaia di righe): viene
//  scaricato lato server e la media viene tenuta in cache edge per alcune
//  ore, per non riscaricare/riparsare il file a ogni apertura dell'app da
//  parte di ogni operatore.
// ============================================================

const SOURCE_URL = 'https://www.mimit.gov.it/images/exportCSV/prezzo_alle_8.csv';
const CACHE_TTL_SECONDS = 6 * 60 * 60; // il file MISE è comunque aggiornato ~1 volta al giorno

export async function onRequestGet(context) {
  const { request } = context;
  const cache = caches.default;
  const cacheKey = new Request(new URL(request.url).origin + '/api/prezzo-italia');

  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  let res;
  try {
    res = await fetch(SOURCE_URL);
  } catch (e) {
    return json({ error: 'Fonte MISE non raggiungibile.' }, 502);
  }
  if (!res.ok) return json({ error: `Fonte MISE non disponibile (${res.status}).` }, 502);

  const text = await res.text();
  const { diesel, benzina, campione } = mediaPrezzi(text);
  if (diesel == null || benzina == null) return json({ error: 'Dati MISE non interpretabili.' }, 502);

  const payload = {
    diesel: round3(diesel),
    benzina: round3(benzina),
    fonte: 'MISE — Osservatorio Prezzi Carburanti',
    campione,
    aggiornatoAl: new Date().toISOString().slice(0, 10),
  };

  const response = json(payload, 200, CACHE_TTL_SECONDS);
  context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

// Media dei prezzi per Benzina e Gasolio sul campione nazionale. Esclude le
// varianti premium ("Blue Diesel", "Hi-Q Diesel", ecc.): si contano solo le
// righe con descCarburante ESATTAMENTE "Benzina" o "Gasolio", che sono i
// carburanti standard usati dal parco mezzi CRI.
//
// Scansione manuale con indexOf invece di split('\n') + split('|') per riga:
// il file ha ~90.000 righe (~4MB) e la versione con split() impiega circa
// 50ms, oltre il limite di CPU time delle Function sul piano gratuito
// Cloudflare (10ms). Questa versione, senza allocare un array per ogni riga,
// gira in ~10ms.
function mediaPrezzi(text) {
  let sumD = 0, nD = 0, sumB = 0, nB = 0;
  let pos = 0;
  const len = text.length;
  while (pos < len) {
    let nl = text.indexOf('\n', pos);
    if (nl === -1) nl = len;
    const p1 = text.indexOf('|', pos);
    if (p1 === -1 || p1 > nl) { pos = nl + 1; continue; }
    const p2 = text.indexOf('|', p1 + 1);
    if (p2 === -1 || p2 > nl) { pos = nl + 1; continue; }
    const p3 = text.indexOf('|', p2 + 1);
    if (p3 === -1 || p3 > nl) { pos = nl + 1; continue; }
    const tipo = text.slice(p1 + 1, p2);
    if (tipo === 'Gasolio' || tipo === 'Benzina') {
      const prezzo = parseFloat(text.slice(p2 + 1, p3));
      if (prezzo > 0) {
        if (tipo === 'Gasolio') { sumD += prezzo; nD++; }
        else { sumB += prezzo; nB++; }
      }
    }
    pos = nl + 1;
  }
  return {
    diesel: nD > 0 ? sumD / nD : null,
    benzina: nB > 0 ? sumB / nB : null,
    campione: nD + nB,
  };
}

function round3(n) { return Math.round(n * 1000) / 1000; }

function json(obj, status = 200, cacheSeconds = 0) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': cacheSeconds > 0 ? `public, max-age=${cacheSeconds}` : 'no-store',
    },
  });
}
