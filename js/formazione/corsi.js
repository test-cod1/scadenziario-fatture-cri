// ============================================================
//  FORMAZIONE ESTERNA — i corsi effettuati e le loro statistiche.
//
//  Un preventivo dice che cosa si è proposto; un corso (una riga di
//  corsi_formazione) dice che cosa si è fatto: in che date, dove, con quali
//  docenti e con quali persone. Le statistiche si fanno sui corsi SVOLTI,
//  non sui preventivi: quindici discenti confermati possono diventare dodici
//  presenti, e «quante persone abbiamo formato» è il secondo numero.
//
//  Qui solo calcoli, senza pagina e senza database: li usano le viste e li
//  controllano le prove (test/corsi-formazione.prove.mjs).
// ============================================================
import { calcola } from './calc.js';
import { centesimi } from '../lib/numeri.js';

export const STATI_CORSO = ['programmato', 'svolto', 'annullato'];
export const ESITI = [
  ['idoneo', 'Idoneo'],
  ['non_idoneo', 'Non idoneo'],
  ['assente', 'Assente'],
];

// Le ore di un corso, lette dalla durata scritta nel catalogo («16 ore»,
// «4,5 ore»). La durata resta testo perché finisce così nel documento; per
// sommare le ore erogate serve il numero. Senza un numero riconoscibile si
// restituisce null, e nella scheda lo si scrive a mano.
export function oreDaDurata(testo) {
  const m = String(testo || '').match(/(\d+(?:[.,]\d+)?)\s*(?:ore|h\b|ora)/i);
  return m ? Number(m[1].replace(',', '.')) : null;
}

// Chi c'era. Con l'elenco nominativo i presenti si contano da lì — chi è
// segnato assente non è stato formato —, senza elenco vale il numero
// scritto a mano.
export function discentiEffettivi(corso) {
  const p = corso?.partecipanti || [];
  if (p.length) return p.filter(x => x.esito !== 'assente').length;
  return Math.max(0, Number(corso?.discenti) || 0);
}

export function idonei(corso) {
  return (corso?.partecipanti || []).filter(x => x.esito === 'idoneo').length;
}

// ------------------------------------------------------------------
//  DA UN PREVENTIVO CONFERMATO AI CORSI DA TENERE
//  Una riga del preventivo = un corso in programma, con le date ancora da
//  fissare. L'importo di ciascuno è la sua parte di quello che il cliente
//  paga IVA esclusa: sconti e trasferta si spalmano in proporzione al valore
//  delle righe, così la somma dei corsi torna al centesimo con il
//  preventivo. Una riga coi discenti da definire non ha valore nel
//  preventivo: prende prezzo × discenti quando li si conosce, altrimenti
//  zero, e si corregge nella scheda.
// ------------------------------------------------------------------
export function corsiDaPreventivo(prev) {
  const r = calcola(prev);
  const quote = ripartisci(r.imponibile, r.righe.map(x => x.importo));
  return r.righe.map((riga, i) => ({
    preventivo_id: prev.id || null,
    corso_id: riga.id || null,
    corso_nome: riga.nome || 'Corso senza nome',
    sigla: riga.sigla || null,
    durata: riga.durata || null,
    ore: oreDaDurata(riga.durata),
    rinnovo_anni: Number(riga.rinnovo_anni) || null,
    cliente: prev.cliente || null,
    data_inizio: null,
    data_fine: null,
    sede_tipo: prev.sede_tipo === 'cliente' ? 'cliente' : 'nostra',
    sede: prev.sede_tipo === 'cliente' ? (prev.sede || null) : null,
    docenti: null,
    stato: 'programmato',
    discenti: riga.discenti || null,
    partecipanti: [],
    importo: quote[i],
    note: null,
  }));
}

// Divide `totale` in parti proporzionali ai pesi, arrotondate al centesimo,
// con lo scarto dell'arrotondamento sull'ultima riga che pesa: tre corsi da
// un terzo ciascuno di 100 € fanno 33,33 + 33,33 + 33,34, non 99,99.
export function ripartisci(totale, pesi) {
  const somma = pesi.reduce((s, p) => s + (p > 0 ? p : 0), 0);
  if (!(somma > 0) || !(totale > 0)) return pesi.map(() => 0);
  const quote = pesi.map(p => (p > 0 ? centesimi(totale * p / somma) : 0));
  const scarto = centesimi(totale - quote.reduce((s, q) => s + q, 0));
  if (scarto) {
    const ultima = pesi.map((p, i) => (p > 0 ? i : -1)).filter(i => i >= 0).pop();
    quote[ultima] = centesimi(quote[ultima] + scarto);
  }
  return quote;
}

// ------------------------------------------------------------------
//  L'ELENCO DEI PARTECIPANTI INCOLLATO
//  L'azienda manda i nomi in una mail o in un foglio Excel: si incollano in
//  blocco, una persona per riga. Da Excel le colonne arrivano separate da
//  tabulazioni (cognome, nome, codice fiscale, in quell'ordine); da una
//  mail di solito è «Rossi Mario RSSMRA80A01D969X». Il codice fiscale si
//  riconosce dalla forma e può stare in qualsiasi punto della riga; del
//  resto, la prima parola è il cognome e il seguito il nome. Le particelle
//  dei cognomi italiani («De Luca», «Della Valle», «Lo Russo») restano
//  attaccate alla parola dopo; i cognomi doppi veri («Rossi Bianchi Anna»)
//  non si possono distinguere da un secondo nome, e si correggono a mano
//  nella tabella.
// ------------------------------------------------------------------
const CF = /\b[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]\b/i;
const PARTICELLA = /^(de|di|da|del|della|dello|delle|dei|degli|dal|dalla|la|lo|li|le|van|von|d'|dell')$/i;

export function leggiPartecipanti(testo) {
  return String(testo || '').split(/\r?\n/).map(r => r.trim()).filter(Boolean).map(riga => {
    if (riga.includes('\t') || riga.includes(';')) {
      const col = riga.split(/[\t;]/).map(c => c.trim());
      const iCf = col.findIndex(c => CF.test(c));
      const cf = iCf >= 0 ? col.splice(iCf, 1)[0].toUpperCase() : '';
      const [cognome = '', ...nome] = col.filter(Boolean);
      return { cognome, nome: nome.join(' '), cf, esito: 'idoneo' };
    }
    const m = riga.match(CF);
    const cf = m ? m[0].toUpperCase() : '';
    const parole = riga.replace(CF, ' ').replace(/[,]/g, ' ').split(/\s+/).filter(Boolean);
    let n = 1;
    while (n < parole.length - 1 && PARTICELLA.test(parole[n - 1])) n++;
    return { cognome: parole.slice(0, n).join(' '), nome: parole.slice(n).join(' '), cf, esito: 'idoneo' };
  });
}

// ------------------------------------------------------------------
//  LE STATISTICHE
//  Tutto per anno solare, sulla data di inizio del corso. Un corso svolto
//  senza data entra nei totali di "tutti gli anni" ma in nessun anno
//  preciso: la pagina lo dice, invece di attribuirlo a un anno a caso.
// ------------------------------------------------------------------
const annoDi = (iso) => (iso ? Number(String(iso).slice(0, 4)) : null);

// Gli anni in cui c'è qualcosa da contare, dal più recente.
export function anniDisponibili(corsi, preventivi = []) {
  const anni = new Set([
    ...corsi.map(c => annoDi(c.data_inizio)),
    ...preventivi.map(p => annoDi(p.data_documento)),
  ].filter(Boolean));
  return [...anni].sort((a, b) => b - a);
}

// I docenti si scrivono in un campo solo («Rossi, Bianchi» o «Rossi e
// Bianchi»): per contarli uno per uno vanno separati.
export function elencoDocenti(testo) {
  return String(testo || '').split(/\s*(?:,|;|\/|\be\b|\n)\s*/i).map(d => d.trim()).filter(Boolean);
}

function riepilogo(svolti) {
  const discenti = svolti.reduce((s, c) => s + discentiEffettivi(c), 0);
  const conEsiti = svolti.filter(c => (c.partecipanti || []).length);
  const presentiConEsito = conEsiti.reduce((s, c) => s + discentiEffettivi(c), 0);
  return {
    edizioni: svolti.length,
    discenti,
    ore: svolti.reduce((s, c) => s + (Number(c.ore) || 0), 0),
    oreUomo: svolti.reduce((s, c) => s + (Number(c.ore) || 0) * discentiEffettivi(c), 0),
    ricavi: centesimi(svolti.reduce((s, c) => s + (Number(c.importo) || 0), 0)),
    committenti: new Set(svolti.map(c => (c.cliente || '').trim().toLowerCase()).filter(Boolean)).size,
    // L'idoneità si calcola solo sui corsi con l'elenco nominativo: sugli
    // altri l'esito non è registrato, e contarli come idonei o no
    // falserebbe la percentuale.
    idonei: conEsiti.reduce((s, c) => s + idonei(c), 0),
    presentiConEsito,
  };
}

function raggruppa(svolti, chiave, etichetta) {
  const gruppi = new Map();
  for (const c of svolti) {
    for (const k of [].concat(chiave(c))) {
      if (!k) continue;
      const id = String(k).trim().toLowerCase();
      if (!gruppi.has(id)) gruppi.set(id, { nome: etichetta(c, k), corsi: [] });
      gruppi.get(id).corsi.push(c);
    }
  }
  return [...gruppi.values()].map(g => ({ nome: g.nome, ...riepilogo(g.corsi) }));
}

// `anno` è un numero, oppure null per "tutti gli anni".
export function statistiche(corsi, preventivi, { anno = null, oggi } = {}) {
  const dellAnno = (iso) => anno === null || annoDi(iso) === anno;
  const svolti = corsi.filter(c => c.stato === 'svolto' && dellAnno(c.data_inizio));
  const r = riepilogo(svolti);

  let precedente = null;
  if (anno !== null) {
    precedente = riepilogo(corsi.filter(c => c.stato === 'svolto' && annoDi(c.data_inizio) === anno - 1));
  }

  const perMese = Array.from({ length: 12 }, () => ({ edizioni: 0, discenti: 0 }));
  if (anno !== null) {
    for (const c of svolti) {
      const m = Number(String(c.data_inizio).slice(5, 7)) - 1;
      perMese[m].edizioni++;
      perMese[m].discenti += discentiEffettivi(c);
    }
  }

  const perCorso = raggruppa(svolti, c => c.corso_id || c.corso_nome, c => c.corso_nome)
    .sort((a, b) => b.discenti - a.discenti || b.edizioni - a.edizioni);
  const perCliente = raggruppa(svolti, c => c.cliente, c => c.cliente.trim())
    .sort((a, b) => b.ricavi - a.ricavi || b.discenti - a.discenti);
  const perDocente = raggruppa(svolti, c => elencoDocenti(c.docenti), (c, d) => d)
    .sort((a, b) => b.ore - a.ore || b.edizioni - a.edizioni);
  const sedi = {
    nostra: svolti.filter(c => c.sede_tipo !== 'cliente').length,
    cliente: svolti.filter(c => c.sede_tipo === 'cliente').length,
  };

  // I preventivi dell'anno, per data del documento: quanti ne sono usciti
  // (le bozze non sono uscite) e quanti sono andati a buon fine. La
  // conversione si calcola sui preventivi che hanno avuto una risposta —
  // confermati e annullati —: quelli ancora in attesa non sono un no.
  const prevAnno = preventivi.filter(p => p.stato !== 'bozza' && dellAnno(p.data_documento));
  const conta = (s) => prevAnno.filter(p => p.stato === s);
  const confermati = conta('confermato');
  const annullati = conta('annullato');
  const risposti = confermati.length + annullati.length;
  const pre = {
    emessi: prevAnno.length,
    confermati: confermati.length,
    annullati: annullati.length,
    inAttesa: conta('inviato').length,
    conversione: risposti ? confermati.length / risposti : null,
    valoreConfermato: centesimi(confermati.reduce((s, p) => s + (Number(p.totale) || 0), 0)),
    valoreMedio: confermati.length
      ? centesimi(confermati.reduce((s, p) => s + (Number(p.totale) || 0), 0) / confermati.length) : null,
  };

  const programmati = corsi.filter(c => c.stato === 'programmato');
  return {
    anno, ...r, precedente, perMese, perCorso, perCliente, perDocente, sedi, preventivi: pre,
    senzaData: anno === null ? 0 : corsi.filter(c => c.stato === 'svolto' && !c.data_inizio).length,
    inProgramma: programmati.filter(c => c.data_inizio && (!oggi || c.data_inizio >= oggi)).length,
    daFissare: programmati.filter(c => !c.data_inizio).length,
  };
}

// La data che conta per il rinnovo dell'attestato: la fine dell'ultimo
// corso svolto per quel preventivo. Restituisce una mappa preventivo → data,
// che l'elenco dei preventivi usa al posto della data del documento.
export function dateCorsiSvolti(corsi) {
  const m = new Map();
  for (const c of corsi) {
    if (c.stato !== 'svolto' || !c.preventivo_id) continue;
    const d = c.data_fine || c.data_inizio;
    if (d && d > (m.get(c.preventivo_id) || '')) m.set(c.preventivo_id, d);
  }
  return m;
}
