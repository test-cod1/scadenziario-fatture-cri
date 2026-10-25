// ============================================================
//  Ogni file JavaScript del sito si deve almeno poter leggere.
//
//  Le altre prove importano solo i moduli che provano: un errore di
//  sintassi in un file che nessuna prova carica (js/app.js, una vista, una
//  function) passava inosservato fino al browser — e in app.js vuol dire
//  il portale che non parte per nessuno. È successo il 27/09/2026, durante
//  una modifica, con una barra rovesciata persa in un'espressione regolare.
// ============================================================
import { gruppo, prova, uguale, RADICE } from './aiuto.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function fileJs(dir) {
  const out = [];
  for (const voce of fs.readdirSync(path.join(RADICE, dir), { withFileTypes: true })) {
    const rel = path.join(dir, voce.name);
    if (voce.isDirectory()) { if (voce.name !== 'vendor') out.push(...fileJs(rel)); }
    else if (/\.m?js$/.test(voce.name)) out.push(rel);
  }
  return out;
}

gruppo('Sintassi dei file');

prova('tutti i file JavaScript del sito, delle function e degli strumenti si leggono', () => {
  const elenco = [...fileJs('js'), ...fileJs('functions'), ...fileJs('tools'), 'sw.js', 'worker.js', 'server.js'];
  const rotti = [];
  for (const f of elenco) {
    const esito = spawnSync(process.execPath, ['--check', path.join(RADICE, f)], { encoding: 'utf8' });
    if (esito.status !== 0) rotti.push(`${f}: ${(esito.stderr.match(/SyntaxError[^\n]*/) || ['errore'])[0]}`);
  }
  uguale(rotti.join(' | '), '', 'file con errori di sintassi');
});
