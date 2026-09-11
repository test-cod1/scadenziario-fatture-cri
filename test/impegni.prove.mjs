// ============================================================
//  L'ordine degli impegni della sezione Direttore.
//  È l'unica cosa della sezione che non si vede a occhio: l'elenco si
//  riordina da sé, e se la regola sbaglia nessuno se ne accorge — vedrà
//  solo un elenco che "non sembra giusto". Qui si fissano i casi che
//  quella regola deve rispettare.
// ============================================================
import { gruppo, prova, uguale, vero } from './aiuto.mjs';
import {
  giorniAllaScadenza, etichettaScadenza, punteggio, ordina, totali, livelloDi,
} from '../js/direttore/calc.js';

// Data di riferimento fissa: le prove non devono cambiare esito a
// seconda del giorno in cui girano.
const OGGI = '2026-09-11';

gruppo('Direttore — scadenze');

prova('i giorni che mancano si contano senza farsi spostare dall’ora legale', () => {
  uguale(giorniAllaScadenza('2026-09-11', OGGI), 0, 'oggi');
  uguale(giorniAllaScadenza('2026-09-12', OGGI), 1, 'domani');
  uguale(giorniAllaScadenza('2026-09-08', OGGI), -3, 'tre giorni fa');
  // A cavallo del cambio d'ora (25 ottobre 2026): contando in millisecondi
  // uno di questi darebbe 43 giorni e mezzo, cioè 43 invece di 44.
  uguale(giorniAllaScadenza('2026-10-25', OGGI), 44, 'oltre il cambio d’ora');
  uguale(giorniAllaScadenza(null, OGGI), null, 'senza scadenza');
});

prova('la scadenza si racconta a parole, non con una data', () => {
  uguale(etichettaScadenza('2026-09-11', OGGI).testo, 'scade oggi');
  uguale(etichettaScadenza('2026-09-12', OGGI).testo, 'scade domani');
  uguale(etichettaScadenza('2026-09-10', OGGI).testo, 'scaduto ieri');
  uguale(etichettaScadenza('2026-09-08', OGGI).testo, 'scaduto da 3 giorni');
  uguale(etichettaScadenza('2026-09-08', OGGI).stato, 'scaduto');
  uguale(etichettaScadenza(null, OGGI).stato, 'nessuna');
});

prova('oltre il mese si contano i mesi, e uno solo è «un mese»', () => {
  uguale(etichettaScadenza('2026-10-11', OGGI).testo, 'fra 30 giorni', 'fino a trenta si contano i giorni');
  uguale(etichettaScadenza('2026-10-21', OGGI).testo, 'fra un mese', 'non «fra 1 mesi»');
  uguale(etichettaScadenza('2026-12-11', OGGI).testo, 'fra 3 mesi');
});

gruppo('Direttore — ordine degli impegni');

const imp = (titolo, importanza, urgenza, scadenza = null, altro = {}) =>
  ({ id: titolo, titolo, importanza, urgenza, scadenza, fatto: false, ...altro });

prova('a parità di urgenza viene prima ciò che è più importante', () => {
  const a = imp('conta di più', 'alta', 'media');
  const b = imp('conta di meno', 'bassa', 'media');
  vero(punteggio(a, OGGI) > punteggio(b, OGGI), 'l’importanza deve pesare');
  uguale(ordina([b, a], OGGI).map(x => x.titolo), ['conta di più', 'conta di meno']);
});

prova('la scadenza vicina scavalca l’urgenza dichiarata', () => {
  // È il caso che giustifica tutto il calcolo: una cosa importante che
  // scade domani deve stare sopra una urgente che scade fra un mese,
  // altrimenti l'elenco mente e si finisce a guardare le scadenze a mano.
  const domani = imp('importante, scade domani', 'alta', 'bassa', '2026-09-12');
  const fraUnMese = imp('urgente, scade fra un mese', 'alta', 'alta', '2026-10-11');
  uguale(ordina([fraUnMese, domani], OGGI).map(x => x.titolo),
    ['importante, scade domani', 'urgente, scade fra un mese']);
});

prova('lo scaduto sale, ma non copre ciò che conta davvero', () => {
  // Lo scaduto prende la spinta massima e scavalca chi gli somiglia:
  const scaduto = imp('scaduto, conta poco', 'bassa', 'bassa', '2026-09-01');
  const medio = imp('media e media, senza data', 'media', 'media');
  uguale(ordina([medio, scaduto], OGGI)[0].titolo, 'scaduto, conta poco');

  // ...ma non arriva a coprire la cosa più importante e urgente che c'è.
  // È voluto: se bastasse una scadenza dimenticata su una pratica
  // marginale per finire in testa all'elenco, l'elenco smetterebbe di
  // dire quale sia il lavoro che conta — che è tutto il suo scopo.
  const massimo = imp('massima priorità, nessuna data', 'alta', 'alta');
  uguale(ordina([scaduto, massimo], OGGI)[0].titolo, 'massima priorità, nessuna data');
});

prova('senza scadenza non vuol dire «mai urgente»', () => {
  // Un impegno senza data non viene spinto né penalizzato: conta solo per
  // urgenza e importanza. Se venisse messo in fondo a prescindere, nessuno
  // scriverebbe più le cose che non hanno una data.
  const senzaData = imp('alta e alta, senza data', 'alta', 'alta');
  const lontano = imp('bassa e bassa, fra due mesi', 'bassa', 'bassa', '2026-11-11');
  uguale(ordina([lontano, senzaData], OGGI)[0].titolo, 'alta e alta, senza data');
});

prova('i fatti scendono in fondo, i più recenti per primi', () => {
  const aperto = imp('da fare', 'bassa', 'bassa');
  const fatto1 = imp('fatto prima', 'alta', 'alta', null, { fatto: true, fatto_il: '2026-09-01T10:00:00Z' });
  const fatto2 = imp('fatto ieri', 'bassa', 'bassa', null, { fatto: true, fatto_il: '2026-09-10T10:00:00Z' });
  uguale(ordina([fatto1, fatto2, aperto], OGGI).map(x => x.titolo),
    ['da fare', 'fatto ieri', 'fatto prima']);
});

prova('a parità di tutto l’ordine è stabile, non casuale', () => {
  const a = imp('Alfa', 'media', 'media');
  const b = imp('Beta', 'media', 'media');
  uguale(ordina([b, a], OGGI).map(x => x.titolo), ['Alfa', 'Beta'], 'in ordine di titolo');
  uguale(ordina([a, b], OGGI).map(x => x.titolo), ['Alfa', 'Beta'], 'e non dipende da come arrivano');
});

prova('un livello scritto male non fa saltare il conto', () => {
  // Una riga vecchia o manomessa non deve rompere l'elenco: livelloDi
  // ripiega su "media" invece di restituire undefined.
  uguale(livelloDi('inventato').id, 'media');
  vero(Number.isFinite(punteggio(imp('strana', 'inventato', null), OGGI)), 'punteggio non calcolabile');
});

gruppo('Direttore — numeri in testata');

prova('i conteggi dicono quello che promettono', () => {
  const elenco = [
    imp('scaduto', 'alta', 'alta', '2026-09-01'),
    imp('oggi', 'media', 'media', OGGI),
    imp('fra tre giorni', 'media', 'media', '2026-09-14'),
    imp('fra due mesi', 'bassa', 'bassa', '2026-11-11'),
    imp('senza data', 'media', 'media'),
    imp('già fatto', 'alta', 'alta', '2026-09-02', { fatto: true, fatto_il: '2026-09-02T09:00:00Z' }),
  ];
  const t = totali(elenco, OGGI);
  uguale(t.aperti, 5, 'aperti');
  uguale(t.fatti, 1, 'fatti');
  uguale(t.scaduti, 1, 'scaduti');
  uguale(t.oggi, 1, 'in scadenza oggi');
  uguale(t.settimana, 2, 'entro sette giorni (oggi compreso, scaduti esclusi)');
  uguale(t.senzaScadenza, 1, 'senza scadenza');
});
