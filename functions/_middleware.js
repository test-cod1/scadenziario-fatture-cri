// ============================================================
//  Middleware Pages: gira prima di ogni richiesta quando il portale è
//  pubblicato su Cloudflare Pages (amministrazione-crigenova.pages.dev,
//  dominio amministrazione.crigenova.it). Fa quello che su Worker fa
//  worker.js: le /api/* le trova Pages da solo dai nomi dei file in
//  functions/api/, qui si aggiungono le intestazioni di sicurezza a tutte
//  le risposte e si danno gli errori giusti sulle /api/* sbagliate.
// ============================================================

import { ROUTES, metodoNonAmmesso } from './_lib/rotte.js';
import { conSicurezza } from './_lib/sicurezza.js';

export async function onRequest(context) {
  const { pathname } = new URL(context.request.url);
  const api = pathname.startsWith('/api/');
  const route = ROUTES[pathname];

  if (route && !route[context.request.method]) {
    return conSicurezza(metodoNonAmmesso(route), 'api');
  }
  // Un endpoint inesistente: su Pages proseguendo si riceverebbe index.html
  // con stato 200 (il ripiego per le app a pagina singola), che il codice
  // del sito proverebbe a leggere come JSON.
  if (api && !route) {
    return conSicurezza(new Response(
      JSON.stringify({ error: 'Endpoint inesistente.' }),
      { status: 404, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } },
    ), 'api');
  }

  return conSicurezza(await context.next(), api ? 'api' : 'asset');
}
