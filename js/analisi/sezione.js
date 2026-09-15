// ============================================================
//  SEZIONE ANALISI — punto di ingresso.
//  Smista alla vista giusta, come fanno le altre sezioni.
//
//  Analisi nasce per avere più sottosezioni: i centri di costo sono la
//  prima, e quando ne arriveranno altre si aggiungono qui e nel `menu`
//  di js/sezioni.js, senza toccare il router del portale.
//
//  Niente cache: i numeri di questa sezione sono la somma di quello che
//  scrivono tutte le altre, e mostrare un totale vecchio è peggio che
//  aspettare un secondo in più — chi guarda un conto lo guarda per
//  decidere qualcosa.
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
  if (sub === 'da-attribuire') {
    const { renderDaAttribuire } = await import('./views/daAttribuire.js');
    return renderDaAttribuire(view, ctxA);
  }
  const { renderCentri } = await import('./views/centri.js');
  return renderCentri(view, ctxA);
}
