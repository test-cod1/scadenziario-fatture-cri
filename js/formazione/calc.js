// ============================================================
//  FORMAZIONE ESTERNA — catalogo dei corsi, calcolo e testi del preventivo.
//
//  Un preventivo di formazione è una lista di corsi, e per ciascuno si dice
//  quante persone lo frequentano e quanto costa a testa. Il catalogo dei
//  corsi (Impostazioni) è la lista di partenza: dentro il preventivo nome,
//  durata, attestazione e prezzo restano modificabili, e la modifica vale
//  solo per quel preventivo — un documento già mandato deve continuare a
//  mostrare quello che c'era scritto quando è stato scritto.
//
//  Il prezzo ha due colonne: il LISTINO (quanto costa il corso a chiunque) e
//  il PREZZO RISERVATO a questo cliente. È il modo in cui il Comitato scrive
//  i preventivi da sempre ("euro 60 a discente, per Voi euro 55"): il
//  listino compare nel documento solo se è più alto del riservato, altrimenti
//  sarebbe una colonna che ripete l'altra.
// ============================================================
import { centesimi, inLettere } from '../lib/numeri.js';

export { inLettere };

// Aliquota ordinaria, l'unica che serve qui: la formazione o è esente (art.
// 10) o, quando non lo è, sconta l'aliquota piena.
export const ALIQUOTA_IVA = 22;

export const DEFAULT_IMPOSTAZIONI = {
  // I sei corsi che il Comitato eroga alle aziende. I prezzi partono a zero
  // di proposito: meglio un preventivo palesemente da completare che uno con
  // numeri inventati che sembrano veri. Si impostano una volta in
  // Impostazioni, e da lì in poi arrivano già compilati.
  //
  //  durata     → come si legge nel documento ("16 ore")
  //  attestato  → cosa si rilascia; cambia da corso a corso ed è la riga che
  //               nel preventivo va scritta sotto la tabella
  //  sigla      → serve solo a proporre l'oggetto ("PREVENTIVO CORSI BLSD")
  corsi: [
    {
      id: 'ps-a-16', sigla: 'PRIMO SOCCORSO',
      nome: 'Corso di formazione per lavoratori designati addetti al primo soccorso per aziende di "Gruppo A"',
      durata: '16 ore', attestato: 'Rilascio di attestazione — validità 3 anni', prezzo: 0,
    },
    {
      id: 'ps-a-agg-6', sigla: 'PRIMO SOCCORSO',
      nome: 'Corso di aggiornamento per lavoratori designati addetti al primo soccorso per aziende di "Gruppo A"',
      durata: '6 ore', attestato: 'Rilascio di attestazione', prezzo: 0,
    },
    {
      id: 'ps-bc-12', sigla: 'PRIMO SOCCORSO',
      nome: 'Corso di formazione per lavoratori designati addetti al primo soccorso per aziende di "Gruppo B e C"',
      durata: '12 ore', attestato: 'Rilascio di attestazione — validità 3 anni', prezzo: 0,
    },
    {
      id: 'ps-bc-agg-4', sigla: 'PRIMO SOCCORSO',
      nome: 'Corso di aggiornamento per lavoratori designati addetti al primo soccorso per aziende di "Gruppo B e C"',
      durata: '4 ore', attestato: 'Rilascio di attestazione', prezzo: 0,
    },
    {
      id: 'blsd', sigla: 'BLSD',
      nome: 'Corso di rianimazione cardio-polmonare (BLSD)',
      durata: '5 ore', attestato: 'Rilascio dell\'autorizzazione all\'uso del defibrillatore semiautomatico (DAE)', prezzo: 0,
    },
    {
      id: 'blsd-retraining', sigla: 'BLSD',
      nome: 'Retraining corso di rianimazione cardio-polmonare (BLSD)',
      durata: '2 ore', attestato: 'Rilascio dell\'autorizzazione all\'uso del defibrillatore semiautomatico (DAE)', prezzo: 0,
    },
  ],

  // Quanto si aggiunge quando il corso si tiene dal cliente invece che da
  // noi: è la proposta, e nel singolo preventivo resta modificabile (o si
  // azzera, se la trasferta è compresa nel prezzo concordato).
  trasferta_predefinita: 0,

  // Testi fissi del documento: stanno nelle impostazioni e non nel codice
  // perché sono formule che cambiano con le convenzioni e la normativa, e
  // devono poter essere corrette senza rifare il sito.
  testi: {
    premessa: 'Buongiorno, come da Vostra richiesta siamo a proporVi il nostro miglior preventivo per i corsi in oggetto:',
    sede_nostra: 'I corsi si svolgeranno presso la nostra sede di Corso Aldo Gastaldi 11, fondi — Genova.',
    sede_cliente: 'I corsi si svolgeranno presso la sede indicata dal committente.',
    oneri: 'Saranno comunque a nostro carico tutti gli oneri di segreteria.',
    // Come si chiama la trasferta nella tabella, quando c'è.
    voce_trasferta: 'Trasferta presso la sede del committente',
    iva_esente: 'Importi esenti IVA ai sensi dell\'art. 10 del D.P.R. 633/72.',
    iva_soggetto: `Importi soggetti a IVA con aliquota ordinaria del ${ALIQUOTA_IVA}%.`,
    validita: 'Il presente preventivo è valido 60 giorni dalla data di emissione.',
    chiusura: 'In attesa di un Vostro gradito riscontro, porgo i miei saluti.',
  },

  firma: {
    ruolo: 'La Presidente',
    nome: 'Federica Bonelli',
  },
};

// Unisce le impostazioni salvate con i valori di default: tollera un
// database più vecchio del codice (una chiave nuova appare con il suo
// default invece di rompere la pagina).
export function mergeImpostazioni(dati) {
  const base = structuredClone(DEFAULT_IMPOSTAZIONI);
  if (!dati) return base;
  return {
    ...base,
    ...dati,
    // Un catalogo vuoto è una scelta (lo si sta rifacendo da capo), non un
    // dato mancante: i sei corsi di partenza valgono solo quando la chiave
    // non c'è proprio, cioè alla primissima apertura.
    corsi: Array.isArray(dati.corsi) ? dati.corsi : base.corsi,
    trasferta_predefinita: Number(dati.trasferta_predefinita) || 0,
    testi: { ...base.testi, ...(dati.testi || {}) },
    firma: { ruolo: dati.firma?.ruolo ?? base.firma.ruolo, nome: dati.firma?.nome ?? base.firma.nome },
  };
}

// Una riga del preventivo a partire da un corso del catalogo: il corso viene
// COPIATO, non richiamato per id, così il preventivo si porta dietro nome,
// durata, attestazione e prezzo com'erano al momento della stesura.
export function rigaDaCorso(corso) {
  return {
    id: corso.id,
    nome: corso.nome,
    durata: corso.durata || '',
    attestato: corso.attestato || '',
    sigla: corso.sigla || '',
    discenti: null,
    listino: Number(corso.prezzo) || 0,
    prezzo: Number(corso.prezzo) || 0,
  };
}

// Calcolo completo del preventivo: importo di ogni riga, eventuale
// trasferta, sconti, IVA e totale.
//
// L'ordine è quello con cui si legge un preventivo: prima quanto costano i
// corsi, poi la trasferta se il corso si tiene dal cliente, poi gli sconti
// concordati, e solo alla fine l'IVA — che si calcola su quello che il
// cliente paga davvero, non sul prezzo pieno.
export function calcola(prev) {
  const righe = (prev.righe || []).map(r => {
    const discenti = Math.max(0, Number(r.discenti) || 0);
    const prezzo = Number(r.prezzo) || 0;
    const listino = Number(r.listino) || 0;
    return {
      ...r, discenti, prezzo, listino,
      importo: centesimi(discenti * prezzo),
      // Quanto risparmia il cliente rispetto al listino: si mostra
      // nell'editor, per rendersi conto dello sconto che si sta facendo
      // anche quando non si è usato il campo "sconto".
      risparmio: centesimi(discenti * Math.max(0, listino - prezzo)),
    };
  });

  const totaleCorsi = centesimi(righe.reduce((s, r) => s + r.importo, 0));
  // La trasferta esiste solo se il corso si tiene dal cliente: lasciata
  // scritta e poi riportata la sede da noi, continuerebbe a sommarsi senza
  // che si veda da dove arriva.
  const trasferta = prev.sede_tipo === 'cliente' ? centesimi(Math.max(0, Number(prev.trasferta) || 0)) : 0;

  const totaleLordo = centesimi(totaleCorsi + trasferta);
  const sconti = calcolaSconti(prev, totaleLordo);
  const sconto = centesimi(sconti.reduce((s, x) => s + x.importo, 0));
  const imponibile = centesimi(totaleLordo - sconto);

  const conIva = prev.regime_iva === 'soggetto';
  const iva = conIva ? centesimi(imponibile * ALIQUOTA_IVA / 100) : 0;

  return {
    righe, totaleCorsi, trasferta, totaleLordo, sconti, sconto,
    imponibile, conIva, iva,
    totale: centesimi(imponibile + iva),
    discenti: righe.reduce((s, r) => s + r.discenti, 0),
    risparmio: centesimi(righe.reduce((s, r) => s + r.risparmio, 0)),
  };
}

// Gli sconti applicati, uno per riga: la percentuale sul totale e/o un
// importo fisso. I due campi sono indipendenti e si possono usare insieme —
// in quel caso la percentuale si calcola sul totale pieno e l'importo fisso
// si toglie da quello che resta, che è l'ordine con cui si scrivono in un
// preventivo ("meno il 10%, e in più 50 € di sconto").
//
// La somma degli sconti non supera mai il totale: un preventivo negativo non
// vuol dire niente, e l'importo fisso viene semplicemente limitato al residuo.
export function calcolaSconti(prev, totaleLordo) {
  if (totaleLordo <= 0) return [];
  const sconti = [];
  let residuo = totaleLordo;

  const perc = Math.min(Math.max(Number(prev?.sconto_percentuale) || 0, 0), 100);
  if (perc > 0) {
    const importo = centesimi(totaleLordo * perc / 100);
    sconti.push({ tipo: 'percentuale', percentuale: perc, importo });
    residuo = centesimi(residuo - importo);
  }

  const valore = Math.max(Number(prev?.sconto_valore) || 0, 0);
  if (valore > 0 && residuo > 0) {
    // `ridotto` dice che lo sconto scritto era più grande di quello che
    // restava da scontare: l'editor lo segnala, altrimenti il documento
    // stampa una cifra diversa da quella digitata senza dire perché.
    const importo = centesimi(Math.min(valore, residuo));
    sconti.push({ tipo: 'valore', importo, ridotto: importo < centesimi(valore), richiesto: centesimi(valore) });
  }
  return sconti;
}

// Oggetto proposto per il documento, ricavato dai corsi scelti: "PREVENTIVO
// CORSI BLSD" quando sono tutti della stessa famiglia, altrimenti le sigle
// unite. Resta un suggerimento — nell'editor si può riscrivere.
export function oggettoProposto(righe) {
  const sigle = [...new Set((righe || []).map(r => (r.sigla || '').trim().toUpperCase()).filter(Boolean))];
  if (!sigle.length) return 'PREVENTIVO CORSI DI FORMAZIONE';
  return 'PREVENTIVO CORSI ' + sigle.join(' E ');
}
