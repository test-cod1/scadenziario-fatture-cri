// Generatore minimale di file .xlsx (Office Open XML), senza librerie esterne.
//
// Perché non il solito CSV: aprendolo in Excel è quest'ultimo a indovinare il
// tipo di ogni cella dal testo, e spesso sbaglia — un numero di fattura lungo
// diventa notazione scientifica (2,52E+08), le date restano stringhe non
// riconosciute come tali e la colonna troppo stretta mostra "####". Scrivendo
// qui il tipo di ogni cella in modo esplicito (testo/numero/data) il problema
// sparisce alla radice, senza bisogno che l'utente sistemi nulla a mano.
//
// Un .xlsx è uno zip contenente pochi file XML: lo compone js/lib/zip.js, che
// scrive voci "stored" (senza compressione) per evitare di dover
// reimplementare deflate — per poche centinaia di righe di fatture il file
// risultante resta comunque piccolo.

import { creaZip } from './zip.js';

// Testo -> byte, che è la forma in cui creaZip vuole il contenuto dei file.
// Questo helper è rimasto indietro quando lo zip è stato spostato in zip.js:
// là dentro `u8` c'è ma è privato del modulo (non esportato), e qui le sei
// chiamate in buildXlsxBlob continuavano a usarlo come se fosse ancora in
// questo file. Risultato: "u8 is not defined" alla prima riga di
// buildXlsxBlob, cioè l'export Excel non produceva NIENTE — né per le fatture
// passive né per le attive — e la dashboard mostrava soltanto un messaggio di
// errore tecnico. Come in docx.js, l'helper resta locale al file che lo usa.
const u8 = (s) => new TextEncoder().encode(s);

function escXml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function letteraColonna(i) {
  let s = ''; i++;
  while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); }
  return s;
}

// Seriale data in stile Excel: giorni dal 1899-12-30 (l'epoca "sbagliata" di
// Excel, che replica di proposito un bug storico di Lotus 1-2-3). Corretto per
// qualunque data dal 1900 in poi, quindi per tutte le date di fatture reali.
function serialeData(iso) {
  if (!iso) return null;
  const d = new Date(iso + 'T00:00:00Z');
  if (isNaN(d)) return null;
  return Math.round((d.getTime() - Date.UTC(1899, 11, 30)) / 86400000);
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

const RELS_ROOT = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

const WORKBOOK = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Foglio1" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

// Stili applicati per indice (cellXfs): 0 generale, 1 valuta (formato
// Contabilità, simbolo Euro allineato a destra e trattino per lo zero), 2
// data (dd/mm/yyyy), 3 intestazione in grassetto. I separatori (virgola o
// punto) restano scelti da Excel in base alla lingua del sistema, coerenti
// con quanto l'utente vede già nell'app.
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="_-* #,##0.00\\ &quot;€&quot;_-;-* #,##0.00\\ &quot;€&quot;_-;_-* &quot;-&quot;??\\ &quot;€&quot;_-;_-@_-"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="4">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
</styleSheet>`;

// Stima quanto sarà largo il contenuto UNA VOLTA FORMATTATO dalla cella, non
// il valore grezzo: una data ISO "2026-08-30" (10 caratteri) è larga uguale
// una volta scritta "30/08/2026", ma un importo come 17150 diventa "17.150,00
// €" (11 caratteri) — usare la lunghezza del numero grezzo lascerebbe la
// colonna troppo stretta e Excel la mostrerebbe come "####" o tronca il
// simbolo, esattamente il difetto da evitare.
function stimaLarghezza(c, valore) {
  if (c.tipo === 'data') return 10; // "31/12/2026"
  if (c.tipo === 'numero') return String(valore ?? '').length + 1;   // "-12,25"
  if (c.tipo === 'valuta') {
    const n = Number(valore);
    if (!Number.isFinite(n)) return 0;
    const cifreIntere = Math.max(1, Math.trunc(Math.abs(n)).toString().length);
    const separatoriMigliaia = Math.floor((cifreIntere - 1) / 3);
    return cifreIntere + separatoriMigliaia + 3 /* ",00" */ + 2 /* spazio+simbolo € */ + (n < 0 ? 1 : 0);
  }
  return String(valore ?? '').length;
}

// colonne: [{ header, tipo: 'testo'|'numero'|'valuta'|'data', get: riga => valore }]
function costruisciFoglio(colonne, righe) {
  const larghezze = colonne.map(c => {
    let max = String(c.header).length;
    for (const r of righe) {
      const len = stimaLarghezza(c, c.get(r));
      if (len > max) max = len;
    }
    return Math.min(40, Math.max(9, max + 2));
  });
  let xml = '<cols>' + larghezze.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('') + '</cols>';
  xml += '<sheetData>';
  xml += '<row r="1">' + colonne.map((c, i) => `<c r="${letteraColonna(i)}1" t="inlineStr" s="3"><is><t>${escXml(String(c.header))}</t></is></c>`).join('') + '</row>';
  righe.forEach((r, ri) => {
    const numRiga = ri + 2;
    xml += `<row r="${numRiga}">` + colonne.map((c, ci) => {
      const rif = letteraColonna(ci) + numRiga;
      const raw = c.get(r);
      if (raw === null || raw === undefined || raw === '') return '';
      if (c.tipo === 'valuta') {
        const n = Number(raw);
        return Number.isFinite(n) ? `<c r="${rif}" s="1"><v>${n}</v></c>` : '';
      }
      // Numero semplice, senza formato valuta: le ore di straordinario, che
      // in Excel devono restare sommabili (e con il loro segno) ma non sono
      // euro. Scritte come testo, la somma in fondo alla colonna darebbe zero.
      if (c.tipo === 'numero') {
        const n = Number(raw);
        return Number.isFinite(n) ? `<c r="${rif}"><v>${n}</v></c>` : '';
      }
      if (c.tipo === 'data') {
        const s = serialeData(raw);
        return s === null ? '' : `<c r="${rif}" s="2"><v>${s}</v></c>`;
      }
      return `<c r="${rif}" t="inlineStr"><is><t>${escXml(String(raw))}</t></is></c>`;
    }).join('') + '</row>';
  });
  xml += '</sheetData>';
  return xml;
}

export function buildXlsxBlob(colonne, righe) {
  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${costruisciFoglio(colonne, righe)}</worksheet>`;
  const file = [
    { nome: '[Content_Types].xml', dati: u8(CONTENT_TYPES) },
    { nome: '_rels/.rels', dati: u8(RELS_ROOT) },
    { nome: 'xl/workbook.xml', dati: u8(WORKBOOK) },
    { nome: 'xl/_rels/workbook.xml.rels', dati: u8(WORKBOOK_RELS) },
    { nome: 'xl/styles.xml', dati: u8(STYLES) },
    { nome: 'xl/worksheets/sheet1.xml', dati: u8(sheetXml) },
  ];
  return new Blob([creaZip(file)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
