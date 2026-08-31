// ============================================================
//  Cloudflare Function — Creazione utente da parte di un admin
//  Endpoint: POST /api/crea-utente
//  Body: { email, nome, ruolo }  →  { email, passwordProvvisoria }
//
//  Crea l'account su Supabase Auth con una password provvisoria generata
//  qui (mai scelta dall'admin, mai inviata via email: la comunica lui
//  stesso all'utente su un canale a sua scelta) e imposta il profilo
//  (ruolo, nome, deve_cambiare_password=true) così al primo accesso
//  l'app costringe a impostarne una propria prima di entrare.
//
//  Richiede la SERVICE ROLE KEY di Supabase (mai esposta al client): va
//  configurata come secret nel progetto Cloudflare —
//    npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
//  (valore: Supabase → Project Settings → API → service_role key).
// ============================================================

import { requireUser, ruoloUtente, SUPABASE_URL, SUPABASE_ANON_KEY } from '../_lib/auth.js';

const ALFABETO_PASSWORD = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'; // niente 0/O/1/l/I: ambigui da leggere/comunicare a voce

export async function onRequestPost(context) {
  const { request, env } = context;
  const user = await requireUser(request, env);
  if (!user) return json({ error: 'Accesso non autorizzato: effettua il login.' }, 401);

  if (!env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'Chiave amministrativa Supabase non configurata (SUPABASE_SERVICE_ROLE_KEY).' }, 500);

  const ruoloChiamante = await ruoloUtente(request, env, user.id);
  if (ruoloChiamante !== 'admin') return json({ error: 'Solo gli amministratori possono creare utenti.' }, 403);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Body non valido.' }, 400); }
  const email = String(body?.email || '').trim().toLowerCase();
  const nome = String(body?.nome || '').trim();
  const ruolo = body?.ruolo === 'admin' ? 'admin' : 'operatore';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Email non valida.' }, 400);

  const url = (env && env.SUPABASE_URL) || SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const passwordProvvisoria = generaPassword();

  const creaRes = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: passwordProvvisoria, email_confirm: true }),
  });
  const creaData = await creaRes.json().catch(() => ({}));
  if (!creaRes.ok) {
    const msg = creaData?.msg || creaData?.message || creaData?.error_description || 'Creazione utente non riuscita.';
    const giaEsistente = /already.*registered|already exists|duplicate/i.test(msg);
    return json({ error: giaEsistente ? 'Esiste già un utente con questa email.' : msg }, creaRes.status);
  }
  const nuovoId = creaData?.id;

  // Il trigger handle_new_user() ha già creato il profilo (ruolo 'in_attesa',
  // stessa transazione dell'insert su auth.users): qui lo si completa.
  // `nome` viene incluso solo se l'admin ne ha indicato uno: mandarlo a null
  // cancellava il nome di default già ricavato dall'email dal trigger.
  const aggRes = await fetch(`${url}/rest/v1/profili?id=eq.${nuovoId}`, {
    method: 'PATCH',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(nome ? { ruolo, nome, deve_cambiare_password: true } : { ruolo, deve_cambiare_password: true }),
  });
  if (!aggRes.ok) {
    // L'utente Auth esiste già a questo punto: meglio dare comunque la
    // password generata piuttosto che perderla, segnalando di sistemare
    // ruolo/nome a mano.
    return json({
      email, passwordProvvisoria,
      error: 'Utente creato ma il profilo (ruolo/nome) non è stato aggiornato: sistemalo a mano su Supabase.',
    }, 207);
  }

  return json({ email, passwordProvvisoria });
}

function generaPassword(lunghezza = 12) {
  const bytes = new Uint8Array(lunghezza);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => ALFABETO_PASSWORD[b % ALFABETO_PASSWORD.length]).join('');
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
