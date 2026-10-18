// ============================================================
//  Ogni nome importato esiste davvero nel modulo da cui lo si prende.
//
//  Un import di un nome che il modulo non esporta (rinominato, tolto,
//  scritto male) non lo vede nessuna prova che non carichi quel file: nel
//  browser è un SyntaxError che ferma l'intera pagina, o — per gli import()
//  dinamici delle viste — un "undefined is not a function" solo quando
//  qualcuno apre quella pagina. Qui si leggono i sorgenti, senza eseguirli
//  e senza librerie: import statici e dinamici, verso file del progetto,
//  seguendo anche i moduli che riesportano tutto (export * from ...).
// ============================================================
import { gruppo, prova, uguale, RADICE } from './aiuto.mjs';
import fs from 'node:fs';
import path from 'node:path';

function fileJs(dir, out = []) {
  for (const v of fs.readdirSync(path.join(RADICE, dir), { withFileTypes: true })) {
    const rel = path.join(dir, v.name);
    if (v.isDirectory()) { if (v.name !== 'vendor') fileJs(rel, out); }
    else if (/\.m?js$/.test(v.name)) out.push(rel);
  }
  return out;
}

// Solo i commenti che cominciano a inizio riga: un "/*" dentro una stringa
// (accept="image/*") farebbe sparire mezzo file fino al prossimo "*/".
const senzaCommenti = (s) => s.replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, '').replace(/^[ \t]*\/\/.*$/gm, '');

function nomiDaElenco(lista, prendi) {
  return lista.split(',').map(p => prendi(p.trim())).filter(n => n && /^[A-Za-z_$][\w$]*$/.test(n));
}

function esportati(sorgente) {
  const s = senzaCommenti(sorgente);
  const nomi = new Set();
  for (const m of s.matchAll(/export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)) nomi.add(m[1]);
  // export { a, b as c }  e  export { a } from '...'
  for (const m of s.matchAll(/export\s*\{([^{}]*)\}/g)) {
    for (const n of nomiDaElenco(m[1], p => p.split(/\s+as\s+/).pop())) nomi.add(n);
  }
  // export const { a, b: c } = crea(...)
  for (const m of s.matchAll(/export\s+(?:const|let|var)\s*\{([^{}]*)\}/g)) {
    for (const n of nomiDaElenco(m[1], p => p.split(/\s*:\s*/).pop())) nomi.add(n);
  }
  if (/export\s+default\b/.test(s)) nomi.add('default');
  return nomi;
}

function esportatiDa(file, cache, visti = new Set()) {
  if (cache.has(file)) return cache.get(file);
  if (visti.has(file)) return new Set();
  visti.add(file);
  const sorgente = fs.readFileSync(file, 'utf8');
  const nomi = esportati(sorgente);
  for (const m of senzaCommenti(sorgente).matchAll(/export\s*\*\s*from\s*['"]([^'"]+)['"]/g)) {
    for (const n of esportatiDa(path.resolve(path.dirname(file), m[1]), cache, visti)) nomi.add(n);
  }
  cache.set(file, nomi);
  return nomi;
}

function importati(sorgente) {
  const s = senzaCommenti(sorgente);
  const out = [];
  const primo = (p) => p.split(/\s+as\s+|\s*:\s*/)[0];
  for (const m of s.matchAll(/import\s*\{([^{}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    for (const nome of nomiDaElenco(m[1], primo)) out.push({ nome, da: m[2] });
  }
  for (const m of s.matchAll(/(?:const|let|var)\s*\{([^{}]*)\}\s*=\s*await\s+import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    for (const nome of nomiDaElenco(m[1], primo)) out.push({ nome, da: m[2] });
  }
  return out;
}

gruppo('Import fra i moduli');

prova('ogni nome importato è esportato dal modulo indicato', () => {
  const elenco = [...fileJs('js'), ...fileJs('functions'), ...fileJs('tools'), 'sw.js', 'worker.js'];
  const cache = new Map();
  const mancanti = [];
  for (const f of elenco) {
    const assoluto = path.join(RADICE, f);
    for (const { nome, da } of importati(fs.readFileSync(assoluto, 'utf8'))) {
      if (!da.startsWith('.')) continue;                       // node:fs e simili
      const bersaglio = path.resolve(path.dirname(assoluto), da.split('?')[0]);
      if (!fs.existsSync(bersaglio)) { mancanti.push(`${f}: il file ${da} non esiste`); continue; }
      if (bersaglio.includes(`${path.sep}vendor${path.sep}`)) continue;
      if (!esportatiDa(bersaglio, cache).has(nome)) mancanti.push(`${f}: "${nome}" non è esportato da ${da}`);
    }
  }
  uguale(mancanti, [], 'import che nel browser fallirebbero');
});
