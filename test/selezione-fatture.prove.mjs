// Totale delle fatture spuntate nello scadenziario (js/lib/selezioneFatture.js):
// è la cifra del bonifico unico, quindi deve essere giusta al centesimo.
import { gruppo, prova, uguale, RADICE } from './aiuto.mjs';
import { pathToFileURL } from 'node:url';

const { selezionabile, totaleSelezione, potaSelezione, preparaPagamentoUnico, notaPagamentoUnico } =
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

gruppo('Pagamento unico di più fatture');

const scelte = [
  { id: 1, fornitore: 'A', stato: 'da_pagare', importo: 100, _residuo: 100 },
  { id: 2, fornitore: 'A', stato: 'da_pagare', importo: 200, _residuo: 200 },
  { id: 3, fornitore: 'A', stato: 'pagata_parziale', importo: 300, _residuo: 150 },
];

prova('niente di cambiato: si paga il residuo di ciascuna', () => {
  const fresche = new Map(scelte.map(f => [f.id, { ...f }]));
  const p = preparaPagamentoUnico(scelte, fresche);
  uguale(p.daPagare.map(r => [r.fattura.id, r.importo]), [[1, 100], [2, 200], [3, 150]]);
  uguale(p.cambiate, []);
  uguale(p.saldate, []);
  uguale(p.totale, 450);
});

prova('una fattura pagata nel frattempo esce, una con un acconto nuovo paga il residuo attuale', () => {
  const fresche = new Map([
    [1, { ...scelte[0], stato: 'pagata', _residuo: 0 }],
    [2, { ...scelte[1], stato: 'pagata_parziale', _residuo: 50 }],
    [3, { ...scelte[2] }],
  ]);
  const p = preparaPagamentoUnico(scelte, fresche);
  uguale(p.saldate.map(f => f.id), [1]);
  uguale(p.cambiate.map(c => [c.fattura.id, c.prima, c.ora]), [[2, 200, 50]]);
  uguale(p.daPagare.map(r => [r.fattura.id, r.importo]), [[2, 50], [3, 150]]);
  uguale(p.totale, 200);
});

prova('se la rilettura non riesce si usa il residuo che si ha', () => {
  const p = preparaPagamentoUnico(scelte, new Map());
  uguale(p.totale, 450);
  uguale(p.cambiate, []);
});

prova('la nota dice che il pagamento fa parte di un bonifico unico', () => {
  uguale(notaPagamentoUnico(4, 3082.5), 'Pagamento unico di 4 fatture, totale 3082,50 €');
  uguale(notaPagamentoUnico(2, 10, 'CRO 123'), 'Pagamento unico di 2 fatture, totale 10,00 € — CRO 123');
});
