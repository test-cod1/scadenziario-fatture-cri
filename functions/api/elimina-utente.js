// ============================================================
//  Cloudflare Function — Eliminazione definitiva di un utente
//  Endpoint: POST /api/elimina-utente
//  Body: { id }   →   { ok: true, email }
//
//  Cancella l'account da Supabase Auth. Profilo e autorizzazioni se ne
//  vanno insieme a lui (ON DELETE CASCADE), mentre le righe che aveva
//  inserito restano dove sono e perdono solo l'indicazione dell'autore
//  (ON DELETE SET NULL, introdotto da
//  supabase/patch-2026-09-05-elimina-utente.sql: senza quella patch il
//  database rifiuta la cancellazione di chiunque abbia mai inserito
//  qualcosa). Il registro modifiche non è toccato: conserva email e nome
//  come testo, quindi continua a dire chi ha fatto cosa.
//
//  È un'operazione irreversibile e per questo è ristretta al super
//  admin, con due eccezioni che valgono anche per lui: non può eliminare
//  se stesso (resterebbe il portale senza amministratore) né un altro
//  super admin — stessa logica per cui quel ruolo si assegna solo dal
//  database. Per un allontanamento temporaneo esiste "Sospendi", che
//  blocca l'accesso conservando i permessi.
//
//  Richiede la SERVICE ROLE KEY di Supabase (mai esposta al client):
//    npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
// ============================================================

import { requireUser, ruoloUtente, SUPABASE_URL } from '../_lib/auth.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const user = await requireUser(request, env);
  if (!user) return json({ error: 'Accesso non autorizzato: effettua il login.' }, 401);

  if (!env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'Chiave amministrativa Supabase non configurata (SUPABASE_SERVICE_ROLE_KEY).' }, 500);

  const ruoloChiamante = await ruoloUtente(request, env, user.id);
  if (ruoloChiamante !== 'super_admin') return json({ error: 'Solo un amministratore del portale può eliminare utenti.' }, 403);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Body non valido.' }, 400); }
  const id = String(body?.id || '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return json({ error: 'Identificativo utente non valido.' }, 400);
  }
  if (id === user.id) return json({ error: 'Non puoi eliminare il tuo stesso account.' }, 400);

  const url = (env && env.SUPABASE_URL) || SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

  // Si legge il profilo prima di cancellare: serve a fermare l'eliminazione
  // di un altro super admin e a poter dire nella risposta *chi* è stato
  // eliminato, dato che dopo la cancellazione l'email non è più recuperabile.
  const profRes = await fetch(`${url}/rest/v1/profili?id=eq.${id}&select=email,ruolo`, { headers });
  const profilo = (await profRes.json().catch(() => []))?.[0];
  if (!profRes.ok) return json({ error: 'Lettura del profilo non riuscita.' }, 502);
  if (!profilo) return json({ error: 'Utente non trovato: forse è già stato eliminato.' }, 404);
  if (profilo.ruolo === 'super_admin') return json({ error: 'Non puoi eliminare un altro amministratore del portale: il ruolo va prima tolto dal database.' }, 403);

  const delRes = await fetch(`${url}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers });
  if (!delRes.ok) {
    const dati = await delRes.json().catch(() => ({}));
    const msg = dati?.msg || dati?.message || dati?.error_description || '';
    // Una violazione di chiave esterna qui significa quasi sempre che la
    // patch del 2026-09-05 non è stata applicata su questo database.
    if (/foreign key|violates|constraint/i.test(msg)) {
      return json({ error: 'Il database rifiuta la cancellazione perché l\'utente è ancora collegato ai dati che ha inserito: applica la patch supabase/patch-2026-09-05-elimina-utente.sql.' }, 409);
    }
    return json({ error: msg || 'Eliminazione non riuscita.' }, delRes.status);
  }

  return json({ ok: true, email: profilo.email || null });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
