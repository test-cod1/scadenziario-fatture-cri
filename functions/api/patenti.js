// ============================================================
//  Cloudflare Function — Richieste di patente CRI dai volontari
//  Endpoint: POST /api/patenti   (lo chiama il modulo pubblico
//  patenti.html, aperto dal volontario col link della segreteria)
//
//  Corpo: { nome, cognome, patente, documenti_gaia: { <id>: true, … } }
//  Controlla i dati con le regole di js/lib/patenti.mjs e salva una riga
//  in public.richieste_patenti.
//
//  Nessun login e nessun codice nel link: il link è uno per tutti. Per
//  questo l'endpoint non legge mai niente dal database se non per contare,
//  risponde solo «ok» o l'errore, e mette due tetti agli invii:
//   - per mittente (impronta dell'IP, mai l'IP in chiaro): abbastanza per
//     chi sbaglia e rimanda e per una serata in sede, dove tutti escono
//     dalla stessa Wi-Fi con lo stesso indirizzo, non per chi vuole
//     riempire la tabella;
//   - per giorno, su tutti: se qualcuno aggira il primo, il danno resta
//     contenuto.
//
//  Quando il volontario risponde «No, mi serve supporto» la richiesta si
//  salva lo stesso, e parte un'email di avviso alla segreteria (stesso
//  servizio dei promemoria). Se l'email non parte la richiesta resta
//  salvata: il portale la mostra comunque come «serve supporto».
//
//  Secret: SUPABASE_SERVICE_ROLE_KEY (la tabella non ha policy per gli
//  anonimi: scrive solo il server). Per l'email: PROMEMORIA_MITTENTE e
//  RESEND_API_KEY (o BREVO_API_KEY); il destinatario si può cambiare con
//  PATENTI_EMAIL_SUPPORTO.
// ============================================================

import { SUPABASE_URL } from '../_lib/auth.js';
import { inviaEmail } from '../_lib/promemoria.js';
import { controllaRichiesta, documentiMancanti, tipoRichiesta } from '../../js/lib/patenti.mjs';

// A chi arriva l'avviso delle richieste di supporto.
export const EMAIL_SUPPORTO = 'jacopo.ravaioli@liguria.cri.it';

// 5 l'ora bloccava il sesto volontario che compilava dalla Wi-Fi della
// sede (o la segreteria che lo compila per più persone): stesso indirizzo
// per tutti. Il tetto giornaliero e il campo trappola restano.
export const MAX_PER_MITTENTE = 15;    // nell'ultima ora
export const MAX_AL_GIORNO = 300;      // nelle ultime 24 ore, da tutti
const MAX_CORPO = 4000;

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'Il modulo non è al momento disponibile.' }, 503);

  const grezzo = await request.text();
  if (grezzo.length > MAX_CORPO) return json({ error: 'Richiesta troppo grande.' }, 413);
  let corpo;
  try { corpo = JSON.parse(grezzo); } catch { return json({ error: 'Richiesta non valida.' }, 400); }

  // Campo trappola: invisibile alle persone, i programmi che compilano i
  // moduli da soli lo riempiono. Si risponde «ok» senza salvare, così non
  // imparano niente. Nel modulo il campo ha un nome e un'etichetta che
  // l'autocompilazione dei browser e dei gestori di password non riconosce
  // (js/pubblico/patenti.js, `trappola`): se la riempisse lei, la richiesta
  // di un volontario vero sparirebbe senza che nessuno se ne accorga.
  if (corpo && corpo.sito) return json({ ok: true });

  const esito = controllaRichiesta(corpo);
  if (!esito.ok) return json({ error: 'Alcuni dati vanno corretti.', errori: esito.errori }, 422);

  const base = env.SUPABASE_URL || SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const db = async (percorso, opzioni = {}) => {
    const res = await fetch(`${base}/rest/v1/${percorso}`, {
      ...opzioni,
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(opzioni.headers || {}) },
    });
    if (!res.ok) throw new Error(`${percorso.split('?')[0]}: ${res.status}`);
    return res;
  };
  // Quante righe corrispondono, senza scaricarle: lo dice l'intestazione
  // Content-Range di PostgREST (".../<totale>").
  const conta = async (filtri) => {
    const res = await db(`richieste_patenti?select=id&${filtri}`, { method: 'HEAD', headers: { Prefer: 'count=exact', Range: '0-0' } });
    return Number((res.headers.get('Content-Range') || '').split('/')[1]) || 0;
  };

  try {
    const ipHash = await impronta(request.headers.get('CF-Connecting-IP') || '', key);
    const ora = Date.now();
    const unOraFa = new Date(ora - 3600e3).toISOString();
    const ieri = new Date(ora - 86400e3).toISOString();
    if (await conta(`ip_hash=eq.${ipHash}&created_at=gte.${unOraFa}`) >= MAX_PER_MITTENTE) {
      return json({ error: 'Hai già inviato diverse richieste: riprova fra un\'ora.' }, 429);
    }
    if (await conta(`created_at=gte.${ieri}`) >= MAX_AL_GIORNO) {
      return json({ error: 'Il modulo ha ricevuto troppe richieste oggi: riprova domani o scrivi alla segreteria.' }, 429);
    }
    await db('richieste_patenti', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ ...esito.dati, ip_hash: ipHash }),
    });
    if (corpo.supporto === true) {
      // L'email non deve far fallire né rallentare la risposta al
      // volontario: su Cloudflare prosegue dopo la risposta (waitUntil).
      const avviso = inviaEmail(env, emailSupporto(esito.dati, env, request))
        .catch(e => console.error('[patenti] email di supporto non inviata:', e.message));
      if (typeof context.waitUntil === 'function') context.waitUntil(avviso); else await avviso;
    }
    return json({ ok: true });
  } catch (e) {
    console.error('[patenti]', e);
    return json({ error: 'Il modulo non è al momento disponibile. Riprova più tardi.' }, 500);
  }
}

// L'email alla segreteria: chi, quale patente, cosa manca, e il link alle
// richieste di supporto nel portale. Tutto quello che arriva dal volontario
// è già stato ripulito da controllaRichiesta, ma nell'HTML si scappa lo
// stesso.
export function emailSupporto(dati, env = {}, request = null) {
  const portale = (env.PORTALE_URL || (request ? new URL(request.url).origin : 'https://amministrazione.crigenova.it')).replace(/\/$/, '');
  const link = `${portale}/#/patenti/richieste/supporto`;
  const mancanti = documentiMancanti(dati.documenti_gaia, dati.tipo).map(d => d.breve);
  const chi = `${dati.nome} ${dati.cognome}`;
  const cosa = `${tipoRichiesta(dati.tipo)?.breve || 'Patente'} — patente ${dati.patente}`;
  const e = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  return {
    a: env.PATENTI_EMAIL_SUPPORTO || EMAIL_SUPPORTO,
    oggetto: `Patenti CRI: ${chi} chiede supporto per i documenti`,
    testo: [
      `${chi} ha chiesto supporto dal modulo delle patenti CRI.`,
      `Richiesta: ${cosa}`,
      `Documenti che mancano: ${mancanti.join('; ')}`,
      '',
      `Apri la richiesta nel portale: ${link}`,
    ].join('\n'),
    html: `<p><b>${e(chi)}</b> ha chiesto supporto dal modulo delle patenti CRI.</p>
      <p>Richiesta: <b>${e(cosa)}</b><br>
      Documenti che mancano:</p>
      <ul>${mancanti.map(m => `<li>${e(m)}</li>`).join('')}</ul>
      <p><a href="${e(link)}">Apri le richieste di supporto nel portale</a></p>`,
  };
}

// SHA-256 dell'IP con un sale segreto: due invii dallo stesso indirizzo
// hanno la stessa impronta, ma dall'impronta non si risale all'indirizzo.
// Il sale è un pezzo della chiave di servizio, che non esce dal server.
export async function impronta(ip, segreto) {
  const dati = new TextEncoder().encode(`${segreto.slice(-24)}|${ip}`);
  const h = await crypto.subtle.digest('SHA-256', dati);
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

function json(dati, status = 200) {
  return new Response(JSON.stringify(dati), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
