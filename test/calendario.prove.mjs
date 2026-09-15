// ============================================================
//  IL CALENDARIO DELLA SEZIONE DIRETTORE.
//  La griglia del mese è l'unica parte della pagina che può sbagliare
//  restando credibile: un giorno in più in testa alla prima settimana
//  sposta tutto il mese di una colonna, e a occhio si legge comunque
//  come un calendario. Qui si fissano i casi che la fanno cadere — i
//  mesi che cominciano di domenica, i cambi d'ora, gli anni bisestili —
//  e il passaggio di anno navigando fra i mesi.
// ============================================================
import { gruppo, prova, uguale, vero } from './aiuto.mjs';
import {
  grigliaMese, spostaMese, meseDi, meseValido, nomeMese, nomeGiorno, perGiorno,
} from '../js/direttore/calc.js';

const OGGI = '2026-09-11';
const imp = (titolo, scadenza, altro = {}) =>
  ({ id: titolo, titolo, importanza: 'media', urgenza: 'media', scadenza, fatto: false, ...altro });

gruppo('Direttore — la griglia del mese');

prova('il mese comincia di lunedì e la prima casella è il lunedì giusto', () => {
  // Settembre 2026 comincia di martedì: davanti c'è solo il 31 agosto.
  const g = grigliaMese('2026-09', OGGI);
  uguale(g[0].iso, '2026-08-31', 'prima casella');
  uguale(g[0].nelMese, false, 'la coda del mese prima non è del mese');
  uguale(g[1].iso, '2026-09-01', 'il primo del mese');
  uguale(g[1].nelMese, true);
});

prova('un mese che comincia di domenica porta sei giorni davanti', () => {
  // Il caso che salta fuori solo ogni tanto: con la settimana che parte
  // dal lunedì, la domenica è l'ultima colonna e la riga va riempita
  // tutta prima di arrivarci.
  const g = grigliaMese('2026-11', OGGI);
  uguale(g[0].iso, '2026-10-26', 'si parte dal lunedì prima');
  uguale(g[6].iso, '2026-11-01', 'il primo novembre è di domenica');
});

prova('il cambio d’ora non fa sparire né raddoppiare un giorno', () => {
  // In Italia l'ora legale finisce il 25 ottobre 2026: contando in ora
  // locale quella casella si sdoppiava o si perdeva.
  const g = grigliaMese('2026-10', OGGI).filter(c => c.nelMese).map(c => c.iso);
  uguale(g.length, 31, 'ottobre ha 31 giorni');
  vero(g.includes('2026-10-25'), 'il giorno del cambio d’ora c’è');
  uguale(new Set(g).size, 31, 'nessun giorno ripetuto');
});

prova('febbraio bisestile ha i suoi ventinove giorni', () => {
  uguale(grigliaMese('2028-02', OGGI).filter(c => c.nelMese).length, 29);
  uguale(grigliaMese('2026-02', OGGI).filter(c => c.nelMese).length, 28);
});

prova('la griglia è fatta di settimane intere e non porta righe vuote', () => {
  for (const mese of ['2026-01', '2026-02', '2026-09', '2026-11', '2028-02']) {
    const g = grigliaMese(mese, OGGI);
    uguale(g.length % 7, 0, `${mese}: settimane intere`);
    vero(g.length === 35 || g.length === 42 || g.length === 28, `${mese}: ${g.length} caselle`);
    vero(g.slice(-7).some(c => c.nelMese), `${mese}: l’ultima riga è tutta del mese dopo`);
  }
});

prova('la casella di oggi è una sola, e solo nel mese giusto', () => {
  uguale(grigliaMese('2026-09', OGGI).filter(c => c.oggi).length, 1, 'nel mese di oggi');
  // Il 26 luglio 2026 non è oggi nemmeno quando sbuca in coda ad agosto.
  uguale(grigliaMese('2026-03', OGGI).filter(c => c.oggi).length, 0, 'in un altro mese');
});

gruppo('Direttore — navigare fra i mesi');

prova('avanti e indietro si contano in mesi, non in giorni', () => {
  uguale(spostaMese('2026-09', 1), '2026-10');
  uguale(spostaMese('2026-12', 1), '2027-01', 'passaggio d’anno in avanti');
  uguale(spostaMese('2026-01', -1), '2025-12', 'passaggio d’anno indietro');
  uguale(spostaMese('2026-03', -14), '2025-01', 'più di un anno indietro');
  // Sommando giorni, il 31 gennaio saltava direttamente a marzo.
  uguale(spostaMese('2026-01', 1), '2026-02');
});

prova('si riconosce un mese scritto bene da uno inventato', () => {
  vero(meseValido('2026-09'), 'forma giusta');
  vero(!meseValido('2026-13'), 'mese inesistente');
  vero(!meseValido('2026-9'), 'senza lo zero davanti');
  vero(!meseValido('settembre'), 'parole');
  vero(!meseValido(null), 'niente');
  uguale(meseDi('2026-09-11'), '2026-09', 'il mese di una data');
});

prova('mesi e giorni si scrivono in italiano', () => {
  uguale(nomeMese('2026-09'), 'settembre 2026');
  uguale(nomeGiorno('2026-09-11'), 'venerdì 11 settembre 2026');
  uguale(nomeGiorno('2026-11-01'), 'domenica 1 novembre 2026');
});

gruppo('Direttore — impegni raccolti per giorno');

prova('ogni impegno finisce nel suo giorno, e quelli senza data in nessuno', () => {
  const m = perGiorno([
    imp('a', '2026-09-11'), imp('b', '2026-09-11'), imp('c', '2026-09-12'), imp('vago', null),
  ], OGGI);
  uguale(m.get('2026-09-11').length, 2, 'due l’undici');
  uguale(m.get('2026-09-12').length, 1, 'uno il dodici');
  uguale(m.has('null') || m.has(null), false, 'quello senza data non ha casella');
  uguale([...m.values()].flat().length, 3, 'nessun impegno inventato o perso');
});

prova('dentro un giorno l’ordine è quello dell’elenco', () => {
  // Stessa scadenza: decide il peso, e l'importanza vale il doppio
  // dell'urgenza. Se l'ordine qui fosse quello di arrivo, la cosa che
  // conta di più finirebbe sotto il taglio delle tre righe visibili.
  const m = perGiorno([
    imp('poco', '2026-09-20', { importanza: 'bassa', urgenza: 'bassa' }),
    imp('molto', '2026-09-20', { importanza: 'alta', urgenza: 'alta' }),
    imp('fatto', '2026-09-20', { importanza: 'alta', urgenza: 'alta', fatto: true }),
  ], OGGI);
  uguale(m.get('2026-09-20').map(i => i.titolo), ['molto', 'poco', 'fatto'],
    'prima le cose da fare, in ordine di peso');
});
