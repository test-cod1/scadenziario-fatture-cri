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

// Ritorna { fornitore, numero_fattura, data_fattura, importo, scadenza, metodo_pagamento, note }
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
  rate.sort((a, b) => (a.scadenza || '').localeCompare(b.scadenza || ''));

  const importo = calcolaImporto(body, datiGen, rate);

  const scadenza = rate[0]?.scadenza || data_fattura || '';
  const modPagTag = allTags(body, 'ModalitaPagamento')[0];
  const metodo_pagamento = modPagTag ? traduciModalita(modPagTag.textContent.trim()) : '';

  const avvisi = [];
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
    numero_fattura: numero_fattura || null,
    data_fattura: data_fattura || null,
    importo,
    scadenza: scadenza || null,
    metodo_pagamento: metodo_pagamento || null,
    note: note || null,
  };
}

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
