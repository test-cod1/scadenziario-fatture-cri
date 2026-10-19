// ============================================================
//  Parser per XML di Fattura Elettronica (formato FatturaPA/SdI)
//  Estrazione deterministica lato client: nessuna chiamata AI, gratis,
//  100% precisa sui campi presenti nel tracciato XML.
// ============================================================

// Legge un tag ignorando l'eventuale prefisso di namespace (es. "p:Numero").
function tag(root, name) {
  const found = root.getElementsByTagNameNS ? root.getElementsByTagNameNS('*', name) : [];
  if (found && found.length) return found[0];
  // fallback per parser che non supportano NS wildcard: cerca per suffisso locale
  const all = root.getElementsByTagName('*');
  for (const n of all) if (n.localName === name || n.tagName === name || n.tagName.endsWith(':' + name)) return n;
  return null;
}
function txt(root, name) {
  const n = tag(root, name);
  return n ? n.textContent.trim() : '';
}
function allTags(root, name) {
  const out = [];
  const all = root.getElementsByTagName('*');
  for (const n of all) if (n.localName === name || n.tagName === name || n.tagName.endsWith(':' + name)) out.push(n);
  return out;
}

export function isFileFatturaElettronica(filename) {
  const n = String(filename || "").toLowerCase();
  return n.endsWith(".xml") || n.endsWith(".p7m");
}

export function isXmlFatturaElettronica(filename, text) {
  if (!isFileFatturaElettronica(filename)) return false;
  return /FatturaElettronica/i.test(text.slice(0, 2000));
}

// Ritorna { fornitore, numero_fattura, data_fattura, importo, scadenza, metodo_pagamento, note,
//          tipo_documento, nota_credito, riferimento }
// oppure lancia un errore descrittivo se il documento non è nel formato atteso.
export function parseFatturaXml(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('XML non valido o corrotto.');

  const header = tag(doc, "FatturaElettronicaHeader");
  const corpi = allTags(doc, "FatturaElettronicaBody");
  const body = corpi[0] || null;
  if (!header || !body) throw new Error('Il file non è una Fattura Elettronica riconoscibile.');

  const cedente = tag(header, 'CedentePrestatore');
  let fornitore = '';
  if (cedente) {
    const anagrafica = tag(cedente, 'Anagrafica');
    if (anagrafica) {
      const denom = txt(anagrafica, 'Denominazione');
      if (denom) fornitore = denom;
      else {
        const nome = txt(anagrafica, 'Nome');
        const cognome = txt(anagrafica, 'Cognome');
        fornitore = [nome, cognome].filter(Boolean).join(' ');
      }
    }
  }

  const partita_iva = identificativoFiscale(cedente);

  const datiGen = tag(body, 'DatiGeneraliDocumento');
  const numero_fattura = datiGen ? txt(datiGen, 'Numero') : '';
  const data_fattura = datiGen ? txt(datiGen, 'Data') : '';

  // Rate di pagamento: prendo la scadenza più vicina come riferimento principale
  // e riporto le altre (se presenti) in nota, così l'utente sa che il totale
  // è dilazionato e può registrare i pagamenti via via che avvengono.
  const rate = allTags(body, 'DettaglioPagamento').map(d => ({
    scadenza: txt(d, 'DataScadenzaPagamento'),
    importo: numero(txt(d, 'ImportoPagamento')) || 0,
  })).filter(r => r.scadenza || r.importo);
  // Le rate senza data in fondo, non in testa. Ordinandole per stringa, la
  // data vuota finiva PRIMA di qualunque data vera: un documento con una rata
  // senza scadenza (il campo e' facoltativo nel tracciato) faceva risultare
  // il documento intero senza scadenza, e salvando la fattura l'app ci
  // applicava lo scadenzario di default — cioe' una data che contraddiceva
  // il documento, senza dirlo a nessuno.
  rate.sort((a, b) => {
    if (!a.scadenza) return 1;
    if (!b.scadenza) return -1;
    return a.scadenza.localeCompare(b.scadenza);
  });

  const fiscali = datiFiscali(body, datiGen, calcolaImporto(body, datiGen, rate), 'pagare');
  const importo = fiscali.importo;

  // Se l'XML non riporta rate di pagamento con scadenza, si lascia vuoto:
  // l'app applica poi lo scadenzario di default configurato in Impostazioni.
  const scadenza = rate[0]?.scadenza || '';
  const modPagTag = allTags(body, 'ModalitaPagamento')[0];
  const metodo_pagamento = modPagTag ? traduciModalita(modPagTag.textContent.trim()) : '';

  const avvisi = [...fiscali.avvisi];
  // Un file può contenere un LOTTO di più fatture (più FatturaElettronicaBody):
  // qui se ne legge una sola, ed è giusto che chi carica lo sappia.
  if (corpi.length > 1) {
    avvisi.push("ATTENZIONE: il file contiene " + corpi.length + " fatture (lotto); qui è stata letta solo la prima.");
  }
  let note = "";
  if (rate.length > 1) {
    note = 'Pagamento in ' + rate.length + ' rate: ' +
      rate.map(r => `${r.scadenza || '?'} (${r.importo.toFixed(2)}€)`).join(', ');
  }

  if (note) avvisi.push(note);
  note = avvisi.join(" ");

  if (!fornitore && !importo) throw new Error('Non sono riuscito a leggere i campi principali dal file XML.');

  return {
    fornitore: fornitore || null,
    partita_iva,
    numero_fattura: numero_fattura || null,
    data_fattura: data_fattura || null,
    importo,
    scadenza: scadenza || null,
    metodo_pagamento: metodo_pagamento || null,
    note: note || null,
    tipo_documento: fiscali.tipo_documento,
    nota_credito: fiscali.nota_credito,
    riferimento: fiscali.riferimento,
    collegate: fiscali.collegate,
  };
}

// Come parseFatturaXml, ma per le fatture ATTIVE (emesse a un cliente): il
// tracciato FatturaPA è lo stesso, cambia solo la parte anagrafica letta —
// qui serve il CessionarioCommittente (l'acquirente, cioè il nostro cliente),
// non il CedentePrestatore (che nelle fatture emesse siamo noi).
// Ritorna { cliente, numero_fattura, data_fattura, importo, metodo_pagamento, note }.
export function parseFatturaAttivaXml(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('XML non valido o corrotto.');

  const header = tag(doc, "FatturaElettronicaHeader");
  const corpi = allTags(doc, "FatturaElettronicaBody");
  const body = corpi[0] || null;
  if (!header || !body) throw new Error('Il file non è una Fattura Elettronica riconoscibile.');

  const cessionario = tag(header, 'CessionarioCommittente');
  let cliente = '';
  if (cessionario) {
    const anagrafica = tag(cessionario, 'Anagrafica');
    if (anagrafica) {
      const denom = txt(anagrafica, 'Denominazione');
      if (denom) cliente = denom;
      else {
        const nome = txt(anagrafica, 'Nome');
        const cognome = txt(anagrafica, 'Cognome');
        cliente = [nome, cognome].filter(Boolean).join(' ');
      }
    }
  }

  const partita_iva = identificativoFiscale(cessionario);

  const datiGen = tag(body, 'DatiGeneraliDocumento');
  const numero_fattura = datiGen ? txt(datiGen, 'Numero') : '';
  const data_fattura = datiGen ? txt(datiGen, 'Data') : '';

  const rate = allTags(body, 'DettaglioPagamento').map(d => ({
    scadenza: txt(d, 'DataScadenzaPagamento'),
    importo: numero(txt(d, 'ImportoPagamento')) || 0,
  })).filter(r => r.scadenza || r.importo);
  // Le rate senza data in fondo, non in testa. Ordinandole per stringa, la
  // data vuota finiva PRIMA di qualunque data vera: un documento con una rata
  // senza scadenza (il campo e' facoltativo nel tracciato) faceva risultare
  // il documento intero senza scadenza, e salvando la fattura l'app ci
  // applicava lo scadenzario di default — cioe' una data che contraddiceva
  // il documento, senza dirlo a nessuno.
  rate.sort((a, b) => {
    if (!a.scadenza) return 1;
    if (!b.scadenza) return -1;
    return a.scadenza.localeCompare(b.scadenza);
  });

  const fiscali = datiFiscali(body, datiGen, calcolaImporto(body, datiGen, rate), 'incassare');
  const importo = fiscali.importo;
  const modPagTag = allTags(body, 'ModalitaPagamento')[0];
  const metodo_pagamento = modPagTag ? traduciModalita(modPagTag.textContent.trim()) : '';

  const avvisi = [...fiscali.avvisi];
  if (corpi.length > 1) {
    avvisi.push("ATTENZIONE: il file contiene " + corpi.length + " fatture (lotto); qui è stata letta solo la prima.");
  }
  let note = "";
  if (rate.length > 1) {
    note = 'Pagamento in ' + rate.length + ' rate: ' +
      rate.map(r => `${r.scadenza || '?'} (${r.importo.toFixed(2)}€)`).join(', ');
  }
  if (note) avvisi.push(note);
  note = avvisi.join(" ");

  if (!cliente && !importo) throw new Error('Non sono riuscito a leggere i campi principali dal file XML.');

  return {
    cliente: cliente || null,
    partita_iva,
    numero_fattura: numero_fattura || null,
    data_fattura: data_fattura || null,
    importo,
    metodo_pagamento: metodo_pagamento || null,
    note: note || null,
    tipo_documento: fiscali.tipo_documento,
    nota_credito: fiscali.nota_credito,
    riferimento: fiscali.riferimento,
    collegate: fiscali.collegate,
  };
}

// Valori ammessi per il metodo di pagamento/incasso, usati sia dalle
// tendine di fattura.js/fatturaAttiva.js sia da traduciModalita() qui sotto:
// un'unica lista, così un nuovo metodo prodotto dal parsing XML non può
// dimenticare di essere aggiunto a una delle due tendine ma non all'altra.
export const METODI = ['', 'bonifico', 'RIBA', 'RID', 'contanti', 'assegno', 'carta', 'altro'];

// I codici del tracciato vengono ricondotti ai soli valori presenti nella
// tendina "Metodo di pagamento": prima si producevano etichette come
// "assegno" o "SEPA Direct Debit (RID)", che non combaciando con nessuna
// opzione venivano scartate in silenzio al momento del salvataggio.
function traduciModalita(codice) {
  const map = {
    MP01: "contanti",
    MP02: "assegno", MP03: "assegno",
    MP05: "bonifico",
    MP08: "carta", MP10: "RID", MP11: "RID",
    MP12: "RIBA",
    MP17: "RID", MP18: "RID", MP19: "RID", MP20: "RID", MP21: "RID",
  };
  if (!codice) return "";
  return map[codice] || "altro";   // qualunque altro codice ricade su "altro"
}

// ------------------------------------------------------------
//  Totale del documento
// ------------------------------------------------------------
//  ImportoTotaleDocumento è FACOLTATIVO nel tracciato FatturaPA e molti
//  fornitori non lo compilano: prima, in quei casi, il campo importo restava
//  vuoto senza alcun ripiego. Si prova quindi, nell'ordine:
//    1. ImportoTotaleDocumento, se presente;
//    2. la somma dei DatiRiepilogo (imponibile + imposta di ogni aliquota),
//       che è il totale ricostruito secondo il tracciato;
//    3. la somma delle rate di pagamento indicate nel documento.
function calcolaImporto(body, datiGen, rate) {
  const dichiarato = datiGen ? numero(txt(datiGen, 'ImportoTotaleDocumento')) : null;
  if (dichiarato) return dichiarato;

  const riepiloghi = allTags(body, 'DatiRiepilogo');
  let totale = 0, conteggiati = 0;
  for (const r of riepiloghi) {
    const imponibile = numero(txt(r, 'ImponibileImporto'));
    const imposta = numero(txt(r, 'Imposta'));
    if (imponibile === null && imposta === null) continue;
    totale += (imponibile || 0) + (imposta || 0);
    conteggiati++;
  }
  if (conteggiati) return arrotonda(totale);

  const daRate = rate.reduce((s, r) => s + (r.importo || 0), 0);
  return daRate > 0 ? arrotonda(daRate) : null;
}

// ------------------------------------------------------------
//  Partita IVA (o codice fiscale) della controparte
// ------------------------------------------------------------
//  Il nome si scrive in mille modi ("ENEL S.P.A.", "Enel SpA"): la partita
//  IVA no. Serve al controllo dei doppioni e a raggruppare il Report per
//  soggetto vero. Si legge IdFiscaleIVA (paese + codice, es. IT01234567890);
//  chi non ce l'ha — un privato, un ente senza P.IVA — ha il codice fiscale.
export function identificativoFiscale(nodo) {
  if (!nodo) return null;
  const iva = tag(nodo, 'IdFiscaleIVA');
  if (iva) {
    const codice = txt(iva, 'IdCodice').replace(/\s+/g, '').toUpperCase();
    if (codice) return (txt(iva, 'IdPaese').trim().toUpperCase() || 'IT') + codice;
  }
  const cf = txt(nodo, 'CodiceFiscale').replace(/\s+/g, '').toUpperCase();
  return cf || null;
}

// ------------------------------------------------------------
//  Tipo di documento, ritenuta d'acconto e split payment
// ------------------------------------------------------------
//  Due cose che prima si ignoravano, e che facevano nascere record sbagliati:
//  - TipoDocumento TD04/TD08 è una NOTA DI CREDITO: registrata come fattura
//    diventava un debito (o un credito) in più, con importo positivo, al posto
//    dello storno che è. Qui la si riconosce, e la vista la manda alla
//    registrazione delle note di credito invece di salvarla come fattura.
//  - La ritenuta d'acconto (DatiRitenuta) e l'IVA in split payment
//    (EsigibilitaIVA = "S") non passano dal fornitore: il totale del documento
//    è il lordo, ma si paga (o si incassa) il netto. Salvando il lordo la
//    fattura restava per sempre "pagata parziale", con un residuo che nessuno
//    deve. L'importo proposto è quindi quello dovuto, e la nota dice da dove
//    viene, col totale del documento.
const TIPI_NOTA_CREDITO = new Set(['TD04', 'TD08']);

function datiFiscali(body, datiGen, totale, verbo) {
  const tipo_documento = datiGen ? txt(datiGen, 'TipoDocumento') : '';
  const nota_credito = TIPI_NOTA_CREDITO.has(tipo_documento);
  // Le fatture che il documento dichiara di stornare: una nota di credito può
  // riferirsi a più fatture (un blocco DatiFattureCollegate per ognuna).
  const collegate = allTags(body, 'DatiFattureCollegate')
    .map(c => ({ numero: txt(c, 'IdDocumento'), data: txt(c, 'Data') || null }))
    .filter(c => c.numero);
  const riferimento = collegate.map(c => c.numero).join(', ');

  const ritenuta = arrotonda((datiGen ? allTags(datiGen, 'DatiRitenuta') : [])
    .reduce((s, r) => s + (numero(txt(r, 'ImportoRitenuta')) || 0), 0));
  const ivaSplit = arrotonda(allTags(body, 'DatiRiepilogo')
    .filter(r => txt(r, 'EsigibilitaIVA').toUpperCase() === 'S')
    .reduce((s, r) => s + (numero(txt(r, 'Imposta')) || 0), 0));

  let importo = totale;
  const avvisi = [];
  if (totale && (ritenuta > 0 || ivaSplit > 0)) {
    const dovuto = arrotonda(totale - ritenuta - ivaSplit);
    if (dovuto > 0) {
      importo = dovuto;
      const voci = [];
      if (ritenuta > 0) voci.push(`ritenuta d'acconto ${ritenuta.toFixed(2)}€`);
      if (ivaSplit > 0) voci.push(`IVA in split payment ${ivaSplit.toFixed(2)}€`);
      avvisi.push(`Totale documento ${totale.toFixed(2)}€, meno ${voci.join(' e ')}: importo da ${verbo} ${dovuto.toFixed(2)}€.`);
    }
  }
  return { tipo_documento: tipo_documento || null, nota_credito, riferimento: riferimento || null, collegate, importo, avvisi };
}

// Nel tracciato FatturaPA i decimali usano il punto, ma qualche gestionale
// esporta la virgola: la accettiamo comunque invece di restituire NaN.
function numero(s) {
  const n = parseFloat(String(s == null ? '' : s).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function arrotonda(n) { return Math.round(n * 100) / 100; }

// ------------------------------------------------------------
//  Lettura del file: XML in chiaro oppure busta di firma .p7m
// ------------------------------------------------------------
//  Le fatture scaricate dal cassetto fiscale sono quasi sempre firmate
//  digitalmente (.xml.p7m): un contenitore PKCS#7/CAdES binario, o la sua
//  versione codificata in base64, che racchiude il documento XML. Prima veniva
//  letto con file.text() e si cercava la stringa "FatturaElettronica" nei
//  primi 2000 caratteri di dati binari: falliva sempre.
//
//  Qui NON si verifica la firma (non è lo scopo di questa app: il documento
//  ufficiale resta quello firmato, conservato altrove); si estrae soltanto il
//  documento XML incapsulato, che nella busta è presente in chiaro.
export async function leggiXmlFattura(file) {
  const buf = new Uint8Array(await file.arrayBuffer());

  const diretto = xmlDaBytes(buf);
  if (diretto) return diretto;

  // Alcune buste sono trasmesse codificate in base64 anziché in DER binario.
  const ascii = new TextDecoder("latin1").decode(buf).replace(/[^A-Za-z0-9+/=]/g, "");
  if (ascii.length > 32 && /^[A-Za-z0-9+/]+={0,2}$/.test(ascii)) {
    try {
      const bin = atob(ascii);
      const bytes = new Uint8Array(bin.length);
      for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
      const dentro = xmlDaBytes(bytes);
      if (dentro) return dentro;
    } catch { /* non era base64 valido: si prosegue con la segnalazione sotto */ }
  }

  if (String(file.name || "").toLowerCase().endsWith(".p7m")) {
    throw new Error("Non sono riuscito a estrarre la fattura dal file firmato (.p7m).");
  }
  return new TextDecoder("utf-8").decode(buf);
}

// Ritaglia il documento XML dai byte grezzi: da inizio dichiarazione
// (o del tag radice) fino alla chiusura di FatturaElettronica.
function xmlDaBytes(bytes) {
  const CHIUSURA = "FatturaElettronica>";
  const fineTag = ultimaOccorrenza(bytes, CHIUSURA);
  if (fineTag < 0) return null;
  const fine = fineTag + CHIUSURA.length;

  let inizio = primaOccorrenza(bytes, "<?xml");
  if (inizio < 0) {
    // Documento senza dichiarazione XML: si risale al "<" che apre il tag radice.
    const radice = primaOccorrenza(bytes, "FatturaElettronica");
    if (radice < 0) return null;
    for (inizio = radice; inizio >= 0 && bytes[inizio] !== 0x3c; inizio--);
  }
  if (inizio < 0 || fine <= inizio) return null;
  return new TextDecoder("utf-8").decode(bytes.subarray(inizio, fine));
}

function primaOccorrenza(bytes, testo) {
  const p = ascii(testo);
  for (let i = 0; i <= bytes.length - p.length; i++) if (combacia(bytes, i, p)) return i;
  return -1;
}
function ultimaOccorrenza(bytes, testo) {
  const p = ascii(testo);
  for (let i = bytes.length - p.length; i >= 0; i--) if (combacia(bytes, i, p)) return i;
  return -1;
}
function combacia(bytes, da, p) {
  for (let j = 0; j < p.length; j++) if (bytes[da + j] !== p[j]) return false;
  return true;
}
function ascii(testo) {
  const out = new Uint8Array(testo.length);
  for (let i = 0; i < testo.length; i++) out[i] = testo.charCodeAt(i);
  return out;
}
