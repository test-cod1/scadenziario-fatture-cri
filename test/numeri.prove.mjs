// Importi in lettere, arrotondamenti, lettura e scrittura dei decimali.
// È la parte che finisce stampata su un documento firmato: se sbaglia qui,
// sbaglia su carta.
import { gruppo, prova, uguale, circa, RADICE } from './aiuto.mjs';
import { pathToFileURL } from 'node:url';

const { inLettere, centesimi } = await import(pathToFileURL(RADICE + '/js/lib/numeri.js').href);
const { parseEuro, sommaGiorniISO, fineMeseISO } = await import(pathToFileURL(RADICE + '/js/lib/ui.js').href);
const { testoDecimale, testoDecimaleOVuoto, leggiDecimale, leggiDecimaleO0 } =
  await import(pathToFileURL(RADICE + '/js/lib/importi.js').href);

gruppo('Importo in lettere');

prova('scrive i casi elementari', () => {
  uguale(inLettere(0), 'zero/00');
  uguale(inLettere(1), 'uno/00');
  uguale(inLettere(15.5), 'quindici/50');
  uguale(inLettere(100), 'cento/00');
});

prova('toglie la vocale davanti a uno e otto', () => {
  uguale(inLettere(21), 'ventuno/00');
  uguale(inLettere(28), 'ventotto/00');
  uguale(inLettere(180), 'centottanta/00');
});

prova('gestisce migliaia e milioni', () => {
  uguale(inLettere(1000), 'mille/00');
  uguale(inLettere(1743), 'millesettecentoquarantatre/00');
  uguale(inLettere(2500), 'duemilacinquecento/00');
  // Il caso per cui esiste sottoMilione(): un milione era "diecicentomila".
  uguale(inLettere(1000000), 'unmilione/00');
  uguale(inLettere(1234567.89), 'unmilioneduecentotrentaquattromilacinquecentosessantasette/89');
});

prova('arrotonda ai centesimi e non accetta importi negativi', () => {
  uguale(inLettere(598.499), 'cinquecentonovantotto/50');
  uguale(inLettere(-5), 'zero/00');
});

gruppo('Arrotondamento');

prova('centesimi() taglia le code di virgola', () => {
  uguale(centesimi(0.1 + 0.2), 0.3);
  uguale(centesimi(1094.148936170213), 1094.15);
});

gruppo('Lettura degli importi scritti a mano');

prova('capisce la notazione italiana', () => {
  uguale(parseEuro('55,50'), 55.5);
  uguale(parseEuro('1.234,56'), 1234.56);
  uguale(parseEuro('1.234.567,89'), 1234567.89);
  uguale(parseEuro('2.500'), 2500, 'un punto con tre cifre sono le migliaia');
});

prova('capisce anche quella inglese, che è come la scrive il codice', () => {
  uguale(parseEuro('55.50'), 55.5);
  uguale(parseEuro('1234.56'), 1234.56);
  uguale(parseEuro('2.101'), 2101, 'tre cifre dopo il punto restano migliaia: per questo i campi si riempiono con la virgola');
});

prova('tratta il vuoto come "non compilato", non come zero', () => {
  uguale(parseEuro(''), null);
  uguale(parseEuro(null), null);
  uguale(leggiDecimale(''), null);
  uguale(leggiDecimaleO0(''), 0);
});

prova('scrittura e rilettura tornano allo stesso numero', () => {
  for (const n of [0, 1.2, 25, 42.75, 55.5, 1234.5, 2.101, 0.001]) {
    uguale(leggiDecimale(testoDecimale(n)), n, `andata e ritorno di ${n}`);
  }
});

prova('lo zero resta visibile dove conta e sparisce dove è "non compilato"', () => {
  uguale(testoDecimale(0), '0');
  uguale(testoDecimaleOVuoto(0), '');
  uguale(testoDecimaleOVuoto(null), '');
  uguale(testoDecimaleOVuoto(12.5), '12,5');
});

gruppo('Date');

prova('somma i giorni senza scivolare di un giorno per il fuso', () => {
  uguale(sommaGiorniISO('2026-03-28', 1), '2026-03-29', 'cambio dell\'ora legale');
  uguale(sommaGiorniISO('2026-12-31', 1), '2027-01-01');
  uguale(fineMeseISO('2026-02-10'), '2026-02-28');
});
