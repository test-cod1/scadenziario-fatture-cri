// ============================================================
//  Sezione Scadenze (js/scadenze/calc.js): le date delle ricorrenze, lo
//  stato con il preavviso, l'ordine dell'elenco.
// ============================================================
import { gruppo, prova, uguale } from './aiuto.mjs';
import { prossimaData, stato, etichetta, ordina, totali, successiva, giorniA } from '../js/scadenze/calc.js';

gruppo('Scadenze');

prova('la scadenza successiva tiene il giorno, o l\'ultimo del mese se non c\'è', () => {
  uguale(prossimaData('2026-01-31', 'mensile'), '2026-02-28');
  uguale(prossimaData('2028-01-31', 'mensile'), '2028-02-29', 'anno bisestile');
  uguale(prossimaData('2026-11-15', 'trimestrale'), '2027-02-15', 'cambio d\'anno');
  uguale(prossimaData('2028-02-29', 'annuale'), '2029-02-28');
  uguale(prossimaData('2026-10-19', 'quinquennale'), '2031-10-19');
  uguale(prossimaData('2026-10-19', 'nessuna'), null);
});

prova('lo stato tiene conto del preavviso', () => {
  const oggi = '2026-10-19';
  uguale(stato({ data_scadenza: '2026-10-18', preavviso_giorni: 30 }, oggi), 'scaduta');
  uguale(stato({ data_scadenza: '2026-10-19', preavviso_giorni: 30 }, oggi), 'oggi');
  uguale(stato({ data_scadenza: '2026-11-10', preavviso_giorni: 30 }, oggi), 'preavviso');
  uguale(stato({ data_scadenza: '2026-11-10', preavviso_giorni: 7 }, oggi), 'futura');
  uguale(stato({ data_scadenza: '2026-10-01', fatta: true }, oggi), 'fatta');
  uguale(etichetta({ data_scadenza: '2026-10-16', preavviso_giorni: 0 }, oggi).testo, 'scaduta da 3 giorni');
});

prova('giorni a una data senza farsi ingannare dall\'ora legale', () => {
  uguale(giorniA('2026-10-26', '2026-10-24'), 2, 'a cavallo del cambio d\'ora di ottobre');
});

prova('elenco: aperte per data, poi le fatte', () => {
  const r = ordina([
    { titolo: 'B', data_scadenza: '2026-12-01' },
    { titolo: 'F', data_scadenza: '2026-01-01', fatta: true, fatta_il: '2026-01-02' },
    { titolo: 'A', data_scadenza: '2026-09-01' },
  ]);
  uguale(r.map(s => s.titolo), ['A', 'B', 'F']);
});

prova('i numeri in testa alla pagina', () => {
  const t = totali([
    { data_scadenza: '2026-10-01', preavviso_giorni: 30 },
    { data_scadenza: '2026-10-25', preavviso_giorni: 30 },
    { data_scadenza: '2027-05-01', preavviso_giorni: 30 },
    { data_scadenza: '2026-10-01', fatta: true },
  ], '2026-10-19');
  uguale(t, { aperte: 3, scadute: 1, preavviso: 1, mese: 1, fatte: 1 });
});

prova('segnata fatta una ricorrente, la successiva è da fare e ricorda da dove viene', () => {
  const s = successiva({ id: 'x', titolo: 'Bollo', data_scadenza: '2026-10-31', ricorrenza: 'annuale', fatta: true, fatta_il: 'ieri', created_by: 'u' });
  uguale([s.data_scadenza, s.fatta, s.fatta_il, s.precedente_id, s.id, s.created_by], ['2027-10-31', false, null, 'x', undefined, undefined]);
  uguale(successiva({ data_scadenza: '2026-10-31', ricorrenza: 'nessuna' }), null);
});
