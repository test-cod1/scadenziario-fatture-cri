// I corsi effettuati della formazione esterna: dal preventivo ai corsi, gli
// elenchi dei partecipanti incollati e le statistiche. Sono i numeri che
// finiscono in una relazione di fine anno: un discente contato due volte o
// un corso attribuito all'anno sbagliato non si notano a occhio.
import { gruppo, prova, uguale, vero, RADICE } from './aiuto.mjs';
import { pathToFileURL } from 'node:url';

const mod = (p) => import(pathToFileURL(RADICE + p).href);
const corsi = await mod('/js/formazione/corsi.js');
const calc = await mod('/js/formazione/calc.js');

gruppo('Formazione esterna — corsi effettuati');

prova('le ore si leggono dalla durata del catalogo', () => {
  uguale(corsi.oreDaDurata('16 ore'), 16);
  uguale(corsi.oreDaDurata('4,5 ore'), 4.5);
  uguale(corsi.oreDaDurata('mezza giornata'), null);
});

prova('un preventivo confermato diventa un corso per riga, con l\'importo ripartito', () => {
  const prev = {
    id: 'p1', cliente: 'Omnia', sede_tipo: 'cliente', sede: 'Via Roma 1', trasferta: 60,
    sconto_percentuale: 10, regime_iva: 'soggetto',
    righe: [
      { id: 'ps', nome: 'Primo soccorso', durata: '12 ore', discenti: 10, prezzo: 50, listino: 50, rinnovo_anni: 3 },
      { id: 'blsd', nome: 'BLSD', durata: '5 ore', discenti: 5, prezzo: 40, listino: 40 },
    ],
  };
  const c = corsi.corsiDaPreventivo(prev);
  uguale(c.length, 2);
  // imponibile: (500 + 200 + 60) − 10% = 684; ripartito 500:200
  uguale(c[0].importo + c[1].importo, 684, 'la somma torna con l\'imponibile, IVA esclusa');
  uguale(c[0].importo, 488.57);
  uguale(c[0].ore, 12);
  uguale(c[0].rinnovo_anni, 3);
  uguale(c[0].sede, 'Via Roma 1');
  uguale(c[1].stato, 'programmato');
});

prova('la ripartizione non perde il centesimo dell\'arrotondamento', () => {
  uguale(corsi.ripartisci(100, [1, 1, 1]), [33.33, 33.33, 33.34]);
  uguale(corsi.ripartisci(100, [0, 0]), [0, 0], 'senza valore nelle righe non si inventa niente');
});

prova('i presenti si contano dall\'elenco, senza gli assenti', () => {
  const c = { discenti: 15, partecipanti: [{ esito: 'idoneo' }, { esito: 'non_idoneo' }, { esito: 'assente' }] };
  uguale(corsi.discentiEffettivi(c), 2);
  uguale(corsi.idonei(c), 1);
  uguale(corsi.discentiEffettivi({ discenti: 8, partecipanti: [] }), 8, 'senza elenco vale il numero');
});

prova('l\'elenco incollato da Excel e da una mail', () => {
  const da = corsi.leggiPartecipanti('Rossi\tMario\tRSSMRA80A01D969X\nBianchi\tAnna Maria\n');
  uguale(da, [
    { cognome: 'Rossi', nome: 'Mario', cf: 'RSSMRA80A01D969X', esito: 'idoneo' },
    { cognome: 'Bianchi', nome: 'Anna Maria', cf: '', esito: 'idoneo' },
  ]);
  const mail = corsi.leggiPartecipanti('  verdi luca vrdlcu90b02d969y  \n\n');
  uguale(mail, [{ cognome: 'verdi', nome: 'luca', cf: 'VRDLCU90B02D969Y', esito: 'idoneo' }]);
  uguale(corsi.leggiPartecipanti('De Luca Giovanna\nDella Valle Anna Maria')
    .map(x => [x.cognome, x.nome]), [['De Luca', 'Giovanna'], ['Della Valle', 'Anna Maria']], 'le particelle stanno col cognome');
});

prova('i docenti scritti in un campo solo si contano uno per uno', () => {
  uguale(corsi.elencoDocenti('Rossi, Bianchi e Verdi'), ['Rossi', 'Bianchi', 'Verdi']);
  uguale(corsi.elencoDocenti(''), []);
});

const svolto = (o) => ({ stato: 'svolto', partecipanti: [], ...o });

prova('statistiche: solo i corsi svolti dell\'anno, per data di inizio', () => {
  const lista = [
    svolto({ corso_id: 'ps', corso_nome: 'PS', data_inizio: '2026-03-10', discenti: 10, ore: 12, importo: 500, cliente: 'A', docenti: 'Rossi' }),
    svolto({ corso_id: 'ps', corso_nome: 'PS', data_inizio: '2026-03-20', discenti: 5, ore: 12, importo: 250, cliente: 'b ', docenti: 'Rossi, Bianchi', sede_tipo: 'cliente' }),
    svolto({ corso_id: 'blsd', corso_nome: 'BLSD', data_inizio: '2025-11-02', discenti: 7, ore: 5, importo: 300, cliente: 'A' }),
    { stato: 'programmato', corso_nome: 'BLSD', data_inizio: '2026-12-01', discenti: 4 },
    svolto({ corso_nome: 'X', data_inizio: null, discenti: 3 }),
  ];
  const s = corsi.statistiche(lista, [], { anno: 2026, oggi: '2026-11-02' });
  uguale(s.edizioni, 2);
  uguale(s.discenti, 15);
  uguale(s.ore, 24);
  uguale(s.oreUomo, 180);
  uguale(s.ricavi, 750);
  uguale(s.committenti, 2);
  uguale(s.perMese[2], { edizioni: 2, discenti: 15 });
  uguale(s.precedente.edizioni, 1, 'confronto con l\'anno prima');
  uguale(s.perDocente.map(d => [d.nome, d.ore]), [['Rossi', 24], ['Bianchi', 12]]);
  uguale(s.sedi, { nostra: 1, cliente: 1 });
  uguale(s.senzaData, 1, 'il corso senza data si segnala, non si attribuisce');
  uguale(s.inProgramma, 1);
  const tutti = corsi.statistiche(lista, [], { anno: null });
  uguale(tutti.edizioni, 4, 'in "tutti gli anni" entra anche quello senza data');
});

prova('statistiche: conversione dei preventivi sulle sole risposte', () => {
  const prev = [
    { stato: 'confermato', data_documento: '2026-02-01', totale: 600 },
    { stato: 'confermato', data_documento: '2026-05-01', totale: 400 },
    { stato: 'annullato', data_documento: '2026-06-01', totale: 300 },
    { stato: 'inviato', data_documento: '2026-10-01', totale: 300 },
    { stato: 'bozza', data_documento: '2026-10-05', totale: 100 },
    { stato: 'confermato', data_documento: '2025-12-01', totale: 999 },
  ];
  const s = corsi.statistiche([], prev, { anno: 2026 }).preventivi;
  uguale(s.emessi, 4, 'le bozze non sono uscite');
  uguale(s.conversione, 2 / 3, 'gli inviati in attesa non sono un no');
  uguale(s.valoreConfermato, 1000);
  uguale(s.valoreMedio, 500);
});

prova('il rinnovo si conta dalla fine del corso svolto, se c\'è', () => {
  const catalogo = [{ id: 'ps', rinnovo_anni: 3 }];
  const prev = { id: 'p1', cliente: 'A', stato: 'confermato', data_documento: '2023-01-10', righe: [{ id: 'ps' }] };
  const date = corsi.dateCorsiSvolti([
    { preventivo_id: 'p1', stato: 'svolto', data_inizio: '2023-04-01', data_fine: '2023-04-02' },
    { preventivo_id: 'p1', stato: 'programmato', data_inizio: '2023-09-01' },
  ]);
  uguale(date.get('p1'), '2023-04-02');
  const r = calc.daRicontattare([prev], catalogo, '2026-02-01', 120, date);
  uguale(r[0].rinnovo, '2026-04-02');
  vero(calc.daRicontattare([prev], catalogo, '2026-02-01').length === 1, 'senza corsi resta la data del preventivo');
});
