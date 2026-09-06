// Il registro degli straordinari: ore, segni e saldo del mese. Qui non ci
// sono euro, ma le ore che le persone hanno davvero lavorato.
import { gruppo, prova, uguale, circa, RADICE } from './aiuto.mjs';
import { pathToFileURL } from 'node:url';

const s = await import(pathToFileURL(RADICE + '/js/straordinari/calc.js').href);

gruppo('Straordinari — ore e saldo');

prova('la durata di un turno, mezzanotte compresa', () => {
  uguale(s.durataOre('09:00', '13:30'), 4.5);
  uguale(s.durataOre('22:00', '02:00'), 4, 'un rientro notturno non dura meno di zero');
  uguale(s.durataOre('', '13:00'), null, 'un orario incompleto non vale zero ore: non si sa quante siano');
});

prova('le ore si scrivono come vengono e si capiscono lo stesso', () => {
  uguale(s.parseOre('2,5'), 2.5);
  uguale(s.parseOre('2.5'), 2.5);
  uguale(s.parseOre('2'), 2);
});

prova('i recuperi contano col segno meno, gli straordinari col più', () => {
  uguale(s.oreConSegno({ tipo: 'straordinario', ore: 3 }), 3);
  uguale(s.oreConSegno({ tipo: 'recupero', ore: 3 }), -3);
});

prova('il saldo del mese è straordinari meno recuperi', () => {
  const t = s.totali([
    { tipo: 'straordinario', ore: 4 },
    { tipo: 'straordinario', ore: 2.5 },
    { tipo: 'recupero', ore: 3 },
  ]);
  circa(t.positive, 6.5);
  circa(t.recuperi, 3);
  circa(t.saldo, 3.5);
});

prova('le ore si scrivono all\'italiana, e i recuperi col meno', () => {
  uguale(s.fmtOre(9.5), '9,5 h');
  uguale(s.fmtOre(8), '8 h');
  uguale(s.fmtOre(-3, { segno: true }), '−3 h');
  uguale(s.fmtOre(0, { segno: true }), '0 h', 'zero non ha segno');
});

prova('il mese si sposta avanti e indietro senza sbagliare l\'anno', () => {
  uguale(s.meseSpostato('2026-01', -1), '2025-12');
  uguale(s.meseSpostato('2026-12', 1), '2027-01');
  uguale(s.ultimoGiorno('2028-02'), '2028-02-29', 'anno bisestile');
});
