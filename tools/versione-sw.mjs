// ============================================================
//  Versione del service worker per il sito pubblicato.
//  Usato da tools/build-pages.mjs (e dalle prove): calcola un'impronta del
//  contenuto di dist/ e la scrive in dist/sw.js insieme all'elenco dei
//  file dell'avvio da mettere in cache all'installazione. Vedi il commento
//  in cima a sw.js per il perché.
// ============================================================

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

// Impronta di tutti i file di `cartella` (percorsi e contenuti), esclusa
// sw.js: è il file in cui l'impronta va scritta.
export function impronta(cartella) {
  const hash = createHash('sha256');
  const visita = (dir) => {
    for (const voce of readdirSync(dir).sort()) {
      const pieno = join(dir, voce);
      if (statSync(pieno).isDirectory()) { visita(pieno); continue; }
      const rel = relative(cartella, pieno).split(sep).join('/');
      if (rel === 'sw.js') continue;
      hash.update(rel).update('\0').update(readFileSync(pieno)).update('\0');
    }
  };
  visita(cartella);
  return hash.digest('hex').slice(0, 12);
}

// File dell'avvio: quelli che index.html richiede da sé (foglio di stile,
// script, pre-caricamenti, manifest, icone). È lo stesso elenco che già
// deve tenere aggiornato per i <link rel="modulepreload">, quindi non ce n'è
// un secondo da ricordarsi. Le viste delle sezioni restano fuori: finiscono
// nella cache della versione la prima volta che si aprono.
export function fileAvvio(indiceHtml) {
  const trovati = [...indiceHtml.matchAll(/\s(?:href|src)="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((u) => !/^(?:[a-z]+:|\/\/|#)/i.test(u))   // niente data:, https:, ancore
    .map((u) => '/' + u.replace(/^\.?\//, ''));
  return [...new Set(['/', ...trovati])];
}

// Sostituisce i segnaposto di sw.js. Se uno dei due manca vuol dire che
// sw.js è cambiato senza aggiornare questo file: meglio fermare la build
// che pubblicare un service worker in modalità sviluppo senza accorgersene.
export function scriviVersione(sorgenteSw, versione, elenco) {
  if (!sorgenteSw.includes("'__VERSIONE__'") || !sorgenteSw.includes('[/* __PRECACHE__ */]')) {
    throw new Error('sw.js: segnaposto __VERSIONE__ o __PRECACHE__ non trovato');
  }
  return sorgenteSw
    .replace("'__VERSIONE__'", JSON.stringify(versione))
    .replace('[/* __PRECACHE__ */]', JSON.stringify(elenco));
}
