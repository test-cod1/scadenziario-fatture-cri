// ============================================================
//  Cloudflare Function — Webhook del bot Telegram (idee del Direttore)
//  Endpoint: POST /api/telegram   (lo chiama Telegram, non il portale)
//  Header:   X-Telegram-Bot-Api-Secret-Token: <TELEGRAM_WEBHOOK_SECRET>
//
//  Telegram manda qui ogni messaggio scritto al bot. Se la chat è
//  collegata a un utente del portale che ha accesso alla sezione
//  Direttore, il testo diventa un'idea (idee_direttore, origine
//  'telegram'). I comandi: /collega CODICE (o il link t.me/...?start=CODICE
//  generato dal portale), /idee, /scollega, /aiuto.
//
//  La risposta al messaggio si manda nella risposta stessa al webhook
//  ({ method: 'sendMessage', ... }): niente chiamate in più a Telegram.
//  Si risponde sempre 200 a Telegram (anche in caso di errore, con un
//  messaggio all'utente): un errore farebbe ripetere la consegna a oltranza.
//
//  Chi è chi lo decide solo il database: il segreto nell'intestazione
//  prova che la chiamata viene da Telegram, la tabella
//  telegram_collegamenti dice di chi è la chat, e il collegamento nasce
//  solo da un codice monouso generato da un utente collegato al portale.
//
//  Secret: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY.
// ============================================================

import { SUPABASE_URL } from '../_lib/auth.js';
import { accessiDi } from '../_lib/promemoria.js';
import { interpreta, TESTI, testoCollegato, testoUltimeIdee, stessoSegreto } from '../_lib/telegram.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_WEBHOOK_SECRET || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Bot non configurato.' }, 503);
  }
  if (!stessoSegreto(request.headers.get('X-Telegram-Bot-Api-Secret-Token'), env.TELEGRAM_WEBHOOK_SECRET)) {
    return json({ error: 'Non autorizzato.' }, 401);
  }

  let update;
  try { update = await request.json(); } catch { return json({}); }
  const msg = interpreta(update);
  if (!msg) return json({});
  const rispondi = (text) => json({ method: 'sendMessage', chat_id: msg.chatId, text });

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
  // Il profilo e l'accesso al Direttore di un utente, con le stesse regole
  // delle policy (sospesi e password provvisoria non vedono nulla).
  const utente = async (id) => {
    const [profili, aut] = await Promise.all([
      db(`profili?select=id,email,nome,ruolo,deve_cambiare_password&id=eq.${id}`),
      db(`autorizzazioni?select=utente_id,sezione&utente_id=eq.${id}`),
    ]);
    const profilo = profili[0];
    return { profilo, accede: accessiDi(profilo, aut).has('direttore') };
  };

  try {
    if (msg.tipo === 'aiuto') return rispondi(TESTI.aiuto);

    if (msg.tipo === 'collega') {
      if (!/^[A-Z0-9]{8}$/.test(msg.codice)) return rispondi(TESTI.codiceNonValido);
      const righe = await db(`telegram_collegamenti?select=utente_id,codice_scade&codice=eq.${msg.codice}`);
      const r = righe[0];
      if (!r || !r.codice_scade || new Date(r.codice_scade) < new Date()) return rispondi(TESTI.codiceNonValido);
      const { profilo, accede } = await utente(r.utente_id);
      if (!accede) return rispondi(TESTI.senzaAccesso);
      // Una chat appartiene a una persona sola: se era collegata a un altro
      // utente, quel collegamento si scioglie.
      await db(`telegram_collegamenti?chat_id=eq.${msg.chatId}&utente_id=neq.${r.utente_id}`, { method: 'DELETE' });
      await db(`telegram_collegamenti?utente_id=eq.${r.utente_id}`, {
        method: 'PATCH',
        body: JSON.stringify({ chat_id: msg.chatId, telegram_nome: msg.nome || null, codice: null, codice_scade: null, collegato_il: new Date().toISOString() }),
      });
      return rispondi(testoCollegato(profilo?.nome || profilo?.email));
    }

    const collegati = await db(`telegram_collegamenti?select=utente_id&chat_id=eq.${msg.chatId}`);
    if (!collegati.length) return rispondi(msg.tipo === 'scollega' ? TESTI.scollegato : TESTI.nonCollegato);
    const utenteId = collegati[0].utente_id;

    if (msg.tipo === 'scollega') {
      await db(`telegram_collegamenti?chat_id=eq.${msg.chatId}`, { method: 'DELETE' });
      return rispondi(TESTI.scollegato);
    }

    const { profilo, accede } = await utente(utenteId);
    if (!accede) return rispondi(TESTI.senzaAccesso);

    if (msg.tipo === 'idee') {
      const ultime = await db('idee_direttore?select=testo,stato,autore_nome,created_at&order=created_at.desc&limit=5');
      return rispondi(testoUltimeIdee(ultime));
    }

    await db('idee_direttore', {
      method: 'POST',
      body: JSON.stringify({ testo: msg.testo, origine: 'telegram', autore_id: utenteId, autore_nome: profilo.nome || profilo.email }),
    });
    return rispondi(TESTI.ideaSalvata);
  } catch {
    return rispondi(TESTI.errore);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
