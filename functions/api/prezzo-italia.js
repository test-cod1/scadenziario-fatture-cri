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

import { requireUser, ruoloSezione } from '../_lib/auth.js';

const SOURCE_URL = 'https://www.mimit.gov.it/images/exportCSV/prezzo_alle_8.csv';
const CACHE_TTL_SECONDS = 6 * 60 * 60; // il file MISE è comunque aggiornato ~1 volta al giorno

export async function onRequestGet(context) {
  const { request, env } = context;
  // Era l'unico endpoint senza controllo, mentre gli altri sei lo hanno tutti:
  // chiunque conoscesse l'URL poteva far scaricare al Worker un CSV da 4 MB e
  // riparsarlo. Il prezzo serve alla sola sezione trasporti, quindi si chiede
  // lo stesso permesso di geocode/route/prezzo-eu.
  const user = await requireUser(request, env);
  if (!user) return json({ error: 'Accesso non autorizzato: effettua il login.' }, 401);
  if (!await ruoloSezione(request, env, 'trasporti')) {
    return json({ error: 'Non sei autorizzato ad accedere ai trasporti lunghi: chiedi a un amministratore del portale.' }, 403);
  }

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
  const { diesel, benzina, campione, modalita } = mediaPrezzi(text);
  if (diesel == null || benzina == null) return json({ error: 'Dati MISE non interpretabili.' }, 502);

  const payload = {
    diesel: round3(diesel),
    benzina: round3(benzina),
    fonte: `MISE — Osservatorio Prezzi Carburanti (${modalita})`,
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
// Si contano SOLO le erogazioni self (quarta colonna, isSelf=1). Il file
// elenca due righe per impianto, self e servito, con differenze grosse — a
// campione: Benzina 2,159 self contro 2,519 servito. Mescolandole veniva
// fuori una media che non corrisponde a nessun dato pubblicato dal Ministero
// e che sovrastimava sistematicamente il costo del carburante nei preventivi,
// visto che i mezzi CRI fanno rifornimento self. Se per un carburante non
// risultasse nessuna riga self si ripiega sul campione completo, per non
// restituire un errore al posto di un prezzo approssimato.
//
// Scansione manuale con indexOf invece di split('\n') + split('|') per riga:
// il file ha ~90.000 righe (~4MB) e la versione con split() impiega circa
// 50ms, oltre il limite di CPU time delle Function sul piano gratuito
// Cloudflare (10ms). Questa versione, senza allocare un array per ogni riga,
// gira in ~10ms.
function mediaPrezzi(text) {
  let sumD = 0, nD = 0, sumB = 0, nB = 0;          // solo self
  let sumDx = 0, nDx = 0, sumBx = 0, nBx = 0;      // tutte le righe (ripiego)
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
        const p4 = text.indexOf('|', p3 + 1);
        const self = p4 !== -1 && p4 <= nl && text.slice(p3 + 1, p4).trim() === '1';
        if (tipo === 'Gasolio') {
          sumDx += prezzo; nDx++;
          if (self) { sumD += prezzo; nD++; }
        } else {
          sumBx += prezzo; nBx++;
          if (self) { sumB += prezzo; nB++; }
        }
      }
    }
    pos = nl + 1;
  }
  const soloSelf = nD > 0 && nB > 0;
  return {
    diesel: soloSelf ? sumD / nD : (nDx > 0 ? sumDx / nDx : null),
    benzina: soloSelf ? sumB / nB : (nBx > 0 ? sumBx / nBx : null),
    campione: soloSelf ? nD + nB : nDx + nBx,
    modalita: soloSelf ? 'self' : 'self e servito',
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
