// ============================================================
//  Avvio del portale: cosa si scarica prima della prima schermata.
//
//  Fino al 27/09/2026 js/app.js importava staticamente tutte le viste dello
//  scadenziario, e con loro l'editor delle fatture, la lettura degli XML e
//  l'export Excel: 29 moduli e ~380 KB prima di poter disegnare perfino il
//  login, su 5 livelli di import uno dietro l'altro. Adesso quelle viste si
//  caricano quando si apre la loro pagina, e index.html pre-carica i pochi
//  moduli che restano.
//
//  Le due cose si guastano in silenzio: un import statico aggiunto in cima
//  ad app.js funziona benissimo, solo rallenta tutti; un modulo nuovo non
//  messo nei <link rel="modulepreload"> si scarica lo stesso, solo più tardi.
//  Queste prove lo dicono al momento.
// ============================================================
import { gruppo, prova, uguale, vero, RADICE } from './aiuto.mjs';
import fs from 'node:fs';
import path from 'node:path';

// Moduli raggiunti da `file` attraverso i soli import statici (gli import()
// dinamici restano fuori: sono proprio quelli che si caricano dopo).
function grafoStatico(file) {
  const visti = new Set();
  const visita = (assoluto) => {
    if (visti.has(assoluto)) return;
    visti.add(assoluto);
    const sorgente = fs.readFileSync(assoluto, 'utf8');
    for (const m of sorgente.matchAll(/^\s*import\s+(?:[\s\S]*?\sfrom\s+)?['"]([^'"]+)['"]/gm)) {
      visita(path.resolve(path.dirname(assoluto), m[1]));
    }
  };
  visita(path.join(RADICE, file));
  return [...visti].map(f => '/' + path.relative(RADICE, f).split(path.sep).join('/'));
}

const indice = fs.readFileSync(path.join(RADICE, 'index.html'), 'utf8');
const precaricati = [...indice.matchAll(/<link rel="modulepreload" href="([^"]+)"/g)].map(m => m[1]);

gruppo('Avvio del portale');

prova('app.js non si porta dietro le viste delle sezioni', () => {
  const avvio = grafoStatico('js/app.js');
  const pesanti = avvio.filter(f => /\/views\/(dashboard|fattura|report|proposte|impostazioni|portaleUtenti|clientiAttive)|\/lib\/(export|xlsx|zip|xmlFattura|tour)\.js/.test(f));
  uguale(pesanti.join(', '), '', 'moduli pesanti importati staticamente da app.js');
  vero(avvio.length <= 12, `all'avvio servono ${avvio.length} moduli: sono tornati a crescere?`);
});

prova('index.html pre-carica esattamente i moduli di avvio', () => {
  // app.js lo carica già il suo <script type="module">; il caricatore di
  // Supabase (con config.js) arriva da un import() in store.js, ma serve
  // subito, per il controllo della sessione.
  const attesi = new Set([
    ...grafoStatico('js/app.js').filter(f => f !== '/js/app.js'),
    ...grafoStatico('js/lib/supabase.js'),
  ]);
  const mancanti = [...attesi].filter(f => !precaricati.includes(f));
  const superflui = precaricati.filter(f => !attesi.has(f));
  uguale(mancanti.join(', '), '', 'moduli di avvio senza <link rel="modulepreload">');
  uguale(superflui.join(', '), '', 'modulepreload di moduli che all\'avvio non servono (o spariti)');
});

prova('il pre-caricamento della libreria Supabase punta alla versione in uso', () => {
  const caricatore = fs.readFileSync(path.join(RADICE, 'js/lib/supabase.js'), 'utf8');
  const versione = caricatore.match(/const VERSIONE = '([^']+)'/)?.[1];
  vero(versione, 'VERSIONE non trovata in js/lib/supabase.js');
  vero(indice.includes(`<link rel="preload" as="script" href="/js/vendor/supabase-js-${versione}.js" />`),
    `index.html non pre-carica /js/vendor/supabase-js-${versione}.js`);
  vero(fs.existsSync(path.join(RADICE, `js/vendor/supabase-js-${versione}.js`)), 'il file della libreria non esiste');
});
