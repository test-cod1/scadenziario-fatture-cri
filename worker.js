// ============================================================
//  Entry point del Worker Cloudflare (deploy via `wrangler deploy`).
//  Il progetto è stato collegato come Worker con Git integration (non la
//  vecchia "Pages" classica): qui instradiamo manualmente le poche route
//  API e per tutto il resto serviamo gli asset statici (index.html, css/,
//  js/) tramite il binding ASSETS configurato in wrangler.jsonc.
//
//  La logica delle singole API resta nella cartella functions/ (stesso
//  formato "Pages Function": un export onRequest* che riceve {request,env}),
//  così il codice è riutilizzabile anche se in futuro si torna a Pages.
// ============================================================

import { onRequestPost as estraiFatturaPost } from './functions/api/estrai-fattura.js';
import { onRequestPost as creaUtentePost } from './functions/api/crea-utente.js';

const ROUTES = {
  '/api/estrai-fattura': { POST: estraiFatturaPost },
  '/api/crea-utente': { POST: creaUtentePost },
};

// ============================================================
//  Intestazioni di sicurezza applicate a ogni risposta
// ------------------------------------------------------------
//  Il sito non ne serviva nessuna. La CSP è volutamente stretta e va tenuta
//  allineata a ciò che carica davvero la pagina:
//   - script-src: solo file nostri + esm.sh, da cui arriva il client Supabase
//     (import dinamico in js/lib/supabase.js);
//   - connect-src: le chiamate REST/Storage/Auth vanno a *.supabase.co, più
//     le nostre /api/*;
//   - style-src consente gli stili inline perché le viste usano attributi
//     style="..." su molti elementi;
//   - niente script inline: la stampa PDF ora è avviata dal codice del sito.
// ============================================================
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://esm.sh",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co https://esm.sh",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const HEADER_SICUREZZA = {
  "Content-Security-Policy": CSP,
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Cross-Origin-Opener-Policy": "same-origin",
};

function conSicurezza(res) {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(HEADER_SICUREZZA)) out.headers.set(k, v);
  return out;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const route = ROUTES[url.pathname];
    if (route && route[request.method]) {
      return conSicurezza(await route[request.method]({ request, env, ctx }));
    }
    return conSicurezza(await env.ASSETS.fetch(request));
  },
};
