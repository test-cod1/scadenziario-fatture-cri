// ============================================================
//  IL REPORT DEL FATTURATO (sezione Analisi).
//  Qui non si sbaglia un totale: si sbaglia una lettura. Una nota di
//  credito portata sul mese sbagliato, un cliente contato due volte
//  perché scritto in due modi, una concentrazione più bassa del vero —
//  tutte cose che producono una pagina credibilissima e falsa, su cui
//  poi qualcuno decide se una convenzione si rinnova. Le regole che
//  quella pagina deve rispettare stanno scritte qui.
// ============================================================
import { gruppo, prova, uguale, vero, falso, circa } from './aiuto.mjs';
import {
  chiaveCliente, nelPeriodoFatture, anniFatturato, riepilogo, mediana,
  perCliente, concentrazione, livelloConcentrazione, perMese, perAnno,
  totaleAnno, taglioConfronto, giorniIncasso, tempiDiIncasso, anzianitaCredito,
  creditiVecchi, coperturaCentri, lacune, netto, residuo,
} from '../js/analisi/fatturato.js';
import { imputazioniPerFattura } from '../js/analisi/calc.js';

// Le fatture arrivano dallo scadenziario già passate da withResiduo, che
// aggiunge `_incassato`, `_stornato` e `_residuo`: le finte qui li
// dichiarano come farebbe lui.
function fat(id, cliente, importo, data, { incassi = [], stornato = 0, stato, numero = id.toUpperCase() } = {}) {
  const inc = incassi.reduce((s, p) => s + p.importo, 0);
  const res = Math.max(0, importo - inc - stornato);
  return {
    id, cliente, importo, data_fattura: data, numero_fattura: numero,
    incassi: incassi.map((p, i) => ({ id: `${id}-p${i}`, ...p })),
    _incassato: inc, _stornato: stornato, _residuo: res,
    stato: stato || (res <= 0.005 ? (stornato > 0 && inc === 0 ? 'stornata' : 'incassata')
      : inc > 0 ? 'incassata_parziale' : 'da_incassare'),
  };
}

gruppo('Analisi — fatturato: i clienti sono gli stessi anche scritti diversi');

prova('maiuscole e spazi doppi non fanno due clienti', () => {
  uguale(chiaveCliente('COMUNE DI GENOVA  ATS35'), chiaveCliente('Comune di Genova ATS35'));
  uguale(chiaveCliente('  Asl 3  '), 'ASL 3');
  uguale(chiaveCliente(''), '—', 'senza nome resta una riga sola, non sparisce');
});

prova('due grafie dello stesso ente finiscono in una riga sola', () => {
  const g = perCliente([
    fat('a', 'COMUNE DI GENOVA  ATS35', 1000, '2026-01-10'),
    fat('b', 'Comune di Genova ATS35', 500, '2026-02-10'),
    fat('c', 'ASL 3', 500, '2026-03-10'),
  ]);
  uguale(g.length, 2, 'due clienti, non tre');
  uguale(g[0].n, 2);
  circa(g[0].netto, 1500);
  uguale(g[0].cliente, 'COMUNE DI GENOVA  ATS35', 'si mostra la prima grafia incontrata, non una inventata');
});

gruppo('Analisi — fatturato: il periodo');

prova('una fattura senza data resta dentro ogni periodo', () => {
  const righe = [
    fat('a', 'Tizio', 100, '2026-05-01'),
    fat('b', 'Caio', 200, null),
    fat('c', 'Sempronio', 300, '2025-05-01'),
  ];
  const dentro = nelPeriodoFatture(righe, { da: '2026-01-01', a: '2026-12-31' });
  uguale(dentro.length, 2);
  vero(dentro.some(f => f.id === 'b'), 'la fattura senza data non è «fuori dall’anno»: le manca la data');
  falso(dentro.some(f => f.id === 'c'));
});

prova('gli anni proposti sono solo quelli in cui c’è davvero una fattura', () => {
  const a = anniFatturato([fat('a', 'T', 1, '2026-01-01'), fat('b', 'T', 1, '2024-01-01'), fat('c', 'T', 1, null)]);
  uguale(a.join(','), '2026,2024');
});

gruppo('Analisi — fatturato: il riepilogo');

prova('il fatturato è al netto delle note di credito', () => {
  const r = riepilogo([
    fat('a', 'Tizio', 1000, '2026-01-10', { stornato: 100 }),
    fat('b', 'Caio', 500, '2026-02-10'),
  ]);
  circa(r.lordo, 1500);
  circa(r.stornato, 100);
  circa(r.netto, 1400, 0.005, 'lo storno abbassa il fatturato, non ci si aggiunge');
  uguale(r.nStornate, 1);
});

prova('mediana e media dicono due cose diverse, e servono entrambe', () => {
  // Cento assistenze da 90 € e una convenzione da 22.600: la media
  // racconta una fattura tipo che non esiste.
  const righe = [fat('big', 'Comune', 22600, '2026-01-10')];
  for (let i = 0; i < 9; i++) righe.push(fat(`s${i}`, 'Vari', 90, '2026-02-10'));
  const r = riepilogo(righe);
  circa(r.mediano, 90, 0.005, 'la fattura di tutti i giorni vale 90 €');
  vero(r.medio > 2000, 'la media è spostata dalla convenzione, ed è giusto che si veda');
});

prova('la mediana di un elenco pari è la media dei due centrali', () => {
  uguale(mediana([1, 2, 3, 4]), 2.5);
  uguale(mediana([]), null, 'senza numeri non si inventa uno zero');
});

prova('incassato e residuo non si confondono col fatturato', () => {
  const r = riepilogo([
    fat('a', 'Tizio', 1000, '2026-01-10', { incassi: [{ importo: 400, data_incasso: '2026-02-01' }] }),
    fat('b', 'Caio', 500, '2026-02-10'),
  ]);
  circa(r.incassato, 400);
  circa(r.residuo, 1100);
  uguale(r.nAperte, 2);
  circa(r.quotaIncassata, 400 / 1500, 0.0001);
});

gruppo('Analisi — fatturato: da chi dipendiamo');

prova('la quota cumulata dice quanti clienti fanno l’80%', () => {
  const righe = [
    fat('a', 'Grande', 700, '2026-01-10'),
    fat('b', 'Medio', 200, '2026-01-10'),
    fat('c', 'Piccolo', 60, '2026-01-10'),
    fat('d', 'Minimo', 40, '2026-01-10'),
  ];
  const g = perCliente(righe);
  uguale(g[0].cliente, 'Grande', 'l’elenco parte da chi pesa di più');
  circa(g[0].quota, 0.7, 0.0001);
  circa(g[1].quotaCumulata, 0.9, 0.0001);
  const c = concentrazione(g);
  uguale(c.clientiPer80, 2, 'il primo da solo non arriva all’80%, con il secondo lo supera');
  circa(c.primi1, 0.7, 0.0001);
  uguale(c.nClienti, 4);
});

prova('i clienti dell’80% comprendono quello che scavalca la soglia', () => {
  // A=500, B=350, C=150: A da solo fa il 50%, con B si arriva all'85%.
  // La pagina scrive «2 clienti fanno l’80%» ed evidenzia le prime
  // `clientiPer80` righe: una soglia sulla cumulata (≤ 80%) avrebbe
  // evidenziato solo A, contraddicendo il numero scritto sopra.
  const g = perCliente([
    fat('a', 'A', 500, '2026-01-10'),
    fat('b', 'B', 350, '2026-01-10'),
    fat('c', 'C', 150, '2026-01-10'),
  ]);
  const c = concentrazione(g);
  uguale(c.clientiPer80, 2);
  vero(g[1].quotaCumulata > 0.8, 'la seconda riga sta sopra l’80% e va evidenziata lo stesso');
  uguale(g.slice(0, c.clientiPer80).map(x => x.cliente), ['A', 'B']);
});

prova('l’indice di Herfindahl distingue un cliente solo da tanti uguali', () => {
  const uno = concentrazione(perCliente([fat('a', 'Unico', 1000, '2026-01-10')]));
  circa(uno.hhi, 1, 0.0001, 'un cliente solo: dipendenza totale');
  const tanti = concentrazione(perCliente(
    Array.from({ length: 10 }, (_, i) => fat(`f${i}`, `Cliente ${i}`, 100, '2026-01-10'))));
  circa(tanti.hhi, 0.1, 0.0001);
  uguale(livelloConcentrazione(uno.hhi).chiave, 'alta');
  uguale(livelloConcentrazione(tanti.hhi).chiave, 'bassa');
});

prova('senza fatture la concentrazione è zero e non una divisione per zero', () => {
  const c = concentrazione(perCliente([]));
  uguale(c.nClienti, 0);
  uguale(c.hhi, 0);
  uguale(c.clientiPer80, 0);
  uguale(c.primo, null);
});

gruppo('Analisi — fatturato: l’andamento');

prova('lo storno pesa sul mese della fattura, non su quello della nota', () => {
  // Fattura di marzo, nota di credito di settembre: marzo vale 900, e
  // settembre non ha nessun buco.
  const mesi = perMese([fat('a', 'Tizio', 1000, '2026-03-10', { stornato: 100 })], '2026');
  circa(mesi[2].valore, 900);
  circa(mesi[8].valore, 0);
});

prova('i dodici mesi ci sono tutti, anche quelli vuoti', () => {
  const mesi = perMese([fat('a', 'Tizio', 100, '2026-07-10')], '2026');
  uguale(mesi.length, 12);
  circa(mesi[11].cumulato, 100, 0.005, 'il progressivo tiene il valore anche nei mesi senza fatture');
});

prova('il confronto con l’anno prima si ferma dove non c’è nulla da confrontare', () => {
  const righe = [
    fat('a', 'Tizio', 100, '2026-01-10'),
    fat('b', 'Tizio', 50, '2025-01-10'),
    fat('c', 'Tizio', 80, '2026-02-10'),
  ];
  const mesi = perMese(righe, '2026');
  circa(mesi[0].variazione, 1, 0.0001, 'da 50 a 100 è +100%');
  uguale(mesi[1].variazione, null, 'da zero a 80 non è «+infinito%»: è un confronto che non esiste');
  circa(totaleAnno(righe, '2025'), 50);
});

prova('l’anno in corso si confronta con l’anno prima alla stessa data', () => {
  // Stesso passo nei due anni: a fine settembre il 2026 ha nove mesi di
  // fatture, e contro i dodici del 2025 sembrerebbe un calo del 25%.
  const righe = [];
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    righe.push(fat(`p${m}`, 'T', 100, `2025-${mm}-15`));
    if (m <= 9) righe.push(fat(`c${m}`, 'T', 100, `2026-${mm}-15`));
  }
  const oggi = '2026-09-27';
  const finoAl = taglioConfronto('2026', oggi);
  uguale(finoAl, '09-27');
  circa(totaleAnno(righe, '2025', finoAl), 900, 0.005, 'da gennaio al 27 settembre, non l’anno intero');
  circa(totaleAnno(righe, '2025'), 1200, 0.005, 'senza taglio resta l’anno intero');
  uguale(taglioConfronto('2025', oggi), '', 'un anno già chiuso si confronta intero');
  uguale(taglioConfronto('', oggi), '', 'su «tutti gli anni» non c’è confronto');
  // Il giorno stesso conta: una fattura del 27/09/2025 è dentro.
  circa(totaleAnno([fat('x', 'T', 10, '2025-09-27'), fat('y', 'T', 5, '2025-09-28')], '2025', finoAl), 10);
});

prova('su «tutti gli anni» si guarda un anno per colonna', () => {
  const a = perAnno([
    fat('a', 'T', 100, '2025-01-10'),
    fat('b', 'T', 200, '2026-01-10'),
    fat('c', 'T', 300, null),
  ]);
  uguale(a.length, 2, 'la fattura senza data non fa un anno a sé');
  uguale(a[0].anno, '2025');
  circa(a[1].valore, 200);
});

gruppo('Analisi — fatturato: quanto ci mettono a pagarci');

prova('i giorni si contano solo sulle fatture chiuse davvero', () => {
  const chiusa = fat('a', 'Tizio', 100, '2026-01-01', { incassi: [{ importo: 100, data_incasso: '2026-02-10' }] });
  uguale(giorniIncasso(chiusa), 40);
  const parziale = fat('b', 'Caio', 100, '2026-01-01', { incassi: [{ importo: 50, data_incasso: '2026-02-10' }] });
  uguale(giorniIncasso(parziale), null, 'un acconto non dice quando la fattura sarà chiusa');
  const aperta = fat('c', 'Sempronio', 100, '2026-01-01');
  uguale(giorniIncasso(aperta), null);
});

prova('una nota di credito chiude la partita ma non è un pagamento', () => {
  const stornata = fat('a', 'Tizio', 100, '2026-01-01', { stornato: 100 });
  uguale(stornata.stato, 'stornata');
  uguale(giorniIncasso(stornata), null, 'contarla accorcerebbe i tempi senza che sia entrato un euro');
});

prova('la distribuzione dice quello che la media nasconde', () => {
  const righe = [
    fat('a', 'T', 100, '2026-01-01', { incassi: [{ importo: 100, data_incasso: '2026-01-11' }] }),  // 10 gg
    fat('b', 'T', 100, '2026-01-01', { incassi: [{ importo: 100, data_incasso: '2026-01-21' }] }),  // 20 gg
    fat('c', 'T', 100, '2026-01-01', { incassi: [{ importo: 100, data_incasso: '2027-01-01' }] }),  // 365 gg
  ];
  const t = tempiDiIncasso(righe);
  uguale(t.n, 3);
  uguale(t.mediana, 20, 'la mediana resta dove sta la maggioranza');
  vero(t.media > 100, 'la media la tira su la fattura dimenticata per un anno');
  uguale(t.peggiore, 365);
  uguale(t.fasce.find(f => f.chiave === '0-30').n, 2);
  uguale(t.fasce.find(f => f.chiave === '180+').n, 1);
});

gruppo('Analisi — fatturato: il credito aperto');

prova('l’anzianità si conta dalla data della fattura', () => {
  const righe = [
    fat('a', 'T', 1000, '2026-06-01'),                          // 29 gg al 30/06
    fat('b', 'T', 500, '2025-12-01'),                           // oltre 180
    fat('c', 'T', 300, '2026-06-01', { incassi: [{ importo: 300, data_incasso: '2026-06-02' }] }),
  ];
  const e = anzianitaCredito(righe, '2026-06-30');
  circa(e.totale, 1500, 0.005, 'la fattura già incassata non è credito');
  circa(e.fasce.find(f => f.chiave === '0-30').importo, 1000);
  circa(e.fasce.find(f => f.chiave === '180+').importo, 500);
});

prova('un credito senza data non sparisce: si conta a parte', () => {
  const e = anzianitaCredito([fat('a', 'T', 400, null)], '2026-06-30');
  circa(e.totale, 400);
  uguale(e.senzaData.n, 1);
  circa(e.senzaData.importo, 400);
  uguale(e.fasce.reduce((s, f) => s + f.n, 0), 0, 'non viene infilata in una fascia inventata');
});

prova('le più vecchie vengono prima, perché sono quelle da telefonare', () => {
  const v = creditiVecchi([
    fat('a', 'T', 100, '2026-06-01'),
    fat('b', 'T', 100, '2025-01-01'),
    fat('c', 'T', 100, '2026-06-01', { incassi: [{ importo: 100, data_incasso: '2026-06-05' }] }),
  ], '2026-06-30', 5);
  uguale(v.length, 2, 'quella incassata non è un credito');
  uguale(v[0].f.id, 'b');
  vero(v[0].giorni > 500);
});

gruppo('Analisi — fatturato: il ponte con i centri di costo');

prova('la copertura misura quanto del fatturato sta dentro un’attività', () => {
  const righe = [
    fat('a', 'T', 1000, '2026-01-10'),
    fat('b', 'T', 500, '2026-02-10'),
  ];
  const perFattura = imputazioniPerFattura([
    { id: 'i1', centro_id: 'c1', fattura_attiva_id: 'a', importo: 1000 },
    { id: 'i2', centro_id: 'c1', fattura_attiva_id: 'b', importo: 200 },
  ]);
  const c = coperturaCentri(righe, perFattura);
  circa(c.attribuito, 1200);
  circa(c.scoperto, 300);
  uguale(c.nScoperte, 1, 'la fattura attribuita solo in parte conta come scoperta per la differenza');
  circa(c.quota, 0.8, 0.0001);
});

prova('una quota lorda si confronta con un fatturato netto, non con sé stessa', () => {
  // Fattura da 1000 attribuita per intero, poi stornata di 100: vale 900
  // di fatturato e 900 di attribuito, non 1000 su 900 (che darebbe una
  // copertura sopra il 100%).
  const righe = [fat('a', 'T', 1000, '2026-01-10', { stornato: 100 })];
  const perFattura = imputazioniPerFattura([{ id: 'i1', centro_id: 'c1', fattura_attiva_id: 'a', importo: 1000 }]);
  const c = coperturaCentri(righe, perFattura);
  circa(c.attribuito, 900);
  circa(c.scoperto, 0);
  uguale(c.nScoperte, 0);
  circa(c.quota, 1, 0.0001);
});

gruppo('Analisi — fatturato: quello che manca');

prova('i buchi nei dati si contano e si dicono', () => {
  const l = lacune([
    fat('a', 'T', 100, null),
    fat('b', 'T', 0, '2026-01-10'),
    fat('c', 'T', 100, '2026-01-10', { numero: '' }),
  ]);
  uguale(l.senzaData, 1);
  uguale(l.aZero, 1);
  uguale(l.senzaNumero, 1);
});

prova('netto e residuo non scendono mai sotto zero', () => {
  // Una nota di credito più grande della fattura è un dato sbagliato, ma
  // deve produrre uno zero e non un numero negativo che poi si somma agli
  // altri e abbassa il fatturato di tutti.
  const f = fat('a', 'T', 100, '2026-01-10', { stornato: 300 });
  uguale(netto(f), 0);
  uguale(residuo(f), 0);
});
