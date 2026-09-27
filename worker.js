// ============================================================
//  Entry point del Worker Cloudflare (deploy via `wrangler deploy`).
//  Il progetto è stato collegato come Worker con Git integration (non la
//  vecchia "Pages" classica): qui instradiamo manualmente le poche route
//  API e per tutto il resto serviamo gli asset statici (index.html, css/,
//  js/) tramite il binding ASSETS configurato in wrangler.jsonc.
//
//  La logica delle singole API resta nella cartella functions/ (stesso
//  formato "Pages Function": un export onRequest* che riceve {request,env}),
//  e lo stesso repo si pubblica anche su Pages, dove al posto di questo file
//  lavora functions/_middleware.js: elenco delle route e intestazioni
//  stanno in functions/_lib/ e valgono per tutte e due.
// ============================================================

import { ROUTES, metodoNonAmmesso } from './functions/_lib/rotte.js';
import { conSicurezza } from './functions/_lib/sicurezza.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const route = ROUTES[url.pathname];
    if (route && !route[request.method]) {
      return conSicurezza(metodoNonAmmesso(route), 'api');
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
