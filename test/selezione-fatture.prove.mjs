// Totale delle fatture spuntate nello scadenziario (js/lib/selezioneFatture.js):
// è la cifra del bonifico unico, quindi deve essere giusta al centesimo.
import { gruppo, prova, uguale, RADICE } from './aiuto.mjs';
import { pathToFileURL } from 'node:url';

const { selezionabile, totaleSelezione, potaSelezione } =
  await import(pathToFileURL(RADICE + '/js/lib/selezioneFatture.js').href);

gruppo('Somma delle fatture selezionate');

prova('somma il residuo, non l’importo: gli acconti già versati non si pagano due volte', () => {
  const t = totaleSelezione([
    { importo: 1000, _residuo: 600 },   // acconto di 400 già pagato
    { importo: 250.5, _residuo: 250.5 },
  ]);
  uguale(t.n, 2);
  uguale(t.residuo, 850.5);
  uguale(t.importo, 1250.5);
  uguale(t.giaVersato, 400);
});

prova('nessun errore di arrotondamento (0,10 + 0,20 = 0,30)', () => {
  const t = totaleSelezione([{ importo: 0.1, _residuo: 0.1 }, { importo: 0.2, _residuo: 0.2 }]);
  uguale(t.residuo, 0.3);
  uguale(t.giaVersato, 0);
});

prova('nessuna fattura scelta: totale zero', () => {
  uguale(totaleSelezione([]), { n: 0, residuo: 0, importo: 0, giaVersato: 0 });
});

prova('si spuntano solo le fatture con ancora qualcosa da pagare', () => {
  uguale(selezionabile({ stato: 'da_pagare', _residuo: 10 }), true);
  uguale(selezionabile({ stato: 'pagata_parziale', _residuo: 5 }), true);
  uguale(selezionabile({ stato: 'pagata', _residuo: 0 }), false);
  uguale(selezionabile({ stato: 'stornata', _residuo: 0 }), false);
  uguale(selezionabile({ stato: 'da_pagare', _residuo: 0 }), false);
});

prova('dopo una ricarica restano scelte solo le fatture ancora da pagare', () => {
  const ids = new Set([1, 2, 3]);
  potaSelezione(ids, [
    { id: 1, stato: 'da_pagare', _residuo: 100 },
    { id: 2, stato: 'pagata', _residuo: 0 },   // appena pagata
    // la 3 non c'è più
  ]);
  uguale([...ids], [1]);
});
