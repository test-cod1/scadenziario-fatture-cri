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

  if (sub === 'nuovo') return renderImpegno(view, null, ctxD);
  if (sub === 'impegno' && param) return renderImpegno(view, param, ctxD);
  return renderImpegni(view, ctxD);
}
