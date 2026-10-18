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
