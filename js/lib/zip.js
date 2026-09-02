// ============================================================
//  ZIP minimale: scrittura e lettura, senza librerie esterne.
//
//  Serve perché i formati Office (.xlsx, .docx, .dotx) sono zip di file XML:
//  l'export Excel lo scrive (js/lib/xlsx.js), il preventivo delle assistenze
//  sanitarie legge la carta intestata .dotx e ne riscrive una copia come
//  documento Word (js/assistenze/lib/carta.js).
//
//  In scrittura le voci sono "stored", cioè senza compressione: evita di
//  reimplementare deflate e per questi file (poche pagine di testo, più le
//  immagini della carta intestata, che sono già compresse di loro) la
//  differenza di dimensione non si nota. In lettura invece la compressione va
//  gestita, perché i file prodotti da Word sono deflated: lo fa il browser
//  con DecompressionStream, senza dipendenze.
// ============================================================

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

export function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABELLA[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

const u8 = s => new TextEncoder().encode(s);
function scriviU16(arr, v) { arr.push(v & 0xFF, (v >>> 8) & 0xFF); }
function scriviU32(arr, v) { arr.push(v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF); }

// file: [{ nome, dati: Uint8Array }] → Uint8Array dello zip
export function creaZip(file) {
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

async function inflateRaw(dati) {
  const stream = new Blob([dati]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Legge uno zip e restituisce { 'percorso/file': Uint8Array, … }.
// Si parte dalla "central directory" in fondo al file, che è l'indice
// autorevole delle voci: scorrere gli header locali dall'inizio funziona solo
// finché nessuno di essi usa i campi rimandati in coda al dato.
export async function leggiZip(buffer) {
  const b = new Uint8Array(buffer);
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let fine = b.length - 22;
  while (fine >= 0 && dv.getUint32(fine, true) !== 0x06054b50) fine--;
  if (fine < 0) throw new Error('Archivio non valido: manca la fine dello zip.');

  const quanti = dv.getUint16(fine + 10, true);
  let p = dv.getUint32(fine + 16, true);
  const out = {};
  for (let k = 0; k < quanti; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('Archivio non valido: indice illeggibile.');
    const metodo = dv.getUint16(p + 10, true);
    const dimCompressa = dv.getUint32(p + 20, true);
    const lunNome = dv.getUint16(p + 28, true);
    const lunExtra = dv.getUint16(p + 30, true);
    const lunCommento = dv.getUint16(p + 32, true);
    const offsetLocale = dv.getUint32(p + 42, true);
    const nome = new TextDecoder().decode(b.subarray(p + 46, p + 46 + lunNome));

    // L'header locale ripete nome ed extra, che possono avere lunghezze
    // diverse da quelle dell'indice: il dato inizia dopo di essi.
    const lunNomeLoc = dv.getUint16(offsetLocale + 26, true);
    const lunExtraLoc = dv.getUint16(offsetLocale + 28, true);
    const inizio = offsetLocale + 30 + lunNomeLoc + lunExtraLoc;
    const grezzo = b.subarray(inizio, inizio + dimCompressa);
    out[nome] = metodo === 8 ? await inflateRaw(grezzo) : new Uint8Array(grezzo);

    p += 46 + lunNome + lunExtra + lunCommento;
  }
  return out;
}
