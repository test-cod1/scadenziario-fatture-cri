// ============================================================
//  PATENTI CRI — dati comuni
//  Le otto patenti e il percorso che ciascuna richiede partendo dalla
//  patente civile. Lo usano il modulo pubblico per i volontari
//  (patenti.html) e la sezione Patenti del portale: un elenco solo, così
//  quello che il volontario legge e quello che vede la segreteria non
//  possono andare ognuno per conto suo.
// ============================================================

// Percorsi di conversione. Il testo esteso della procedura (cosa succede
// dopo l'invio) va in `spiegazione`: per ora è un segnaposto.
export const PERCORSI = {
  diretta: {
    etichetta: 'Conversione diretta',
    breve: 'Nessuna prova da sostenere.',
    spiegazione: '',
  },
  pratica: {
    etichetta: 'Conversione con prova pratica',
    breve: 'È prevista una prova pratica di guida.',
    spiegazione: '',
  },
  esame: {
    etichetta: 'Conversione con esame',
    breve: 'È previsto un esame.',
    spiegazione: '',
  },
};

export const PATENTI = [
  { numero: 1, percorso: 'diretta' },
  { numero: 2, percorso: 'diretta' },
  { numero: 3, percorso: 'diretta' },
  { numero: 4, percorso: 'pratica' },
  { numero: 5, percorso: 'esame' },
  { numero: 6, percorso: 'pratica' },
  { numero: 7, percorso: 'pratica' },
  { numero: 8, percorso: 'pratica' },
];

export function patente(numero) {
  return PATENTI.find(p => p.numero === Number(numero)) || null;
}

export function percorsoDi(numero) {
  const p = patente(numero);
  return p ? PERCORSI[p.percorso] : null;
}

// Documenti che il volontario deve aver caricato su Gaia prima di andare
// avanti: vanno spuntati tutti.
export const DOCUMENTI_GAIA = [
  { id: 'fototessera', testo: 'Ho inserito su Gaia una <b>fototessera formale</b>.' },
  { id: 'patente_civile', testo: 'Ho inserito su Gaia la <b>scansione fronte e retro della patente civile</b>.' },
  { id: 'carta_identita', testo: 'Ho inserito su Gaia la <b>scansione fronte e retro della carta d\'identità</b>.' },
];

// Stati di una richiesta, per la segreteria.
export const STATI = [
  ['nuova', 'Nuova'],
  ['in_lavorazione', 'In lavorazione'],
  ['completata', 'Completata'],
];

// Le regole dell'invio: le applica il modulo per dire subito cosa
// correggere, e le riapplica il server (/api/patenti), che è l'unico a
// decidere. Si salvano solo i campi previsti, ripuliti e con un tetto di
// lunghezza.
const pulisci = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);

export function controllaRichiesta(grezzi) {
  const g = grezzi && typeof grezzi === 'object' ? grezzi : {};
  const dati = {
    nome: pulisci(g.nome),
    cognome: pulisci(g.cognome),
    patente: Number(g.patente),
    documenti_gaia: DOCUMENTI_GAIA.filter(d => g.documenti_gaia?.[d.id] === true).map(d => d.id),
  };
  const errori = {};
  if (!dati.nome) errori.nome = 'Scrivi il tuo nome.';
  if (!dati.cognome) errori.cognome = 'Scrivi il tuo cognome.';
  const p = patente(dati.patente);
  if (!p) errori.patente = 'Scegli la patente che richiedi.';
  else dati.percorso = p.percorso;
  if (dati.documenti_gaia.length !== DOCUMENTI_GAIA.length) errori.documenti_gaia = 'Conferma di aver inserito su Gaia tutti i documenti.';
  return { ok: !Object.keys(errori).length, errori, dati };
}
