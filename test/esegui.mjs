// ============================================================
//  Esegue tutte le prove: `npm test`.
//  Trova da sé i file test/*.prove.mjs, li importa (ognuno registra le sue
//  prove chiamando `prova(...)`) e le esegue in fila, stampando cosa passa e
//  cosa no. Esce con codice 1 se qualcosa fallisce, così un domani serve
//  anche a un controllo automatico prima del deploy.
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { registro, RADICE } from './aiuto.mjs';

const CARTELLA = path.join(RADICE, 'test');
const file = fs.readdirSync(CARTELLA).filter(f => f.endsWith('.prove.mjs')).sort();

for (const f of file) await import(pathToFileURL(path.join(CARTELLA, f)).href);

let passate = 0;
const fallite = [];
let gruppoStampato = '';

for (const p of registro) {
  if (p.gruppo !== gruppoStampato) {
    gruppoStampato = p.gruppo;
    console.log(`\n  ${gruppoStampato}`);
  }
  try {
    await p.fn();
    passate++;
    console.log(`    ✓ ${p.nome}`);
  } catch (e) {
    fallite.push({ ...p, errore: e });
    console.log(`    ✗ ${p.nome}`);
    console.log(`        ${e.message}`);
  }
}

console.log(`\n${passate} prove passate su ${registro.length}` +
  (fallite.length ? `, ${fallite.length} FALLITE` : '') + `  (${file.length} file)\n`);

if (fallite.length) {
  for (const f of fallite) {
    if (!(f.errore?.message) || f.errore.stack?.includes('at ')) {
      // Per un errore inatteso (non una differenza di valore) la traccia dice
      // dove è successo: senza, si sa solo che qualcosa è andato storto.
      console.log(`— ${f.gruppo} › ${f.nome}\n${f.errore.stack || f.errore}\n`);
    }
  }
  process.exit(1);
}
