// ============================================================
//  SEZIONE FORMAZIONE ESTERNA — punto di ingresso.
//  Preventivi, registro dei corsi effettuati, statistiche, rubrica e
//  impostazioni.
//  Carica una volta sola il catalogo dei corsi e i testi (cambiano di rado) e
//  smista alla vista giusta, come fanno le assistenze e i trasporti.
// ============================================================
import { impostazioni } from './data/store.js';
import { renderDashboard } from './views/dashboard.js';
import { renderPreventivo } from './views/preventivo.js';
import { renderImpostazioni } from './views/impostazioni.js';
import { renderRubrica } from './views/rubrica.js';
import { renderCorsi } from './views/corsi.js';
import { renderCorso } from './views/corso.js';
import { renderStatistiche } from './views/statistiche.js';

// Il catalogo si tiene in memoria per non richiederlo a ogni cambio di
// pagina, ma non per sempre: chi lavora con la scheda aperta continuerebbe a
// preventivare con i prezzi vecchi anche ore dopo che un collega li ha
// cambiati. Cinque minuti bastano a evitare la lettura a ogni clic senza far
// invecchiare i prezzi.
const DURATA_CACHE = 5 * 60 * 1000;
let _imp = null;
let _impLetteAlle = 0;

export async function renderFormazione(view, ctx, sub, param) {
  if (!_imp || Date.now() - _impLetteAlle > DURATA_CACHE) {
    _imp = await impostazioni.get();
    _impLetteAlle = Date.now();
  }

  const ctxF = {
    user: ctx.user,
    imp: _imp,
    go: ctx.go,
    reloadImp: async () => { _imp = await impostazioni.get(); _impLetteAlle = Date.now(); ctxF.imp = _imp; },
  };

  if (sub === 'nuovo') return renderPreventivo(view, null, ctxF);
  if (sub === 'preventivo' && param) return renderPreventivo(view, param, ctxF);
  // Il registro dei corsi accetta un preventivo come filtro:
  // #/formazione/corsi/<id> mostra solo i corsi nati da quel preventivo.
  if (sub === 'corsi') return renderCorsi(view, ctxF, param);
  if (sub === 'corso') return renderCorso(view, param, ctxF);
  if (sub === 'statistiche') return renderStatistiche(view, ctxF);
  if (sub === 'rubrica') return renderRubrica(view, ctxF);
  if (sub === 'impostazioni') return renderImpostazioni(view, ctxF);
  return renderDashboard(view, ctxF);
}
