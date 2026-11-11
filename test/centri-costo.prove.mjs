// ============================================================
//  I CONTI DEI CENTRI DI COSTO (sezione Analisi).
//  Sono numeri su cui si prendono decisioni — «questo corso lo rifacciamo
//  o no» — e nessuno può accorgersi a occhio che sono sbagliati. Qui si
//  fissano i casi che i conti devono rispettare.
//
//  Dal 11/11/2026 Analisi è staccata dallo scadenziario: i centri hanno
//  movimenti propri (tabella movimenti_analisi), e una prova controlla
//  che nessun file della sezione torni a leggere le fatture.
// ============================================================
import { gruppo, prova, uguale, vero, RADICE } from './aiuto.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {
  vociDi, totaliDi, quadro, nelPeriodo, anni, perAnno, perMese, perCategoria, categorieUsate, SENZA_CATEGORIA,
} from '../js/analisi/calc.js';
import { rigaMovimento } from '../js/analisi/data/store.js';

const mov = (id, centro_id, tipo, importo, data, extra = {}) =>
  ({ id, centro_id, tipo, importo, data, descrizione: id, ...extra });

const CENTRI = [
  { id: 'c1', nome: 'Corso BLSD' },
  { id: 'c2', nome: 'Assistenza Fiera' },
  { id: 'c3', nome: 'Attività nuova' },
];
const MOVIMENTI = [
  mov('u1', 'c1', 'uscita', 600, '2026-03-04'),
  mov('u2', 'c2', 'uscita', 400, '2026-03-04'),
  mov('u3', 'c1', 'uscita', 500, '2026-05-20'),
  mov('e1', 'c1', 'entrata', 2000, '2026-04-01'),
  mov('e2', 'c2', 'entrata', 800, '2026-06-15'),
  mov('u4', 'c1', 'uscita', 300, '2025-11-02'),
];

gruppo('Analisi — il conto di un’attività');

prova('entrate, uscite e saldo di un’attività', () => {
  const t = totaliDi(vociDi('c1', MOVIMENTI));
  uguale(t.entrate, 2000, 'entrate');
  uguale(t.uscite, 1400, 'uscite: 600 + 500 + 300');
  uguale(t.saldo, 600, 'saldo');
  uguale(t.nEntrate, 1);
  uguale(t.nUscite, 3);
});

prova('i movimenti di un’altra attività non entrano nel conto', () => {
  const t = totaliDi(vociDi('c2', MOVIMENTI));
  uguale(t.uscite, 400);
  uguale(t.entrate, 800);
});

prova('un’attività senza movimenti fa zero, non fa errore', () => {
  const t = totaliDi(vociDi('c3', MOVIMENTI));
  uguale([t.entrate, t.uscite, t.saldo, t.nEntrate + t.nUscite], [0, 0, 0, 0]);
});

prova('tanti importi con i centesimi sommano senza code di arrotondamento', () => {
  // 25 rifornimenti da 66,47: in virgola mobile la somma esce 1661,7499999…
  const tanti = Array.from({ length: 25 }, (_, i) => mov('r' + i, 'c1', 'uscita', 66.47, '2026-01-01'));
  uguale(totaliDi(vociDi('c1', tanti)).uscite, 1661.75);
});

prova('il periodo taglia via i movimenti di un altro anno', () => {
  const t = totaliDi(vociDi('c1', MOVIMENTI, { da: '2026-01-01', a: '2026-12-31' }));
  uguale(t.uscite, 1100, 'il movimento del 2025 resta fuori');
});

prova('un movimento senza data resta dentro a qualunque periodo, e in cima', () => {
  // Escluderlo lo farebbe sparire dai conti senza che nessuno se ne
  // accorga: meglio vederlo e andargli a mettere la data.
  const senzaData = mov('u9', 'c1', 'uscita', 100, null);
  vero(nelPeriodo(senzaData, { da: '2026-01-01', a: '2026-12-31' }));
  const voci = vociDi('c1', [...MOVIMENTI, senzaData], { da: '2026-01-01', a: '2026-12-31' });
  uguale(voci[0].id, 'u9');
  uguale(totaliDi(voci).uscite, 1200);
});

prova('i movimenti sono in ordine dal più recente', () => {
  uguale(vociDi('c1', MOVIMENTI).map(v => v.id), ['u3', 'e1', 'u1', 'u4']);
});

gruppo('Analisi — il quadro d’insieme');

prova('in cima ci sono le attività in perdita, in fondo quelle vuote', () => {
  // c2: 800 − 400 = +400. c1: 2000 − 1400 = +600. c3 vuota, in fondo.
  uguale(quadro(CENTRI, MOVIMENTI).map(r => r.centro.id), ['c2', 'c1', 'c3']);
});

prova('un’attività in perdita passa davanti a una in utile', () => {
  const righe = quadro(
    [{ id: 'buona', nome: 'Buona' }, { id: 'perdita', nome: 'In perdita' }],
    [mov('a', 'perdita', 'uscita', 1000, '2026-03-04'), mov('b', 'buona', 'entrata', 1000, '2026-03-04')],
  );
  uguale(righe.map(r => r.centro.id), ['perdita', 'buona']);
});

prova('gli anni proposti nel filtro sono quelli che hanno davvero un movimento', () => {
  uguale(anni(MOVIMENTI), ['2026', '2025'], 'dal più recente');
  uguale(anni([mov('u9', 'c1', 'uscita', 100, null)]), [], 'un movimento senza data non inventa un anno');
});

gruppo('Analisi — anno per anno, mese per mese, per categoria');

prova('una riga per anno, dal più recente, con la variazione delle uscite', () => {
  const r = perAnno(vociDi('c1', MOVIMENTI));
  uguale(r.map(x => x.anno), ['2026', '2025']);
  uguale([r[0].entrate, r[0].uscite, r[0].saldo], [2000, 1100, 900]);
  uguale(r[1].uscite, 300);
  uguale(Math.round(r[0].varUscite * 100), 267, '1100 contro 300: +267%');
  uguale(r[1].varUscite, null, 'senza un anno prima la variazione non si inventa');
});

prova('i movimenti senza data stanno in una riga a parte, in fondo', () => {
  const r = perAnno([...MOVIMENTI, mov('x', 'c1', 'uscita', 50, null)]);
  uguale(r[r.length - 1].anno, '');
  uguale(r[r.length - 1].uscite, 50);
  uguale(r.reduce((s, x) => s + x.uscite, 0), totaliDi(MOVIMENTI).uscite + 50, 'la somma delle righe è il totale');
});

prova('i mesi sono sempre dodici, anche quelli vuoti', () => {
  const m = perMese(vociDi('c1', MOVIMENTI), '2026');
  uguale(m.length, 12);
  uguale([m[2].uscite, m[3].entrate, m[4].uscite, m[0].uscite], [600, 2000, 500, 0]);
});

prova('le categorie si sommano ignorando maiuscole e spazi, la più pesante prima', () => {
  const vs = [
    mov('a', 'c1', 'uscita', 80, '2026-01-01', { categoria: 'Carburante' }),
    mov('b', 'c1', 'uscita', 20, '2026-01-02', { categoria: ' carburante  ' }),
    mov('c', 'c1', 'uscita', 400, '2026-01-03', { categoria: 'Assicurazione' }),
    mov('d', 'c1', 'uscita', 900, '2026-01-04'),
    mov('e', 'c1', 'entrata', 999, '2026-01-04', { categoria: 'Convenzione' }),
  ];
  const r = perCategoria(vs, 'uscita');
  uguale(r.map(x => x.categoria), ['Assicurazione', 'Carburante', SENZA_CATEGORIA],
    '«Senza categoria» in fondo anche se è la voce più grossa');
  uguale(r[1].importo, 100);
  uguale(r[1].n, 2);
  uguale(Math.round(r.reduce((s, x) => s + x.quota, 0) * 1000), 1000, 'le quote fanno il 100%');
  uguale(perCategoria(vs, 'entrata').map(x => x.categoria), ['Convenzione'], 'le entrate per conto loro');
});

prova('le categorie suggerite sono una per nome, in ordine alfabetico', () => {
  uguale(categorieUsate([{ categoria: 'carburante' }, { categoria: 'Assicurazione' }, { categoria: 'Carburante' }, {}]),
    ['Assicurazione', 'carburante']);
});

gruppo('Analisi — che cosa è un movimento valido');

prova('la categoria si salva ripulita, o null se vuota', () => {
  uguale(rigaMovimento({ ...{ centro_id: 'c1', tipo: 'uscita', importo: 5, descrizione: 'x' }, categoria: '  Manutenzione   auto ' }).categoria, 'Manutenzione auto');
  uguale(rigaMovimento({ centro_id: 'c1', tipo: 'uscita', importo: 5, descrizione: 'x', categoria: '  ' }).categoria, null);
});

const base = { centro_id: 'c1', tipo: 'uscita', importo: 82, descrizione: 'Rifornimento' };

prova('un movimento completo passa, con i testi ripuliti', () => {
  const r = rigaMovimento({ ...base, controparte: '  Europam  ', documento: '', data: '2026-04-29' });
  uguale(r.controparte, 'Europam');
  uguale(r.documento, null, 'un campo vuoto è null, non una stringa vuota');
  uguale(r.data, '2026-04-29');
});

prova('l’importo si arrotonda al centesimo', () => {
  uguale(rigaMovimento({ ...base, importo: 10.005 + 0.0001 }).importo, 10.01);
});

prova('importo zero o negativo non passa', () => {
  for (const importo of [0, -5, NaN, null]) {
    let errore = '';
    try { rigaMovimento({ ...base, importo }); } catch (e) { errore = e.message; }
    vero(/maggiore di zero/.test(errore), `importo ${importo}`);
  }
});

prova('serve sapere se è un’entrata o un’uscita', () => {
  let errore = '';
  try { rigaMovimento({ ...base, tipo: 'altro' }); } catch (e) { errore = e.message; }
  vero(/entrata o un’uscita/.test(errore));
});

prova('un importo senza nessuna descrizione non passa', () => {
  let errore = '';
  try { rigaMovimento({ centro_id: 'c1', tipo: 'uscita', importo: 50 }); } catch (e) { errore = e.message; }
  vero(/almeno una descrizione/.test(errore));
});

gruppo('Analisi — staccata dallo scadenziario');

prova('nessun file della sezione legge le fatture o le imputazioni', () => {
  const cartella = path.join(RADICE, 'js', 'analisi');
  const file = [];
  const giro = d => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) giro(p); else if (p.endsWith('.js')) file.push(p);
    }
  };
  giro(cartella);
  const vietati = ['data/store.js', 'data/storeAttive.js'].map(f => path.join(RADICE, 'js', f));
  for (const p of file) {
    const s = fs.readFileSync(p, 'utf8');
    for (const m of s.matchAll(/(?:from\s+|import\()\s*['"](\.[^'"]+)['"]/g)) {
      const dove = path.resolve(path.dirname(p), m[1]);
      vero(!vietati.includes(dove), `${path.relative(RADICE, p)} importa ${m[1]}, lo store dello scadenziario`);
    }
    vero(!/from\(['"](fatture|fatture_attive|imputazioni)['"]\)/.test(s),
      `${path.relative(RADICE, p)} legge una tabella dello scadenziario`);
  }
});
