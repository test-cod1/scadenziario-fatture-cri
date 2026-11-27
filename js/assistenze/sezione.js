// ============================================================
//  SEZIONE ASSISTENZE SANITARIE — punto di ingresso.
//  Carica una volta sola il tariffario e i testi (cambiano di rado) e smista
//  alla vista giusta, come fa la sezione trasporti.
// ============================================================
import { impostazioni } from './data/store.js';
import { renderDashboard } from './views/dashboard.js';
import { renderPreventivo } from './views/preventivo.js';
import { renderImpostazioni } from './views/impostazioni.js';
import { renderRubrica } from './views/rubrica.js';

// Il tariffario si tiene in memoria per non richiederlo a ogni cambio di
// pagina, ma non per sempre: restava quello letto all'ingresso nella sezione,
// così chi lavorava con la scheda aperta continuava a preventivare con i
// prezzi vecchi anche ore dopo che un collega li aveva cambiati. Cinque
// minuti bastano a evitare la lettura a ogni clic senza far invecchiare i
// prezzi.
const DURATA_CACHE = 5 * 60 * 1000;
let _imp = null;
let _impLetteAlle = 0;

export async function renderAssistenze(view, ctx, sub, param) {
  if (!_imp || Date.now() - _impLetteAlle > DURATA_CACHE) {
    _imp = await impostazioni.get();
    _impLetteAlle = Date.now();
  }

  const ctxA = {
    user: ctx.user,
    imp: _imp,
    go: ctx.go,
    // Ruolo 'lettore': le viste mostrano tutto ma non offrono nulla che scriva.
    solaLettura: !!ctx.solaLettura,
    reloadImp: async () => { _imp = await impostazioni.get(); _impLetteAlle = Date.now(); ctxA.imp = _imp; },
  };

  // La pagina iniziale della sezione è il preventivo nuovo: chi è in sola
  // visualizzazione non può scriverlo, e finisce sull'elenco. replace() e non
  // un link: «Indietro» non deve riportarlo qui per rimandarlo avanti.
  if (sub === 'nuovo' && ctxA.solaLettura) { location.replace('#/assistenze/preventivi'); return; }
  if (sub === 'nuovo') return renderPreventivo(view, null, ctxA);
  if (sub === 'preventivo' && param) return renderPreventivo(view, param, ctxA);
  if (sub === 'rubrica') return renderRubrica(view, ctxA);
  if (sub === 'impostazioni') return renderImpostazioni(view, ctxA);
  return renderDashboard(view, ctxA);
}
