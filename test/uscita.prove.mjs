// ============================================================
//  Avviso di uscita con modifiche non salvate (js/lib/uscita.js).
//  Si simula il minimo di browser che serve — cronologia, indirizzo,
//  eventi — per provare i casi che contano:
//    - "indietro" con modifiche in sospeso: si resta e si chiede;
//    - "indietro" senza modifiche: si va indietro davvero;
//    - dopo un salvataggio l'editor cambia pagina da sé (ctx.go): NON
//      si deve tornare indietro. Era il difetto per cui, salvato un
//      preventivo nuovo, ci si ritrovava sull'editor vuoto.
// ============================================================
import { gruppo, prova, uguale } from './aiuto.mjs';

// ---------- Browser finto ----------
const ascoltatori = {};
const registro = [];          // cosa ha fatto la pagina con la cronologia
let href = '';
let domande = 0;              // quante volte si è aperta la finestra "vuoi uscire?"

// La finestra di conferma (confirmDialog in ui.js) comincia creando un
// elemento: qui quel primo passo conta la domanda e si ferma lì.
class DomandaFatta extends Error {}
process.on('unhandledRejection', (e) => { if (!(e instanceof DomandaFatta)) throw e; });

globalThis.window = { addEventListener: (t, fn) => { (ascoltatori[t] ||= []).push(fn); } };
globalThis.document = {
  addEventListener() {}, removeEventListener() {},
  createElement() { domande++; throw new DomandaFatta(); },
};
globalThis.location = {
  get href() { return href; },
  get hash() { return href.slice(href.indexOf('#')); },
  set hash(h) { href = 'http://x/' + h; scatta('popstate'); },   // come Chrome: anche l'hash fa scattare popstate
};
globalThis.history = {
  pushState(_s, _t, u) { registro.push('push'); href = u; },
  back() { registro.push('back'); },
  go(n) { registro.push('go ' + n); },
};
function scatta(tipo) { for (const fn of ascoltatori[tipo] || []) fn({}); }

const { sorvegliaUscita, armaGuardiaIndietro } = await import('../js/lib/uscita.js');

gruppo('Avviso di uscita');

function editor() {
  href = 'http://x/#/trasporti/nuovo';
  registro.length = 0;
  domande = 0;
  const stato = { sporco: false };
  sorvegliaUscita({ isConnected: true }, () => stato.sporco);
  return stato;
}
const pausa = () => new Promise(r => setTimeout(r, 0));

prova('dopo il salvataggio, la navigazione dell\'editor non viene annullata', () => {
  const s = editor();
  s.sporco = true; armaGuardiaIndietro();      // prima modifica: voce di cronologia
  s.sporco = false;                             // salvato
  location.hash = '#/trasporti/preventivo/42';  // ctx.go dopo il salvataggio
  uguale(registro, ['push'], 'la cronologia dopo il salvataggio');
  uguale(location.hash, '#/trasporti/preventivo/42');
  uguale(domande, 0);
});

prova('"indietro" con modifiche in sospeso: si resta sulla pagina e si chiede', async () => {
  const s = editor();
  s.sporco = true; armaGuardiaIndietro();
  scatta('popstate');                           // l'indietro consuma la voce: stesso indirizzo
  await pausa();
  uguale(registro, ['push', 'push'], 'la voce di guardia va rimessa mentre si chiede');
  uguale(domande, 1);
});

prova('"indietro" senza modifiche in sospeso: si va indietro davvero', () => {
  const s = editor();
  s.sporco = true; armaGuardiaIndietro();
  s.sporco = false;
  scatta('popstate');
  uguale(registro, ['push', 'back']);
  uguale(domande, 0);
});
