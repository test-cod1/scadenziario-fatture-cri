// ============================================================
//  Cloudflare Function — Promemoria di prova, a sé stessi
//  Endpoint: POST /api/promemoria-prova
//  Body:     { giorni_anticipo, fatture_passive, crediti_attive, impegni, scadenze }
//            (le scelte a schermo, anche se non ancora salvate)
//  Risposta: { ok: true, email, vuoto }
//
//  Dalla pagina "Promemoria email": manda SUBITO all'utente collegato
//  l'email che riceverebbe con quelle scelte — anche se oggi non c'è niente
//  da segnalare, così si vede che l'invio funziona. Dieci al giorno al
//  massimo, per persona (quota "promemoria-prova", functions/_lib/quota.js).
// ============================================================

import { requireUser, SUPABASE_URL } from '../_lib/auth.js';
import { consumaQuota, errore429 } from '../_lib/quota.js';
import { oggiRoma, selezionaPerUtente, componiPromemoria, inviaEmail, leggiDati, accessiDi } from '../_lib/promemoria.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const user = await requireUser(request, env);
  if (!user) return json({ error: 'Accesso non autorizzato: effettua il login.' }, 401);
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'Chiave amministrativa Supabase non configurata (SUPABASE_SERVICE_ROLE_KEY).' }, 500);

  let body = {};
  try { body = await request.json(); } catch { return json({ error: 'Body non valido.' }, 400); }
  const giorni = Math.min(60, Math.max(1, Math.round(Number(body?.giorni_anticipo) || 7)));
  const pref = {
    giorni_anticipo: giorni,
    fatture_passive: body?.fatture_passive !== false,
    crediti_attive: body?.crediti_attive !== false,
    impegni: body?.impegni !== false,
    scadenze: body?.scadenze !== false,
  };

  const base = env.SUPABASE_URL || SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const oggi = oggiRoma();
  try {
    const [profili, autorizzazioni] = await Promise.all([
      fetch(`${base}/rest/v1/profili?select=id,email,nome,ruolo,deve_cambiare_password&id=eq.${user.id}`, { headers }).then(r => r.json()),
      fetch(`${base}/rest/v1/autorizzazioni?select=utente_id,sezione&utente_id=eq.${user.id}`, { headers }).then(r => r.json()),
    ]);
    const profilo = profili?.[0];
    const accessi = accessiDi(profilo, autorizzazioni || []);
    // Prima di spendere la quota del servizio email: un account sospeso, in
    // attesa o con la password provvisoria ha ancora un token valido, ma
    // nessuna sezione — e per lui il tetto giornaliero non conta (la
    // funzione consuma_quota non lo registra), quindi va fermato qui.
    if (!accessi.size) return json({ error: 'Il tuo account non ha accesso a nessuna sezione che manda promemoria.' }, 403);
    if (!profilo?.email) return json({ error: 'Profilo senza email.' }, 400);
    const quota = await consumaQuota(request, env, 'promemoria-prova');
    if (!quota.ok) return json(errore429('promemoria-prova', quota), 429);
    const dati = await leggiDati(base, key, {
      passive: accessi.has('scadenziario') && pref.fatture_passive,
      attive: accessi.has('scadenziario') && pref.crediti_attive,
      impegni: accessi.has('direttore') && pref.impegni,
      scadenze: accessi.has('scadenze') && pref.scadenze,
      giorniMax: giorni, oggi,
    });
    const sel = selezionaPerUtente(pref, accessi, dati, oggi);
    const indirizzo = (env.PORTALE_URL || new URL(request.url).origin).replace(/\/$/, '');
    const email = componiPromemoria({ nome: profilo.nome, oggi, sel, indirizzo });
    await inviaEmail(env, { a: profilo.email, oggetto: '[Prova] ' + email.oggetto, html: email.html, testo: email.testo });
    return json({ ok: true, email: profilo.email, vuoto: email.vuoto });
  } catch (e) {
    return json({ error: e.message }, 502);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
