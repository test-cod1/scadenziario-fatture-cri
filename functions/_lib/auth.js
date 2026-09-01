// ============================================================
//  Verifica sessione Supabase per le Cloudflare Pages Functions
// ------------------------------------------------------------
//  /api/estrai-fattura proxa Google Gemini tenendo la chiave lato server.
//  Senza questo controllo sarebbe un endpoint pubblico: chiunque conoscesse
//  l'URL potrebbe interrogarlo in loop ed esaurire la quota gratuita
//  giornaliera, bloccando l'estrazione AI per tutti.
//
//  Si convalida il token passando dall'endpoint /auth/v1/user di Supabase:
//  verifica firma, scadenza e revoca senza bisogno del JWT secret (che
//  resta privato lato Supabase).
//
//  IMPORTANTE: sostituisci i valori qui sotto con quelli del tuo progetto
//  Supabase dedicato (gli stessi di js/config.js), oppure impostali come
//  variabili d'ambiente SUPABASE_URL / SUPABASE_ANON_KEY nel progetto Pages.
// ============================================================

export const SUPABASE_URL = 'https://xmfqozojjplccnnttwxu.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_Cm8yAHlD3TZSjW0fW53_fw_OmfeWJT3';

// Ruolo dell'utente autenticato in una sezione del portale ('admin',
// 'operatore' oppure null se non vi ha accesso). Si appoggia alla funzione
// ruolo_sezione() del database — la stessa che governa le RLS — chiamata con
// il token dell'utente: così la regola sta scritta in un posto solo e non può
// divergere fra client, server e policy.
export async function ruoloSezione(request, env, sezione) {
  const url = (env && env.SUPABASE_URL) || SUPABASE_URL;
  const anonKey = (env && env.SUPABASE_ANON_KEY) || SUPABASE_ANON_KEY;
  try {
    const res = await fetch(`${url}/rest/v1/rpc/ruolo_sezione`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: request.headers.get('Authorization') || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_sezione: sezione }),
    });
    if (!res.ok) return null;
    return (await res.json()) || null;
  } catch {
    return null;
  }
}

// Ruolo DI PORTALE dell'utente autenticato ('super_admin' | 'utente' |
// 'in_attesa'), letto rispettando le RLS (usa il suo stesso token, non la
// service key): serve per verificare lato server che chi chiama un endpoint
// sensibile (es. creazione utenti) sia davvero un super admin, senza fidarsi
// di un flag mandato dal client.
export async function ruoloUtente(request, env, userId) {
  const url = (env && env.SUPABASE_URL) || SUPABASE_URL;
  const anonKey = (env && env.SUPABASE_ANON_KEY) || SUPABASE_ANON_KEY;
  try {
    const res = await fetch(`${url}/rest/v1/profili?id=eq.${userId}&select=ruolo`, {
      headers: { apikey: anonKey, Authorization: request.headers.get('Authorization') || '' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.[0]?.ruolo || null;
  } catch {
    return null;
  }
}

// Ritorna l'utente Supabase se il token nell'header Authorization è valido,
// altrimenti null.
export async function requireUser(request, env) {
  const header = request.headers.get('Authorization') || '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  const url = (env && env.SUPABASE_URL) || SUPABASE_URL;
  const anonKey = (env && env.SUPABASE_ANON_KEY) || SUPABASE_ANON_KEY;

  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
