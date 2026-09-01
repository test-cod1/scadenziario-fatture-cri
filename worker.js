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
import { onRequestPost as estraiFatturaAttivaPost } from './functions/api/estrai-fattura-attiva.js';
import { onRequestPost as creaUtentePost } from './functions/api/crea-utente.js';
import { onRequestGet as geocodeGet } from './functions/api/geocode.js';
import { onRequestPost as routePost } from './functions/api/route.js';
import { onRequestGet as prezzoItaliaGet } from './functions/api/prezzo-italia.js';
import { onRequestGet as prezzoEuGet } from './functions/api/prezzo-eu.js';
import { HEADER_SICUREZZA } from './js/lib/securityHeaders.mjs';

const ROUTES = {
  '/api/estrai-fattura': { POST: estraiFatturaPost },
  '/api/estrai-fattura-attiva': { POST: estraiFatturaAttivaPost },
  '/api/crea-utente': { POST: creaUtentePost },
  // Sezione trasporti: proxy verso OpenRouteService (chiave ORS_KEY lato
  // server) e prezzi carburante ufficiali.
  '/api/geocode': { GET: geocodeGet },
  '/api/route': { POST: routePost },
  '/api/prezzo-italia': { GET: prezzoItaliaGet },
  '/api/prezzo-eu': { GET: prezzoEuGet },
};

function conSicurezza(res) {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(HEADER_SICUREZZA)) out.headers.set(k, v);
  // Niente cache "silenziosa" su HTML/CSS/JS: senza questo, chi aveva già
  // aperto il sito prima di un deploy poteva restare con la versione vecchia
  // (specie su mobile) finché non svuotava la cache a mano. "no-cache" non
  // è "no-store": il browser continua a poter riusare il file, ma solo dopo
  // aver controllato con una richiesta condizionale (ETag) se è ancora quello
  // giusto — quindi un deploy nuovo si vede subito, senza perdere la velocità
  // della cache quando il file non è cambiato.
  out.headers.set('Cache-Control', 'no-cache');
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
