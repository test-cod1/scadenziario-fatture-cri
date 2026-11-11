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

// ---------- anno per anno ----------
// Una riga per anno, dal più recente, con la variazione delle uscite
// rispetto all'anno prima. I movimenti senza data stanno in una riga a
// parte in fondo: non appartengono a nessun anno, e farli sparire
// renderebbe la somma delle righe diversa dal totale.
export function perAnno(voci) {
  const gruppi = new Map();
  for (const v of voci) {
    const k = v.data ? v.data.slice(0, 4) : '';
    if (!gruppi.has(k)) gruppi.set(k, []);
    gruppi.get(k).push(v);
  }
  const righe = [...gruppi.entries()]
    .map(([anno, vs]) => ({ anno, ...totaliDi(vs) }))
    .sort((a, b) => (!a.anno - !b.anno) || b.anno.localeCompare(a.anno));
  for (const r of righe) {
    const prec = r.anno && righe.find(x => x.anno === String(Number(r.anno) - 1));
    r.varUscite = prec && prec.uscite > 0.005 ? (r.uscite - prec.uscite) / prec.uscite : null;
  }
  return righe;
}

// ---------- mese per mese ----------
// Dodici caselle sempre, anche vuote: un grafico che salta i mesi senza
// movimenti avvicina luglio a novembre e fa sembrare continuo un buco.
export function perMese(voci, anno) {
  const mesi = Array.from({ length: 12 }, (_, i) => ({ mese: i, entrate: 0, uscite: 0, n: 0 }));
  for (const v of voci) {
    if (!v.data || v.data.slice(0, 4) !== anno) continue;
    const m = mesi[Number(v.data.slice(5, 7)) - 1];
    const c = Math.round(euro(v) * 100);
    if (v.tipo === 'entrata') m.entrate += c; else m.uscite += c;
    m.n++;
  }
  return mesi.map(m => ({ ...m, entrate: m.entrate / 100, uscite: m.uscite / 100 }));
}

// ---------- per categoria ----------
export const SENZA_CATEGORIA = 'Senza categoria';

// La chiave che decide se due categorie sono la stessa: maiuscole e
// spazi non contano. A schermo resta la grafia della prima incontrata.
export const chiaveCategoria = c => String(c || '').trim().replace(/\s+/g, ' ').toLowerCase();

// Le voci di un verso raggruppate per categoria, dalla più pesante, con la
// quota sul totale. «Senza categoria» va sempre in fondo, qualunque sia il
// suo peso: è lavoro da fare, non una categoria.
export function perCategoria(voci, tipo = 'uscita') {
  const g = new Map();
  let tot = 0;
  for (const v of voci) {
    if ((v.tipo === 'entrata') !== (tipo === 'entrata')) continue;
    const k = chiaveCategoria(v.categoria);
    if (!g.has(k)) g.set(k, { categoria: k ? String(v.categoria).trim().replace(/\s+/g, ' ') : SENZA_CATEGORIA, cent: 0, n: 0, senza: !k });
    const r = g.get(k);
    const c = Math.round(euro(v) * 100);
    r.cent += c; r.n++; tot += c;
  }
  return [...g.values()]
    .map(r => ({ categoria: r.categoria, importo: r.cent / 100, n: r.n, quota: tot ? r.cent / tot : 0, senza: r.senza }))
    .sort((a, b) => (a.senza - b.senza) || b.importo - a.importo || a.categoria.localeCompare(b.categoria, 'it'));
}

// Le categorie già usate, per i suggerimenti del modulo: una per chiave,
// in ordine alfabetico.
export function categorieUsate(movimenti) {
  const g = new Map();
  for (const m of movimenti) {
    const k = chiaveCategoria(m.categoria);
    if (k && !g.has(k)) g.set(k, String(m.categoria).trim().replace(/\s+/g, ' '));
  }
  return [...g.values()].sort((a, b) => a.localeCompare(b, 'it'));
}

// Gli anni in cui c'è almeno un movimento, dal più recente: sono le voci
// del filtro di periodo, e proporre un anno vuoto sarebbe proporre una
// pagina vuota.
export function anni(movimenti) {
  const s = new Set();
  for (const m of movimenti) if (m.data) s.add(m.data.slice(0, 4));
  return [...s].sort().reverse();
}
