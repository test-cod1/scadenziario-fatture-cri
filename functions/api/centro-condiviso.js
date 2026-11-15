// ============================================================
//  Cloudflare Function — Il conto di un centro di costo, in sola lettura
//  Endpoint: POST /api/centro-condiviso   (lo chiama la pagina pubblica
//  conto.html, aperta col link creato in Analisi)
//
//  Corpo: { token }
//  Risposta: il nome e il periodo del centro e i suoi movimenti, con i soli
//  campi che la pagina mostra. Le note restano fuori: ci finiscono numeri di
//  carte carburante, accordi e appunti di lavoro, scritti per chi usa il
//  portale e non per chi riceve un link.
//
//  Nessun login: chi ha il link vede quel centro. Per questo l'endpoint
//  risponde allo stesso modo a un codice inesistente o disattivato, legge
//  soltanto (nessuna scrittura possibile da qui) e il codice viaggia nel
//  corpo della richiesta, non nell'indirizzo, così non resta nei log.
//
//  Secret: SUPABASE_SERVICE_ROLE_KEY (le tabelle di Analisi non hanno
//  policy per gli anonimi: legge solo il server).
// ============================================================

import { SUPABASE_URL } from '../_lib/auth.js';
import { formaValida } from '../../js/lib/linkCentri.mjs';
import { consumaLimite, improntaIp } from '../_lib/limiti.js';

const MAX_CORPO = 2000;
// Aperture per indirizzo: largo per chi guarda davvero (anche un ufficio
// intero dietro lo stesso indirizzo), stretto per chi prova codici a caso.
export const LIMITE_CENTRO = { massimo: 60, secondi: 10 * 60 };
const NON_VALIDO = 'Il link non è valido o non è più attivo. Chiedine uno nuovo a chi te lo ha mandato.';

// I campi che escono, scritti qui e non chiesti dal client: è il server a
// decidere che cosa vede chi ha il link.
export const CAMPI_CENTRO = 'id,nome,descrizione,inizio,fine,chiuso';
export const CAMPI_MOVIMENTO = 'tipo,data,controparte,documento,descrizione,categoria,importo';

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'La pagina non è al momento disponibile.' }, 503);

  const grezzo = await request.text();
  if (grezzo.length > MAX_CORPO) return json({ error: 'Richiesta troppo grande.' }, 413);
  let corpo;
  try { corpo = JSON.parse(grezzo); } catch { return json({ error: 'Richiesta non valida.' }, 400); }
  const token = corpo?.token;
  // La forma si controlla prima di qualunque query: nel filtro di PostgREST
  // finisce solo una stringa corta di lettere, cifre e trattini.
  if (!formaValida(token)) return json({ error: NON_VALIDO }, 404);

  const base = env.SUPABASE_URL || SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const db = async (percorso) => {
    const res = await fetch(`${base}/rest/v1/${percorso}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) throw new Error(`${percorso.split('?')[0]}: ${res.status}`);
    return res.json();
  };

  // Chi prova codici a caso (o una pagina lasciata a ricaricarsi da sola)
  // non deve poter interrogare il database senza freni: ogni richiesta qui
  // legge con la service role tutti i movimenti del centro.
  const ip = await improntaIp(request, key);
  if (!(await consumaLimite(env, `centro-condiviso:${ip}`, LIMITE_CENTRO.massimo, LIMITE_CENTRO.secondi)).ok) {
    return json({ error: 'Troppe richieste: riprova tra qualche minuto.' }, 429);
  }

  try {
    const [centro] = await centroDelCodice(db, token);
    if (!centro) return json({ error: NON_VALIDO }, 404);
    // Link con una scadenza (link_scade_il, patch 2026-11-15): vale fino a
    // quel giorno compreso, ora italiana. Scaduto = come un link inesistente.
    if (centro.link_scade_il && oggiRoma() > centro.link_scade_il) return json({ error: NON_VALIDO }, 404);
    const movimenti = await tutti(db, `movimenti_analisi?select=${CAMPI_MOVIMENTO}&centro_id=eq.${centro.id}&order=data.desc`);
    const { id: _id, ...visibile } = centro;
    return json({ centro: visibile, movimenti, letto_il: new Date().toISOString() });
  } catch (e) {
    console.error('[centro-condiviso]', e);
    return json({ error: 'La pagina non è al momento disponibile. Riprova più tardi.' }, 500);
  }
}

// Con la scadenza, se la colonna c'è; senza, sul database a cui la patch
// del 15/11/2026 non è ancora stata applicata (PostgREST risponde 400 a una
// colonna che non conosce): meglio un link che non scade di una pagina rotta.
async function centroDelCodice(db, token) {
  try {
    return await db(`centri_costo?select=${CAMPI_CENTRO},link_scade_il&link_token=eq.${token}`);
  } catch (e) {
    if (!/: 400$/.test(e.message)) throw e;
    return db(`centri_costo?select=${CAMPI_CENTRO}&link_token=eq.${token}`);
  }
}

export function oggiRoma(adesso = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(adesso);
}

// PostgREST si ferma a 1000 righe: un centro seguito per anni le supera, e
// un conto troncato in silenzio è peggio di nessun conto.
async function tutti(db, percorso) {
  const out = [];
  for (let da = 0; ; da += 1000) {
    const blocco = await db(`${percorso}&offset=${da}&limit=1000`);
    out.push(...blocco);
    if (blocco.length < 1000) return out;
  }
}

function json(dati, status = 200) {
  return new Response(JSON.stringify(dati), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
