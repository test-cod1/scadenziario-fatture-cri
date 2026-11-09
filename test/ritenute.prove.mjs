// Ritenute d'acconto: in quale mese matura ogni quota, quanto vale, entro
// quando si versa. Sono i numeri che finiscono sull'F24: se sbagliano qui,
// si versa il mese sbagliato o la cifra sbagliata.
import { gruppo, prova, uguale, circa, RADICE } from './aiuto.mjs';
import { pathToFileURL } from 'node:url';

const { scadenzaVersamento, quoteRitenute, riepilogoMesi, ritenutaDaNote, nomeMese, primoDelMese } =
  await import(pathToFileURL(RADICE + '/js/lib/ritenute.js').href);

gruppo("Ritenute d'acconto");

prova('si versano il 16 del mese dopo il pagamento', () => {
  uguale(scadenzaVersamento('2026-10'), '2026-11-16');   // lunedì
  uguale(scadenzaVersamento('2026-02'), '2026-03-16');
});

prova('il 16 di sabato o domenica slitta al lunedì, anche a cavallo d’anno', () => {
  uguale(scadenzaVersamento('2026-04'), '2026-05-18');   // 16/05/2026 è sabato
  uguale(scadenzaVersamento('2026-12'), '2027-01-18');   // 16/01/2027 è sabato
});

prova('i pagamenti di luglio si versano entro il 20 agosto', () => {
  uguale(scadenzaVersamento('2026-07'), '2026-08-20');   // giovedì
  uguale(scadenzaVersamento('2027-07'), '2027-08-20');   // venerdì
  uguale(scadenzaVersamento('2028-07'), '2028-08-21');   // 20/08/2028 è domenica
});

prova('salta anche la Pasquetta', () => {
  // Pasqua 2028 è il 16 aprile: il 16 è domenica, il 17 è Pasquetta.
  uguale(scadenzaVersamento('2028-03'), '2028-04-18');
});

const fattura = (over = {}) => ({
  id: 'f1', fornitore: 'Studio Rossi', importo: 800, ritenuta: 200, ritenuta_codice_tributo: '1040', stato: 'pagata', pagamenti: [], ...over,
});

prova('pagata in una volta: tutta la ritenuta nel mese del pagamento', () => {
  const q = quoteRitenute([fattura({ pagamenti: [{ id: 'p1', importo: 800, data_pagamento: '2026-05-20' }] })]);
  uguale(q.length, 1);
  uguale(q[0].mese, '2026-05');
  uguale(q[0].quota, 200);
});

prova('pagata a rate: la ritenuta si divide in proporzione e torna al centesimo', () => {
  const q = quoteRitenute([fattura({ importo: 1000, ritenuta: 100.01, pagamenti: [
    { id: 'p2', importo: 333.33, data_pagamento: '2026-06-10' },
    { id: 'p1', importo: 333.33, data_pagamento: '2026-05-10' },
    { id: 'p3', importo: 333.34, data_pagamento: '2026-07-10' },
  ] })]);
  uguale(q.map(x => x.mese), ['2026-05', '2026-06', '2026-07']);
  uguale(q.map(x => x.quota), [33.34, 33.34, 33.33]);
  circa(q.reduce((s, x) => s + x.quota, 0), 100.01, 0.0001);
});

prova('pagata solo in parte: matura solo la quota pagata', () => {
  const q = quoteRitenute([fattura({ stato: 'pagata_parziale', pagamenti: [{ id: 'p1', importo: 400, data_pagamento: '2026-05-20' }] })]);
  uguale(q.map(x => x.quota), [100]);
});

prova('senza ritenuta o senza pagamenti non matura niente', () => {
  uguale(quoteRitenute([fattura({ ritenuta: null, pagamenti: [{ id: 'p', importo: 800, data_pagamento: '2026-05-01' }] })]), []);
  uguale(quoteRitenute([fattura()]), []);
});

prova('riepilogo per mese: totali per codice tributo e stato del versamento', () => {
  const fatt = [
    fattura({ pagamenti: [{ id: 'a', importo: 800, data_pagamento: '2026-09-03' }] }),
    fattura({ id: 'f2', fornitore: 'Agenzia Bianchi', importo: 920, ritenuta: 23, ritenuta_codice_tributo: '1038', pagamenti: [{ id: 'b', importo: 920, data_pagamento: '2026-09-28' }] }),
    fattura({ id: 'f3', importo: 400, ritenuta: 100, pagamenti: [{ id: 'c', importo: 400, data_pagamento: '2026-10-05' }] }),
    fattura({ id: 'f4', importo: 400, ritenuta: 100, pagamenti: [{ id: 'd', importo: 400, data_pagamento: '2026-11-02' }] }),
    fattura({ id: 'f5', importo: 80, ritenuta: 20, pagamenti: [{ id: 'e', importo: 80, data_pagamento: '2026-08-02' }] }),
  ];
  const vers = [{ id: 'v1', mese: '2026-09-01', data_versamento: '2026-10-16', importo: 223 },
    { id: 'v2', mese: '2026-08-01', data_versamento: '2026-09-16', importo: 10 }];
  const r = riepilogoMesi(fatt, vers, '2026-11-09');
  uguale(r.map(m => m.mese), ['2026-11', '2026-10', '2026-09', '2026-08']);
  const [nov, ott, set, ago] = r;
  uguale(nov.stato, 'in_corso');
  uguale(ott.stato, 'da_versare');
  uguale(ott.scadenza, '2026-11-16');
  uguale(set.stato, 'versato');
  uguale(set.totale, 223);
  uguale(set.perCodice, { 1038: 23, 1040: 200 });
  uguale(ago.stato, 'differenza');
  uguale(riepilogoMesi(fatt, [], '2026-11-20').find(m => m.mese === '2026-10').stato, 'scaduto');
});

prova('ritenuta letta dalle note scritte dall’XML o a mano', () => {
  uguale(ritenutaDaNote("Totale documento 1000.00€, meno ritenuta d'acconto 200.00€: importo da pagare 800.00€."), 200);
  uguale(ritenutaDaNote('Ritenuta d’acconto di € 1.234,56'), 1234.56);
  uguale(ritenutaDaNote('ritenuta 40,00 euro'), 40);
  uguale(ritenutaDaNote('pagamento in due rate'), null);
  uguale(ritenutaDaNote(null), null);
});

prova('nomi e date dei mesi', () => {
  uguale(nomeMese('2026-05'), 'maggio 2026');
  uguale(primoDelMese('2026-05'), '2026-05-01');
});
