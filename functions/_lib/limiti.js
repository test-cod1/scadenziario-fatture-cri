// ============================================================
//  Limite di richieste per chi NON ha fatto il login
// ------------------------------------------------------------
//  Gli endpoint pubblici (l'accesso con nome e cognome, i link dei centri
//  di costo) non hanno un utente a cui intestare un contatore, come fa
//  quota.js: si conta per impronta dell'indirizzo IP, e se serve anche per
//  un'altra chiave (il nome con cui si tenta l'accesso).
//
//  Il conteggio sta sul database (public.limiti_anonimi, funzione
//  consuma_limite_anonimo, vedi supabase/patch-2026-11-15-revisione-esterna.sql)
//  per la stessa ragione di quota.js: gli isolate del Worker sono tanti e
//  durano poco, un contatore in memoria non conterebbe niente. La funzione
//  la può chiamare solo la service role.
//
//  Se il contatore non risponde (patch non ancora eseguita, database giù)
//  si lascia passare e lo si scrive nei log: bloccare l'accesso a tutti per
//  un contatore che manca sarebbe peggio del rischio che il limite evita.
// ============================================================

import { SUPABASE_URL } from './auth.js';

// Impronta dell'indirizzo di chi chiama, mai l'indirizzo in chiaro. Per
// IPv6 conta il /64: chi ha un indirizzo IPv6 di solito ne ha a disposizione
// miliardi nello stesso blocco, e cambiarlo a ogni richiesta azzerava il
// limite.
export function bloccoIp(ip) {
  const s = String(ip || '').trim();
  if (!s.includes(':')) return s;
  const [testa, coda = ''] = s.split('::');
  const a = testa ? testa.split(':') : [];
  const b = coda ? coda.split(':') : [];
  const gruppi = s.includes('::') ? [...a, ...Array(Math.max(0, 8 - a.length - b.length)).fill('0'), ...b] : a;
  return gruppi.slice(0, 4).map(g => (g || '0').toLowerCase().replace(/^0+(?=.)/, '')).join(':') + '::/64';
}

export async function improntaIp(request, segreto) {
  const ip = bloccoIp(request.headers.get('CF-Connecting-IP') || '');
  const dati = new TextEncoder().encode(`${String(segreto || '').slice(-24)}|${ip}`);
  const h = await crypto.subtle.digest('SHA-256', dati);
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

// Conta una richiesta per `chiave` nella finestra di `secondi` e dice se si
// è ancora entro `massimo`. { ok: true } oppure { ok: false }.
export async function consumaLimite(env, chiave, massimo, secondi) {
  const key = env?.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return { ok: true };
  const base = env.SUPABASE_URL || SUPABASE_URL;
  try {
    const res = await fetch(`${base}/rest/v1/rpc/consuma_limite_anonimo`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_chiave: chiave, p_finestra_secondi: secondi }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const n = Number(await res.json());
    if (!Number.isFinite(n)) throw new Error('risposta non numerica');
    return { ok: n <= massimo };
  } catch (e) {
    console.warn(`[limiti] contatore non disponibile per ${chiave.split(':')[0]} (${e.message}): si lascia passare`);
    return { ok: true };
  }
}
