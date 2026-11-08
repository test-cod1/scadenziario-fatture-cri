// ============================================================
//  DATI DI FATTURAZIONE CHIESTI AL CLIENTE
//  Il modulo che il cliente compila dal link allegato al preventivo, e le
//  regole con cui lo si controlla. Sta in un file solo, importato sia dalla
//  pagina pubblica (dati-fatturazione.html) sia dal server
//  (functions/api/dati-fatturazione.js): il browser controlla per
//  cortesia, mentre ciò che finisce nel database lo decide il server, con
//  le stesse identiche regole — due copie divergerebbero al primo ritocco.
//
//  Tre tipi di cliente, perché la fattura elettronica chiede cose diverse:
//   - azienda (o associazione con partita IVA): P.IVA, e codice
//     destinatario SDI oppure PEC;
//   - ente pubblico: codice univoco ufficio (6 caratteri, da IndicePA), e
//     spesso CIG, CUP, split payment e il riferimento della determina;
//   - privato: codice fiscale, senza codice destinatario (la fattura arriva
//     nel cassetto fiscale).
// ============================================================

export const TIPI = [
  ['azienda', 'Azienda, associazione o professionista con partita IVA'],
  ['ente_pubblico', 'Ente pubblico (fattura alla Pubblica Amministrazione)'],
  ['privato', 'Persona fisica o ente senza partita IVA'],
];

// Lunghezza massima di ogni campo: un modulo pubblico non deve poter
// scrivere un romanzo nel database.
const MAX = 200;
const MAX_NOTE = 1000;

export const CAMPI = [
  'tipo', 'ragione_sociale', 'partita_iva', 'codice_fiscale',
  'indirizzo', 'cap', 'comune', 'provincia', 'nazione',
  'codice_destinatario', 'pec', 'email_amministrazione',
  'referente', 'telefono',
  'cig', 'cup', 'split_payment', 'riferimento_ordine',
  'note', 'privacy',
];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Controllo della partita IVA italiana: undici cifre, l'ultima di controllo.
export function partitaIvaValida(v) {
  const s = String(v || '').replace(/\s/g, '');
  if (!/^\d{11}$/.test(s)) return false;
  let somma = 0;
  for (let i = 0; i < 10; i++) {
    let c = Number(s[i]);
    if (i % 2 === 1) { c *= 2; if (c > 9) c -= 9; }
    somma += c;
  }
  return (10 - (somma % 10)) % 10 === Number(s[10]);
}

// Codice fiscale di persona fisica (16 caratteri, con il carattere di
// controllo) oppure numerico di 11 cifre, quello delle associazioni e degli
// enti — che ha la stessa regola della partita IVA.
const DISPARI = {
  0: 1, 1: 0, 2: 5, 3: 7, 4: 9, 5: 13, 6: 15, 7: 17, 8: 19, 9: 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18,
  N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
};
export function codiceFiscaleValido(v) {
  const s = String(v || '').replace(/\s/g, '').toUpperCase();
  if (/^\d{11}$/.test(s)) return partitaIvaValida(s);
  if (!/^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/.test(s)) return false;
  let somma = 0;
  for (let i = 0; i < 15; i++) {
    const c = s[i];
    if (i % 2 === 0) somma += DISPARI[c];
    else somma += /\d/.test(c) ? Number(c) : c.charCodeAt(0) - 65;
  }
  return String.fromCharCode(65 + (somma % 26)) === s[15];
}

const testo = (v, max = MAX) => String(v ?? '').trim().slice(0, max);

// Restituisce { ok, errori: {campo: messaggio}, dati } — `dati` è la
// versione ripulita (spazi tolti, maiuscole dove servono, campi estranei
// scartati): è quella, e solo quella, che si salva.
export function controllaDati(grezzi) {
  const g = grezzi && typeof grezzi === 'object' ? grezzi : {};
  const tipo = TIPI.some(([t]) => t === g.tipo) ? g.tipo : 'azienda';
  const d = {
    tipo,
    ragione_sociale: testo(g.ragione_sociale),
    partita_iva: testo(g.partita_iva).replace(/\s/g, '').replace(/^IT/i, ''),
    codice_fiscale: testo(g.codice_fiscale).replace(/\s/g, '').toUpperCase(),
    indirizzo: testo(g.indirizzo),
    cap: testo(g.cap).replace(/\s/g, ''),
    comune: testo(g.comune),
    provincia: testo(g.provincia).toUpperCase(),
    nazione: testo(g.nazione).toUpperCase() || 'IT',
    codice_destinatario: testo(g.codice_destinatario).replace(/\s/g, '').toUpperCase(),
    pec: testo(g.pec).toLowerCase(),
    email_amministrazione: testo(g.email_amministrazione).toLowerCase(),
    referente: testo(g.referente),
    telefono: testo(g.telefono),
    cig: testo(g.cig).replace(/\s/g, '').toUpperCase(),
    cup: testo(g.cup).replace(/\s/g, '').toUpperCase(),
    split_payment: g.split_payment === true || g.split_payment === 'true' || g.split_payment === 'on',
    riferimento_ordine: testo(g.riferimento_ordine),
    note: testo(g.note, MAX_NOTE),
    privacy: g.privacy === true || g.privacy === 'true' || g.privacy === 'on',
  };
  const e = {};
  const italia = d.nazione === 'IT';

  if (!d.ragione_sociale) e.ragione_sociale = tipo === 'privato' ? 'Indica nome e cognome.' : 'Indica la denominazione.';

  if (tipo === 'azienda') {
    if (!d.partita_iva) e.partita_iva = 'La partita IVA è obbligatoria.';
    else if (italia && !partitaIvaValida(d.partita_iva)) e.partita_iva = 'La partita IVA non è valida: controlla le 11 cifre.';
  } else if (tipo === 'ente_pubblico') {
    if (d.partita_iva && !partitaIvaValida(d.partita_iva)) e.partita_iva = 'La partita IVA non è valida: controlla le 11 cifre.';
    if (!d.partita_iva && !d.codice_fiscale) e.codice_fiscale = 'Indica il codice fiscale dell\'ente.';
  } else if (!d.codice_fiscale) {
    e.codice_fiscale = 'Il codice fiscale è obbligatorio.';
  }
  if (d.codice_fiscale && italia && !codiceFiscaleValido(d.codice_fiscale)) e.codice_fiscale = 'Il codice fiscale non è valido.';

  if (!d.indirizzo) e.indirizzo = 'Indica via e numero civico.';
  if (!d.comune) e.comune = 'Indica il comune.';
  if (italia) {
    if (!/^\d{5}$/.test(d.cap)) e.cap = 'Il CAP è di 5 cifre.';
    if (!/^[A-Z]{2}$/.test(d.provincia)) e.provincia = 'La provincia è la sigla di 2 lettere (es. GE).';
  }

  // Il recapito della fattura elettronica.
  if (tipo === 'ente_pubblico') {
    if (!/^[A-Z0-9]{6}$/.test(d.codice_destinatario)) e.codice_destinatario = 'Il codice univoco ufficio della PA è di 6 caratteri (lo trovi su IndicePA).';
  } else if (tipo === 'azienda') {
    const codiceVero = /^[A-Z0-9]{7}$/.test(d.codice_destinatario) && d.codice_destinatario !== '0000000';
    if (d.codice_destinatario && !/^[A-Z0-9]{7}$/.test(d.codice_destinatario)) e.codice_destinatario = 'Il codice destinatario è di 7 caratteri.';
    else if (!codiceVero && !d.pec) e.pec = 'Indica il codice destinatario oppure la PEC.';
  }
  if (d.pec && !EMAIL.test(d.pec)) e.pec = 'La PEC non sembra un indirizzo valido.';
  if (d.email_amministrazione && !EMAIL.test(d.email_amministrazione)) e.email_amministrazione = 'L\'email non sembra un indirizzo valido.';
  if (d.cig && !/^[A-Z0-9]{10}$/.test(d.cig)) e.cig = 'Il CIG è di 10 caratteri.';
  if (d.cup && !/^[A-Z0-9]{15}$/.test(d.cup)) e.cup = 'Il CUP è di 15 caratteri.';

  if (!d.privacy) e.privacy = 'Serve il consenso al trattamento dei dati per l\'emissione della fattura.';

  // I campi della PA non hanno senso per gli altri: non si salvano.
  if (tipo !== 'ente_pubblico') { d.cig = ''; d.cup = ''; d.split_payment = false; }
  if (tipo === 'privato') { d.partita_iva = ''; d.codice_destinatario = ''; }

  return { ok: Object.keys(e).length === 0, errori: e, dati: d };
}

// Il codice nel link: 32 byte casuali in base64url, 43 caratteri. Non si
// indovina e non si deduce da niente (né dal preventivo né dalla data).
export const FORMA_TOKEN = /^[A-Za-z0-9_-]{43}$/;

export function nuovoToken() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Il riassunto di una riga, per l'editor e per la richiesta di fattura.
export function riassunto(d) {
  if (!d) return '';
  return [
    d.ragione_sociale,
    d.partita_iva ? `P.IVA ${d.partita_iva}` : '',
    d.codice_fiscale && d.codice_fiscale !== d.partita_iva ? `C.F. ${d.codice_fiscale}` : '',
    [d.indirizzo, [d.cap, d.comune, d.provincia ? `(${d.provincia})` : ''].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    d.codice_destinatario ? `${d.tipo === 'ente_pubblico' ? 'Codice ufficio' : 'Cod. destinatario'} ${d.codice_destinatario}` : '',
    d.pec ? `PEC ${d.pec}` : '',
  ].filter(Boolean).join(' · ');
}

// La frase che porta il link nel documento del preventivo (PDF e Word),
// prima dei saluti. Il link si scrive per intero: nel PDF stampato e nel
// Word deve potersi anche ricopiare a mano.
export function fraseLinkFatturazione(url) {
  return `Per l'emissione della fattura Vi chiediamo di comunicarci i dati di fatturazione compilando il modulo a questo indirizzo: ${url}`;
}
