// ============================================================
//  ASSISTENZE SANITARIE — tariffario, calcolo e testi del preventivo.
//
//  Il tariffario non è un elenco fisso di voci: è una lista configurabile
//  (Impostazioni), e ogni preventivo sceglie quali voci usare. Ogni voce è
//  'oraria' (prezzo × ore × quantità, per ogni turno del calendario) oppure
//  'fissa' (prezzo × quantità, indipendente dalla durata: il gazebo si monta
//  una volta, non si paga a ore).
// ============================================================

export const DEFAULT_IMPOSTAZIONI = {
  // I prezzi partono a zero di proposito: meglio un preventivo palesemente da
  // completare che uno con numeri inventati che sembrano veri.
  tariffe: [
    { id: 'ambulanza', nome: 'Ambulanza con equipaggio', tipo: 'oraria', prezzo: 0 },
    { id: 'medico',    nome: 'Medico',                    tipo: 'oraria', prezzo: 0 },
    { id: 'sap',       nome: 'Squadra a piedi (SAP)',     tipo: 'oraria', prezzo: 0 },
    { id: 'gazebo',    nome: 'Gazebo',                     tipo: 'fissa', prezzo: 0 },
  ],

  // Testi fissi del documento: stanno nelle impostazioni e non nel codice
  // perché sono formule che cambiano con le convenzioni e la normativa, e
  // devono poter essere corrette senza rifare il sito.
  testi: {
    premessa: 'A seguito della Vs richiesta indichiamo il preventivo di spesa per l\'esecuzione del servizio di assistenza sanitaria:',
    iva: 'OPERAZIONI FUORI CAMPO IVA ART. 4 DPR 633/72.',
    banca: 'Vi forniamo di seguito i nostri riferimenti bancari:\nBANCA CREDIT AGRICOLE\nIBAN: IT93Z0623001495000030454359\nintestato a CROCE ROSSA ITALIANA COMITATO DI GENOVA',
    mezzi: 'Lo scrivente Comitato mette a disposizione mezzi e personale in possesso dei requisiti previsti dalla normativa vigente in materia di trasporto sanitario di emergenza/urgenza, con le dotazioni e le specifiche indicate nella relativa documentazione, disponibile su richiesta.',
    privacy: 'Si precisa altresì che gli operatori C.R.I. che seguiranno il servizio di cui sopra sono istruiti:\n– a trattare i dati personali esclusivamente per lo svolgimento del servizio in oggetto;\n– a non comunicare e/o diffondere dati personali a soggetti terzi;\n– a effettuare tale trattamento secondo i principi di correttezza, liceità e trasparenza, in modo da tutelare la riservatezza e i diritti degli interessati;\n– a comunicare senza indugio ogni violazione, o presunta tale, dei dati personali e delle misure di sicurezza;\n– a provvedere al trattamento esclusivamente per la durata del rapporto contrattuale: al termine permangono i divieti di duplicazione, comunicazione a terzi e diffusione.',
    chiusura: 'Restando a disposizione per ogni ulteriore chiarimento, si porgono cordiali e distinti saluti.',
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
    tariffe: Array.isArray(dati.tariffe) && dati.tariffe.length ? dati.tariffe : base.tariffe,
    testi: { ...base.testi, ...(dati.testi || {}) },
    // Solo le due righe che il documento stampa davvero. Il form ha avuto per
    // un po' un campo "Ente" che nel preventivo non compariva da nessuna
    // parte: si compilava credendo di cambiare la firma, e non cambiava
    // nulla. Elencare le chiavi qui fa sparire anche il valore già salvato.
    firma: { ruolo: dati.firma?.ruolo ?? base.firma.ruolo, nome: dati.firma?.nome ?? base.firma.nome },
  };
}

// Durata di un turno in ore. Un turno che finisce prima di quando inizia si
// intende passato per la mezzanotte (es. 22:00 → 02:00 = 4 ore): capita nei
// servizi notturni ed è più utile che restituire un numero negativo.
export function oreTurno(riga) {
  const inizio = minuti(riga?.dalle);
  const fine = minuti(riga?.alle);
  if (inizio === null || fine === null) return 0;
  let diff = fine - inizio;
  if (diff < 0) diff += 24 * 60;
  return diff / 60;
}

function minuti(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

// Calcolo completo del preventivo: importo di ogni turno, riepilogo per voce
// (è quello che finisce nel documento) e totale.
export function calcola(prev) {
  const voci = (prev.voci || []).filter(v => v && v.id);
  const calendario = prev.calendario || [];

  const perVoce = new Map(voci.map(v => [v.id, {
    ...v, ore: 0, quantita: 0, importo: 0,
  }]));

  const righe = calendario.map(r => {
    const ore = oreTurno(r);
    const dettaglio = [];
    let importoRiga = 0;
    for (const v of voci) {
      const qta = Number(r.qta?.[v.id]) || 0;
      if (!qta) continue;
      const importo = v.tipo === 'fissa'
        ? qta * (Number(v.prezzo) || 0)
        : qta * ore * (Number(v.prezzo) || 0);
      importoRiga += importo;
      dettaglio.push({ voceId: v.id, nome: v.nome, qta, ore, importo });
      const agg = perVoce.get(v.id);
      agg.quantita += qta;
      // Le ore di una voce a prezzo fisso non vogliono dire nulla (il gazebo si
      // monta, non si paga a ore): restano a zero e il documento non le stampa.
      if (v.tipo !== 'fissa') agg.ore += qta * ore;
      agg.importo += importo;
    }
    return { ...r, ore, dettaglio, importo: importoRiga };
  });

  const riepilogo = [...perVoce.values()].filter(v => v.importo > 0 || v.quantita > 0);
  const totaleLordo = centesimi(righe.reduce((s, r) => s + r.importo, 0));
  const sconti = calcolaSconti(prev, totaleLordo);
  const sconto = centesimi(sconti.reduce((s, x) => s + x.importo, 0));
  return { righe, riepilogo, totaleLordo, sconti, sconto, totale: centesimi(totaleLordo - sconto) };
}

// Arrotonda ai centesimi: senza, la somma di più turni può lasciare code di
// virgola (0,30000000000000004) che poi si vedono nel documento.
function centesimi(n) { return Math.round((Number(n) || 0) * 100) / 100; }

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
    sconti.push({ tipo: 'valore', importo: centesimi(Math.min(valore, residuo)) });
  }
  return sconti;
}

// ---------------------------------------------------------------
//  Importo in lettere, come si usa nei preventivi ("euro
//  quattrocentocinquanta/00"): serve a rendere non alterabile la cifra.
// ---------------------------------------------------------------
const UNITA = ['zero', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove',
  'dieci', 'undici', 'dodici', 'tredici', 'quattordici', 'quindici', 'sedici', 'diciassette', 'diciotto', 'diciannove'];
const DECINE = ['', '', 'venti', 'trenta', 'quaranta', 'cinquanta', 'sessanta', 'settanta', 'ottanta', 'novanta'];

function sottoCento(n) {
  if (n < 20) return UNITA[n];
  const d = Math.floor(n / 10), u = n % 10;
  let s = DECINE[d];
  // "ventuno", "trentotto": la vocale finale della decina cade davanti a
  // uno e otto.
  if (u === 1 || u === 8) s = s.slice(0, -1);
  return s + (u ? UNITA[u] : '');
}

function sottoMille(n) {
  if (n < 100) return sottoCento(n);
  const c = Math.floor(n / 100), r = n % 100;
  const centinaia = (c > 1 ? UNITA[c] : '') + 'cento';
  const resto = r ? sottoCento(r) : '';
  // 'cento' perde la o davanti a otto/ottanta: centottanta, non centoottanta.
  return (resto.startsWith('o') ? centinaia.slice(0, -1) : centinaia) + resto;
}

export function inLettere(importo) {
  const n = Math.max(0, Math.round((Number(importo) || 0) * 100));
  const euro = Math.floor(n / 100);
  const cent = n % 100;
  let parole;
  if (euro === 0) parole = 'zero';
  else if (euro < 1000) parole = sottoMille(euro);
  else {
    const migliaia = Math.floor(euro / 1000), resto = euro % 1000;
    const testa = migliaia === 1 ? 'mille' : sottoMille(migliaia) + 'mila';
    parole = testa + (resto ? sottoMille(resto) : '');
  }
  return `${parole}/${String(cent).padStart(2, '0')}`;
}
