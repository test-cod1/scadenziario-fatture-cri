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

const SUPABASE_URL = 'https://TUO-PROGETTO.supabase.co';
const SUPABASE_ANON_KEY = 'TUA-ANON-KEY';

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
