// ============================================================
//  ALLINEARE L'ARCHIVIO AL REGISTRO DI FATTURAZIONE.
//  Queste regole decidono che cosa viene CANCELLATO da un archivio di
//  fatture, e lo decidono in automatico su qualche centinaio di righe:
//  è il punto del progetto in cui un errore costa di più, perché una
//  fattura cancellata insieme ai suoi incassi non si ricostruisce
//  guardando il codice. Le prove che contano di più, qui, sono quelle su
//  quello che NON deve succedere.
// ============================================================
import { gruppo, prova, uguale, vero } from './aiuto.mjs';
import { chiave, leggiRegistro, conStoria, pianifica, campiCsv } from '../tools/allineamento.mjs';

const fat = (id, numero, data, cliente, importo, created_at = '2026-01-01T00:00:00Z') =>
  ({ id, numero_fattura: numero, data_fattura: data, cliente, importo, stato: 'da_incassare', created_at });
const reg = (numero, data, cliente, importo) => ({ numero, data, cliente, importo });

gruppo('Allineamento — riconoscere la stessa fattura');

prova('la chiave è numero più anno', () => {
  uguale(chiave('1', '2026-01-14'), '1/2026');
  uguale(chiave('1', '2026-01-28'), '1/2026', 'la data dentro l’anno non cambia la fattura');
  uguale(chiave('1', '2025-01-14'), '1/2025', 'lo stesso numero in un altro anno è un’altra fattura');
});

prova('gli zeri iniziali non fanno una fattura diversa', () => {
  uguale(chiave('007', '2026-03-01'), chiave('7', '2026-03-01'));
});

prova('numero o data mancanti non diventano una chiave che collide', () => {
  uguale(chiave(null, '2026-01-01'), '?/2026');
  uguale(chiave('5', null), '5/?');
});

gruppo('Allineamento — leggere il registro');

prova('legge il CSV che si rilegge a occhio, totali esclusi', () => {
  const r = leggiRegistro([
    'N. fattura;Data;Cliente;Totale documento',
    "1;14/01/2026;COMUNE DI GENOVA ATS 34 PRA';279,27",
    '2;15/01/2026;ARPAL;1.234,50',
    '',
    ';;2 fatture;1.513,77',
  ].join('\r\n'));
  uguale(r.length, 2, 'la riga dei totali non è una fattura');
  uguale(r[0].data, '2026-01-14', 'la data diventa quella del database');
  uguale(r[0].cliente, "COMUNE DI GENOVA ATS 34 PRA'");
  uguale(r[1].importo, 1234.5, 'il punto delle migliaia e la virgola dei decimi');
});

prova('un punto e virgola dentro un nome fra virgolette non sposta le colonne', () => {
  uguale(campiCsv('1;14/01/2026;"ROSSI; BIANCHI SRL";100,00').length, 4);
  uguale(campiCsv('1;14/01/2026;"ROSSI; BIANCHI SRL";100,00')[2], 'ROSSI; BIANCHI SRL');
  uguale(campiCsv('a;"con ""virgolette"" dentro";c')[1], 'con "virgolette" dentro');
});

prova('le colonne si riconoscono dal nome, non dalla posizione', () => {
  const r = leggiRegistro([
    'Cliente;Totale documento;N. fattura;Data',
    'ARPAL;1.234,50;7;03/03/2026',
  ].join('\n'));
  uguale(r.length, 1);
  uguale(r[0].numero, '7');
  uguale(r[0].cliente, 'ARPAL');
  uguale(r[0].importo, 1234.5);
  uguale(r[0].data, '2026-03-03');
});

prova('un registro senza le colonne attese si ferma invece di indovinare', () => {
  let esploso = false;
  try { leggiRegistro('pippo;pluto\n1;2'); } catch { esploso = true; }
  vero(esploso, 'meglio fermarsi che leggere l’importo dalla casella sbagliata');
});

prova('la colonna degli incassi è facoltativa', () => {
  const senza = leggiRegistro('N. fattura;Data;Cliente;Totale documento\n1;14/01/2026;ARPAL;100,00');
  uguale(senza[0].incassata, null);
  const con = leggiRegistro('N. fattura;Data;Cliente;Totale documento;Incassata il\n1;14/01/2026;ARPAL;100,00;20/02/2026');
  uguale(con[0].incassata, '2026-02-20');
  const vuota = leggiRegistro('N. fattura;Data;Cliente;Totale documento;Incassata il\n1;14/01/2026;ARPAL;100,00;');
  uguale(vuota[0].incassata, null);
});

gruppo('Allineamento — i doppioni');

prova('fra due righe uguali e vuote ne resta una', () => {
  const f = conStoria([
    fat('a', '5', '2026-02-01', 'ARPAL', 100, '2026-02-01T10:00:00Z'),
    fat('b', '5', '2026-02-20', 'ARPAL', 100, '2026-03-01T10:00:00Z'),
  ]);
  const p = pianifica([], f);
  uguale(p.daCancellare.length, 1);
  uguale(p.daCancellare[0].id, 'b', 'resta la più vecchia, che è quella a cui puntano i collegamenti');
  uguale(p.doppioniIrrisolti.length, 0);
});

prova('non si cancella mai la riga che ha incassi', () => {
  const f = conStoria(
    [fat('a', '5', '2026-02-01', 'ARPAL', 100, '2026-02-01T10:00:00Z'),
      fat('b', '5', '2026-02-20', 'ARPAL', 100, '2026-03-01T10:00:00Z')],
    { incassi: [{ fattura_attiva_id: 'b', importo: 100 }] });
  const p = pianifica([], f);
  uguale(p.daCancellare.length, 1);
  uguale(p.daCancellare[0].id, 'a', 'si tiene quella con la storia, anche se è la più recente');
});

prova('se la storia ce l’hanno tutte e due, non si cancella niente', () => {
  const f = conStoria(
    [fat('a', '5', '2026-02-01', 'ARPAL', 100), fat('b', '5', '2026-02-20', 'ARPAL', 100)],
    { incassi: [{ fattura_attiva_id: 'a', importo: 50 }], quote: [{ fattura_attiva_id: 'b' }] });
  const p = pianifica([], f);
  uguale(p.daCancellare.length, 0, 'unire due storie è una decisione, non un’operazione');
  uguale(p.doppioniIrrisolti.length, 1);
  uguale(p.doppioniIrrisolti[0].chiave, '5/2026');
});

prova('una quota su un centro di costo conta come storia', () => {
  const f = conStoria(
    [fat('a', '5', '2026-02-01', 'ARPAL', 100, '2026-01-01T00:00:00Z'),
      fat('b', '5', '2026-02-20', 'ARPAL', 100, '2026-02-01T00:00:00Z')],
    { quote: [{ fattura_attiva_id: 'b' }] });
  const p = pianifica([], f);
  uguale(p.daCancellare[0].id, 'a');
});

prova('tre righe uguali e vuote diventano una', () => {
  const f = conStoria([
    fat('a', '5', '2026-02-01', 'ARPAL', 100, '2026-01-01T00:00:00Z'),
    fat('b', '5', '2026-02-02', 'ARPAL', 100, '2026-02-01T00:00:00Z'),
    fat('c', '5', '2026-02-03', 'ARPAL', 100, '2026-03-01T00:00:00Z'),
  ]);
  uguale(pianifica([], f).daCancellare.length, 2);
});

gruppo('Allineamento — inserire, correggere, lasciar stare');

prova('si inserisce solo quello che in archivio non c’è', () => {
  const f = conStoria([fat('a', '1', '2026-01-28', 'ARPAL', 100)]);
  const p = pianifica([reg('1', '2026-01-14', 'ARPAL', 100), reg('2', '2026-01-15', 'ASL 3', 200)], f);
  uguale(p.daInserire.length, 1);
  uguale(p.daInserire[0].numero, '2');
});

prova('la data diversa NON fa un doppione: corregge quella che c’è', () => {
  // È il caso vero dell'archivio: la n. 1 risultava al 28/01 e il registro
  // la dà al 14/01. Cercandola per data sarebbe stata inserita due volte.
  const f = conStoria([fat('a', '1', '2026-01-28', 'COMUNE  ATS35', 7436)]);
  const p = pianifica([reg('1', '2026-01-14', 'COMUNE DI GENOVA ATS 35 CENTRO OVEST', 7436)], f);
  uguale(p.daInserire.length, 0, 'è la stessa fattura, non una nuova');
  uguale(p.daCorreggere.length, 1);
  uguale(p.daCorreggere[0].r.data, '2026-01-14');
  uguale(p.daCorreggere[0].r.cliente, 'COMUNE DI GENOVA ATS 35 CENTRO OVEST');
});

prova('quello che già coincide non viene toccato', () => {
  const f = conStoria([fat('a', '1', '2026-01-14', 'ARPAL', 100)]);
  const p = pianifica([reg('1', '2026-01-14', 'ARPAL', 100)], f);
  uguale(p.daCorreggere.length, 0);
  uguale(p.daInserire.length, 0);
  uguale(p.daCancellare.length, 0);
});

prova('l’importo non scende sotto quanto è già stato incassato', () => {
  const f = conStoria([fat('a', '1', '2026-01-14', 'ARPAL', 1000)],
    { incassi: [{ fattura_attiva_id: 'a', importo: 800 }] });
  const p = pianifica([reg('1', '2026-01-14', 'ARPAL', 500)], f);
  uguale(p.daCorreggere.length, 0, 'abbassarlo di nascosto nasconderebbe l’errore');
  uguale(p.bloccate.length, 1);
});

prova('una nota di credito conta come l’incasso, per quella soglia', () => {
  const f = conStoria([fat('a', '1', '2026-01-14', 'ARPAL', 1000)],
    { storni: [{ fattura_attiva_id: 'a', importo: 900 }] });
  uguale(pianifica([reg('1', '2026-01-14', 'ARPAL', 500)], f).bloccate.length, 1);
});

prova('alzare l’importo si può sempre', () => {
  const f = conStoria([fat('a', '1', '2026-01-14', 'ARPAL', 100)],
    { incassi: [{ fattura_attiva_id: 'a', importo: 100 }] });
  uguale(pianifica([reg('1', '2026-01-14', 'ARPAL', 150)], f).daCorreggere.length, 1);
});

prova('un numero rimasto doppio non si corregge', () => {
  const f = conStoria(
    [fat('a', '5', '2026-02-01', 'ARPAL', 100), fat('b', '5', '2026-02-20', 'ASL 3', 100)],
    { incassi: [{ fattura_attiva_id: 'a', importo: 10 }], quote: [{ fattura_attiva_id: 'b' }] });
  const p = pianifica([reg('5', '2026-02-01', 'ARPAL', 999)], f);
  uguale(p.daCorreggere.length, 0, 'non si sa quale delle due il registro stia descrivendo');
  uguale(p.daInserire.length, 0, 'e nemmeno se ne aggiunge una terza');
});

prova('quello che sta in archivio e non nel registro si elenca, non si cancella', () => {
  const f = conStoria([
    fat('a', '1', '2026-01-14', 'ARPAL', 100),
    fat('b', '11', '2026-02-14', 'ASL 3', 200),      // numero annullato
    fat('c', '90', '2025-05-10', 'ARPAL', 300),      // altro anno
  ]);
  const p = pianifica([reg('1', '2026-01-14', 'ARPAL', 100)], f);
  uguale(p.fuoriRegistro.length, 1);
  uguale(p.fuoriRegistro[0].id, 'b');
  uguale(p.altriAnni.length, 1);
  uguale(p.altriAnni[0].id, 'c');
  uguale(p.daCancellare.length, 0, 'nessuna delle due viene toccata');
});

gruppo('Allineamento — gli incassi');

const regPag = (numero, data, cliente, importo, incassata) =>
  ({ numero, data, cliente, importo, incassata });

prova('una fattura che nasce ora porta con sé il suo incasso', () => {
  const p = pianifica([regPag('1', '2026-01-14', 'ARPAL', 100, '2026-02-20')], conStoria([]));
  uguale(p.daInserire.length, 1);
  uguale(p.daIncassare.length, 1);
  uguale(p.daIncassare[0].f, null, 'la fattura non esiste ancora: l’id si trova dopo averla inserita');
});

prova('una fattura già in archivio e senza incassi ne riceve uno', () => {
  const f = conStoria([fat('a', '1', '2026-01-14', 'ARPAL', 100)]);
  const p = pianifica([regPag('1', '2026-01-14', 'ARPAL', 100, '2026-02-20')], f);
  uguale(p.daIncassare.length, 1);
  uguale(p.daIncassare[0].f.id, 'a');
});

prova('un incasso registrato a mano non viene toccato', () => {
  const f = conStoria([fat('a', '1', '2026-01-14', 'ARPAL', 100)],
    { incassi: [{ fattura_attiva_id: 'a', importo: 40 }] });
  const p = pianifica([regPag('1', '2026-01-14', 'ARPAL', 100, '2026-02-20')], f);
  uguale(p.daIncassare.length, 0, 'il registro conosce una data sola e l’importo pieno: ne sa meno di chi l’ha scritto');
  uguale(p.incassiGiaPresenti.length, 1);
});

prova('senza data di incasso non si registra niente', () => {
  const f = conStoria([fat('a', '1', '2026-01-14', 'ARPAL', 100)]);
  uguale(pianifica([regPag('1', '2026-01-14', 'ARPAL', 100, null)], f).daIncassare.length, 0);
});

prova('un incasso datato prima dell’emissione si registra lo stesso', () => {
  // Capita davvero: un corso pagato in anticipo e fatturato dopo. È un dato
  // da guardare, non da rifiutare — e lo strumento lo segnala.
  const f = conStoria([fat('a', '1', '2026-06-22', 'ARPAL', 100)]);
  const p = pianifica([regPag('1', '2026-06-22', 'ARPAL', 100, '2026-05-25')], f);
  uguale(p.daIncassare.length, 1);
});

prova('su un doppione irrisolto non si tocca nemmeno l’incasso', () => {
  const f = conStoria(
    [fat('a', '5', '2026-02-01', 'ARPAL', 100), fat('b', '5', '2026-02-20', 'ARPAL', 100)],
    { incassi: [{ fattura_attiva_id: 'a', importo: 10 }], quote: [{ fattura_attiva_id: 'b' }] });
  uguale(pianifica([regPag('5', '2026-02-01', 'ARPAL', 100, '2026-03-01')], f).daIncassare.length, 0);
});

gruppo('Allineamento — rieseguire non deve fare danni');

prova('la seconda volta non c’è più niente da fare', () => {
  const registro = [reg('1', '2026-01-14', 'ARPAL', 100), reg('2', '2026-01-15', 'ASL 3', 200)];
  // L'archivio come sarebbe dopo una prima applicazione riuscita.
  const f = conStoria([
    fat('a', '1', '2026-01-14', 'ARPAL', 100),
    fat('b', '2', '2026-01-15', 'ASL 3', 200),
  ]);
  const p = pianifica(registro, f);
  uguale(p.daCancellare.length, 0);
  uguale(p.daCorreggere.length, 0);
  uguale(p.daInserire.length, 0);
  uguale(p.doppioniIrrisolti.length, 0);
  uguale(p.fuoriRegistro.length, 0);
});

prova('su un archivio vuoto entra tutto il registro, e nient’altro', () => {
  const registro = [reg('1', '2026-01-14', 'ARPAL', 100), reg('2', '2026-01-15', 'ASL 3', 200)];
  const p = pianifica(registro, conStoria([]));
  uguale(p.daInserire.length, 2);
  uguale(p.daCancellare.length, 0);
  uguale(p.fuoriRegistro.length, 0);
});
