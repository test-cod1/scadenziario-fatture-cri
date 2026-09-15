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
    ruolo: ctx.user?.ruolo,          // 'admin' o 'operatore' NELLA sezione
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
  if (sub === 'nuovo') return renderImpegno(view, null, ctxD, param);
  if (sub === 'impegno' && param) return renderImpegno(view, param, ctxD);
  return renderImpegni(view, ctxD);
}
