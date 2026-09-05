// ============================================================
//  SEZIONE STRAORDINARI — punto di ingresso.
//  Carica una volta sola l'anagrafica degli dipendenti e le impostazioni
//  (causali, soglie) e smista alla vista giusta, come fanno trasporti e
//  assistenze.
// ============================================================
import { dipendenti as dipendentiStore, impostazioni } from './data/store.js';
import { meseCorrente } from './calc.js';
import { renderRegistro } from './views/registro.js';
import { renderRichiesta } from './views/richiesta.js';
import { renderRiepilogo } from './views/riepilogo.js';
import { renderDipendenti } from './views/dipendenti.js';
import { renderImpostazioni } from './views/impostazioni.js';

// Anagrafica e impostazioni cambiano di rado ma non sono immutabili: come
// nelle assistenze si tengono in memoria cinque minuti, così un dipendente
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
  const [elencoDipendenti, imp] = await Promise.all([dipendentiStore.list(), impostazioni.get()]);
  _cache = { dipendenti: elencoDipendenti, imp };
  _lettaAlle = Date.now();
  return _cache;
}

export async function renderStraordinari(view, ctx, sub, param) {
  if (!_cache || Date.now() - _lettaAlle > DURATA_CACHE) await leggi();

  const ctxS = {
    user: ctx.user,
    ruolo: ctx.user?.ruolo,          // 'admin' o 'operatore' NELLA sezione
    go: ctx.go,
    dipendenti: _cache.dipendenti,
    imp: _cache.imp,
    stato,
    ricarica: async () => {
      await leggi();
      ctxS.dipendenti = _cache.dipendenti;
      ctxS.imp = _cache.imp;
    },
  };

  if (sub === 'nuovo') return renderRichiesta(view, null, ctxS);
  if (sub === 'richiesta' && param) return renderRichiesta(view, param, ctxS);
  if (sub === 'riepilogo') return renderRiepilogo(view, ctxS);
  if (sub === 'dipendenti') return renderDipendenti(view, ctxS);
  if (sub === 'impostazioni') return renderImpostazioni(view, ctxS);
  return renderRegistro(view, ctxS);
}
