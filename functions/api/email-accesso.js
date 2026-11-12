// ============================================================
//  Cloudflare Function — Da nome e cognome all'email di accesso
//  Endpoint: POST /api/email-accesso   (lo chiama la pagina di login)
//
//  Corpo: { nome }   →   { email }   oppure 404
//
//  Senza login, perché serve prima del login. Risponde solo per gli account
//  che hanno un nome di accesso in app_metadata.nome_accesso (vedi
//  js/lib/nomeAccesso.mjs): gli altri non si trovano per nome, quindi da qui
//  non si ricavano le email dei colleghi. Non fa il login al posto del
//  browser: la password non passa di qui, e i limiti ai tentativi di
//  Supabase restano quelli per indirizzo di chi prova.
//
//  Secret: SUPABASE_SERVICE_ROLE_KEY (per leggere gli utenti di Auth).
// ============================================================

import { SUPABASE_URL } from '../_lib/auth.js';
import { normalizzaNome } from '../../js/lib/nomeAccesso.mjs';

const MAX_CORPO = 500;
export const NON_TROVATO = 'Nome o password non corretti.';

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'Accesso per nome non disponibile: usa l\'email.' }, 503);

  const grezzo = await request.text();
  if (grezzo.length > MAX_CORPO) return json({ error: 'Richiesta troppo grande.' }, 413);
  let corpo;
  try { corpo = JSON.parse(grezzo); } catch { return json({ error: 'Richiesta non valida.' }, 400); }
  const cercato = normalizzaNome(corpo?.nome);
  if (!cercato || cercato.length > 120) return json({ error: NON_TROVATO }, 404);

  const base = env.SUPABASE_URL || SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    // Gli utenti del portale sono qualche decina: si scorrono tutti.
    for (let pagina = 1; pagina <= 20; pagina++) {
      const res = await fetch(`${base}/auth/v1/admin/users?page=${pagina}&per_page=200`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      if (!res.ok) throw new Error(`utenti: ${res.status}`);
      const { users = [] } = await res.json();
      const trovati = users.filter(u => u.app_metadata?.nome_accesso && normalizzaNome(u.app_metadata.nome_accesso) === cercato);
      // Due account con lo stesso nome: meglio non indovinare chi è.
      if (trovati.length > 1) return json({ error: 'Questo nome corrisponde a più account: accedi con l\'email.' }, 409);
      if (trovati.length === 1) return json({ email: trovati[0].email });
      if (users.length < 200) break;
    }
    return json({ error: NON_TROVATO }, 404);
  } catch {
    return json({ error: 'Accesso per nome non disponibile in questo momento: usa l\'email.' }, 502);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
