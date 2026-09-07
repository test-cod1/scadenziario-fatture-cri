// ============================================================
//  Cloudflare Function — Creazione utente da parte del super admin
//  Endpoint: POST /api/crea-utente
//  Body: { email, nome, autorizzazioni: { sezione: 'operatore'|'admin', … } }
//        →  { email, passwordProvvisoria }
//
//  Crea l'account su Supabase Auth con una password provvisoria generata
//  qui (mai scelta dall'admin, mai inviata via email: la comunica lui
//  stesso all'utente su un canale a sua scelta), completa il profilo
//  (ruolo di portale, nome, deve_cambiare_password=true) così al primo
//  accesso l'app costringe a impostarne una propria, e scrive le
//  autorizzazioni di sezione richieste.
//
//  Richiede la SERVICE ROLE KEY di Supabase (mai esposta al client): va
//  configurata come secret nel progetto Cloudflare —
//    npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
//  (valore: Supabase → Project Settings → API → service_role key).
// ============================================================

import { requireUser, ruoloUtente, SUPABASE_URL } from '../_lib/auth.js';
import { ID_SEZIONI } from '../../js/sezioniIds.js';

export const ALFABETO_PASSWORD = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'; // niente 0/O/1/l/I: ambigui da leggere/comunicare a voce

// Le sezioni che si possono assegnare, dallo stesso elenco che il portale usa
// per disegnare il form: una sezione non prevista verrebbe comunque rifiutata
// dalla chiave esterna verso public.sezioni, ma tanto vale scartarla qui
// invece di creare l'utente e fallire a metà strada.
//
// L'elenco NON va riscritto qui: quando era una copia scritta a mano si è
// disallineato dal portale, e i permessi per una sezione che il server non
// conosceva venivano buttati via senza un errore visibile — il collega
// risultava creato, ma senza quell'accesso.
const SEZIONI_VALIDE = ID_SEZIONI;

export async function onRequestPost(context) {
  const { request, env } = context;
  const user = await requireUser(request, env);
  if (!user) return json({ error: 'Accesso non autorizzato: effettua il login.' }, 401);

  if (!env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'Chiave amministrativa Supabase non configurata (SUPABASE_SERVICE_ROLE_KEY).' }, 500);

  const ruoloChiamante = await ruoloUtente(request, env, user.id);
  if (ruoloChiamante !== 'super_admin') return json({ error: 'Solo un amministratore del portale può creare utenti.' }, 403);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Body non valido.' }, 400); }
  const email = String(body?.email || '').trim().toLowerCase();
  const nome = String(body?.nome || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Email non valida.' }, 400);

  // Permessi richiesti, ripuliti: si tengono solo le sezioni note e i due
  // ruoli ammessi, così un body manomesso non può inventarsi nulla.
  const permessi = [];
  for (const [sezione, ruolo] of Object.entries(body?.autorizzazioni || {})) {
    if (!SEZIONI_VALIDE.includes(sezione)) continue;
    if (ruolo !== 'operatore' && ruolo !== 'admin') continue;
    permessi.push({ sezione, ruolo });
  }

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
  // `nome` viene incluso solo se ne è stato indicato uno: mandarlo a null
  // cancellava il nome di default già ricavato dall'email dal trigger.
  // Il ruolo di portale diventa 'utente' solo se gli si sta dando almeno una
  // sezione; senza permessi resta 'in_attesa', che è la verità.
  const ruoloPortale = permessi.length ? 'utente' : 'in_attesa';
  const campiProfilo = { ruolo: ruoloPortale, deve_cambiare_password: true };
  if (nome) campiProfilo.nome = nome;
  const aggRes = await fetch(`${url}/rest/v1/profili?id=eq.${nuovoId}`, {
    method: 'PATCH',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(campiProfilo),
  });
  if (!aggRes.ok) {
    // L'utente Auth esiste già a questo punto: meglio dare comunque la
    // password generata piuttosto che perderla, segnalando di sistemare
    // profilo e permessi a mano.
    return json({
      email, passwordProvvisoria,
      error: 'Utente creato ma il profilo (nome/stato) non è stato aggiornato: sistemalo a mano su Supabase.',
    }, 207);
  }

  if (permessi.length) {
    const permRes = await fetch(`${url}/rest/v1/autorizzazioni`, {
      method: 'POST',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(permessi.map(p => ({ utente_id: nuovoId, sezione: p.sezione, ruolo: p.ruolo, assegnata_da: user.id }))),
    });
    if (!permRes.ok) {
      return json({
        email, passwordProvvisoria,
        error: 'Utente creato ma le autorizzazioni non sono state salvate: assegnagliele dalla tabella qui sotto.',
      }, 207);
    }
  }

  return json({ email, passwordProvvisoria });
}

// I byte casuali si scartano invece di ripiegarli con il modulo: 256 non è
// divisibile per i 55 caratteri dell'alfabeto, quindi `b % 55` rendeva i
// primi 36 caratteri circa il 5% più probabili degli altri. Si tengono solo
// i byte sotto il multiplo di 55 più alto (220) e gli altri si buttano,
// chiedendone altri finché serve: così ogni carattere ha esattamente la
// stessa probabilità. In media basta un giro e mezzo.
export function generaPassword(lunghezza = 12) {
  const n = ALFABETO_PASSWORD.length;
  const soglia = Math.floor(256 / n) * n;   // 220 con 55 caratteri
  const out = [];
  while (out.length < lunghezza) {
    const bytes = new Uint8Array(lunghezza);
    crypto.getRandomValues(bytes);
    for (const b of bytes) {
      if (b >= soglia) continue;
      out.push(ALFABETO_PASSWORD[b % n]);
      if (out.length === lunghezza) break;
    }
  }
  return out.join('');
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
