// ============================================================
//  Tetto giornaliero per gli endpoint che consumano una quota esterna
// ------------------------------------------------------------
//  Gemini (lettura AI delle fatture) e OpenRouteService (indirizzi e km
//  dei preventivi trasporti) hanno una quota gratuita giornaliera che è
//  di tutto il Comitato, non di chi la sta usando. L'autorizzazione di
//  sezione dice CHI può spenderla; senza un tetto non diceva nessuno
//  QUANTO, e un ciclo sbagliato in una pagina — o una prova ripetuta
//  venti volte su una fattura che non si legge — poteva lasciare i
//  colleghi senza servizio per il resto della giornata.
//
//  Il conteggio sta sul database (public.consumi_api), non in memoria nel
//  Worker: gli isolate di Cloudflare nascono e muoiono continuamente e ce
//  n'è più di uno per regione, quindi un contatore in memoria non conta
//  niente. La funzione consuma_quota() incrementa e restituisce il valore
//  raggiunto in un'unica istruzione, così due schede aperte insieme non
//  leggono lo stesso numero.
//
//  Richiede supabase/patch-2026-09-05-sospensione-e-quote.sql. Se la
//  funzione non c'è ancora, si lascia passare la richiesta: un portale
//  che smette di leggere le fatture perché manca un contatore sarebbe un
//  danno peggiore del rischio che il tetto evita.
// ============================================================

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './auth.js';

// Quante chiamate al giorno per persona. Sono generosi rispetto all'uso
// normale (qualche decina di fatture al giorno nei giorni di punta, un
// preventivo trasporti ne fa una manciata fra indirizzi e percorso) e
// stretti rispetto alle quote gratuite dei due servizi.
export const LIMITI = {
  'estrai-fattura': 120,
  'geocode': 400,
  'route': 200,
  'prezzo-eu': 60,
};

// Restituisce { ok: true } se la chiamata può procedere, altrimenti
// { ok: false, conteggio, limite } — chi la chiama risponde 429.
export async function consumaQuota(request, env, endpoint) {
  const limite = LIMITI[endpoint];
  if (!limite) return { ok: true };

  const url = (env && env.SUPABASE_URL) || SUPABASE_URL;
  const anonKey = (env && env.SUPABASE_ANON_KEY) || SUPABASE_ANON_KEY;

  let conteggio;
  try {
    const res = await fetch(`${url}/rest/v1/rpc/consuma_quota`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: request.headers.get('Authorization') || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_endpoint: endpoint }),
    });
    // Patch non ancora eseguita (404 sulla funzione) o database
    // momentaneamente irraggiungibile: si passa. Vedi il commento in testa.
    if (!res.ok) return { ok: true };
    conteggio = Number(await res.json());
  } catch {
    return { ok: true };
  }

  if (!Number.isFinite(conteggio)) return { ok: true };
  if (conteggio > limite) return { ok: false, conteggio, limite };
  return { ok: true };
}

// Messaggio unico, così i quattro endpoint dicono la stessa cosa: quante
// ne ha fatte, qual è il tetto, e che domani riparte da zero.
export function errore429(endpoint, esito) {
  return {
    error: `Hai raggiunto il limite di ${esito.limite} richieste al giorno per questa funzione `
         + `(ne hai fatte ${esito.conteggio - 1}). Riparte da zero domani; `
         + `se ti serve un tetto più alto, chiedilo a un amministratore del portale.`,
  };
}
