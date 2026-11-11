// ============================================================
//  GLI IMPORTI DELLA SEZIONE ANALISI
//  In italiano il browser mette il punto delle migliaia solo dalle cinque
//  cifre in su: «3438,25 €» accanto a «21.024,14 €». In una pagina fatta di
//  colonne di numeri da confrontare a occhio, due grafie diverse per la
//  stessa grandezza si notano e confondono. Qui il punto c'è sempre.
//
//  È la stessa fmtEuro di js/lib/ui.js, con un'opzione in più: il resto del
//  portale (scadenziario, preventivi) resta com'era.
// ============================================================

const FORMATO = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', useGrouping: 'always' });

export function fmtEuro(nv, dash = '—') {
  if (nv === null || nv === undefined || nv === '' || (typeof nv === 'number' && !Number.isFinite(nv))) return dash;
  return FORMATO.format(Number(nv));
}
