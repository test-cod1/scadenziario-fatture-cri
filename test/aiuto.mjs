// ============================================================
//  Le poche cose che servono per scrivere una prova.
//  Niente librerie: il progetto non ha dipendenze e non è il caso di
//  aggiungerne una per fare dei confronti. Ogni file di prova chiama
//  `prova('cosa deve fare', () => { … })` e dentro usa gli aiuti qui sotto;
//  `test/esegui.mjs` li raccoglie tutti e stampa il risultato.
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Le prove registrate, nell'ordine in cui sono state scritte.
export const registro = [];
let gruppoCorrente = '';

export function gruppo(nome) { gruppoCorrente = nome; }
export function prova(nome, fn) { registro.push({ gruppo: gruppoCorrente, nome, fn }); }

class Fallita extends Error {}

export function uguale(ottenuto, atteso, cosa = '') {
  const a = JSON.stringify(ottenuto);
  const b = JSON.stringify(atteso);
  if (a !== b) throw new Fallita(`${cosa ? cosa + ': ' : ''}atteso ${b}, ottenuto ${a}`);
}

// Confronto fra numeri con una tolleranza: i totali passano da divisioni e
// arrotondamenti, e pretendere l'uguaglianza esatta dei binari sarebbe una
// prova che fallisce per motivi che non interessano a nessuno.
export function circa(ottenuto, atteso, tolleranza = 0.005, cosa = '') {
  if (!Number.isFinite(ottenuto) || Math.abs(ottenuto - atteso) > tolleranza) {
    throw new Fallita(`${cosa ? cosa + ': ' : ''}atteso ~${atteso}, ottenuto ${ottenuto}`);
  }
}

export function vero(condizione, cosa = 'condizione non verificata') {
  if (!condizione) throw new Fallita(cosa);
}

export function falso(condizione, cosa = 'condizione verificata quando non doveva') {
  if (condizione) throw new Fallita(cosa);
}

// ------------------------------------------------------------------
//  Un pezzo di browser, quel tanto che basta
//  I moduli che generano i documenti leggono la carta intestata con
//  fetch('/assets/…') e trasformano le immagini in base64 con btoa: qui si
//  serve il file dal disco e si presta un btoa. Nessun DOM: le funzioni
//  provate costruiscono testo, non pagine.
// ------------------------------------------------------------------
export function preparaAmbienteDocumenti() {
  globalThis.fetch = async (url) => {
    const file = path.join(RADICE, String(url).replace(/^\//, ''));
    if (!fs.existsSync(file)) return { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) };
    const buf = fs.readFileSync(file);
    return {
      ok: true, status: 200,
      arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    };
  };
  globalThis.btoa = (s) => Buffer.from(s, 'latin1').toString('base64');
}

// Il testo di un documento generato, senza i tag: serve a verificare che una
// certa frase ci sia (o non ci sia) senza dipendere da come è impaginata.
export function soloTesto(html) {
  return String(html)
    .replace(/<[^>]*>/g, ' ')
    // Le entità vanno riportate al carattere vero, altrimenti cercare una
    // frase con un apostrofo non la trova mai: nell'HTML è scritta &#39;.
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');
}
