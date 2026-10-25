// ============================================================
//  QUANDO DUE NOMI SONO LO STESSO ENTE.
//  Qui il rischio non è simmetrico: due clienti lasciati separati per
//  sbaglio si correggono in qualsiasi momento, due uniti per sbaglio non
//  si separano più — le fatture hanno perso la grafia che li distingueva.
//  Per questo le prove che contano di più sono quelle sui nomi che NON
//  devono finire insieme.
// ============================================================
import { gruppo, prova, uguale, vero, falso } from './aiuto.mjs';
import {
  chiaveCliente, chiaveStretta, unoIniziaLAltro, variantiDi, gruppiDoppi,
} from '../js/lib/nomiClienti.js';

const fat = (cliente, importo = 100, data = '2026-01-10') =>
  ({ id: Math.random().toString(36).slice(2), cliente, importo, data_fattura: data });

// Dai nomi ai gruppi in un passo solo: nelle prove interessa quasi sempre
// il risultato, non le varianti intermedie.
const gruppiDa = (...nomi) => gruppiDoppi(variantiDi(nomi.map(n => fat(n))));
const nomiDi = (g) => g.membri.map(m => m.nome).sort();

gruppo('Nomi clienti — le due chiavi');

prova('maiuscole e spazi doppi non fanno due clienti', () => {
  uguale(chiaveCliente('COMUNE DI GENOVA  ATS35'), chiaveCliente('Comune di Genova ATS35'));
  uguale(chiaveCliente('  Asl 3  '), 'ASL 3');
  uguale(chiaveCliente(''), '—', 'senza nome resta una riga sola, non sparisce');
});

prova('accenti e apostrofi battuti su tastiere diverse sono la stessa parola', () => {
  uguale(chiaveCliente('UNIVERSITÀ DI GENOVA'), chiaveCliente('UNIVERSITA DI GENOVA'));
  uguale(chiaveStretta('FONDAZIONE L’ANCORA'), chiaveStretta("FONDAZIONE L'ANCORA"));
});

prova('la chiave stretta ignora punteggiatura, spazi e forma giuridica', () => {
  uguale(chiaveStretta('COMUNE DI GENOVA ATS 35'), chiaveStretta('COMUNE DI GENOVA  ATS35'));
  uguale(chiaveStretta('PETERCOM S.R.L.'), chiaveStretta('PETERCOM SRL'));
  uguale(chiaveStretta("FONDAZIONE L'ANCORA ONLUS"), chiaveStretta("FONDAZIONE L'ANCORA ETS"));
});

prova('la forma giuridica si toglie solo per confrontare: due enti diversi restano diversi', () => {
  vero(chiaveStretta('ROSSI SRL') !== chiaveStretta('BIANCHI SRL'),
    'togliere «SRL» non deve far coincidere due società qualsiasi');
});

gruppo('Nomi clienti — un nome che è l’inizio dell’altro');

prova('si contano le parole, non le lettere', () => {
  vero(unoIniziaLAltro('COMUNE DI GENOVA ATS 41', 'COMUNE DI GENOVA ATS 41 V MUNICIPIO'));
  falso(unoIniziaLAltro('COMUNE DI GENOVA ATS 4', 'COMUNE DI GENOVA ATS 41'),
    '«ATS 4» non è l’inizio di «ATS 41»: sono due numeri diversi');
});

prova('una parola sola in comune non basta', () => {
  falso(unoIniziaLAltro('COMUNE', 'COMUNE DI GENOVA'),
    'altrimenti ogni «COMUNE …» finirebbe nello stesso mucchio');
});

prova('lo stesso nome non è l’inizio di sé stesso', () => {
  falso(unoIniziaLAltro('PORTO ANTICO DI GENOVA', 'PORTO ANTICO DI GENOVA'));
});

gruppo('Nomi clienti — i gruppi e quanto sono sicuri');

prova('due grafie identiche a meno di maiuscole sono un gruppo sicuro', () => {
  const g = gruppiDa('COOPERATIVA SAN CARLO ONLUS SCS', 'cooperativa SAN CARLO ONLUS SCS');
  uguale(g.length, 1);
  uguale(g[0].certezza, 'identico');
  uguale(g[0].membri.length, 2);
});

prova('lo stesso ente che cambia forma giuridica è «probabile», non sicuro', () => {
  const g = gruppiDa("FONDAZIONE L'ANCORA ONLUS", "FONDAZIONE L'ANCORA ETS");
  uguale(g.length, 1);
  uguale(g[0].certezza, 'probabile');
});

prova('un nome che è l’inizio dell’altro resta «da vedere»', () => {
  const g = gruppiDa('PORTO ANTICO', 'PORTO ANTICO DI GENOVA');
  uguale(g.length, 1);
  uguale(g[0].certezza, 'da vedere', 'qui il dubbio è vero e lo scioglie una persona');
});

prova('il gruppo porta la certezza del legame più debole', () => {
  // Le prime due sono identiche, la terza si aggancia solo perché è
  // l'inizio: il gruppo intero non può dirsi sicuro.
  const g = gruppiDa('COMUNE DI GENOVA ATS 41', 'Comune di Genova ATS 41', 'COMUNE DI GENOVA ATS 41 V MUNICIPIO VALPOLCEVERA');
  uguale(g.length, 1);
  uguale(g[0].membri.length, 3);
  uguale(g[0].certezza, 'da vedere', 'un gruppo è sicuro solo se lo è ogni legame che lo tiene insieme');
});

prova('due uffici con numero diverso NON finiscono insieme', () => {
  const g = gruppiDa('COMUNE DI GENOVA ATS 41', 'COMUNE DI GENOVA ATS 47');
  uguale(g.length, 0, 'è l’errore che non si può più correggere: non va fatto');
});

prova('due enti che condividono solo l’inizio non finiscono insieme', () => {
  uguale(gruppiDa('ISTITUTO COMPRENSIVO DI BORZOLI', 'ISTITUTO COMPRENSIVO RIVAROLO').length, 0);
});

prova('un cliente solo non è un doppione', () => {
  uguale(gruppiDa('AZIENDA OSPEDALIERA SAN MARTINO').length, 0);
});

gruppo('Nomi clienti — che cosa propone la pagina');

prova('la grafia proposta è quella usata di più', () => {
  const fatture = [
    fat('cooperativa SAN CARLO ONLUS SCS'), fat('cooperativa SAN CARLO ONLUS SCS'),
    fat('COOPERATIVA SAN CARLO ONLUS SCS'),
  ];
  const g = gruppiDoppi(variantiDi(fatture));
  uguale(g[0].proposta, 'cooperativa SAN CARLO ONLUS SCS');
  uguale(g[0].fatture, 3, 'il gruppo dice quante fatture muove: è il numero da leggere prima di premere');
});

prova('a pari uso vince la grafia più completa', () => {
  const g = gruppiDa('PORTO ANTICO', 'PORTO ANTICO DI GENOVA');
  uguale(g[0].proposta, 'PORTO ANTICO DI GENOVA');
});

prova('prima i gruppi sicuri, poi quelli da leggere', () => {
  const g = gruppiDa(
    'PORTO ANTICO', 'PORTO ANTICO DI GENOVA',
    'ARPAL', 'arpal',
  );
  uguale(g.length, 2);
  uguale(g[0].certezza, 'identico', 'quelli che si spuntano e via stanno in cima');
  uguale(g[1].certezza, 'da vedere');
});

prova('le varianti portano quante fatture e quanto valgono', () => {
  const v = variantiDi([
    fat('ARPAL', 100, '2026-01-10'),
    fat('ARPAL', 250, '2026-03-10'),
    fat('arpal', 50, '2026-02-10'),
  ]);
  uguale(v.length, 2);
  const grande = v.find(x => x.nome === 'ARPAL');
  uguale(grande.n, 2);
  uguale(grande.importo, 350);
  uguale(grande.ultima, '2026-03-10', 'l’ultima fattura aiuta a capire quale grafia è quella in uso');
});

prova('una fattura senza cliente non sparisce e non si mischia', () => {
  const v = variantiDi([fat(''), fat(null), fat('ARPAL')]);
  uguale(v.length, 2);
  vero(v.some(x => x.nome === '—'), 'le fatture senza cliente restano contate, sotto un’etichetta visibile');
});

prova('ogni variante ricorda le grafie esatte del database', () => {
  // La rinomina cerca il valore esatto: se la variante tenesse solo il
  // nome ripulito, «ASL 3 » con lo spazio o il cliente NULL non
  // verrebbero mai trovati, e l'unificazione riuscirebbe a vuoto.
  const v = variantiDi([fat('ASL 3'), fat('ASL 3 '), fat('ASL 3 '), fat(''), fat(null)]);
  const asl = v.find(x => x.nome === 'ASL 3');
  uguale(asl.n, 3);
  uguale(asl.grafie, [{ valore: 'ASL 3', n: 1 }, { valore: 'ASL 3 ', n: 2 }]);
  const vuoto = v.find(x => x.nome === '—');
  uguale(vuoto.grafie, [{ valore: '', n: 1 }, { valore: null, n: 1 }], 'la stringa vuota e il NULL sono due valori da cercare in due modi');
  const g = gruppiDoppi(variantiDi([fat('ASL 3 '), fat('asl 3')]));
  uguale(g[0].membri.flatMap(m => m.grafie.map(x => x.valore)).sort(), ['ASL 3 ', 'asl 3'], 'le grafie esatte arrivano fino ai gruppi');
});

gruppo('Nomi clienti — i casi veri dell’archivio 2026');

prova('i doppioni davvero presenti vengono riconosciuti', () => {
  // Nomi presi dall'import delle fatture attive 2026.
  const g = gruppiDa(
    'COMUNE DI GENOVA ATS 35 CENTRO OVEST', 'COMUNE DI GENOVA  ATS35 CENTRO OVEST',
    'FONDAZIONE L\'ANCORA ONLUS', 'FONDAZIONE L\'ANCORA ETS', 'FONDAZIONE L\'ANCORA',
    'cooperativa SAN CARLO ONLUS SCS', 'COOPERATIVA SAN CARLO ONLUS SCS',
    'AZIENDA OSPEDALIERA SAN MARTINO',
  );
  uguale(g.length, 3);
  const ancora = g.find(x => x.proposta.includes('ANCORA'));
  uguale(ancora.membri.length, 3, 'le tre grafie della Fondazione stanno nello stesso gruppo');
  const ats = g.find(x => x.proposta.includes('ATS'));
  uguale(nomiDi(ats).length, 2);
});
