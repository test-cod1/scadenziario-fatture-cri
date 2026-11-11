// ============================================================
//  CALCOLI DELLA SEZIONE ANALISI — CENTRI DI COSTO
//
//  La domanda a cui serve rispondere è una sola: «quell'attività quanto è
//  costata e quanto ha reso?». Ogni centro ha i suoi movimenti — entrate
//  e uscite registrate in Analisi, staccate dallo scadenziario — e i
//  conti sono la loro somma.
//
//  Due scelte che vale la pena sapere prima di leggere un numero:
//
//  1. Un movimento conta nella data del documento a cui si riferisce
//     (la fattura di dicembre pagata a marzo è un costo di dicembre).
//     Quanto sia stato davvero pagato è un'altra domanda, e non è questa
//     sezione a risponderla.
//
//  2. Il totale delle attività non è il bilancio del Comitato: è la somma
//     di quello che qualcuno ha deciso di seguire attività per attività.
// ============================================================

// L'importo di un movimento, sempre positivo: il verso lo dice `tipo`.
const euro = m => Number(m?.importo || 0);

// Un movimento senza data non è «fuori periodo»: è un movimento a cui
// manca la data. Escluderlo da ogni filtro lo farebbe sparire dai conti
// senza che nessuno se ne accorga, quindi resta dentro sempre — chi guarda
// lo vede e va a mettere la data.
export function nelPeriodo(mov, { da = '', a = '' } = {}) {
  if (!mov.data) return true;
  if (da && mov.data < da) return false;
  if (a && mov.data > a) return false;
  return true;
}

// I movimenti di un centro nel periodo, più recenti prima. Quelli senza
// data vanno in cima: sono quelli da sistemare.
export function vociDi(centroId, movimenti = [], periodo = {}) {
  return movimenti
    .filter(m => m.centro_id === centroId && nelPeriodo(m, periodo))
    .sort((a, b) => {
      if (!a.data !== !b.data) return a.data ? 1 : -1;
      return String(b.data || '').localeCompare(String(a.data || ''))
        || String(a.controparte || '').localeCompare(String(b.controparte || ''), 'it');
    });
}

// I totali si fanno in centesimi interi: sommare decine di rifornimenti in
// virgola mobile lascia code di 0,0000001 che a schermo diventano un
// centesimo di troppo o di meno rispetto alla somma delle righe.
export function totaliDi(voci) {
  let e = 0, u = 0, nEntrate = 0, nUscite = 0;
  for (const v of voci) {
    const c = Math.round(euro(v) * 100);
    if (v.tipo === 'entrata') { e += c; nEntrate++; }
    else { u += c; nUscite++; }
  }
  return { entrate: e / 100, uscite: u / 100, saldo: (e - u) / 100, nEntrate, nUscite };
}

// Il quadro di tutti i centri, già ordinato come va letto: prima quelli
// che hanno movimenti, dal saldo peggiore — un'attività in perdita è la
// cosa che si è venuti a cercare — e in fondo quelli ancora vuoti, in
// ordine di nome.
export function quadro(centri, movimenti, periodo = {}) {
  const righe = centri.map(c => ({ centro: c, ...totaliDi(vociDi(c.id, movimenti, periodo)) }));
  return righe.sort((a, b) => {
    const movA = a.nEntrate + a.nUscite, movB = b.nEntrate + b.nUscite;
    if (!movA !== !movB) return movA ? -1 : 1;
    if (movA && a.saldo !== b.saldo) return a.saldo - b.saldo;
    return String(a.centro.nome).localeCompare(String(b.centro.nome), 'it');
  });
}

// Gli anni in cui c'è almeno un movimento, dal più recente: sono le voci
// del filtro di periodo, e proporre un anno vuoto sarebbe proporre una
// pagina vuota.
export function anni(movimenti) {
  const s = new Set();
  for (const m of movimenti) if (m.data) s.add(m.data.slice(0, 4));
  return [...s].sort().reverse();
}
