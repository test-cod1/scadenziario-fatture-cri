// ============================================================
//  CALCOLI DELLA SEZIONE ANALISI — FATTURATO (fatture emesse)
//
//  I centri di costo rispondono a «quell'attività quanto ha reso?».
//  Questa pagina risponde a tre domande diverse, che nessuna delle due
//  sezioni esistenti sa dire:
//
//    - quanto abbiamo fatturato, e come sta andando rispetto all'anno
//      prima (il Report dello scadenziario mostra i mesi, ma non li
//      confronta: e un mese da 60.000 € non dice niente finché non si sa
//      che l'anno scorso, a quel punto, eravamo a 40.000);
//    - da chi dipende quel fatturato (se tre clienti fanno il 70% del
//      Comitato, la perdita di una convenzione è un problema di
//      sostenibilità, non un contrattempo);
//    - quanto di quel fatturato è ancora un credito, e da quanto tempo.
//
//  Quattro scelte che vale la pena sapere prima di leggere un numero:
//
//  1. FATTURATO vuol dire emesso, non incassato. La fattura di luglio
//     incassata a ottobre è fatturato di luglio. L'incassato c'è, ma è un
//     altro numero e sta scritto come tale: confonderli è il modo più
//     rapido di credersi più poveri (o più ricchi) di quanto si sia.
//
//  2. Il fatturato è al NETTO delle note di credito, e lo storno pesa sul
//     mese della FATTURA, non su quello della nota. Una fattura di marzo
//     stornata a settembre non è fatturato di marzo che resta e un buco a
//     settembre: è fatturato di marzo che non c'è mai stato. Portarla a
//     settembre farebbe un mese artificialmente basso e un marzo
//     artificialmente alto, cioè due numeri falsi al posto di uno vero.
//
//  3. I clienti si raggruppano per nome normalizzato (maiuscole e spazi).
//     Le fatture arrivano da import e da mani diverse, e «COMUNE DI
//     GENOVA  ATS35» e «Comune di Genova ATS35» sono lo stesso ente: se
//     restassero due righe, la concentrazione — che è tutto il senso di
//     questa pagina — risulterebbe più bassa del vero. Normalizzare non
//     è indovinare: si unisce solo ciò che è identico a meno di
//     maiuscole e spaziatura, mai per somiglianza.
//
//  4. Una fattura senza data resta dentro ogni periodo, come nel resto di
//     Analisi (vedi `nelPeriodo` in calc.js): non è «fuori dall'anno», è
//     una fattura a cui manca la data. Sparisce solo dal grafico mensile,
//     perché un mese non ce l'ha, e la pagina lo dice invece di lasciarlo
//     scoprire.
// ============================================================

const CENT = 0.005;
const GIORNO = 86400000;

// ---------- normalizzazione e filtro ----------

// Il nome del cliente ridotto alla sua forma confrontabile. Serve solo a
// decidere se due righe sono lo stesso ente: a schermo si mostra sempre la
// grafia originale (vedi `perCliente`), perché è quella che sta sulla
// fattura e quella che chi legge riconosce.
//
// La regola sta in js/lib/nomiClienti.js e non qui, perché la usa anche la
// pagina che unifica i nomi doppi nello scadenziario: se le due
// divergessero, quella pagina direbbe «doppio» di una coppia che questo
// report ha già unito da sé, o il contrario.
export { chiaveCliente } from '../lib/nomiClienti.js';
import { chiaveCliente } from '../lib/nomiClienti.js';

export function nelPeriodo(f, { da = '', a = '' } = {}) {
  if (!f.data_fattura) return true;      // vedi il punto 4 in testa al file
  if (da && f.data_fattura < da) return false;
  if (a && f.data_fattura > a) return false;
  return true;
}

export function nelPeriodoFatture(attive = [], periodo = {}) {
  return attive.filter(f => nelPeriodo(f, periodo));
}

// Gli anni in cui c'è almeno una fattura emessa, dal più recente: sono le
// voci del filtro di periodo.
export function anniFatturato(attive = []) {
  const s = new Set();
  for (const f of attive) if (f.data_fattura) s.add(f.data_fattura.slice(0, 4));
  return [...s].sort().reverse();
}

// ---------- i quattro numeri di una fattura ----------
// `_incassato`, `_stornato` e `_residuo` li mette già withResiduo() dello
// scadenziario (js/data/storeAttive.js). Qui si leggono con un default,
// perché questo modulo lo provano anche le prove con fatture finte, e una
// fattura senza incassi non deve valere NaN.
export const lordo = f => Number(f.importo || 0);
export const stornato = f => Number(f._stornato || 0);
export const incassato = f => Number(f._incassato || 0);
export const netto = f => Math.max(0, lordo(f) - stornato(f));
export const residuo = f => Number(f._residuo ?? Math.max(0, lordo(f) - incassato(f) - stornato(f)));

// ---------- il riepilogo del periodo ----------
// Media E mediana del valore di una fattura, non solo la media: con una
// convenzione da 22.600 € in mezzo a cento assistenze da 90 €, la media
// racconta una fattura tipo che non esiste. La mediana dice qual è la
// fattura di tutti i giorni, la media dice quanto pesano le grandi.
export function riepilogo(righe = []) {
  const t = {
    n: righe.length,
    lordo: 0, stornato: 0, netto: 0, incassato: 0, residuo: 0,
    nStornate: 0, nAperte: 0,
    medio: 0, mediano: 0,
    quotaIncassata: 0,
  };
  const valori = [];
  for (const f of righe) {
    t.lordo += lordo(f);
    t.stornato += stornato(f);
    t.incassato += incassato(f);
    t.residuo += residuo(f);
    if (stornato(f) > CENT) t.nStornate++;
    if (residuo(f) > CENT) t.nAperte++;
    valori.push(netto(f));
  }
  t.netto = t.lordo - t.stornato;
  t.medio = t.n ? t.netto / t.n : 0;
  t.mediano = mediana(valori) ?? 0;
  t.quotaIncassata = t.netto > CENT ? t.incassato / t.netto : 0;
  return t;
}

export function mediana(numeri = []) {
  const v = numeri.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

// ---------- i clienti ----------
// Una riga per ente, con la quota sul totale e la quota cumulata: la
// cumulata è quella che risponde alla domanda vera, «quanti clienti fanno
// l'80% del Comitato», che non si legge da nessuna colonna di importi.
export function perCliente(righe = []) {
  const m = new Map();
  for (const f of righe) {
    const k = chiaveCliente(f.cliente);
    if (!m.has(k)) {
      m.set(k, {
        chiave: k,
        // Fra più grafie dello stesso ente si mostra la prima incontrata.
        // Le fatture arrivano ordinate per data, quindi è quella con cui
        // il rapporto è cominciato: scelta arbitraria ma stabile, mentre
        // tenere l'ultima avrebbe cambiato l'etichetta della riga ogni
        // volta che si registra una fattura nuova.
        cliente: String(f.cliente || '—').trim() || '—',
        n: 0, netto: 0, incassato: 0, residuo: 0, stornato: 0,
        giorni: [], ultima: null,
      });
    }
    const g = m.get(k);
    g.n++;
    g.netto += netto(f);
    g.incassato += incassato(f);
    g.residuo += residuo(f);
    g.stornato += stornato(f);
    const gg = giorniIncasso(f);
    if (gg !== null) g.giorni.push(gg);
    if (f.data_fattura && (!g.ultima || f.data_fattura > g.ultima)) g.ultima = f.data_fattura;
  }

  const totale = [...m.values()].reduce((s, g) => s + g.netto, 0);
  const gruppi = [...m.values()].sort((a, b) => b.netto - a.netto
    || String(a.cliente).localeCompare(String(b.cliente), 'it'));

  let cumulato = 0;
  for (const g of gruppi) {
    g.giorniMediani = mediana(g.giorni);
    g.quota = totale > CENT ? g.netto / totale : 0;
    cumulato += g.netto;
    g.quotaCumulata = totale > CENT ? cumulato / totale : 0;
  }
  return gruppi;
}

// Quanto il Comitato dipende da pochi clienti.
//
//  - `primi1/3/10`: la quota dei primi N. È il numero che si porta in
//    Consiglio, perché si capisce senza spiegazioni.
//  - `clientiPer80`: quanti clienti bastano a fare l'80% del fatturato.
//    Dice la stessa cosa dal verso utile: «se ne perdiamo due su
//    quarantacinque, quanto se ne va».
//  - `hhi`: l'indice di Herfindahl (somma dei quadrati delle quote, da 0 a
//    1). Non è per i comunicati: è l'unico dei tre che non dipende da
//    dove si taglia l'elenco, e quindi l'unico confrontabile fra un anno
//    e l'altro quando il numero dei clienti cambia.
export function concentrazione(gruppi = []) {
  const totale = gruppi.reduce((s, g) => s + g.netto, 0);
  const quota = n => totale > CENT
    ? gruppi.slice(0, n).reduce((s, g) => s + g.netto, 0) / totale
    : 0;
  let cumulato = 0, clientiPer80 = 0;
  for (const g of gruppi) {
    if (cumulato / (totale || 1) >= 0.8) break;
    cumulato += g.netto;
    clientiPer80++;
  }
  return {
    nClienti: gruppi.length,
    primo: gruppi[0] || null,
    primi1: quota(1), primi3: quota(3), primi10: quota(10),
    clientiPer80: totale > CENT ? clientiPer80 : 0,
    hhi: totale > CENT
      ? gruppi.reduce((s, g) => s + (g.netto / totale) ** 2, 0)
      : 0,
  };
}

// L'indice di concentrazione a parole. Le soglie (15% e 25% di HHI) sono
// quelle usate per i mercati: qui non c'è nessun mercato, ma servono a
// dire «questo numero è alto» a chi non ha mai visto un HHI, ed è meglio
// di una cifra nuda che nessuno sa dove collocare.
export function livelloConcentrazione(hhi) {
  if (hhi >= 0.25) return { chiave: 'alta', testo: 'molto concentrato' };
  if (hhi >= 0.15) return { chiave: 'media', testo: 'concentrato' };
  return { chiave: 'bassa', testo: 'distribuito' };
}

// ---------- l'andamento nel tempo ----------
// Dodici mesi dell'anno scelto, affiancati agli stessi mesi dell'anno
// prima. I mesi ci sono tutti anche se vuoti: un buco nel grafico è
// un'informazione (in quel mese non si è fatturato), mentre saltare la
// colonna fa sembrare l'anno più corto e allinea male i due confronti.
//
// `attive` è l'elenco COMPLETO, non quello filtrato: l'anno precedente sta
// per definizione fuori dal periodo selezionato.
export function perMese(attive = [], anno) {
  const y = String(anno || '');
  const somma = (aa) => {
    const mesi = Array.from({ length: 12 }, () => 0);
    if (!aa) return mesi;
    for (const f of attive) {
      if (!f.data_fattura || f.data_fattura.slice(0, 4) !== aa) continue;
      mesi[Number(f.data_fattura.slice(5, 7)) - 1] += netto(f);
    }
    return mesi;
  };
  const corrente = somma(y);
  const precedente = somma(y ? String(Number(y) - 1) : '');
  let cum = 0, cumPrec = 0;
  return corrente.map((v, i) => {
    cum += v; cumPrec += precedente[i];
    return {
      mese: i,
      valore: v,
      precedente: precedente[i],
      cumulato: cum,
      cumulatoPrecedente: cumPrec,
      // La variazione si calcola solo dove c'è un anno prima da
      // confrontare: da zero a qualunque cifra l'aumento percentuale è
      // infinito, e «+∞%» non è una notizia, è una divisione per zero.
      variazione: precedente[i] > CENT ? (v - precedente[i]) / precedente[i] : null,
    };
  });
}

// Quando il periodo è «tutti gli anni» un grafico a dodici colonne non ha
// senso: al suo posto si mostra un anno per colonna. È lo stesso disegno
// letto a una scala diversa, non una pagina che cambia faccia.
export function perAnno(attive = []) {
  const m = new Map();
  for (const f of attive) {
    if (!f.data_fattura) continue;
    const y = f.data_fattura.slice(0, 4);
    m.set(y, (m.get(y) || 0) + netto(f));
  }
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    .map(([anno, valore]) => ({ anno, valore }));
}

// Il totale dell'anno prima, per la riga di confronto sotto al fatturato.
// Non si ricava dai mesi perché le fatture senza data non hanno un mese ma
// contano nel totale: sommarle solo di qua le farebbe sparire di là.
//
// `finoAl` ('MM-GG', facoltativo) ferma il conto a quel giorno dell'anno:
// serve per l'anno in corso, che a settembre ha nove mesi di fatture e
// messo contro i dodici dell'anno prima mostrerebbe un calo del 25% anche
// a parità di passo. Con il taglio le fatture senza data restano fuori,
// perché non si può dire se stanno prima o dopo quel giorno.
export function totaleAnno(attive = [], anno, finoAl = '') {
  const y = String(anno || '');
  if (!y) return 0;
  const limite = finoAl ? `${y}-${finoAl}` : '';
  return attive.reduce((s, f) => s + (f.data_fattura?.slice(0, 4) === y
    && (!limite || f.data_fattura <= limite) ? netto(f) : 0), 0);
}

// Il giorno a cui fermare il confronto con l'anno prima: per l'anno in
// corso è oggi (stesso giorno e mese, un anno indietro), per un anno già
// chiuso nessun taglio, perché lì si confrontano due anni interi.
// `oggi` arriva da fuori per la stessa ragione di anzianitaCredito.
export function taglioConfronto(anno, oggi) {
  const base = oggi || new Date().toISOString().slice(0, 10);
  return anno && String(anno) === base.slice(0, 4) ? base.slice(5, 10) : '';
}

// ---------- il credito ----------
// Giorni impiegati a incassare: dalla data fattura all'ultimo incasso
// vero. Vale solo per le fatture chiuse — un acconto non dice quando la
// fattura sarà chiusa — ed esclude le note di credito, che sono una
// chiusura contabile e non un incasso. Stessa regola di reportAttive.js:
// se qui divergesse, due pagine direbbero due tempi diversi.
export function giorniIncasso(f) {
  const chiusa = f.stato === 'incassata' || f.stato === 'stornata';
  if (!chiusa || !f.data_fattura || !(f.incassi || []).length) return null;
  const ultimo = f.incassi.reduce((max, p) => (p.data_incasso && p.data_incasso > max ? p.data_incasso : max), '');
  if (!ultimo) return null;
  const g = Math.round((new Date(ultimo + 'T00:00:00') - new Date(f.data_fattura + 'T00:00:00')) / GIORNO);
  return Number.isFinite(g) ? g : null;
}

export const FASCE_TEMPI = [
  { chiave: '0-30', etichetta: 'entro 30 gg', max: 30 },
  { chiave: '31-60', etichetta: '31–60 gg', max: 60 },
  { chiave: '61-90', etichetta: '61–90 gg', max: 90 },
  { chiave: '91-180', etichetta: '91–180 gg', max: 180 },
  { chiave: '180+', etichetta: 'oltre 180 gg', max: Infinity },
];

// Quanto ci mettono a pagarci, non in media ma in distribuzione: una media
// di 60 giorni può voler dire «tutti a 60» oppure «metà subito e metà a un
// anno», e sono due situazioni che si gestiscono in due modi diversi.
export function tempiDiIncasso(righe = []) {
  const giorni = righe.map(giorniIncasso).filter(g => g !== null);
  const fasce = FASCE_TEMPI.map(f => ({ ...f, n: 0 }));
  for (const g of giorni) (fasce.find(f => g <= f.max) || fasce[fasce.length - 1]).n++;
  return {
    n: giorni.length,
    mediana: mediana(giorni),
    media: giorni.length ? giorni.reduce((s, g) => s + g, 0) / giorni.length : null,
    peggiore: giorni.length ? Math.max(...giorni) : null,
    fasce,
  };
}

export const FASCE_ANZIANITA = [
  { chiave: '0-30', etichetta: 'fino a 30 gg', max: 30 },
  { chiave: '31-60', etichetta: '31–60 gg', max: 60 },
  { chiave: '61-90', etichetta: '61–90 gg', max: 90 },
  { chiave: '91-180', etichetta: '91–180 gg', max: 180 },
  { chiave: '180+', etichetta: 'oltre 180 gg', max: Infinity },
];

// L'anzianità del credito: quanto è ancora da incassare e da quanto tempo
// è stato emesso. Si misura dalla DATA FATTURA e non dalla scadenza,
// perché la scadenza sulle attive è spesso vuota (l'ha tolta una patch di
// agosto) e un aging che sparisce quando manca un campo facoltativo non
// serve a niente. Il conto è quindi «da quanto abbiamo emesso», che è
// comunque la domanda giusta da porre a un ente pubblico.
//
// `oggi` si passa da fuori invece di leggere l'orologio qui dentro: è
// l'unico modo di provarlo senza far dipendere il risultato dal giorno in
// cui girano le prove.
export function anzianitaCredito(righe = [], oggi) {
  const base = oggi || new Date().toISOString().slice(0, 10);
  const fasce = FASCE_ANZIANITA.map(f => ({ ...f, n: 0, importo: 0 }));
  const senzaData = { n: 0, importo: 0 };
  let totale = 0;
  for (const f of righe) {
    const r = residuo(f);
    if (r <= CENT) continue;
    totale += r;
    if (!f.data_fattura) { senzaData.n++; senzaData.importo += r; continue; }
    const g = Math.round((new Date(base + 'T00:00:00') - new Date(f.data_fattura + 'T00:00:00')) / GIORNO);
    const fascia = fasce.find(x => g <= x.max) || fasce[fasce.length - 1];
    fascia.n++; fascia.importo += r;
  }
  return { totale, fasce, senzaData };
}

// Le singole fatture aperte più vecchie: l'aging dice quanto c'è nella
// fascia brutta, questo dice quali sono — che è quello che serve per
// alzare il telefono.
export function creditiVecchi(righe = [], oggi, quante = 10) {
  const base = oggi || new Date().toISOString().slice(0, 10);
  return righe
    .filter(f => residuo(f) > CENT && f.data_fattura)
    .map(f => ({
      f,
      residuo: residuo(f),
      giorni: Math.round((new Date(base + 'T00:00:00') - new Date(f.data_fattura + 'T00:00:00')) / GIORNO),
    }))
    .sort((a, b) => b.giorni - a.giorni || b.residuo - a.residuo)
    .slice(0, quante);
}

// ---------- il ponte con i centri di costo ----------
// Quanta parte del fatturato del periodo è attribuita a un'attività. È il
// numero che tiene insieme le due pagine della sezione: finché non è alto,
// i conti dei centri di costo sono una fotografia parziale, e questa
// pagina è il posto dove ci si accorge che lo sono.
export function coperturaCentri(righe = [], perFattura) {
  const t = { attribuito: 0, scoperto: 0, nScoperte: 0, quota: 0 };
  for (const f of righe) {
    const quote = (perFattura?.get(f.id) || []).reduce((s, i) => s + Number(i.importo || 0), 0);
    // Le quote sono scritte sul lordo (vedi restoDa in calc.js): per
    // confrontarle con un fatturato netto vanno ridotte nella stessa
    // proporzione in cui la nota di credito riduce la fattura.
    const fattore = lordo(f) > CENT ? netto(f) / lordo(f) : 0;
    const coperto = Math.min(quote, lordo(f)) * fattore;
    t.attribuito += coperto;
    const scoperto = Math.max(0, netto(f) - coperto);
    if (scoperto > CENT) { t.scoperto += scoperto; t.nScoperte++; }
  }
  const tot = t.attribuito + t.scoperto;
  t.quota = tot > CENT ? t.attribuito / tot : 0;
  return t;
}

// ---------- quello che manca ----------
// I buchi nei dati, detti prima che qualcuno legga i numeri come se non ce
// ne fossero. Non è una lista di errori: è il margine di incertezza di
// questa pagina, e una pagina che non lo dichiara mente per omissione.
export function lacune(righe = []) {
  return {
    senzaData: righe.filter(f => !f.data_fattura).length,
    senzaNumero: righe.filter(f => !String(f.numero_fattura || '').trim()).length,
    aZero: righe.filter(f => lordo(f) <= CENT).length,
  };
}
