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
import { onRequestPost as eliminaUtentePost } from './functions/api/elimina-utente.js';
import { onRequestGet as geocodeGet } from './functions/api/geocode.js';
import { onRequestPost as routePost } from './functions/api/route.js';
import { onRequestGet as prezzoItaliaGet } from './functions/api/prezzo-italia.js';
import { onRequestGet as prezzoEuGet } from './functions/api/prezzo-eu.js';
import { HEADER_SICUREZZA } from './js/lib/securityHeaders.mjs';

const ROUTES = {
  '/api/estrai-fattura': { POST: estraiFatturaPost },
  '/api/estrai-fattura-attiva': { POST: estraiFatturaAttivaPost },
  '/api/crea-utente': { POST: creaUtentePost },
  '/api/elimina-utente': { POST: eliminaUtentePost },
  // Sezione trasporti: proxy verso OpenRouteService (chiave ORS_KEY lato
  // server) e prezzi carburante ufficiali.
  '/api/geocode': { GET: geocodeGet },
  '/api/route': { POST: routePost },
  '/api/prezzo-italia': { GET: prezzoItaliaGet },
  '/api/prezzo-eu': { GET: prezzoEuGet },
};

// `cache` dice come regolare la memorizzazione della risposta:
//   'asset' → si impone "no-cache" (vedi sotto)
//   'api'   → si lascia quello che la function ha già deciso
function conSicurezza(res, cache = 'asset') {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(HEADER_SICUREZZA)) out.headers.set(k, v);
  // Niente cache "silenziosa" su HTML/CSS/JS: senza questo, chi aveva già
  // aperto il sito prima di un deploy poteva restare con la versione vecchia
  // (specie su mobile) finché non svuotava la cache a mano. "no-cache" non
  // è "no-store": il browser continua a poter riusare il file, ma solo dopo
  // aver controllato con una richiesta condizionale (ETag) se è ancora quello
  // giusto — quindi un deploy nuovo si vede subito, senza perdere la velocità
  // della cache quando il file non è cambiato.
  //
  // Le risposte delle /api/* sono l'eccezione, e prima non lo erano: le
  // function dichiarano "no-store" apposta, e sovrascriverlo qui rendeva
  // memorizzabile su disco anche la risposta di /api/crea-utente, che contiene
  // la password provvisoria in chiaro. Chi invece vuole essere messo in cache
  // (i prezzi carburante, col loro max-age) continua a dirlo da sé.
  if (cache === 'asset') out.headers.set('Cache-Control', 'no-cache');
  return out;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const route = ROUTES[url.pathname];
    // Metodo sbagliato su una route esistente: senza questo ramo la richiesta
    // proseguiva verso gli asset statici, che per /api/... rispondevano con la
    // pagina "non trovato" — un errore fuorviante (sembra un endpoint
    // inesistente) al posto di quello vero.
    if (route && !route[request.method]) {
      return conSicurezza(new Response(
        JSON.stringify({ error: 'Metodo non ammesso.' }),
        { status: 405, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Allow: Object.keys(route).join(', ') } },
      ), 'api');
    }
    if (route && route[request.method]) {
      // `waitUntil` va passato anche in cima al contesto, non solo dentro
      // `ctx`: le function sono scritte nel formato Pages, dove si chiama
      // context.waitUntil(...) — /api/prezzo-italia lo usa per salvare la
      // risposta nella cache edge, e senza andava in eccezione (error 1101).
      const contesto = { request, env, ctx, waitUntil: (p) => ctx.waitUntil(p) };
      return conSicurezza(await route[request.method](contesto), 'api');
    }
    return conSicurezza(await env.ASSETS.fetch(request));
  },
};
