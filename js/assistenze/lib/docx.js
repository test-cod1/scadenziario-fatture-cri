// ============================================================
//  GENERAZIONE DEL .docx SULLA CARTA INTESTATA
//  Non si costruisce un documento Word da zero: si parte dal modello
//  ufficiale (assets/carta-intestata.dotx), se ne tiene tutto — intestazione,
//  piè di pagina, immagini, stili, margini — e si sostituisce soltanto il
//  corpo con i blocchi del preventivo. Così il risultato è identico a un
//  documento scritto a mano su quella carta, e resta modificabile in Word.
//
//  Un .docx è uno zip di file XML: si riscrive il corpo, si cambia il tipo di
//  contenuto (un .dotx è un "modello", un .docx un "documento": senza questa
//  modifica Word aprirebbe una copia senza nome) e si richiude lo zip.
// ============================================================
import { creaZip } from '../../lib/zip.js';
import { caricaCarta } from './carta.js';
import { costruisciBlocchi, nomeFile } from './documento.js';

const TIPO_MODELLO = 'application/vnd.openxmlformats-officedocument.wordprocessingml.template.main+xml';
const TIPO_DOCUMENTO = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml';
const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const testo = new TextDecoder();
const byte = (s) => new TextEncoder().encode(s);

export async function generaDocx(prev, imp) {
  const carta = await caricaCarta();
  const { blocchi } = costruisciBlocchi(prev, imp);

  const documentoOriginale = testo.decode(carta.file['word/document.xml']);
  const sectPr = (documentoOriginale.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/) || [''])[0];
  const apertura = documentoOriginale.slice(0, documentoOriginale.indexOf('<w:body>') + '<w:body>'.length);

  const corpo = blocchi.map(bloccoXml).join('');
  // Word vuole un paragrafo prima delle proprietà di sezione: se il documento
  // finisse con una tabella, l'ultima riga risulterebbe incollata al piede.
  const documento = `${apertura}${corpo}${paragrafo('', {})}${sectPr}</w:body></w:document>`;

  const contentTypes = testo.decode(carta.file['[Content_Types].xml']).replace(TIPO_MODELLO, TIPO_DOCUMENTO);

  const voci = Object.entries(carta.file).map(([nome, dati]) => {
    if (nome === 'word/document.xml') return { nome, dati: byte(documento) };
    if (nome === '[Content_Types].xml') return { nome, dati: byte(contentTypes) };
    return { nome, dati };
  });

  return { blob: new Blob([creaZip(voci)], { type: MIME_DOCX }), nome: nomeFile(prev, 'docx') };
}

// Scarica il documento generato.
export async function scaricaDocx(prev, imp) {
  const { blob, nome } = await generaDocx(prev, imp);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// ---------------------------------------------------------------
//  Dai blocchi all'XML di Word
// ---------------------------------------------------------------
function bloccoXml(b) {
  if (b.t === 'spazio') return paragrafo('', {});
  if (b.t === 'titolo') return paragrafo(b.testo, { grassetto: true, dimensione: 22, colore: 'A4161A', spazioPrima: 240, spazioDopo: 80, maiuscoletto: true });
  if (b.t === 'p') {
    return paragrafo(b.testo, {
      grassetto: b.grassetto,
      dimensione: b.piccolo ? 18 : 22,
      allineamento: b.allineamento === 'destra' ? 'right' : 'both',
    });
  }
  if (b.t === 'firma') {
    const [ruolo, nome] = [b.righe[0] || '', b.righe[1] || ''];
    // Rientro invece di allineamento a destra: le due righe restano
    // allineate fra loro (com'è nella versione rivista del documento),
    // mentre "a destra" le avrebbe fatte finire a bandiera.
    return paragrafo('', {}) +
      paragrafo(ruolo, { rientro: 5664, spazioDopo: 0, spazioPrima: 240 }) +
      paragrafo(nome, { rientro: 5664, spazioDopo: 0, grassetto: true });
  }
  if (b.t === 'tabella') return tabellaXml(b);
  return '';
}

// Un font solo per tutto il documento, lo stesso della carta intestata
// (intestazione e piè di pagina del modello sono in Arial): dichiararlo su
// ogni testo evita che il corpo prenda il font predefinito del tema — un
// secondo carattere in una pagina che ne usa già uno.
const FONT = 'Arial';

// dimensione in mezzi punti (22 = 11pt), spazi e rientri in ventesimi di
// punto (1440 = 2,54 cm).
function paragrafo(t, { grassetto, dimensione = 22, allineamento, colore, spazioPrima = 0, spazioDopo = 120, maiuscoletto, rientro } = {}) {
  // L'ordine degli elementi dentro <w:pPr> non è libero: lo schema OOXML
  // prescrive spacing, poi ind, poi jc. Word perdona, ma altri programmi che
  // leggono .docx (e i validatori) no.
  const pPr = `<w:pPr>` +
    `<w:spacing w:before="${spazioPrima}" w:after="${spazioDopo}" w:line="259" w:lineRule="auto"/>` +
    (rientro ? `<w:ind w:left="${rientro}"/>` : '') +
    (allineamento ? `<w:jc w:val="${allineamento}"/>` : '') +
    `</w:pPr>`;
  if (!t) return `<w:p>${pPr}</w:p>`;
  const rPr = `<w:rPr>` +
    `<w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}"/>` +
    (grassetto ? '<w:b/>' : '') +
    (maiuscoletto ? '<w:caps/>' : '') +
    (colore ? `<w:color w:val="${colore}"/>` : '') +
    `<w:sz w:val="${dimensione}"/><w:szCs w:val="${dimensione}"/></w:rPr>`;
  return `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${esc(t)}</w:t></w:r></w:p>`;
}

function tabellaXml(b) {
  const colonne = b.intestazioni.length;
  // Larghezze in cinquantesimi di percento (5000 = 100% della pagina).
  const larghezze = b.larghezze && b.larghezze.length === colonne
    ? b.larghezze.map(p => Math.round(p * 50))
    : Array.from({ length: colonne }, () => Math.round(5000 / colonne));

  const bordo = (lato) => `<w:${lato} w:val="single" w:sz="4" w:space="0" w:color="B9C0C6"/>`;
  const tblPr = `<w:tblPr><w:tblW w:w="5000" w:type="pct"/>` +
    `<w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(bordo).join('')}</w:tblBorders>` +
    `<w:tblLayout w:type="fixed"/></w:tblPr>`;
  const grid = `<w:tblGrid>${larghezze.map(w => `<w:gridCol w:w="${Math.round(w * 1.86)}"/>`).join('')}</w:tblGrid>`;

  // Tabella con molte colonne (il calendario quando le voci sono parecchie):
  // corpo più piccolo, come nella stampa, altrimenti le colonne strette
  // spezzano date e orari su due righe.
  const dimensione = b.compatta ? 17 : 20;
  const cella = (contenuto, i, { intestazione, grassetto } = {}) => {
    const jc = b.allineamenti?.[i] === 'dx' ? 'right' : b.allineamenti?.[i] === 'centro' ? 'center' : 'left';
    const sfondo = intestazione ? '<w:shd w:val="clear" w:color="auto" w:fill="F0F2F4"/>' : '';
    return `<w:tc><w:tcPr><w:tcW w:w="${larghezze[i]}" w:type="pct"/>${sfondo}</w:tcPr>` +
      paragrafo(contenuto, { grassetto: intestazione || grassetto, dimensione, allineamento: jc, spazioDopo: 20 }) +
      `</w:tc>`;
  };

  // tblHeader ripete l'intestazione se la tabella si spezza fra due pagine.
  const intestazione = `<w:tr><w:trPr><w:tblHeader/></w:trPr>` +
    b.intestazioni.map((h, i) => cella(h, i, { intestazione: true })).join('') + `</w:tr>`;
  const righe = b.righe.map(r => `<w:tr>${r.map((c, i) => cella(c, i)).join('')}</w:tr>`).join('');
  // Piede: una riga sola col totale, oppure tre quando c'è uno sconto.
  const piede = (b.piede || []).map(p =>
    `<w:tr>${p.celle.map((c, i) => cella(c, i, { grassetto: p.forte })).join('')}</w:tr>`).join('');

  return `<w:tbl>${tblPr}${grid}${intestazione}${righe}${piede}</w:tbl>`;
}
