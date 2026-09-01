// ============================================================
//  Prezzi carburante Paesi UE — Weekly Oil Bulletin (Commissione Europea)
//  Endpoint: GET /api/prezzo-eu
//
//  A differenza dell'Italia (aggiornata in automatico a ogni apertura da
//  /api/prezzo-italia), per gli altri Paesi non esiste una fonte gratuita
//  aggiornabile in automatico per tutti: questo endpoint viene chiamato SOLO
//  su richiesta esplicita (tasto "Aggiorna prezzi UE" in Impostazioni).
//
//  Fonte: bollettino settimanale della Commissione Europea (rilasciato ogni
//  giovedì), file Excel "Prices with taxes". Il link di download cambia a
//  ogni pubblicazione: si legge prima la pagina indice per trovarlo, poi si
//  scarica e interpreta il file (il bollettino non offre un endpoint dati
//  diretto, solo il file .xlsx). Copre i ~27 Paesi UE: gli altri Paesi della
//  tabella (extra-UE) non sono toccati da questo endpoint.
// ============================================================

import { requireUser, ruoloSezione } from '../_lib/auth.js';

const BULLETIN_INDEX_URL = 'https://energy.ec.europa.eu/data-and-analysis/weekly-oil-bulletin_en';
const LABEL_MARKER = 'data-untranslated-label="Prices with taxes latest prices (xlsx)"';
const CACHE_TTL_SECONDS = 12 * 60 * 60; // il bollettino è comunque settimanale

// Nome inglese del Paese (come compare nel bollettino) -> ISO alpha-2 usato
// nella tabella prezzi dell'app. Solo i Paesi UE presenti in entrambe le fonti.
const NOME_TO_ISO2 = {
  Austria: 'AT', Belgium: 'BE', Bulgaria: 'BG', Croatia: 'HR', Cyprus: 'CY',
  Czechia: 'CZ', Denmark: 'DK', Estonia: 'EE', Finland: 'FI', France: 'FR',
  Germany: 'DE', Greece: 'GR', Hungary: 'HU', Ireland: 'IE', Italy: 'IT',
  Latvia: 'LV', Lithuania: 'LT', Luxembourg: 'LU', Malta: 'MT', Netherlands: 'NL',
  Poland: 'PL', Portugal: 'PT', Romania: 'RO', Slovakia: 'SK', Slovenia: 'SI',
  Spain: 'ES', Sweden: 'SE',
};

export async function onRequestGet(context) {
  const { request, env } = context;
  const user = await requireUser(request, env);
  if (!user) return json({ error: 'Accesso non autorizzato: effettua il login.' }, 401);

  // Non basta essere autenticati: la chiave OpenRouteService (e la quota
  // giornaliera che ci sta dietro) e' di questa sezione, quindi la puo'
  // consumare solo chi e' autorizzato ai trasporti.
  if (!await ruoloSezione(request, env, 'trasporti')) {
    return json({ error: 'Non sei autorizzato ad accedere ai trasporti lunghi: chiedi a un amministratore del portale.' }, 403);
  }

  const cache = caches.default;
  const cacheKey = new Request(new URL(request.url).origin + '/api/prezzo-eu');
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  let xlsxUrl;
  try {
    xlsxUrl = await trovaUrlBollettino();
  } catch (e) {
    return json({ error: 'Impossibile trovare il bollettino aggiornato: ' + e.message }, 502);
  }

  let buf;
  try {
    const res = await fetch(xlsxUrl);
    if (!res.ok) return json({ error: `Download bollettino non riuscito (${res.status}).` }, 502);
    buf = new Uint8Array(await res.arrayBuffer());
  } catch (e) {
    return json({ error: 'Bollettino UE non raggiungibile.' }, 502);
  }

  let prezzi;
  try {
    prezzi = await estraiPrezzi(buf);
  } catch (e) {
    return json({ error: 'File del bollettino non interpretabile: ' + e.message }, 502);
  }

  const payload = {
    prezzi,
    fonte: 'Commissione Europea — Weekly Oil Bulletin',
    aggiornatoAl: new Date().toISOString().slice(0, 10),
  };
  const response = json(payload, 200, CACHE_TTL_SECONDS);
  context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

// Il link di download cambia ogni settimana (nuovo GUID a ogni pubblicazione):
// si individua tramite l'attributo data-untranslated-label, stabile nel tempo,
// invece di un URL fisso.
async function trovaUrlBollettino() {
  const res = await fetch(BULLETIN_INDEX_URL);
  if (!res.ok) throw new Error(`pagina indice non disponibile (${res.status})`);
  const html = await res.text();
  const idx = html.indexOf(LABEL_MARKER);
  if (idx === -1) throw new Error('link "Prices with taxes" non trovato nella pagina');
  const tagStart = html.lastIndexOf('<a ', idx);
  const hrefMatch = tagStart === -1 ? null : html.slice(tagStart, idx).match(/href="([^"]+)"/);
  if (!hrefMatch) throw new Error('href non trovato per il link individuato');
  const href = hrefMatch[1];
  return href.startsWith('http') ? href : new URL(href, BULLETIN_INDEX_URL).toString();
}

async function estraiPrezzi(buf) {
  const entries = trovaVociZip(buf, ['xl/sharedStrings.xml', 'xl/worksheets/sheet1.xml']);
  const sharedBytes = await inflateSeNecessario(entries['xl/sharedStrings.xml']);
  const sheetBytes = await inflateSeNecessario(entries['xl/worksheets/sheet1.xml']);
  if (!sharedBytes || !sheetBytes) throw new Error('voci ZIP mancanti (formato del file cambiato?)');

  const dec = new TextDecoder('utf-8');
  const strings = parseSharedStrings(dec.decode(sharedBytes));
  const sheetXml = dec.decode(sheetBytes);

  const prezzi = {};
  const rowRegex = /<row r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
  let rm;
  while ((rm = rowRegex.exec(sheetXml))) {
    const rowNum = Number(rm[1]);
    if (rowNum < 3) continue; // salta intestazione (riga 1) e riga unità di misura (riga 2)
    const cells = parseRow(rm[2]);
    if (cells.A == null) continue;
    const nome = strings[cells.A];
    const iso2 = NOME_TO_ISO2[nome];
    // colonna B = benzina, C = diesel, valori in EUR per 1000 litri nel file sorgente
    if (!iso2 || typeof cells.B !== 'number' || typeof cells.C !== 'number') continue;
    prezzi[iso2] = { benzina: round3(cells.B / 1000), diesel: round3(cells.C / 1000) };
  }
  if (Object.keys(prezzi).length < 20) throw new Error('troppo pochi Paesi riconosciuti: il formato del file è probabilmente cambiato');
  return prezzi;
}

// ---- ZIP minimale: solo header locali (basta per file generati da Excel/Office,
// che non usano lo streaming con data-descriptor) ----
function trovaVociZip(buf, nomiCercati) {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const dec = new TextDecoder('utf-8');
  const risultati = {};
  let pos = 0;
  while (pos < buf.length - 4) {
    if (view.getUint32(pos, true) !== 0x04034b50) { pos++; continue; }
    const method = view.getUint16(pos + 8, true);
    const compSize = view.getUint32(pos + 18, true);
    const nameLen = view.getUint16(pos + 26, true);
    const extraLen = view.getUint16(pos + 28, true);
    const name = dec.decode(buf.slice(pos + 30, pos + 30 + nameLen));
    const dataStart = pos + 30 + nameLen + extraLen;
    if (nomiCercati.includes(name)) {
      risultati[name] = { method, data: buf.slice(dataStart, dataStart + compSize) };
    }
    pos = dataStart + compSize;
  }
  return risultati;
}

async function inflateSeNecessario(entry) {
  if (!entry) return null;
  if (entry.method === 0) return entry.data; // "stored", non compresso
  const stream = new Response(entry.data).body.pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function parseSharedStrings(xml) {
  const strings = [];
  const siRegex = /<si>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = siRegex.exec(xml))) {
    const tRegex = /<t[^>]*>([\s\S]*?)<\/t>/g;
    let text = '';
    let tm;
    while ((tm = tRegex.exec(m[1]))) text += tm[1];
    strings.push(decodeXmlEntities(text));
  }
  return strings;
}

function parseRow(rowXml) {
  const cells = {};
  const cellRegex = /<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>(?:<v>([^<]*)<\/v>)?<\/c>)/g;
  let m;
  while ((m = cellRegex.exec(rowXml))) {
    const col = m[1], val = m[3];
    cells[col] = val === undefined || val === '' ? null : Number(val);
  }
  return cells;
}

function decodeXmlEntities(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
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
