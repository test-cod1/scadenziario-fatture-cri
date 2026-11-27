// ============================================================
//  SEZIONE DIRETTORE — punto di ingresso.
//  Smista alla vista giusta, come fanno le altre sezioni. Qui non c'è
//  nessuna cache: gli impegni cambiano di continuo — una spunta, una
//  scadenza spostata — e sono poche righe, quindi si rileggono ad ogni
//  apertura dell'elenco. Meglio una lettura in più che vedere un impegno
//  già segnato fatto da un collega.
// ============================================================
import { renderImpegni } from './views/impegni.js';
import { renderImpegno } from './views/impegno.js';

export async function renderDirettore(view, ctx, sub, param) {
  const ctxD = {
    user: ctx.user,
    ruolo: ctx.user?.ruolo,          // 'admin', 'operatore' o 'lettore' NELLA sezione
    // Il lettore vede impegni, calendario e idee ma non cambia nulla: le
    // viste nascondono i comandi con data-scrive e aprono le schede in
    // consultazione.
    solaLettura: !!ctx.solaLettura,
    go: ctx.go,
  };

  // Il calendario si carica solo quando lo si apre: chi usa la sezione per
  // l'elenco non si porta dietro la griglia del mese.
  if (sub === 'calendario') {
    const { renderCalendario } = await import('./views/calendario.js');
    return renderCalendario(view, ctxD, param);
  }
  // Il parametro di «nuovo» è la data da cui si arriva: si clicca un giorno
  // sul calendario e la scheda si apre con quella scadenza già scritta.
  if (sub === 'idee') {
    const { renderIdee } = await import('./views/idee.js');
    return renderIdee(view, ctxD);
  }
  if (sub === 'nuovo') return renderImpegno(view, null, ctxD, param);
  if (sub === 'impegno' && param) return renderImpegno(view, param, ctxD);
  return renderImpegni(view, ctxD);
}
