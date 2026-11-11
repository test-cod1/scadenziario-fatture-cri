// ============================================================
//  SEZIONE ANALISI — punto di ingresso.
//  Smista alla vista giusta, come fanno le altre sezioni.
//
//  Analisi è staccata dallo scadenziario (patch-2026-11-11-analisi-
//  autonoma.sql): i centri di costo hanno movimenti propri e nessuna
//  pagina legge le fatture. Le prossime sottosezioni si aggiungono qui e
//  nel `menu` di js/sezioni.js, senza toccare il router del portale.
// ============================================================

export async function renderAnalisi(view, ctx, sub, param) {
  const ctxA = {
    user: ctx.user,
    ruolo: ctx.user?.ruolo,          // 'admin' o 'operatore' NELLA sezione
    go: ctx.go,
  };

  if (sub === 'centro' && param) {
    const { renderCentro } = await import('./views/centro.js');
    return renderCentro(view, param, ctxA);
  }
  const { renderCentri } = await import('./views/centri.js');
  return renderCentri(view, ctxA);
}
