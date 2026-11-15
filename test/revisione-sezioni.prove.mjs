// Le correzioni della revisione delle sezioni (15/11/2026): prezzi negativi
// nei preventivi, percentuali di sconto arrotondate, accento dell'importo in
// lettere, giorno di «fatta il» dopo mezzanotte, ore dei corsi coi minuti,
// valore totale delle assistenze, CAP della sede ed entità XML della carta
// intestata. Ogni prova qui sotto falliva col codice di prima.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { gruppo, prova, uguale, vero, falso, RADICE } from './aiuto.mjs';

const mod = (p) => import(pathToFileURL(RADICE + p).href);
const sorgente = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');

const calcFormazione = await mod('/js/formazione/calc.js');
const calcAssistenze = await mod('/js/assistenze/calc.js');
const docFormazione = await mod('/js/formazione/lib/documento.js');
const docAssistenze = await mod('/js/assistenze/lib/documento.js');
const { inLettere } = await mod('/js/lib/numeri.js');
const calcScadenze = await mod('/js/scadenze/calc.js');
const calcDirettore = await mod('/js/direttore/calc.js');
const { oreDaDurata } = await mod('/js/formazione/corsi.js');
const { CONFIG } = await mod('/js/trasporti/config.js');
const { leggiZip } = await mod('/js/lib/zip.js');
const carta = await mod('/js/lib/carta.js');

gruppo('Revisione delle sezioni — 15/11/2026');

// ---- 1. Prezzi negativi -------------------------------------------------

prova('formazione: un prezzo negativo non toglie soldi dal totale', () => {
  const r = calcFormazione.calcola({
    righe: [
      { nome: 'BLSD', discenti: 2, prezzo: -55, listino: -55 },
      { nome: 'Primo soccorso', discenti: 1, prezzo: 100, listino: 100 },
    ],
  });
  uguale(r.righe[0].importo, 0);
  uguale(r.totale, 100);
});

prova('formazione: nonNegativo porta a zero il meno e lascia il campo vuoto', () => {
  uguale(calcFormazione.nonNegativo(-55), 0);
  uguale(calcFormazione.nonNegativo(55.5), 55.5);
  uguale(calcFormazione.nonNegativo(null), null);
});

prova('assistenze: prezzi e quantità negativi valgono zero', () => {
  const r = calcAssistenze.calcola({
    voci: [
      { id: 'amb', nome: 'Ambulanza', tipo: 'oraria', prezzo: -50 },
      { id: 'gaz', nome: 'Gazebo', tipo: 'fissa', prezzo: 30 },
    ],
    calendario: [{ data: '2026-11-20', dalle: '09:00', alle: '11:00', qta: { amb: 1, gaz: -2 } }],
  });
  uguale(r.totale, 0);
  const r2 = calcAssistenze.calcola({
    voci: [{ id: 'gaz', nome: 'Gazebo', tipo: 'fissa', prezzo: 30 }],
    calendario: [
      { data: '2026-11-20', qta: { gaz: 2 } },
      { data: '2026-11-21', qta: { gaz: -1 } },
    ],
  });
  uguale(r2.totale, 60);
});

// ---- 2. Percentuale di sconto con due decimali --------------------------

prova('lo sconto del 12,25% si stampa con due decimali', () => {
  for (const doc of [docFormazione, docAssistenze]) {
    uguale(doc.etichettaSconto({ tipo: 'percentuale', percentuale: 12.25 }), 'Sconto 12,25%');
    uguale(doc.etichettaSconto({ tipo: 'percentuale', percentuale: 10 }), 'Sconto 10%');
    uguale(doc.etichettaSconto({ tipo: 'percentuale', percentuale: 7.5 }), 'Sconto 7,5%');
  }
});

// ---- 3. Importo in lettere con l'accento --------------------------------

prova('«tre» in fondo a un numero composto prende l\'accento', () => {
  uguale(inLettere(3), 'tre/00');
  uguale(inLettere(23), 'ventitré/00');
  uguale(inLettere(103), 'centotré/00');
  uguale(inLettere(183), 'centottantatré/00');
  uguale(inLettere(1003), 'milletré/00');
  uguale(inLettere(3000), 'tremila/00');
  uguale(inLettere(23000), 'ventitremila/00');
  uguale(inLettere(3000000), 'tremilioni/00');
  uguale(inLettere(3000003), 'tremilionitré/00');
  uguale(inLettere(13), 'tredici/00');
});

// ---- 4. «Fatta il» nel giorno locale ------------------------------------

prova('un timestamp UTC dopo la mezzanotte italiana cade il giorno dopo', () => {
  for (const calc of [calcScadenze, calcDirettore]) {
    uguale(calc.giornoLocale('2026-11-14T23:30:00+00:00', 'Europe/Rome'), '2026-11-15');
    uguale(calc.giornoLocale('2026-07-14T22:30:00Z', 'Europe/Rome'), '2026-07-15', 'ora legale');
    uguale(calc.giornoLocale('2026-11-14T10:00:00+00:00', 'Europe/Rome'), '2026-11-14');
    uguale(calc.giornoLocale('2026-11-14'), '2026-11-14', 'una data senza ora resta com\'è');
    uguale(calc.giornoLocale(null), '');
  }
});

prova('le viste non tagliano più il timestamp UTC', () => {
  falso(sorgente('js/scadenze/views/elenco.js').includes('fatta_il.slice(0, 10)'), 'scadenze/elenco');
  falso(sorgente('js/direttore/views/impegni.js').includes('fatto_il.slice(0, 10)'), 'direttore/impegni');
  falso(sorgente('js/direttore/views/calendario.js').includes('fatto_il.slice(0, 10)'), 'direttore/calendario');
});

// ---- 5. Ore dei corsi coi minuti -----------------------------------------

prova('le ore di un corso contano anche i minuti', () => {
  uguale(oreDaDurata('2 ore e 30'), 2.5);
  uguale(oreDaDurata('2h30'), 2.5);
  uguale(oreDaDurata('2 ore e 30 minuti'), 2.5);
  uguale(oreDaDurata('2,5 ore'), 2.5);
  uguale(oreDaDurata('90 minuti'), 1.5);
  uguale(oreDaDurata('16 ore'), 16);
  uguale(oreDaDurata('1 ora'), 1);
  uguale(oreDaDurata('8 ore e 2 moduli'), 8, 'un numero seguito da un\'altra parola non sono minuti');
  uguale(oreDaDurata('mezza giornata'), null);
});

// ---- 6. Valore totale delle assistenze ----------------------------------

prova('il valore totale esclude bozze e annullati', () => {
  const elenco = [
    { stato: 'bozza', totale: 1000 },
    { stato: 'inviato', totale: 200 },
    { stato: 'confermato', totale: 300.5 },
    { stato: 'annullato', totale: 4000 },
  ];
  uguale(calcAssistenze.valoreTotale(elenco), 500.5);
  uguale(calcAssistenze.valoreTotale([]), 0);
  vero(sorgente('js/assistenze/views/dashboard.js').includes('valoreTotale(list)'), 'la dashboard usa valoreTotale');
});

// ---- 7. CAP della sede ---------------------------------------------------

prova('il CAP della partenza dei trasporti è quello della carta intestata', async () => {
  const buf = fs.readFileSync(path.join(RADICE, 'assets/carta-intestata.dotx'));
  const file = await leggiZip(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const piede = carta.righeTesto(file, 'word/footer1.xml').join(' ');
  const capCarta = /Gastaldi[^-]*-\s*(\d{5})/.exec(piede)?.[1];
  vero(capCarta, 'CAP non trovato nella carta intestata');
  uguale(/\b(\d{5})\b/.exec(CONFIG.partenza.indirizzo)?.[1], capCarta);
});

// ---- 8. Entità XML della carta intestata ---------------------------------

prova('i testi della carta intestata si leggono senza entità XML', () => {
  uguale(carta.decodificaEntita('A &amp; B &lt;x&gt; &quot;c&quot; &apos;d&apos;'), 'A & B <x> "c" \'d\'');
  uguale(carta.decodificaEntita('&#38; &#x26; &#xE8;'), '& & è');
  uguale(carta.decodificaEntita('&amp;lt;'), '&lt;', 'una passata sola');
  const xml = '<w:p><w:r><w:t>Soci &amp; volontari</w:t></w:r></w:p>';
  uguale(carta.righeTesto({ 'word/x.xml': new TextEncoder().encode(xml) }, 'word/x.xml'), ['Soci & volontari']);
});
