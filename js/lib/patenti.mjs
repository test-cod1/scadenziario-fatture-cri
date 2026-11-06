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

// `civile`: da quale patente civile si fa la conversione (Testo Unico
// CRI, art. 51 e allegati C-1 e C-2). La 5 non si converte: si ottiene con
// corso ed esame.
export const PATENTI = [
  { numero: 1, percorso: 'diretta', civile: 'da patente AM' },
  { numero: 2, percorso: 'diretta', civile: 'da patente A2 o A' },
  { numero: 3, percorso: 'diretta', civile: 'da patente B' },
  { numero: 4, percorso: 'pratica', civile: 'da patente B' },
  { numero: 5, percorso: 'esame', civile: 'serve corso con esame' },
  { numero: 6, percorso: 'pratica', civile: 'da patente C1 o C' },
  { numero: 7, percorso: 'pratica', civile: 'da patente D' },
  { numero: 8, percorso: 'pratica', civile: 'da patente C1E, CE o DE' },
];

export function patente(numero) {
  return PATENTI.find(p => p.numero === Number(numero)) || null;
}

export function percorsoDi(numero) {
  const p = patente(numero);
  return p ? PERCORSI[p.percorso] : null;
}

// Che cosa chiede il volontario: una patente che non ha ancora, o il
// rinnovo di una che ha già. Per il rinnovo non c'è conversione: serve la
// visita medica di conferma della validità (TU artt. 60 e 61).
export const TIPI_RICHIESTA = [
  { id: 'nuova', etichetta: 'Ottieni nuova patente CRI', breve: 'Nuova patente' },
  { id: 'rinnovo', etichetta: 'Rinnova patente CRI', breve: 'Rinnovo' },
];

export function tipoRichiesta(id) {
  return TIPI_RICHIESTA.find(t => t.id === id) || null;
}

// Test dei riflessi: chi ottiene o rinnova la patente 5 o una superiore
// (6, 7, 8) deve farlo, prenotandolo al Comitato Regionale Liguria. Il
// modulo glielo dice in un passaggio apposito, da confermare prima
// dell'invio.
export const TEST_RIFLESSI = {
  telefono: '010 256992',
  telefonoLink: '+39010256992',
  sogliaMinima: 4,         // ogni valore cerchiato deve essere almeno questo
};

export function servonoRiflessi(numero) {
  return Number(numero) >= 5;
}

// Il testo del passaggio finale per chi rinnova (segnaposto, come quelli
// dei percorsi).
export const RINNOVO = {
  etichetta: 'Rinnovo',
  breve: 'Serve la visita medica di conferma della validità.',
  spiegazione: '',
};

// Documenti che il volontario deve aver caricato su Gaia. Il modulo glieli
// chiede uno per uno (Sì / No): con tutti Sì la richiesta parte normale,
// con almeno un No può chiedere supporto alla segreteria.
export const DOCUMENTI_GAIA = [
  { id: 'fototessera', domanda: 'Hai caricato su Gaia una <b>fototessera formale</b>?', breve: 'fototessera formale' },
  { id: 'patente_civile', domanda: 'Hai caricato su Gaia la <b>scansione fronte e retro della patente civile</b>?', breve: 'patente civile, fronte e retro' },
  { id: 'carta_identita', domanda: 'Hai caricato su Gaia la <b>scansione fronte e retro della carta d\'identità</b>?', breve: 'carta d\'identità, fronte e retro' },
];

// Per il rinnovo serve in più la foto della patente CRI in scadenza (o già
// scaduta), mandata per email. Si chiede come gli altri documenti, e si
// salva nella stessa colonna (documenti_gaia) con il suo id.
export const EMAIL_FOTO_PATENTE = 'jacopo.ravaioli@liguria.cri.it';
export const FOTO_PATENTE_CRI = {
  id: 'foto_patente_cri',
  domanda: `Hai inviato la <b>foto della patente CRI in scadenza o scaduta</b> a
    <a href="mailto:${EMAIL_FOTO_PATENTE}">${EMAIL_FOTO_PATENTE}</a>?`,
  breve: 'foto della patente CRI in scadenza o scaduta (via email)',
};

// I documenti chiesti per quel tipo di richiesta.
export function documentiRichiesti(tipo) {
  return tipo === 'rinnovo' ? [...DOCUMENTI_GAIA, FOTO_PATENTE_CRI] : DOCUMENTI_GAIA;
}

// I documenti che mancano a una richiesta salvata (quelli non confermati).
// Le richieste arrivate prima che il modulo chiedesse il tipo (tipo null)
// si leggono con i soli documenti su Gaia, gli unici che chiedeva allora.
export function documentiMancanti(caricati, tipo) {
  return documentiRichiesti(tipo).filter(d => !(caricati || []).includes(d.id));
}

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
  const tipo = tipoRichiesta(g.tipo)?.id || '';
  const richiesti = documentiRichiesti(tipo);
  const dati = {
    nome: pulisci(g.nome),
    cognome: pulisci(g.cognome),
    tipo,
    patente: Number(g.patente),
    documenti_gaia: richiesti.filter(d => g.documenti_gaia?.[d.id] === true).map(d => d.id),
  };
  const errori = {};
  if (!dati.nome) errori.nome = 'Scrivi il tuo nome.';
  if (!dati.cognome) errori.cognome = 'Scrivi il tuo cognome.';
  if (!dati.tipo) errori.tipo = 'Scegli se vuoi rinnovare la patente o ottenerne una nuova.';
  const p = patente(dati.patente);
  if (!p) errori.patente = 'Scegli la patente che richiedi.';
  else dati.percorso = p.percorso;
  // Senza tutti i documenti si può solo chiedere supporto, e chiedere
  // supporto ha senso solo se ne manca almeno uno. Il supporto non ha una
  // colonna sua: una richiesta salvata con documenti mancanti È una
  // richiesta di supporto.
  const completi = dati.documenti_gaia.length === richiesti.length;
  if (g.supporto === true) {
    if (completi) errori.documenti_gaia = 'Hai confermato tutti i documenti: invia la richiesta normalmente.';
  } else if (!completi) {
    errori.documenti_gaia = 'Conferma tutti i documenti, oppure chiedi supporto.';
  }
  return { ok: !Object.keys(errori).length, errori, dati };
}
