// ============================================================
//  CARTA INTESTATA
//  Il file assets/carta-intestata.dotx è il modello Word ufficiale del
//  Comitato. Da lì si prende TUTTO: le immagini e i testi di intestazione e
//  piè di pagina per il PDF, e il modello stesso per generare il .docx.
//
//  Perché leggerlo invece di ricopiarne i contenuti nel codice: se un domani
//  cambia l'indirizzo, il RUNTS o il logo, basta sostituire quel file e sia
//  il Word sia il PDF cambiano insieme, senza toccare una riga.
// ============================================================
import { leggiZip } from '../../lib/zip.js';

const PERCORSO = '/assets/carta-intestata.dotx';

let _carta = null;

export async function caricaCarta() {
  if (_carta) return _carta;
  const res = await fetch(PERCORSO);
  if (!res.ok) throw new Error(`Carta intestata non trovata (${res.status}).`);
  const file = await leggiZip(await res.arrayBuffer());

  const righePiede = righeTesto(file, 'word/footer1.xml');
  _carta = {
    file,
    // Intestazione: le due righe del nome dell'ente (il logo le ripete in
    // rosso al suo interno, ma la carta ufficiale le ha entrambe).
    intestazione: righeTesto(file, 'word/header1.xml'),
    // Piè di pagina: i dati dell'ente vanno a destra, l'indirizzo del sito a
    // sinistra sopra il logo — come nella carta ufficiale, dove il sito è
    // l'unica riga che sta da quel lato.
    piede: righePiede.filter(r => !/^www\./i.test(r)),
    sito: righePiede.find(r => /crigenova/i.test(r)) || 'www.crigenova.it',
    logo: dataUri(file['word/media/image2.jpg'], 'image/jpeg'),
    logoPiede: dataUri(file['word/media/image3.png'], 'image/png'),
  };
  return _carta;
}

// Testo dei paragrafi di un pezzo del documento Word: si leggono solo i nodi
// <w:t> (il testo vero), altrimenti finirebbero nel risultato anche i numeri
// interni dei disegni. Le righe ripetute si scartano: nel piè di pagina
// "www.cri.it" compare più volte perché è sia scritta sia parte di un
// riquadro.
function righeTesto(file, nome) {
  const xml = new TextDecoder().decode(file[nome] || new Uint8Array());
  const righe = xml.split(/<w:p[ >]/).slice(1).map(par =>
    [...par.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map(m => m[1]).join('').trim()
  ).filter(Boolean);
  return [...new Set(righe)];
}

// Le immagini finiscono nel PDF come data: URI (la CSP del sito le consente):
// così la finestra di stampa è autosufficiente e non dipende da URL temporanei
// che potrebbero essere già stati liberati quando parte la stampa.
function dataUri(bytes, tipo) {
  if (!bytes) return '';
  let binario = '';
  const blocco = 0x8000;   // a pezzi: String.fromCharCode con 100.000 argomenti supera lo stack
  for (let i = 0; i < bytes.length; i += blocco) {
    binario += String.fromCharCode(...bytes.subarray(i, i + blocco));
  }
  return `data:${tipo};base64,${btoa(binario)}`;
}
