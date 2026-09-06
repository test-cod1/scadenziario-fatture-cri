// ============================================================
//  IMPORTO IN LETTERE
//  Come si usa nei preventivi ("euro quattrocentocinquanta/00"): serve a
//  rendere non alterabile la cifra. Sta fra gli helper condivisi perché lo
//  scrivono allo stesso modo tutti i documenti del Comitato — i preventivi
//  delle assistenze sanitarie e quelli della formazione esterna.
// ============================================================

const UNITA = ['zero', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove',
  'dieci', 'undici', 'dodici', 'tredici', 'quattordici', 'quindici', 'sedici', 'diciassette', 'diciotto', 'diciannove'];
const DECINE = ['', '', 'venti', 'trenta', 'quaranta', 'cinquanta', 'sessanta', 'settanta', 'ottanta', 'novanta'];

function sottoCento(n) {
  if (n < 20) return UNITA[n];
  const d = Math.floor(n / 10), u = n % 10;
  let s = DECINE[d];
  // "ventuno", "trentotto": la vocale finale della decina cade davanti a
  // uno e otto.
  if (u === 1 || u === 8) s = s.slice(0, -1);
  return s + (u ? UNITA[u] : '');
}

function sottoMille(n) {
  if (n < 100) return sottoCento(n);
  const c = Math.floor(n / 100), r = n % 100;
  const centinaia = (c > 1 ? UNITA[c] : '') + 'cento';
  const resto = r ? sottoCento(r) : '';
  // 'cento' perde la o davanti a otto/ottanta: centottanta, non centoottanta.
  return (resto.startsWith('o') ? centinaia.slice(0, -1) : centinaia) + resto;
}

// Sotto il milione. Oltre ci pensa inLettere, che spezza in milioni e resto:
// senza, un milione diventava "diecicentomila", perché le migliaia venivano
// passate a sottoMille anche quando erano quattro cifre.
function sottoMilione(n) {
  if (n < 1000) return sottoMille(n);
  const migliaia = Math.floor(n / 1000), resto = n % 1000;
  const testa = migliaia === 1 ? 'mille' : sottoMille(migliaia) + 'mila';
  return testa + (resto ? sottoMille(resto) : '');
}

export function inLettere(importo) {
  const n = Math.max(0, Math.round((Number(importo) || 0) * 100));
  const euro = Math.floor(n / 100);
  const cent = n % 100;
  let parole;
  if (euro === 0) parole = 'zero';
  else if (euro < 1e6) parole = sottoMilione(euro);
  else {
    const milioni = Math.floor(euro / 1e6), resto = euro % 1e6;
    const testa = milioni === 1 ? 'unmilione' : sottoMilione(milioni) + 'milioni';
    parole = testa + (resto ? sottoMilione(resto) : '');
  }
  return `${parole}/${String(cent).padStart(2, '0')}`;
}

// Arrotonda ai centesimi: senza, la somma di più righe può lasciare code di
// virgola (0,30000000000000004) che poi si vedono nel documento.
export function centesimi(n) { return Math.round((Number(n) || 0) * 100) / 100; }
