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

const ROUTES = {
  '/api/estrai-fattura': { POST: estraiFatturaPost },
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const route = ROUTES[url.pathname];
    if (route && route[request.method]) {
      return route[request.method]({ request, env, ctx });
    }
    return env.ASSETS.fetch(request);
  },
};
