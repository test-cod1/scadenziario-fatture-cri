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

export function isXmlFatturaElettronica(filename, text) {
  if (!/\.xml(\.p7m)?$/i.test(filename)) return false;
  return /FatturaElettronica/i.test(text.slice(0, 2000));
}

// Ritorna { fornitore, numero_fattura, data_fattura, importo, scadenza, metodo_pagamento, note }
// oppure lancia un errore descrittivo se il documento non è nel formato atteso.
export function parseFatturaXml(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('XML non valido o corrotto.');

  const header = tag(doc, 'FatturaElettronicaHeader');
  const body = tag(doc, 'FatturaElettronicaBody');
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
  const importoStr = datiGen ? txt(datiGen, 'ImportoTotaleDocumento') : '';
  const importo = importoStr ? parseFloat(importoStr) : null;

  // Rate di pagamento: prendo la scadenza più vicina come riferimento principale
  // e riporto le altre (se presenti) in nota, così l'utente sa che il totale
  // è dilazionato e può registrare i pagamenti via via che avvengono.
  const rate = allTags(body, 'DettaglioPagamento').map(d => ({
    scadenza: txt(d, 'DataScadenzaPagamento'),
    importo: parseFloat(txt(d, 'ImportoPagamento') || '0'),
  })).filter(r => r.scadenza || r.importo);
  rate.sort((a, b) => (a.scadenza || '').localeCompare(b.scadenza || ''));

  const scadenza = rate[0]?.scadenza || data_fattura || '';
  const modPagTag = allTags(body, 'ModalitaPagamento')[0];
  const metodo_pagamento = modPagTag ? traduciModalita(modPagTag.textContent.trim()) : '';

  let note = '';
  if (rate.length > 1) {
    note = 'Pagamento in ' + rate.length + ' rate: ' +
      rate.map(r => `${r.scadenza || '?'} (${r.importo.toFixed(2)}€)`).join(', ');
  }

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

function traduciModalita(codice) {
  const map = {
    MP01: 'contanti', MP02: 'assegno', MP03: 'assegno circolare', MP05: 'bonifico',
    MP08: 'carta di pagamento', MP12: 'RIBA', MP19: 'SEPA Direct Debit (RID)',
    MP21: 'SEPA Direct Debit CORE',
  };
  return map[codice] || codice || '';
}
