// ============================================================
//  Cloudflare Function — Dati di fatturazione dal cliente
//  Endpoint: POST /api/dati-fatturazione   (lo chiama il modulo pubblico
//  dati-fatturazione.html, aperto dal cliente col link del preventivo)
//
//  Corpo: { azione: 'leggi' | 'invia', token, dati? }
//   - leggi → l'intestazione del preventivo (a chi, che cosa, di quando) e
//             i dati già mandati, oppure quelli che il preventivo conosce
//             già, per non far riscrivere al cliente quello che sappiamo;
//   - invia → controlla i dati con le regole di js/lib/datiFatturazione.mjs
//             e li salva.
//
//  Nessun login: chi ha il link è il cliente. Per questo l'endpoint non
//  dice mai niente di più di quello che serve al modulo — non il totale,
//  non le righe, non chi ha fatto il preventivo —, risponde allo stesso
//  modo a un codice inesistente, scaduto o revocato, e scrive solo i campi
//  dei dati di fatturazione della sua riga. Il codice viaggia nel corpo
//  della richiesta e non nell'indirizzo, così non resta nei log.
//
//  Secret: SUPABASE_SERVICE_ROLE_KEY (la tabella non ha policy per gli
//  anonimi: scrive solo il server).
// ============================================================

import { SUPABASE_URL } from '../_lib/auth.js';
import { controllaDati, FORMA_TOKEN } from '../../js/lib/datiFatturazione.mjs';

// Quante volte lo stesso link può mandare i dati: abbastanza per correggersi,
// non abbastanza per usare il modulo come un modo di riempire il database.
export const MAX_INVII = 30;
const MAX_CORPO = 20000;

// La tabella del preventivo e le colonne che servono all'intestazione, per
// sezione. Le colonne sono scritte qui e non chieste dal client: è il
// server a decidere che cosa del preventivo può vedere chi ha il link.
const PREVENTIVI = {
  formazione: { tabella: 'preventivi_formazione', colonne: 'cliente,cliente_cf,cliente_indirizzo,oggetto,protocollo,data_documento', nome: 'Formazione esterna' },
  assistenze: { tabella: 'preventivi_assistenze', colonne: 'cliente,cliente_cf,cliente_indirizzo,oggetto,data_documento', nome: 'Assistenza sanitaria' },
  trasporti: { tabella: 'preventivi', colonne: 'cliente', nome: 'Trasporto sanitario' },
};

const NON_VALIDO = 'Il link non è valido o è scaduto. Chiedi un link nuovo a chi ti ha mandato il preventivo.';

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'Il modulo non è al momento disponibile.' }, 503);

  const grezzo = await request.text();
  if (grezzo.length > MAX_CORPO) return json({ error: 'Richiesta troppo grande.' }, 413);
  let corpo;
  try { corpo = JSON.parse(grezzo); } catch { return json({ error: 'Richiesta non valida.' }, 400); }
  const { azione, token } = corpo || {};
  if (azione !== 'leggi' && azione !== 'invia') return json({ error: 'Richiesta non valida.' }, 400);
  // La forma si controlla prima di qualunque query: nel filtro di PostgREST
  // finisce solo una stringa di 43 caratteri da un alfabeto innocuo.
  if (typeof token !== 'string' || !FORMA_TOKEN.test(token)) return json({ error: NON_VALIDO }, 404);

  const base = env.SUPABASE_URL || SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const db = async (percorso, opzioni = {}) => {
    const res = await fetch(`${base}/rest/v1/${percorso}`, {
      ...opzioni,
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(opzioni.headers || {}) },
    });
    if (!res.ok) throw new Error(`${percorso.split('?')[0]}: ${res.status}`);
    return res.status === 204 ? [] : res.json();
  };

  try {
    const [riga] = await db(`dati_fatturazione?select=id,sezione,preventivo_id,scade_il,revocato,dati,inviato_il,invii&token=eq.${token}`);
    if (!riga || riga.revocato || new Date(riga.scade_il) < new Date()) return json({ error: NON_VALIDO }, 404);
    const conf = PREVENTIVI[riga.sezione];
    if (!conf) return json({ error: NON_VALIDO }, 404);

    if (azione === 'leggi') {
      const [prev] = await db(`${conf.tabella}?select=${conf.colonne}&id=eq.${riga.preventivo_id}`);
      if (!prev) return json({ error: NON_VALIDO }, 404);
      return json({
        intestazione: {
          servizio: conf.nome,
          cliente: prev.cliente || '',
          oggetto: prev.oggetto || '',
          protocollo: prev.protocollo || '',
          data: prev.data_documento || '',
        },
        dati: riga.dati || proposta(prev),
        inviato_il: riga.inviato_il,
      });
    }

    const esito = controllaDati(corpo.dati);
    if (!esito.ok) return json({ error: 'Alcuni dati vanno corretti.', errori: esito.errori }, 422);
    if (riga.invii >= MAX_INVII) {
      return json({ error: 'Questo link ha già ricevuto troppi invii. Scrivi a chi ti ha mandato il preventivo.' }, 429);
    }
    const ora = new Date().toISOString();
    // Il filtro sul numero di invii fa da controllo di concorrenza: due invii
    // contemporanei non possono superare il tetto contando lo stesso valore.
    const scritte = await db(`dati_fatturazione?id=eq.${riga.id}&invii=eq.${riga.invii}`, {
      method: 'PATCH',
      body: JSON.stringify({ dati: esito.dati, inviato_il: ora, invii: riga.invii + 1, updated_at: ora }),
    });
    if (!scritte.length) return json({ error: 'Invio non riuscito: riprova fra un momento.' }, 409);
    return json({ ok: true, inviato_il: ora });
  } catch (e) {
    console.error('[dati-fatturazione]', e);
    return json({ error: 'Il modulo non è al momento disponibile. Riprova più tardi.' }, 500);
  }
}

// Quello che il preventivo sa già del cliente, per partire non da zero. Il
// codice del preventivo è un campo unico «C.F. / P.IVA»: undici cifre sono
// una partita IVA, il resto un codice fiscale.
export function proposta(prev) {
  const cf = String(prev.cliente_cf || '').replace(/\s/g, '').toUpperCase();
  const piva = /^\d{11}$/.test(cf);
  return {
    tipo: piva || !cf ? 'azienda' : 'privato',
    ragione_sociale: prev.cliente || '',
    partita_iva: piva ? cf : '',
    codice_fiscale: piva ? '' : cf,
    indirizzo: prev.cliente_indirizzo || '',
    nazione: 'IT',
  };
}

function json(dati, status = 200) {
  return new Response(JSON.stringify(dati), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
