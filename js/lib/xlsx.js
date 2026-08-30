// Generatore minimale di file .xlsx (Office Open XML), senza librerie esterne.
//
// Perché non il solito CSV: aprendolo in Excel è quest'ultimo a indovinare il
// tipo di ogni cella dal testo, e spesso sbaglia — un numero di fattura lungo
// diventa notazione scientifica (2,52E+08), le date restano stringhe non
// riconosciute come tali e la colonna troppo stretta mostra "####". Scrivendo
// qui il tipo di ogni cella in modo esplicito (testo/numero/data) il problema
// sparisce alla radice, senza bisogno che l'utente sistemi nulla a mano.
//
// Un .xlsx è uno zip contenente pochi file XML: qui lo zip viene composto a
// mano con voci "stored" (senza compressione) per evitare di dover
// reimplementare deflate — per poche centinaia di righe di fatture il file
// risultante resta comunque piccolo.

function tabellaCrc32() {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
}
const CRC_TABELLA = tabellaCrc32();
function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABELLA[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

const u8 = s => new TextEncoder().encode(s);
function scriviU16(arr, v) { arr.push(v & 0xFF, (v >>> 8) & 0xFF); }
function scriviU32(arr, v) { arr.push(v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF); }

function creaZip(file) {
  const locali = [], centrali = [];
  let offset = 0;
  for (const { nome, dati } of file) {
    const nomeBytes = u8(nome);
    const crc = crc32(dati);
    const header = [];
    scriviU32(header, 0x04034b50);
    scriviU16(header, 20); scriviU16(header, 0); scriviU16(header, 0); // versione, flag, metodo (0=stored)
    scriviU16(header, 0); scriviU16(header, 0x21);                    // ora/data modifica (1/1/1980, valore fisso)
    scriviU32(header, crc);
    scriviU32(header, dati.length); scriviU32(header, dati.length);
    scriviU16(header, nomeBytes.length); scriviU16(header, 0);
    const locale = new Uint8Array(header.length + nomeBytes.length + dati.length);
    locale.set(header, 0); locale.set(nomeBytes, header.length); locale.set(dati, header.length + nomeBytes.length);
    locali.push(locale);

    const cd = [];
    scriviU32(cd, 0x02014b50);
    scriviU16(cd, 20); scriviU16(cd, 20); scriviU16(cd, 0); scriviU16(cd, 0);
    scriviU16(cd, 0); scriviU16(cd, 0x21);
    scriviU32(cd, crc);
    scriviU32(cd, dati.length); scriviU32(cd, dati.length);
    scriviU16(cd, nomeBytes.length); scriviU16(cd, 0); scriviU16(cd, 0);
    scriviU16(cd, 0); scriviU16(cd, 0);
    scriviU32(cd, 0);
    scriviU32(cd, offset);
    const centrale = new Uint8Array(cd.length + nomeBytes.length);
    centrale.set(cd, 0); centrale.set(nomeBytes, cd.length);
    centrali.push(centrale);

    offset += locale.length;
  }
  const dimCentrale = centrali.reduce((s, b) => s + b.length, 0);
  const fine = [];
  scriviU32(fine, 0x06054b50);
  scriviU16(fine, 0); scriviU16(fine, 0);
  scriviU16(fine, file.length); scriviU16(fine, file.length);
  scriviU32(fine, dimCentrale);
  scriviU32(fine, offset);
  scriviU16(fine, 0);

  const out = new Uint8Array(offset + dimCentrale + fine.length);
  let p = 0;
  for (const b of locali) { out.set(b, p); p += b.length; }
  for (const b of centrali) { out.set(b, p); p += b.length; }
  out.set(new Uint8Array(fine), p);
  return out;
}

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

// Stili applicati per indice (cellXfs): 0 generale, 1 valuta (due decimali),
// 2 data (dd/mm/yyyy), 3 intestazione in grassetto. Il formato valuta usa il
// codice "#,##0.00": è Excel stesso, in base alla lingua del sistema, a
// scegliere virgola o punto come separatore — coerente con quanto l'utente
// vede già nell'app.
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.00"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/></numFmts>
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

// colonne: [{ header, tipo: 'testo'|'valuta'|'data', get: riga => valore }]
function costruisciFoglio(colonne, righe) {
  const larghezze = colonne.map(c => {
    let max = String(c.header).length;
    for (const r of righe) {
      const v = c.get(r);
      const testo = c.tipo === 'data' ? '' : String(v ?? '');
      if (testo.length > max) max = testo.length;
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
