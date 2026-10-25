// ============================================================
//  SEZIONE SCADENZE — punto di ingresso.
//  Smista alla vista giusta, come le altre sezioni. Nessuna cache: le
//  scadenze sono poche righe e cambiano con le spunte dei colleghi.
// ============================================================
import { renderElenco } from './views/elenco.js';
import { renderScheda } from './views/scheda.js';

export async function renderScadenze(view, ctx, sub, param) {
  const ctxS = { user: ctx.user, ruolo: ctx.user?.ruolo, go: ctx.go };
  // Il calendario si carica solo quando lo si apre, come nel Direttore.
  if (sub === 'calendario') {
    const { renderCalendario } = await import('./views/calendario.js');
    return renderCalendario(view, ctxS, param);
  }
  // Il parametro di «nuova» è il giorno cliccato sul calendario.
  if (sub === 'nuova') return renderScheda(view, null, ctxS, param);
  if (sub === 'scadenza' && param) return renderScheda(view, param, ctxS);
  return renderElenco(view, ctxS);
}
