// ============================================================
//  Cloudflare Function — Invio dei promemoria email (tutti gli utenti)
//  Endpoint: POST /api/promemoria
//  Header:   X-Promemoria-Token: <PROMEMORIA_TOKEN>
//  Body:     {} oppure { "forza": true } per ignorare frequenza e
//            "già inviato oggi" (prove)
//  Risposta: { inviate, saltate, vuote, errori: [...] }
//
//  Lo chiama ogni mattina il database (pg_cron + pg_net, vedi
//  supabase/patch-2026-10-18-promemoria.sql): Pages non ha un timer suo.
//  Non c'è un utente collegato, quindi niente token Supabase: la chiamata
//  si riconosce dal segreto condiviso PROMEMORIA_TOKEN, e i dati si leggono
//  con la service role. Senza PROMEMORIA_TOKEN configurato l'endpoint non
//  fa nulla: i promemoria restano spenti per tutti.
//
//  Secret richiesti: PROMEMORIA_TOKEN, SUPABASE_SERVICE_ROLE_KEY,
//  PROMEMORIA_MITTENTE e RESEND_API_KEY (oppure BREVO_API_KEY).
//  Facoltativo: PORTALE_URL (default https://amministrazione.crigenova.it).
// ============================================================

import { SUPABASE_URL } from '../_lib/auth.js';
import { oggiRoma, tocca, selezionaPerUtente, componiPromemoria, inviaEmail, leggiDati, accessiDi } from '../_lib/promemoria.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.PROMEMORIA_TOKEN) return json({ error: 'Promemoria non attivi su questo server (PROMEMORIA_TOKEN non configurato).' }, 503);
  if (!stessoSegreto(request.headers.get('X-Promemoria-Token') || '', env.PROMEMORIA_TOKEN)) {
    return json({ error: 'Non autorizzato.' }, 401);
  }
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'Chiave amministrativa Supabase non configurata (SUPABASE_SERVICE_ROLE_KEY).' }, 500);

  let body = {};
  try { body = await request.json(); } catch { /* corpo vuoto: va bene */ }
  const forza = body?.forza === true;

  const base = env.SUPABASE_URL || SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const indirizzo = (env.PORTALE_URL || 'https://amministrazione.crigenova.it').replace(/\/$/, '');
  const oggi = oggiRoma();

  const leggi = async (percorso) => {
    const res = await fetch(`${base}/rest/v1/${percorso}`, { headers });
    if (!res.ok) throw new Error(`${percorso.split('?')[0]}: ${res.status}`);
    return res.json();
  };

  let preferenze, profili, autorizzazioni;
  try {
    preferenze = (await leggi('notifiche_preferenze?attive=eq.true&select=*'))
      .filter(p => forza ? true : tocca(p, oggi));
    if (!preferenze.length) return json({ inviate: 0, saltate: 0, vuote: 0, errori: [] });
    const ids = preferenze.map(p => p.utente_id).join(',');
    [profili, autorizzazioni] = await Promise.all([
      leggi(`profili?select=id,email,nome,ruolo,deve_cambiare_password&id=in.(${ids})`),
      leggi(`autorizzazioni?select=utente_id,sezione&utente_id=in.(${ids})`),
    ]);
  } catch (e) {
    return json({ error: 'Lettura delle preferenze non riuscita: ' + e.message }, 502);
  }

  const destinatari = preferenze.map(p => {
    const profilo = profili.find(x => x.id === p.utente_id);
    return { pref: p, profilo, accessi: accessiDi(profilo, autorizzazioni) };
  }).filter(d => d.profilo?.email && d.accessi.size);

  const serve = (sezione, campo) => destinatari.some(d => d.accessi.has(sezione) && d.pref[campo]);
  let dati;
  try {
    dati = await leggiDati(base, key, {
      passive: serve('scadenziario', 'fatture_passive'),
      attive: serve('scadenziario', 'crediti_attive'),
      impegni: serve('direttore', 'impegni'),
      giorniMax: Math.max(7, ...destinatari.map(d => Number(d.pref.giorni_anticipo) || 7)),
      oggi,
    });
  } catch (e) {
    return json({ error: 'Lettura dei dati non riuscita: ' + e.message }, 502);
  }

  const esito = { inviate: 0, saltate: preferenze.length - destinatari.length, vuote: 0, errori: [] };
  for (const d of destinatari) {
    const sel = selezionaPerUtente(d.pref, d.accessi, dati, oggi);
    const email = componiPromemoria({ nome: d.profilo.nome, oggi, sel, indirizzo });
    if (email.vuoto) { esito.vuote++; continue; }
    try {
      await inviaEmail(env, { a: d.profilo.email, ...email });
      esito.inviate++;
      await fetch(`${base}/rest/v1/notifiche_preferenze?utente_id=eq.${d.pref.utente_id}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ ultimo_invio: oggi }),
      });
    } catch (e) {
      esito.errori.push(`${d.profilo.email}: ${e.message}`);
    }
  }
  return json(esito);
}

// Confronto a tempo costante: un confronto normale si ferma al primo
// carattere diverso, e il tempo di risposta direbbe quanti ne hai indovinati.
function stessoSegreto(a, b) {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diverso = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diverso |= (x[i] || 0) ^ (y[i] || 0);
  return diverso === 0;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
