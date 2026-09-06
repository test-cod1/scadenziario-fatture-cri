// Il calcolo dei preventivi delle tre sezioni che producono documenti.
// Sono i numeri che finiscono in una lettera firmata e poi in una fattura:
// meritano di essere controllati da qualcosa che non si dimentica.
import { gruppo, prova, uguale, circa, vero, RADICE } from './aiuto.mjs';
import { pathToFileURL } from 'node:url';

const mod = (p) => import(pathToFileURL(RADICE + p).href);

const formazione = await mod('/js/formazione/calc.js');
const assistenze = await mod('/js/assistenze/calc.js');
const trasporti = await mod('/js/trasporti/calc.js');

// ------------------------------------------------------------------
gruppo('Formazione esterna — corsi, sconti e IVA');

const corso = (id, discenti, listino, prezzo) => ({ id, nome: id, discenti, listino, prezzo });

prova('somma i corsi per numero di discenti', () => {
  const r = formazione.calcola({ righe: [corso('blsd', 8, 60, 55), corso('retraining', 4, 40, 35)] });
  uguale(r.totaleCorsi, 580);
  uguale(r.totale, 580);
  uguale(r.discenti, 12);
  uguale(r.risparmio, 60, 'quanto il cliente risparmia rispetto al listino');
});

prova('un corso senza discenti non incide sul totale', () => {
  const r = formazione.calcola({ righe: [corso('blsd', null, 60, 55)] });
  uguale(r.totale, 0);
});

prova('la trasferta conta solo se il corso è dal committente', () => {
  const righe = [corso('blsd', 8, 60, 55)];
  uguale(formazione.calcola({ righe, sede_tipo: 'cliente', trasferta: 50 }).totale, 490);
  uguale(formazione.calcola({ righe, sede_tipo: 'nostra', trasferta: 50 }).totale, 440,
    'riportata la sede da noi, la trasferta non deve continuare a sommarsi');
});

prova('lo sconto in percentuale e quello in valore si applicano in ordine', () => {
  const righe = [corso('blsd', 10, 60, 60)];   // 600 €
  const r = formazione.calcola({ righe, sconto_percentuale: 10, sconto_valore: 50 });
  uguale(r.sconto, 110, '10% di 600 = 60, più 50 fissi');
  uguale(r.totale, 490);
});

prova('lo sconto non può superare il totale', () => {
  const r = formazione.calcola({ righe: [corso('blsd', 1, 60, 60)], sconto_valore: 1000 });
  uguale(r.totale, 0);
  vero(r.sconti.some(s => s.ridotto), 'lo sconto ridotto va segnalato a chi compila');
});

prova('l\'IVA si calcola sul netto, non sul prezzo pieno', () => {
  const righe = [corso('blsd', 10, 60, 60)];   // 600 €
  const r = formazione.calcola({ righe, sconto_percentuale: 10, regime_iva: 'soggetto' });
  uguale(r.imponibile, 540);
  circa(r.iva, 118.8, 0.005, 'il 22% di 540');
  uguale(r.totale, 658.8);
});

prova('senza regime IVA il totale è il netto e basta', () => {
  const r = formazione.calcola({ righe: [corso('blsd', 10, 60, 60)], regime_iva: 'nessuno' });
  uguale(r.iva, 0);
  uguale(r.totale, 600);
});

prova('l\'oggetto proposto raggruppa le sigle dei corsi scelti', () => {
  uguale(formazione.oggettoProposto([{ sigla: 'BLSD' }, { sigla: 'BLSD' }]), 'PREVENTIVO CORSI BLSD');
  uguale(formazione.oggettoProposto([{ sigla: 'BLSD' }, { sigla: 'Primo soccorso' }]),
    'PREVENTIVO CORSI BLSD E PRIMO SOCCORSO');
  uguale(formazione.oggettoProposto([]), 'PREVENTIVO CORSI DI FORMAZIONE');
});

// ------------------------------------------------------------------
gruppo('Assistenze sanitarie — turni e tariffario');

prova('un turno che passa la mezzanotte non dura un tempo negativo', () => {
  uguale(assistenze.oreTurno({ dalle: '22:00', alle: '02:00' }), 4);
  uguale(assistenze.oreTurno({ dalle: '09:00', alle: '18:30' }), 9.5);
  uguale(assistenze.oreTurno({ dalle: 'boh', alle: '18:00' }), 0);
});

prova('le voci a ore si moltiplicano per la durata, quelle fisse no', () => {
  const prev = {
    voci: [
      { id: 'amb', nome: 'Ambulanza', tipo: 'oraria', prezzo: 45 },
      { id: 'gaz', nome: 'Gazebo', tipo: 'fissa', prezzo: 80 },
    ],
    calendario: [
      { data: '2026-10-10', dalle: '09:00', alle: '18:00', qta: { amb: 1, gaz: 1 } },
      { data: '2026-10-11', dalle: '09:00', alle: '13:00', qta: { amb: 1 } },
    ],
  };
  const r = assistenze.calcola(prev);
  uguale(r.totaleLordo, 665, '9h×45 + 80 + 4h×45');
  const gazebo = r.riepilogo.find(v => v.id === 'gaz');
  uguale(gazebo.ore, 0, 'le ore di una voce a prezzo fisso non vogliono dire niente');
});

// ------------------------------------------------------------------
gruppo('Trasporti lunghi — spesa viva e addebito');

const impT = trasporti.DEFAULT_IMPOSTAZIONI;

prova('il carburante esce dai km e dal consumo del mezzo', () => {
  const r = trasporti.calcola({ kmTotali: 640, mezzoId: 'ambulanza', prezzoCarburante: 1.75 }, impT);
  circa(r.litri, 640 / 9.4, 0.01);
  circa(r.carburante, (640 / 9.4) * 1.75, 0.01);
});

prova('le sezioni spente non entrano nel conto', () => {
  const base = { kmTotali: 100, mezzoId: 'ambulanza', prezzoCarburante: 1.7, tariffaKm: 1.2 };
  const spente = trasporti.calcola({ ...base, persone: 3, pastiPersona: 2, pastoCosto: 25, pastiOn: false }, impT);
  const accese = trasporti.calcola({ ...base, persone: 3, pastiPersona: 2, pastoCosto: 25, pastiOn: true }, impT);
  uguale(spente.pasti, 0);
  uguale(accese.pasti, 150);
});

prova('in Italia non ci sono pedaggi, all\'estero sì', () => {
  const base = { kmTotali: 100, mezzoId: 'ambulanza', prezzoCarburante: 1.7, pedaggi: 40 };
  uguale(trasporti.calcola({ ...base, estero: false }, impT).pedaggi, 0);
  uguale(trasporti.calcola({ ...base, estero: true }, impT).pedaggi, 40);
});

prova('l\'addebito è km per tariffa più le voci a rimborso, e il margine è la differenza', () => {
  const r = trasporti.calcola({
    kmTotali: 640, mezzoId: 'ambulanza', prezzoCarburante: 1.75, tariffaKm: 1.2,
    persone: 3, pastiOn: true, pastiPersona: 2, pastoCosto: 25,
    pernottamentoOn: true, notti: 1, camere: 2, prezzoCameraNotte: 80,
    sanitariOn: true, medicoOn: true, medico: 600,
    materialeOn: true, materiale: [{ desc: 'Ossigeno', importo: 40 }, { desc: 'DPI', importo: 25 }],
  }, impT);
  uguale(r.addebitoKm, 768);
  uguale(r.passthrough, 975, 'pasti 150 + pernottamento 160 + medico 600 + materiale 65');
  uguale(r.addebito, 1743);
  circa(r.margine, r.addebito - r.spesaReale, 0.001);
  vero(r.margine > 0, 'con questi numeri il servizio non è in perdita');
});
