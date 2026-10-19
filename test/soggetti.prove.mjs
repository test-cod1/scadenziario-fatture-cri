// ============================================================
//  Lo stesso fornitore scritto in modi diversi (js/lib/soggetti.js):
//  il Report deve contarlo una volta sola quando la partita IVA lo dice,
//  senza fondere soggetti diversi che per caso si chiamano uguale.
// ============================================================
import { gruppo, prova, uguale } from './aiuto.mjs';
import { raggruppaPerSoggetto } from '../js/lib/soggetti.js';

gruppo('Soggetti (partita IVA)');

const riassunto = (gruppi) => gruppi
  .map(g => `${g.nome}|${g.partita_iva || '-'}|${g.righe.length}`)
  .sort();

prova('grafie diverse con la stessa partita IVA fanno un gruppo solo', () => {
  const g = raggruppaPerSoggetto([
    { fornitore: 'ENEL S.P.A.', partita_iva: 'IT06655971007', data_fattura: '2026-01-10' },
    { fornitore: 'Enel SpA', partita_iva: 'IT06655971007', data_fattura: '2026-02-10' },
    { fornitore: 'Enel SpA', partita_iva: 'IT06655971007', data_fattura: '2026-03-10' },
  ], 'fornitore');
  uguale(riassunto(g), ['Enel SpA|IT06655971007|3']);
});

prova('una fattura vecchia senza partita IVA si unisce al gruppo del suo nome', () => {
  const g = raggruppaPerSoggetto([
    { fornitore: 'Enel SpA', partita_iva: 'IT06655971007', data_fattura: '2026-02-10' },
    { fornitore: 'enel  spa', partita_iva: null, data_fattura: '2025-02-10' },
  ], 'fornitore');
  uguale(riassunto(g), ['Enel SpA|IT06655971007|2']);
});

prova('stesso nome ma partite IVA diverse restano separati', () => {
  const g = raggruppaPerSoggetto([
    { cliente: 'Comune', partita_iva: 'IT00856930102', data_fattura: '2026-01-01' },
    { cliente: 'Comune', partita_iva: 'IT00000000001', data_fattura: '2026-01-02' },
  ], 'cliente');
  uguale(g.length, 2);
});

prova('senza partite IVA si raggruppa per nome come prima', () => {
  const g = raggruppaPerSoggetto([
    { fornitore: 'Rossi', data_fattura: '2026-01-01' },
    { fornitore: 'Rossi', data_fattura: '2026-01-02' },
    { fornitore: 'Bianchi', data_fattura: '2026-01-03' },
  ], 'fornitore');
  uguale(riassunto(g), ['Bianchi|-|1', 'Rossi|-|2']);
});

// ---------- Abbinamento delle note di credito ----------
const { abbinaNotaCredito } = await import('../js/lib/soggetti.js');

const ARCHIVIO = [
  { id: 'a', fornitore: 'Enel SpA', partita_iva: 'IT06655971007', numero_fattura: '12/2026', data_fattura: '2026-03-01', _residuo: 500, stato: 'da_pagare' },
  { id: 'b', fornitore: 'Rossi srl', partita_iva: 'IT01111111111', numero_fattura: '12/2026', data_fattura: '2026-03-02', _residuo: 80, stato: 'da_pagare' },
  { id: 'c', fornitore: 'Enel SpA', partita_iva: 'IT06655971007', numero_fattura: '13/2026', data_fattura: '2026-04-01', _residuo: 100, stato: 'da_pagare' },
  { id: 'd', fornitore: 'enel spa', partita_iva: null, numero_fattura: '14', data_fattura: '2026-05-01', _residuo: 0, stato: 'pagata' },
];
const abbina = (x) => abbinaNotaCredito({ fatture: ARCHIVIO, campoNome: 'fornitore', nome: 'ENEL S.P.A.', partita_iva: 'IT06655971007', ...x });

prova('nota di credito: stesso numero di un altro fornitore non basta', () => {
  const r = abbina({ collegate: [{ numero: '12-2026' }], importo: 120 });
  uguale(r.abbinate.map(a => [a.fattura.id, a.importo]), [['a', 120]], 'separatori diversi, stesso numero; Rossi resta fuori');
});

prova('nota di credito: senza partita IVA sulla fattura decide il nome', () => {
  const r = abbinaNotaCredito({ fatture: ARCHIVIO, campoNome: 'fornitore', nome: 'Enel  SpA', partita_iva: 'IT06655971007', collegate: [{ numero: '14' }], importo: 30 });
  uguale(r.abbinate.map(a => a.fattura.id), ['d']);
});

prova('nota di credito su più fatture: a ognuna il suo residuo, il resto all\'ultima', () => {
  const r = abbina({ collegate: [{ numero: '12/2026' }, { numero: '13/2026' }], importo: 650 });
  uguale(r.abbinate.map(a => [a.fattura.id, a.importo]), [['a', 500], ['c', 150]]);
});

prova('nota di credito: fattura non trovata o ambigua, non si sceglie da sola', () => {
  uguale(abbina({ collegate: [{ numero: '99' }], importo: 10 }).mancanti, ['99']);
  const doppie = [...ARCHIVIO, { ...ARCHIVIO[0], id: 'a2', data_fattura: '2026-03-09' }];
  const r = abbinaNotaCredito({ fatture: doppie, campoNome: 'fornitore', nome: 'Enel', partita_iva: 'IT06655971007', collegate: [{ numero: '12/2026' }], importo: 10 });
  uguale(r.ambigue, ['12/2026'], 'due fatture uguali senza data per distinguerle');
  const conData = abbinaNotaCredito({ fatture: doppie, campoNome: 'fornitore', nome: 'Enel', partita_iva: 'IT06655971007', collegate: [{ numero: '12/2026', data: '2026-03-09' }], importo: 10 });
  uguale(conData.abbinate.map(a => a.fattura.id), ['a2'], 'la data scioglie il dubbio');
});

prova('nota di credito su più fatture, una non trovata: il resto non si assegna', () => {
  const r = abbina({ collegate: [{ numero: '12/2026' }, { numero: '77/2026' }], importo: 600 });
  uguale(r.abbinate.map(a => [a.fattura.id, a.importo]), [['a', 500]], 'solo fino al residuo della fattura trovata');
  uguale(r.mancanti, ['77/2026']);
});
