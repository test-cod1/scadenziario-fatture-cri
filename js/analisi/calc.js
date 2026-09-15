// ============================================================
//  CALCOLI DELLA SEZIONE ANALISI — CENTRI DI COSTO
//
//  La domanda a cui serve rispondere è una sola: «quell'attività quanto è
//  costata e quanto ha reso?». I soldi stanno già nelle fatture — passive
//  (uscite) e attive (entrate) — e le imputazioni dicono quanto di
//  ciascuna pesa su quale attività.
//
//  Tre scelte che vale la pena sapere prima di leggere un numero:
//
//  1. Si contano le fatture, non i pagamenti. «Costato» qui vuol dire
//     fatturato: la fattura di dicembre pagata a marzo è un costo di
//     dicembre, che è il momento in cui l'attività l'ha generata. Quanto
//     sia stato effettivamente pagato è un'altra domanda — quella di
//     cassa — e la risponde lo scadenziario.
//
//  2. Le note di credito abbassano la quota in proporzione. Una fattura
//     di 1000 € imputata 600/400 fra due attività, stornata poi per 100,
//     vale 540 e 360: la nota di credito non dice su quale delle due
//     ricade, e spalmarla in proporzione è l'unica ripartizione che non
//     inventa un'informazione che nessuno ha dato. Se invece si sa bene
//     dove ricade, la strada giusta è correggere le quote.
//
//  3. Una fattura può restare non attribuita, o esserlo in parte: sono le
//     spese generali, e non sono un errore. Il totale delle attività non
//     è quindi il bilancio del Comitato, e la pagina lo dice invece di
//     lasciarlo capire.
// ============================================================

const CENT = 0.005;      // mezzo centesimo: sotto, è arrotondamento e non differenza

// ---------- dalle fatture ai documenti ----------
// Passive e attive arrivano da due tabelle con nomi di colonna diversi
// (fornitore/cliente) e due storie diverse. Da qui in poi sono la stessa
// cosa con un segno davanti: tutto il resto del file lavora su questa forma
// sola, e non deve sapere da quale delle due viene una riga.
export function documenti(passive = [], attive = []) {
  const da = (f, tipo, controparte) => {
    const lordo = Number(f.importo || 0);
    const stornato = Number(f._stornato ?? 0);
    return {
      id: f.id,
      tipo,                                   // 'uscita' | 'entrata'
      controparte: f[controparte] || '—',
      numero: f.numero_fattura || '',
      data: f.data_fattura || null,
      lordo,
      stornato,
      netto: Math.max(0, lordo - stornato),
      stato: f.stato,
    };
  };
  return [
    ...passive.map(f => da(f, 'uscita', 'fornitore')),
    ...attive.map(f => da(f, 'entrata', 'cliente')),
  ];
}

// L'id della fattura a cui punta un'imputazione, quale che sia il verso.
export function fatturaDi(imp) {
  return imp?.fattura_id || imp?.fattura_attiva_id || null;
}

// Le imputazioni raccolte per fattura: è la forma in cui servono ovunque,
// perché ogni conto parte da «di questa fattura, quanto è già attribuito».
export function imputazioniPerFattura(imputazioni = []) {
  const m = new Map();
  for (const i of imputazioni) {
    const k = fatturaDi(i);
    if (!k) continue;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(i);
  }
  return m;
}

export function attribuito(doc, perFattura) {
  return (perFattura.get(doc.id) || []).reduce((s, i) => s + Number(i.importo || 0), 0);
}

// Quanto di una fattura non è ancora attribuito a nessuna attività. Si
// misura sul LORDO, perché è sul lordo che il database impedisce di
// sforare: se si misurasse sul netto, una fattura stornata sembrerebbe
// avere spazio che poi il salvataggio rifiuta.
export function restoDa(doc, perFattura) {
  return Math.max(0, doc.lordo - attribuito(doc, perFattura));
}

// I documenti ancora da attribuire, in tutto o in parte, più recenti
// prima: è un arretrato da smaltire, e si smaltisce partendo da quello che
// si ricorda ancora.
export function daAttribuire(docs, perFattura, { tipo = '', cerca = '' } = {}) {
  const q = cerca.trim().toLowerCase();
  return docs
    .map(d => ({ ...d, resto: restoDa(d, perFattura) }))
    .filter(d => d.resto > CENT)
    .filter(d => !tipo || d.tipo === tipo)
    .filter(d => !q || `${d.controparte} ${d.numero}`.toLowerCase().includes(q))
    .sort((a, b) => String(b.data || '').localeCompare(String(a.data || ''))
      || String(a.controparte).localeCompare(String(b.controparte), 'it'));
}

// ---------- quanto vale davvero una quota ----------
// La quota scritta è lorda; le note di credito la abbassano in proporzione
// (vedi il punto 2 in testa al file). Una fattura interamente stornata
// vale zero, e non va nascosta: dice che quell'attività ha avuto un costo
// poi annullato, il che è un'informazione.
export function quotaNetta(quota, doc) {
  const q = Number(quota || 0);
  if (!doc || !doc.lordo) return 0;
  if (!doc.stornato) return q;
  return q * (doc.netto / doc.lordo);
}

// ---------- il conto di un centro ----------
// Una riga per imputazione, con dentro il documento a cui si riferisce:
// è quello che serve sia per i totali sia per l'elenco a schermo, e
// calcolarlo due volte in due posti è il modo di farli divergere.
export function vociDi(centroId, docs, imputazioni, periodo = {}) {
  const perId = new Map(docs.map(d => [d.id, d]));
  const voci = [];
  for (const i of imputazioni) {
    if (i.centro_id !== centroId) continue;
    const doc = perId.get(fatturaDi(i));
    if (!doc || !nelPeriodo(doc, periodo)) continue;
    voci.push({
      id: i.id,
      centro_id: i.centro_id,
      quota: Number(i.importo || 0),
      netta: quotaNetta(i.importo, doc),
      note: i.note || '',
      doc,
    });
  }
  return voci.sort((a, b) => String(b.doc.data || '').localeCompare(String(a.doc.data || '')));
}

// Un documento senza data non è «fuori periodo»: è un documento a cui
// manca la data. Escluderlo da ogni filtro lo farebbe sparire dai conti
// senza che nessuno se ne accorga, quindi resta dentro sempre — chi guarda
// lo vede e va a mettere la data.
export function nelPeriodo(doc, { da = '', a = '' } = {}) {
  if (!doc.data) return true;
  if (da && doc.data < da) return false;
  if (a && doc.data > a) return false;
  return true;
}

export function totaliDi(voci) {
  const t = { entrate: 0, uscite: 0, saldo: 0, nEntrate: 0, nUscite: 0 };
  for (const v of voci) {
    if (v.doc.tipo === 'entrata') { t.entrate += v.netta; t.nEntrate++; }
    else { t.uscite += v.netta; t.nUscite++; }
  }
  t.saldo = t.entrate - t.uscite;
  return t;
}

// Il quadro di tutti i centri, già ordinato come va letto: prima quelli
// che hanno movimenti, dal saldo peggiore — un'attività in perdita è la
// cosa che si è venuti a cercare — e in fondo quelli ancora vuoti, in
// ordine di nome.
export function quadro(centri, docs, imputazioni, periodo = {}) {
  const righe = centri.map(c => ({ centro: c, ...totaliDi(vociDi(c.id, docs, imputazioni, periodo)) }));
  return righe.sort((a, b) => {
    const movA = a.nEntrate + a.nUscite, movB = b.nEntrate + b.nUscite;
    if (!movA !== !movB) return movA ? -1 : 1;
    if (movA && a.saldo !== b.saldo) return a.saldo - b.saldo;
    return String(a.centro.nome).localeCompare(String(b.centro.nome), 'it');
  });
}

// Quanto resta fuori da ogni attività: le spese generali e l'arretrato non
// ancora attribuito, tenuti distinti perché sono due cose diverse — la
// prima è una scelta, la seconda è lavoro da fare.
export function fuoriDaiCentri(docs, perFattura, periodo = {}) {
  const t = { entrate: 0, uscite: 0, documenti: 0 };
  for (const d of docs) {
    if (!nelPeriodo(d, periodo)) continue;
    const resto = restoDa(d, perFattura);
    if (resto <= CENT) continue;
    t.documenti++;
    const netta = quotaNetta(resto, d);
    if (d.tipo === 'entrata') t.entrate += netta; else t.uscite += netta;
  }
  return t;
}

// Gli anni in cui c'è almeno un documento, dal più recente: sono le voci
// del filtro di periodo, e proporre un anno vuoto sarebbe proporre una
// pagina vuota.
export function anni(docs) {
  const s = new Set();
  for (const d of docs) if (d.data) s.add(d.data.slice(0, 4));
  return [...s].sort().reverse();
}
