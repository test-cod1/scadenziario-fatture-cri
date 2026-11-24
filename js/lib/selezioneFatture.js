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

// Prima di registrare il pagamento unico si rilegge ogni fattura: nel
// frattempo qualcuno può aver segnato un acconto o una nota di credito.
// `fresche` è una Map id -> fattura riletta (assente = rilettura fallita: si
// tiene il residuo che si ha). Si paga sempre il residuo ATTUALE; le fatture
// ormai saldate escono, quelle cambiate si elencano per chiedere conferma.
export function preparaPagamentoUnico(scelte, fresche) {
  const cent = (n) => Math.round((Number(n) || 0) * 100);
  const daPagare = [], cambiate = [], saldate = [];
  for (const f of scelte) {
    const fresca = fresche.get(f.id);
    const attuale = fresca && Number.isFinite(Number(fresca._residuo)) ? Number(fresca._residuo) : Number(f._residuo);
    if (!selezionabile({ ...f, ...(fresca || {}), _residuo: attuale })) { saldate.push(f); continue; }
    if (cent(attuale) !== cent(f._residuo)) cambiate.push({ fattura: f, prima: Number(f._residuo), ora: attuale });
    daPagare.push({ fattura: f, importo: attuale });
  }
  return { daPagare, cambiate, saldate, totale: totaleSelezione(daPagare.map(r => ({ _residuo: r.importo, importo: r.importo }))).residuo };
}

// Nota scritta su ciascun pagamento, così in un secondo momento (estratto
// conto, controllo) si capisce che quella riga fa parte di un bonifico unico.
export function notaPagamentoUnico(n, totale, aggiunta = '') {
  const base = `Pagamento unico di ${n} fatture, totale ${totale.toFixed(2).replace('.', ',')} €`;
  return aggiunta ? `${base} — ${aggiunta}` : base;
}

// Tiene solo le scelte ancora valide dopo una ricarica: una fattura appena
// segnata come pagata (o sparita) non deve restare nel totale.
export function potaSelezione(ids, righe) {
  const valide = new Set(righe.filter(selezionabile).map(f => f.id));
  for (const id of [...ids]) if (!valide.has(id)) ids.delete(id);
  return ids;
}
