// Ordinamento al clic sulle intestazioni degli scadenziari (js/lib/ordinaTabella.js).
import { gruppo, prova, uguale, vero } from './aiuto.mjs';
import { RADICE } from './aiuto.mjs';
import { pathToFileURL } from 'node:url';

const { ordinaRighe, prossimoOrdinamento, thOrdinabile } =
  await import(pathToFileURL(RADICE + '/js/lib/ordinaTabella.js').href);

const COLONNE = {
  fornitore: { get: f => f.fornitore, tipo: 'testo' },
  numero:    { get: f => f.numero, tipo: 'testo' },
  importo:   { get: f => f.importo, tipo: 'numero' },
  scadenza:  { get: f => f.scadenza, tipo: 'data' },
};
const righe = [
  { id: 1, fornitore: 'orion srl', numero: '105', importo: 25000, scadenza: '2025-05-19' },
  { id: 2, fornitore: 'Alfa',      numero: '9',   importo: '120.50', scadenza: null },
  { id: 3, fornitore: 'Zeta',      numero: '10',  importo: 3000, scadenza: '2026-01-02' },
  { id: 4, fornitore: 'ALFA',      numero: 'A-2', importo: null, scadenza: '2024-12-31' },
];
const ids = (r) => r.map(x => x.id).join(',');

gruppo('Ordinamento delle tabelle');

prova('senza ordinamento lascia l\'ordine di arrivo', () => {
  uguale(ordinaRighe(righe, null, COLONNE), righe);
});

prova('testo: ignora maiuscole, stabile sui pari merito', () => {
  uguale(ids(ordinaRighe(righe, { campo: 'fornitore', dir: 'asc' }, COLONNE)), '2,4,1,3');
  uguale(ids(ordinaRighe(righe, { campo: 'fornitore', dir: 'desc' }, COLONNE)), '3,1,2,4');
});

prova('numeri di fattura in ordine naturale (9 prima di 10)', () => {
  uguale(ids(ordinaRighe(righe, { campo: 'numero', dir: 'asc' }, COLONNE)), '2,3,1,4');
});

prova('importi come numeri, anche se arrivano come stringhe; vuoti in fondo', () => {
  uguale(ids(ordinaRighe(righe, { campo: 'importo', dir: 'asc' }, COLONNE)), '2,3,1,4');
  uguale(ids(ordinaRighe(righe, { campo: 'importo', dir: 'desc' }, COLONNE)), '1,3,2,4');
});

prova('date: le fatture senza scadenza restano in fondo in entrambe le direzioni', () => {
  uguale(ids(ordinaRighe(righe, { campo: 'scadenza', dir: 'asc' }, COLONNE)), '4,1,3,2');
  uguale(ids(ordinaRighe(righe, { campo: 'scadenza', dir: 'desc' }, COLONNE)), '3,1,4,2');
});

prova('non modifica l\'elenco ricevuto', () => {
  const copia = [...righe];
  ordinaRighe(righe, { campo: 'importo', dir: 'desc' }, COLONNE);
  uguale(ids(righe), ids(copia));
});

prova('primo clic crescente, secondo decrescente, cambio colonna riparte da crescente', () => {
  let s = prossimoOrdinamento(null, 'importo');
  uguale(s, { campo: 'importo', dir: 'asc' });
  s = prossimoOrdinamento(s, 'importo');
  uguale(s, { campo: 'importo', dir: 'desc' });
  s = prossimoOrdinamento(s, 'scadenza');
  uguale(s, { campo: 'scadenza', dir: 'asc' });
});

prova('intestazione: aria-sort e freccia della colonna attiva', () => {
  const attiva = thOrdinabile('Importo', 'importo', { campo: 'importo', dir: 'desc' }, 'money-col');
  vero(attiva.includes('aria-sort="descending"') && attiva.includes('▼') && attiva.includes('class="money-col"'));
  const altra = thOrdinabile('Fornitore', 'fornitore', { campo: 'importo', dir: 'desc' });
  vero(altra.includes('aria-sort="none"') && altra.includes('data-sort="fornitore"'));
});
