// Una guardia sul codice sorgente, non sul comportamento.
//
// I campi che contengono decimali non devono essere `<input type="number">`:
// il browser scarta quello che non riconosce, e incollando «1.234,56» il
// campo resta vuoto (provato: succede anche su Chrome in italiano). Dove la
// lettura era `Number(v) || 0` diventava zero in silenzio; dove era parseEuro,
// l'app rispondeva "indica un importo valido" su una cifra scritta a schermo.
//
// Restano legittimamente numerici solo i campi che contengono INTERI: lì la
// virgola non c'entra e le frecce su/giù del browser fanno comodo. Sono
// elencati qui sotto uno per uno: se ne compare uno nuovo, questa prova
// fallisce e chi l'ha aggiunto deve decidere consapevolmente in quale dei due
// gruppi sta.
import { gruppo, prova, uguale, RADICE } from './aiuto.mjs';
import fs from 'node:fs';
import path from 'node:path';

// campi interi ammessi: file → identificatori (id, data-*, class)
const INTERI_AMMESSI = {
  'js/assistenze/views/preventivo.js': ['data-tutti', 'data-voce'],       // quantità per turno
  'js/formazione/views/preventivo.js': ['data-k="discenti"'],             // numero di persone
  'js/trasporti/views/preventivo.js': ['id="persone"', 'id="pastiPersona"', 'id="notti"', 'id="camere"'],
  'js/views/impostazioni.js': ['id="giorni"'],                            // giorni di scadenza
};

function fileJs(dir, out = []) {
  for (const v of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, v.name);
    if (v.isDirectory()) { if (v.name !== 'vendor') fileJs(p, out); }
    else if (v.name.endsWith('.js')) out.push(p);
  }
  return out;
}

gruppo('Campi con i decimali');

prova('nessun campo numerico fuori dall\'elenco degli interi', () => {
  const inattesi = [];
  for (const percorso of fileJs(path.join(RADICE, 'js'))) {
    const relativo = path.relative(RADICE, percorso).replace(/\\/g, '/');
    const righe = fs.readFileSync(percorso, 'utf8').split(/\r?\n/);
    righe.forEach((riga, i) => {
      if (!riga.includes('type="number"')) return;
      if (riga.trimStart().startsWith('//')) return;           // è un commento che ne parla
      const ammessi = INTERI_AMMESSI[relativo] || [];
      if (ammessi.some(a => riga.includes(a))) return;
      inattesi.push(`${relativo}:${i + 1}`);
    });
  }
  uguale(inattesi, [], 'campi numerici non dichiarati come interi');
});

prova('nessuno cerca più un campo importo come input[type=number]', () => {
  const colpevoli = [];
  for (const percorso of fileJs(path.join(RADICE, 'js'))) {
    const src = fs.readFileSync(percorso, 'utf8');
    if (src.includes('input[type=number]')) colpevoli.push(path.relative(RADICE, percorso).replace(/\\/g, '/'));
  }
  uguale(colpevoli, [], 'selettori rimasti indietro dopo la conversione');
});
