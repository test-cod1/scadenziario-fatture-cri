// ============================================================
//  Elenco delle /api/* con i metodi ammessi, in un posto solo.
//  Lo usano sia worker.js (deploy come Worker, dove le route vanno
//  instradate a mano) sia functions/_middleware.js (deploy su Pages, dove
//  le route le trova Pages dai nomi dei file ma il 405 sul metodo sbagliato
//  va dato da noi): aggiungendo un endpoint si scrive qui e basta.
// ============================================================

import { onRequestPost as estraiFatturaPost } from '../api/estrai-fattura.js';
import { onRequestPost as estraiFatturaAttivaPost } from '../api/estrai-fattura-attiva.js';
import { onRequestPost as creaUtentePost } from '../api/crea-utente.js';
import { onRequestPost as eliminaUtentePost } from '../api/elimina-utente.js';
import { onRequestGet as geocodeGet } from '../api/geocode.js';
import { onRequestPost as routePost } from '../api/route.js';
import { onRequestGet as prezzoItaliaGet } from '../api/prezzo-italia.js';
import { onRequestGet as prezzoEuGet } from '../api/prezzo-eu.js';

export const ROUTES = {
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

// Risposta per un metodo non previsto su una route esistente. Senza, la
// richiesta proseguiva verso gli asset statici, che per /api/... rispondevano
// con la pagina "non trovato" — un errore fuorviante (sembra un endpoint
// inesistente) al posto di quello vero.
export function metodoNonAmmesso(route) {
  return new Response(
    JSON.stringify({ error: 'Metodo non ammesso.' }),
    { status: 405, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Allow: Object.keys(route).join(', ') } },
  );
}
