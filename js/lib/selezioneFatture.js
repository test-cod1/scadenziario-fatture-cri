// ============================================================
//  Selezione di più fatture nello scadenziario, per sapere quanto fa il
//  bonifico unico che le paga insieme (es. le quattro fatture aperte di un
//  fornitore). Solo un conto a schermo: non scrive nulla.
//
//  Si somma il RESIDUO, non l'importo: un acconto già versato o una nota di
//  credito già applicata non vanno pagati di nuovo. L'importo della fattura
//  è già il netto da pagare (la ritenuta d'acconto non c'è), quindi il
//  residuo è proprio la cifra del bonifico.
// ============================================================

const STATI_CHIUSI = ['pagata', 'stornata'];

// Si possono spuntare solo le fatture con ancora qualcosa da pagare.
export function selezionabile(f) {
  return !!f && !STATI_CHIUSI.includes(f.stato) && Number(f._residuo) > 0;
}

// Totali delle fatture scelte, in centesimi interi come residuoFattura
// (js/lib/numeri.js): sommando in virgola mobile 0,10 + 0,20 non fa 0,30.
export function totaleSelezione(righe) {
  const cent = (n) => Math.round((Number(n) || 0) * 100);
  let residuo = 0, importo = 0;
  for (const f of righe) { residuo += cent(f._residuo); importo += cent(f.importo); }
  return { n: righe.length, residuo: residuo / 100, importo: importo / 100, giaVersato: (importo - residuo) / 100 };
}

// Tiene solo le scelte ancora valide dopo una ricarica: una fattura appena
// segnata come pagata (o sparita) non deve restare nel totale.
export function potaSelezione(ids, righe) {
  const valide = new Set(righe.filter(selezionabile).map(f => f.id));
  for (const id of [...ids]) if (!valide.has(id)) ids.delete(id);
  return ids;
}
