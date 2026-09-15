// ============================================================
//  I CONTI DEI CENTRI DI COSTO (sezione Analisi).
//  Sono numeri su cui si prendono decisioni — «questo corso lo rifacciamo
//  o no» — e nessuno può accorgersi a occhio che sono sbagliati: una
//  fattura ripartita male o una nota di credito contata due volte
//  produce un totale credibilissimo e falso. Qui si fissano i casi che
//  quella regola deve rispettare.
// ============================================================
import { gruppo, prova, uguale, vero, circa } from './aiuto.mjs';
import {
  documenti, imputazioniPerFattura, attribuito, restoDa, daAttribuire,
  quotaNetta, vociDi, totaliDi, quadro, fuoriDaiCentri, nelPeriodo, anni,
} from '../js/analisi/calc.js';

// Le fatture arrivano dallo scadenziario già passate da withResiduo, che
// aggiunge `_stornato`: le finte qui lo dichiarano come farebbe lui.
const passiva = (id, fornitore, importo, data, stornato = 0) =>
  ({ id, fornitore, importo, data_fattura: data, _stornato: stornato, numero_fattura: id.toUpperCase() });
const attiva = (id, cliente, importo, data, stornato = 0) =>
  ({ id, cliente, importo, data_fattura: data, _stornato: stornato, numero_fattura: id.toUpperCase() });
const imp = (id, centro_id, fatturaId, importo, attivaSi = false) =>
  ({ id, centro_id, fattura_id: attivaSi ? null : fatturaId, fattura_attiva_id: attivaSi ? fatturaId : null, importo });

const CENTRI = [
  { id: 'c1', nome: 'Corso BLSD' },
  { id: 'c2', nome: 'Assistenza Fiera' },
  { id: 'c3', nome: 'Attività nuova' },
];

gruppo('Analisi — dalle fatture ai documenti');

prova('passive e attive diventano la stessa cosa con un segno davanti', () => {
  const d = documenti(
    [passiva('u1', 'Carburanti SpA', 1000, '2026-03-04')],
    [attiva('e1', 'Comune di Genova', 2500, '2026-03-10')],
  );
  uguale(d.length, 2);
  uguale(d[0].tipo, 'uscita');
  uguale(d[0].controparte, 'Carburanti SpA', 'il fornitore diventa controparte');
  uguale(d[1].tipo, 'entrata');
  uguale(d[1].controparte, 'Comune di Genova', 'e il cliente pure');
});

prova('il netto è l’importo meno quello che è stato stornato', () => {
  const [d] = documenti([passiva('u1', 'Tipografia', 1000, '2026-03-04', 250)], []);
  uguale(d.lordo, 1000);
  uguale(d.stornato, 250);
  uguale(d.netto, 750);
});

gruppo('Analisi — quanto resta da attribuire');

prova('una fattura si può attribuire in parte, e il resto si vede', () => {
  const docs = documenti([passiva('u1', 'Carburanti', 1000, '2026-03-04')], []);
  const perF = imputazioniPerFattura([imp('i1', 'c1', 'u1', 600)]);
  uguale(attribuito(docs[0], perF), 600);
  uguale(restoDa(docs[0], perF), 400);
});

prova('il resto si misura sul lordo, non sul netto', () => {
  // È sul lordo che il database impedisce di sforare: misurando sul netto
  // la pagina avrebbe offerto uno spazio che poi il salvataggio rifiuta.
  const docs = documenti([passiva('u1', 'Tipografia', 1000, '2026-03-04', 400)], []);
  const perF = imputazioniPerFattura([imp('i1', 'c1', 'u1', 800)]);
  uguale(restoDa(docs[0], perF), 200, 'restano 200, non -200');
});

prova('una fattura attribuita per intero esce dall’arretrato', () => {
  const docs = documenti([passiva('u1', 'Carburanti', 1000, '2026-03-04')], []);
  uguale(daAttribuire(docs, imputazioniPerFattura([imp('i1', 'c1', 'u1', 1000)])).length, 0);
  uguale(daAttribuire(docs, imputazioniPerFattura([imp('i1', 'c1', 'u1', 999)])).length, 1, 'un euro scoperto la tiene dentro');
});

prova('un arrotondamento non è un resto', () => {
  // Ripartizione in terzi: 333,33 + 333,33 + 333,34 lascia uno scarto di
  // centesimi che non deve far ricomparire la fattura fra le cose da fare.
  const docs = documenti([passiva('u1', 'Carburanti', 1000, '2026-03-04')], []);
  const perF = imputazioniPerFattura([
    imp('i1', 'c1', 'u1', 333.33), imp('i2', 'c2', 'u1', 333.33), imp('i3', 'c3', 'u1', 333.34),
  ]);
  uguale(daAttribuire(docs, perF).length, 0);
});

prova('l’arretrato si cerca per nome e per numero, e si filtra per verso', () => {
  const docs = documenti(
    [passiva('u1', 'Carburanti SpA', 1000, '2026-03-04')],
    [attiva('e1', 'Comune di Genova', 2500, '2026-03-10')],
  );
  const vuote = imputazioniPerFattura([]);
  uguale(daAttribuire(docs, vuote).length, 2);
  uguale(daAttribuire(docs, vuote, { tipo: 'entrata' }).map(d => d.id), ['e1']);
  uguale(daAttribuire(docs, vuote, { cerca: 'carbur' }).map(d => d.id), ['u1']);
  uguale(daAttribuire(docs, vuote, { cerca: 'E1' }).map(d => d.id), ['e1'], 'anche per numero fattura');
});

gruppo('Analisi — le note di credito abbassano le quote');

prova('una quota vale meno se la fattura è stata stornata in parte', () => {
  // 1000 € ripartiti 600/400, poi 100 di nota di credito: 540 e 360.
  const [doc] = documenti([passiva('u1', 'Tipografia', 1000, '2026-03-04', 100)], []);
  circa(quotaNetta(600, doc), 540, 0.005, 'la quota grande');
  circa(quotaNetta(400, doc), 360, 0.005, 'la quota piccola');
  circa(quotaNetta(600, doc) + quotaNetta(400, doc), doc.netto, 0.005,
    'le due quote insieme fanno esattamente il netto');
});

prova('una fattura stornata del tutto vale zero, ma resta nei conti', () => {
  const [doc] = documenti([passiva('u1', 'Tipografia', 1000, '2026-03-04', 1000)], []);
  uguale(quotaNetta(1000, doc), 0);
  const voci = vociDi('c1', [doc], [imp('i1', 'c1', 'u1', 1000)]);
  uguale(voci.length, 1, 'la riga si vede lo stesso: dice che c’è stato un costo poi annullato');
});

prova('senza note di credito la quota vale quello che c’è scritto', () => {
  const [doc] = documenti([passiva('u1', 'Carburanti', 1000, '2026-03-04')], []);
  uguale(quotaNetta(600, doc), 600);
});

gruppo('Analisi — il conto di un’attività');

const DOCS = documenti(
  [passiva('u1', 'Carburanti', 1000, '2026-03-04'), passiva('u2', 'Tipografia', 500, '2026-05-20'),
   passiva('u3', 'Vecchia', 300, '2025-11-02')],
  [attiva('e1', 'Comune', 2000, '2026-04-01'), attiva('e2', 'Azienda', 800, '2026-06-15')],
);
const IMPUTAZIONI = [
  imp('i1', 'c1', 'u1', 600), imp('i2', 'c2', 'u1', 400),
  imp('i3', 'c1', 'u2', 500),
  imp('i4', 'c1', 'e1', 2000, true),
  imp('i5', 'c2', 'e2', 800, true),
  imp('i6', 'c1', 'u3', 300),
];

prova('entrate, uscite e saldo di un’attività', () => {
  const t = totaliDi(vociDi('c1', DOCS, IMPUTAZIONI));
  uguale(t.entrate, 2000, 'entrate');
  uguale(t.uscite, 1400, 'uscite: 600 + 500 + 300');
  uguale(t.saldo, 600, 'saldo');
  uguale(t.nEntrate, 1);
  uguale(t.nUscite, 3);
});

prova('le imputazioni di un’altra attività non entrano nel conto', () => {
  const t = totaliDi(vociDi('c2', DOCS, IMPUTAZIONI));
  uguale(t.uscite, 400, 'solo la sua quota della fattura divisa');
  uguale(t.entrate, 800);
});

prova('un’attività senza niente attribuito fa zero, non fa errore', () => {
  const t = totaliDi(vociDi('c3', DOCS, IMPUTAZIONI));
  uguale([t.entrate, t.uscite, t.saldo, t.nEntrate + t.nUscite], [0, 0, 0, 0]);
});

prova('il periodo taglia via i documenti di un altro anno', () => {
  const t = totaliDi(vociDi('c1', DOCS, IMPUTAZIONI, { da: '2026-01-01', a: '2026-12-31' }));
  uguale(t.uscite, 1100, 'la fattura del 2025 resta fuori');
});

prova('una fattura senza data resta dentro a qualunque periodo', () => {
  // Escluderla la farebbe sparire dai conti senza che nessuno se ne
  // accorga: meglio vederla e andarle a mettere la data.
  const senzaData = documenti([passiva('u9', 'Ignota', 100, null)], []);
  vero(nelPeriodo(senzaData[0], { da: '2026-01-01', a: '2026-12-31' }));
  uguale(totaliDi(vociDi('c1', senzaData, [imp('i9', 'c1', 'u9', 100)], { da: '2026-01-01', a: '2026-12-31' })).uscite, 100);
});

gruppo('Analisi — il quadro d’insieme');

prova('in cima ci sono le attività in perdita, in fondo quelle vuote', () => {
  const righe = quadro(CENTRI, DOCS, IMPUTAZIONI);
  // c2: 800 entrate − 400 uscite = +400. c1: 2000 − 1400 = +600.
  // Nessuna delle due è in perdita, quindi vince il saldo più basso; c3 è
  // vuota e va in fondo comunque.
  uguale(righe.map(r => r.centro.id), ['c2', 'c1', 'c3']);
});

prova('un’attività in perdita passa davanti a una in utile', () => {
  const docs = documenti([passiva('u1', 'Carburanti', 1000, '2026-03-04')], [attiva('e1', 'Comune', 1000, '2026-03-04')]);
  const righe = quadro(
    [{ id: 'buona', nome: 'Buona' }, { id: 'perdita', nome: 'In perdita' }],
    docs,
    [imp('i1', 'perdita', 'u1', 1000), imp('i2', 'buona', 'e1', 1000, true)],
  );
  uguale(righe.map(r => r.centro.id), ['perdita', 'buona']);
});

gruppo('Analisi — quello che resta fuori');

prova('si conta quanto NON è attribuito, entrate e uscite separate', () => {
  const docs = documenti(
    [passiva('u1', 'Carburanti', 1000, '2026-03-04')],
    [attiva('e1', 'Comune', 2000, '2026-04-01'), attiva('e2', 'Azienda', 800, '2026-06-15')],
  );
  const perF = imputazioniPerFattura([imp('i1', 'c1', 'u1', 600), imp('i2', 'c1', 'e1', 2000, true)]);
  const fuori = fuoriDaiCentri(docs, perF);
  uguale(fuori.documenti, 2, 'la fattura attribuita a metà e quella non toccata');
  uguale(fuori.uscite, 400, 'i 400 non attribuiti della fattura divisa');
  uguale(fuori.entrate, 800);
});

prova('quando è tutto attribuito, fuori non resta niente', () => {
  const docs = documenti([passiva('u1', 'Carburanti', 1000, '2026-03-04')], []);
  const fuori = fuoriDaiCentri(docs, imputazioniPerFattura([imp('i1', 'c1', 'u1', 1000)]));
  uguale([fuori.documenti, fuori.uscite, fuori.entrate], [0, 0, 0]);
});

prova('gli anni proposti nel filtro sono quelli che hanno davvero un documento', () => {
  uguale(anni(DOCS), ['2026', '2025'], 'dal più recente');
  uguale(anni(documenti([passiva('u9', 'Ignota', 100, null)], [])), [], 'una fattura senza data non inventa un anno');
});
