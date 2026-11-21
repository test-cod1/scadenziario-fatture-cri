// Proposte di pagamento: il totale delle proposte in attesa e il testo da
// mandare al presidente. È la cifra che il presidente autorizza: se il
// totale sbaglia, si autorizza la cifra sbagliata.
import { gruppo, prova, uguale, RADICE } from './aiuto.mjs';
import { pathToFileURL } from 'node:url';

const { totaleProposte, testoPresidente } = await import(pathToFileURL(RADICE + '/js/lib/proposte.js').href);

gruppo('Proposte di pagamento');

const righe = [
  { importo: 0.1, fatture: { fornitore: 'Officina Rossi', numero_fattura: '12/A', data_fattura: '2026-10-03' } },
  { importo: 0.2, fatture: { fornitore: 'Carburanti Bianchi', numero_fattura: '7', data_fattura: null } },
  { importo: 1234.5, fatture: { fornitore: 'Studio Verdi', numero_fattura: '', data_fattura: '2026-11-01' } },
];

prova('il totale si somma al centesimo e segue le proposte aggiunte o tolte', () => {
  uguale(totaleProposte(righe), 1234.8);
  uguale(totaleProposte(righe.slice(0, 2)), 0.3);
  uguale(totaleProposte([]), 0);
});

prova('testo per il presidente: ogni fattura e il totale', () => {
  const t = testoPresidente(righe);
  for (const atteso of ['seguenti 3 fatture', '1. Officina Rossi — fattura n. 12/A del 03/10/2026 — € 0,10',
    '2. Carburanti Bianchi — fattura n. 7 — € 0,20', '3. Studio Verdi — fattura del 01/11/2026 — € 1.234,50',
    'Totale: € 1.234,80']) {
    if (!t.includes(atteso)) throw new Error('manca «' + atteso + '» in:\n' + t);
  }
  if (!testoPresidente(righe.slice(0, 1)).includes('della seguente fattura:')) throw new Error('singolare sbagliato');
});
