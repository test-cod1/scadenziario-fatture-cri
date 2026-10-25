// ============================================================
//  Build per Cloudflare Pages: copia in dist/ solo i file del sito.
//  Su Pages la cartella pubblicata deve contenere soltanto ciò che va
//  servito: pubblicando la radice del repo finirebbero scaricabili anche
//  supabase/, test/, README.md e il resto. Cosa escludere lo dice
//  .assetsignore, lo stesso elenco che usa il deploy come Worker, così le
//  due strade pubblicano esattamente gli stessi file.
//
//  Comando di build su Pages: node tools/build-pages.mjs
//  Cartella di output:        dist
//  (functions/ resta nella radice: Pages la cerca lì, non in dist/)
// ============================================================

import { cpSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { impronta, fileAvvio, scriviVersione } from './versione-sw.mjs';

const radice = fileURLToPath(new URL('..', import.meta.url));
const uscita = join(radice, 'dist');

// .assetsignore elenca solo voci di primo livello ("supabase/", "README.md"):
// basta confrontare i nomi, senza interpretare i glob.
const esclusi = new Set(
  readFileSync(join(radice, '.assetsignore'), 'utf8')
    .split(/\r?\n/)
    .map(r => r.trim())
    .filter(r => r && !r.startsWith('#'))
    .map(r => r.replace(/\/$/, '')),
);
esclusi.add('dist');

if (existsSync(uscita)) rmSync(uscita, { recursive: true, force: true });

const copiati = [];
for (const voce of readdirSync(radice)) {
  // Anche i file nascosti restano fuori (.git, .claude, .wrangler...).
  if (voce.startsWith('.') || esclusi.has(voce)) continue;
  cpSync(join(radice, voce), join(uscita, voce), { recursive: true });
  copiati.push(voce);
}

if (!copiati.includes('index.html')) {
  console.error('build-pages: index.html non trovato, niente da pubblicare.');
  process.exit(1);
}
console.log(`build-pages: copiati in dist/ ${copiati.join(', ')}`);

// Service worker con la versione di questo deploy e i file dell'avvio (vedi
// sw.js e tools/versione-sw.mjs). Senza, il sito pubblicato funzionerebbe
// lo stesso, ma in modalità sviluppo: ogni visita ricontrollerebbe ogni file.
const versione = impronta(uscita);
const avvio = fileAvvio(readFileSync(join(uscita, 'index.html'), 'utf8'));
const mancanti = avvio.filter(u => u !== '/' && !existsSync(join(uscita, u)));
if (mancanti.length) {
  console.error(`build-pages: index.html chiede file che non esistono: ${mancanti.join(', ')}`);
  process.exit(1);
}
const sw = join(uscita, 'sw.js');
writeFileSync(sw, scriviVersione(readFileSync(sw, 'utf8'), versione, avvio));
console.log(`build-pages: service worker versione ${versione}, ${avvio.length} file dell'avvio in cache`);
