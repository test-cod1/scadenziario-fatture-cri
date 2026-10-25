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
//
// Il ×100 si ripulisce a 15 cifre significative prima di arrotondare
// (27/09/2026): in virgola mobile 5,75 × 0,22 fa 1,2649999999999999, che per
// cento dà 126,49999999999999 e Math.round portava a 1,26 — un centesimo in
// meno di quello che fa la moltiplicazione a mano (1,265 → 1,27), su un'IVA
// stampata in un preventivo. Quindici cifre sono quelle che un double tiene
// sempre esatte: la coda dell'errore sparisce, l'importo vero no. Il segno si
// tratta a parte, così −1,265 diventa −1,27 e non −1,26 (Math.round
// arrotonda i ,5 negativi verso lo zero).
export function centesimi(n) {
  const x = Number(n) || 0;
  if (!Number.isFinite(x)) return x;
  const cent = Math.round(Number((Math.abs(x) * 100).toPrecision(15)));
  // Niente −0: toLocaleString lo stamperebbe "-0,00 €".
  return x < 0 && cent ? -cent / 100 : cent / 100;
}

// Pagato (o incassato), stornato e residuo di una fattura, sommati in
// centesimi INTERI. In virgola mobile 115,54 − 100 − 15,54 fa 1,42e-14 e non
// 0: la fattura saldata restava "aperta" nell'interfaccia, e il campo del
// nuovo pagamento si precompilava con "1,4210854715202004e-14", che letto
// come importo diventava 1,42 €. Capitava in circa una fattura su quindici
// fra quelle pagate in due rate.
export function residuoFattura(importo, versamenti = [], storni = []) {
  const cent = (n) => Math.round((Number(n) || 0) * 100);
  const versato = versamenti.reduce((s, r) => s + cent(r.importo), 0);
  const stornato = storni.reduce((s, r) => s + cent(r.importo), 0);
  return {
    versato: versato / 100,
    stornato: stornato / 100,
    residuo: Math.max(0, cent(importo) - versato - stornato) / 100,
  };
}
