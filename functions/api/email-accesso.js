// ============================================================
//  Cloudflare Function — Accesso con nome e cognome
//  Endpoint: POST /api/email-accesso   (lo chiama la pagina di login)
//
//  Corpo:  { nome, password }               → { access_token, refresh_token }
//          { nome, azione: 'recupero' }     → { ok: true }   (sempre)
//
//  Senza login, perché serve prima del login. Vale solo per gli account che
//  hanno un nome di accesso in app_metadata.nome_accesso (vedi
//  js/lib/nomeAccesso.mjs): sono quelli di chi condivide una casella email.
//
//  Fino al 15/11/2026 questo endpoint restituiva l'EMAIL corrispondente al
//  nome, e il login lo faceva poi il browser. Così chiunque, senza nessuna
//  password, poteva provare dei nomi e raccogliere gli indirizzi (e capire
//  dal 409 chi aveva un omonimo). Adesso l'email non esce mai di qui:
//  - per l'accesso, il login lo fa il server con nome + password e al
//    browser torna solo la sessione;
//  - per il recupero della password, il server manda il link e risponde
//    sempre allo stesso modo, che il nome esista o no.
//  Nome sbagliato, password sbagliata o nome condiviso da due account danno
//  la stessa identica risposta.
//
//  Limiti (functions/_lib/limiti.js): tentativi per indirizzo e per nome.
//  Il login passa da qui, quindi i limiti di Supabase «per indirizzo» vedono
//  l'indirizzo del Worker e non quello di chi prova: i nostri li sostituiscono.
//
//  Secret: SUPABASE_SERVICE_ROLE_KEY (per leggere gli utenti di Auth).
// ============================================================

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../_lib/auth.js';
import { consumaLimite, improntaIp } from '../_lib/limiti.js';
import { normalizzaNome } from '../../js/lib/nomeAccesso.mjs';

const MAX_CORPO = 2000;
export const NON_TROVATO = 'Nome o password non corretti.';
export const RECUPERO_OK = 'Se il nome è registrato, riceverai a breve un link per impostare una nuova password.';
const TROPPI = 'Troppi tentativi, riprova tra qualche minuto.';

// Tentativi ammessi: per indirizzo (chiunque provi da lì) e per nome (chi
// prova a indovinare la password di una persona da tanti indirizzi).
export const LIMITI_ACCESSO = {
  accessoPerIp: { massimo: 10, secondi: 15 * 60 },
  accessoPerNome: { massimo: 10, secondi: 60 * 60 },
  recuperoPerIp: { massimo: 5, secondi: 60 * 60 },
};

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'Accesso per nome non disponibile: usa l\'email.' }, 503);

  const grezzo = await request.text();
  if (grezzo.length > MAX_CORPO) return json({ error: 'Richiesta troppo grande.' }, 413);
  let corpo;
  try { corpo = JSON.parse(grezzo); } catch { return json({ error: 'Richiesta non valida.' }, 400); }
  const cercato = normalizzaNome(corpo?.nome);
  const recupero = corpo?.azione === 'recupero';
  const password = typeof corpo?.password === 'string' ? corpo.password : '';
  // Una scheda rimasta aperta col codice di prima chiede solo il nome.
  if (!recupero && !password) return json({ error: 'Ricarica la pagina e riprova.' }, 400);
  if (!cercato || cercato.length > 120) return recupero ? json({ ok: true, messaggio: RECUPERO_OK }) : json({ error: NON_TROVATO }, 401);

  const ip = await improntaIp(request, env.SUPABASE_SERVICE_ROLE_KEY);
  if (recupero) {
    const { massimo, secondi } = LIMITI_ACCESSO.recuperoPerIp;
    if (!(await consumaLimite(env, `recupero-nome:${ip}`, massimo, secondi)).ok) return json({ error: TROPPI }, 429);
  } else {
    const perIp = LIMITI_ACCESSO.accessoPerIp, perNome = LIMITI_ACCESSO.accessoPerNome;
    if (!(await consumaLimite(env, `accesso-nome:ip:${ip}`, perIp.massimo, perIp.secondi)).ok) return json({ error: TROPPI }, 429);
    if (!(await consumaLimite(env, `accesso-nome:nome:${cercato}`, perNome.massimo, perNome.secondi)).ok) return json({ error: TROPPI }, 429);
  }

  const base = env.SUPABASE_URL || SUPABASE_URL;
  const anonKey = env.SUPABASE_ANON_KEY || SUPABASE_ANON_KEY;
  let email;
  try {
    email = await emailDelNome(base, env.SUPABASE_SERVICE_ROLE_KEY, cercato);
  } catch (e) {
    console.error('[email-accesso] elenco utenti:', e.message);
    return json({ error: 'Accesso per nome non disponibile in questo momento: usa l\'email.' }, 502);
  }

  if (recupero) {
    if (email) {
      const redirect = new URL(request.url).origin + '/';
      try {
        const res = await fetch(`${base}/auth/v1/recover?redirect_to=${encodeURIComponent(redirect)}`, {
          method: 'POST',
          headers: { apikey: anonKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        if (!res.ok) console.error('[email-accesso] recupero non inviato:', res.status);
      } catch (e) { console.error('[email-accesso] recupero non inviato:', e.message); }
    }
    return json({ ok: true, messaggio: RECUPERO_OK });
  }

  if (!email) return json({ error: NON_TROVATO }, 401);
  let res;
  try {
    res = await fetch(`${base}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch (e) {
    console.error('[email-accesso] login:', e.message);
    return json({ error: 'Accesso non riuscito: riprova tra poco.' }, 502);
  }
  if (res.status === 429) return json({ error: TROPPI }, 429);
  if (!res.ok) return json({ error: NON_TROVATO }, 401);
  const sessione = await res.json().catch(() => null);
  if (!sessione?.access_token || !sessione?.refresh_token) return json({ error: 'Accesso non riuscito: riprova tra poco.' }, 502);
  // Al browser solo i due token: con questi supabase-js ricostruisce la
  // sessione (setSession). L'email la rilegge lui dal proprio account.
  return json({ access_token: sessione.access_token, refresh_token: sessione.refresh_token });
}

// L'email dell'account che ha quel nome di accesso, oppure null (anche
// quando due account hanno lo stesso nome: meglio non indovinare chi è).
async function emailDelNome(base, key, cercato) {
  let trovati = [];
  // Gli utenti del portale sono qualche decina: si scorrono tutti.
  for (let pagina = 1; pagina <= 20; pagina++) {
    const res = await fetch(`${base}/auth/v1/admin/users?page=${pagina}&per_page=200`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) throw new Error(`utenti: ${res.status}`);
    const { users = [] } = await res.json();
    trovati = trovati.concat(users.filter(u => u.app_metadata?.nome_accesso && normalizzaNome(u.app_metadata.nome_accesso) === cercato));
    if (users.length < 200) break;
  }
  return trovati.length === 1 ? trovati[0].email : null;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
