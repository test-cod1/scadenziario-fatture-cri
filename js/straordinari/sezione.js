// ============================================================
//  SEZIONE STRAORDINARI — punto di ingresso.
//  Carica una volta sola l'anagrafica degli autisti e le impostazioni
//  (causali, soglie) e smista alla vista giusta, come fanno trasporti e
//  assistenze.
// ============================================================
import { autisti as autistiStore, impostazioni } from './data/store.js';
import { meseCorrente } from './calc.js';
import { renderRegistro } from './views/registro.js';
import { renderRichiesta } from './views/richiesta.js';
import { renderRiepilogo } from './views/riepilogo.js';
import { renderAutisti } from './views/autisti.js';
import { renderImpostazioni } from './views/impostazioni.js';

// Anagrafica e impostazioni cambiano di rado ma non sono immutabili: come
// nelle assistenze si tengono in memoria cinque minuti, così un autista
// aggiunto da un collega compare senza dover ricaricare la pagina, ma non si
// rilegge il database a ogni clic sul menu.
const DURATA_CACHE = 5 * 60 * 1000;
let _cache = null;
let _lettaAlle = 0;

// Mese su cui si sta lavorando: vive qui e non nell'indirizzo perché è lo
// stesso per registro e riepilogo — si passa dall'elenco alla griglia senza
// doverlo riselezionare, che è come si guarda un mese davvero (prima le
// righe, poi i totali).
const stato = { mese: meseCorrente() };

async function leggi() {
  const [elencoAutisti, imp] = await Promise.all([autistiStore.list(), impostazioni.get()]);
  _cache = { autisti: elencoAutisti, imp };
  _lettaAlle = Date.now();
  return _cache;
}

export async function renderStraordinari(view, ctx, sub, param) {
  if (!_cache || Date.now() - _lettaAlle > DURATA_CACHE) await leggi();

  const ctxS = {
    user: ctx.user,
    ruolo: ctx.user?.ruolo,          // 'admin' o 'operatore' NELLA sezione
    go: ctx.go,
    autisti: _cache.autisti,
    imp: _cache.imp,
    stato,
    ricarica: async () => {
      await leggi();
      ctxS.autisti = _cache.autisti;
      ctxS.imp = _cache.imp;
    },
  };

  if (sub === 'nuovo') return renderRichiesta(view, null, ctxS);
  if (sub === 'richiesta' && param) return renderRichiesta(view, param, ctxS);
  if (sub === 'riepilogo') return renderRiepilogo(view, ctxS);
  if (sub === 'autisti') return renderAutisti(view, ctxS);
  if (sub === 'impostazioni') return renderImpostazioni(view, ctxS);
  return renderRegistro(view, ctxS);
}
