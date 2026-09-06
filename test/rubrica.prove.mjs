// La rubrica condivisa fra assistenze e formazione.
// Il comportamento (elenco, scheda, riquadro di scelta) è fatto di DOM e si
// prova aprendo il sito; quello che si può controllare qui — e che è il
// motivo per cui un file solo è più sicuro di due copie — è che ogni sezione
// gli passi tutto quello che gli serve, e le tre funzioni che deve esporre.
import { gruppo, prova, uguale, vero, RADICE } from './aiuto.mjs';
import { pathToFileURL } from 'node:url';

const mod = (p) => import(pathToFileURL(RADICE + p).href);
const { creaRubrica, TESTI_RICHIESTI } = await mod('/js/lib/rubrica.js');

gruppo('Rubrica condivisa');

prova('ogni sezione fornisce tutti i testi (importarla basta a saperlo)', async () => {
  // Se mancasse una parola, creaRubrica() lancerebbe già all'import: queste
  // due righe sono la prova.
  const a = await mod('/js/assistenze/views/rubrica.js');
  const f = await mod('/js/formazione/views/rubrica.js');
  vero(!!a && !!f);
});

prova('espone le tre funzioni che le sezioni usano', async () => {
  for (const sez of ['assistenze', 'formazione']) {
    const r = await mod(`/js/${sez}/views/rubrica.js`);
    const s = await mod(`/js/${sez}/views/sceltaCliente.js`);
    uguale(typeof r.renderRubrica, 'function', `${sez}: elenco`);
    uguale(typeof r.schedaCliente, 'function', `${sez}: scheda, la usa anche l'editor`);
    uguale(typeof s.scegliCliente, 'function', `${sez}: riquadro di scelta`);
  }
});

prova('le due sezioni parlano con parole diverse, non con le stesse', async () => {
  // È il motivo per cui i testi sono parametri e non un vocabolario neutro:
  // se un domani qualcuno li "semplificasse" mettendo le stesse parole
  // ovunque, le assistenze comincerebbero a chiamare "committenti" i clienti.
  const sorgente = (p) => import('node:fs').then(fs => fs.readFileSync(RADICE + p, 'utf8'));
  const a = await sorgente('/js/assistenze/views/rubrica.js');
  const f = await sorgente('/js/formazione/views/rubrica.js');
  vero(a.includes('Rubrica clienti') && f.includes('Rubrica committenti'));
  vero(a.includes('codice fiscale o referente') && f.includes('partita IVA o referente'));
});

prova('senza un testo si ferma subito, invece di scrivere "undefined" in pagina', () => {
  let errore = null;
  try {
    creaRubrica({ clienti: {}, testi: { titolo: 'Solo questo' } });
  } catch (e) { errore = e.message; }
  vero(errore && errore.includes('mancano i testi'), 'doveva rifiutare una configurazione incompleta');
  vero(errore.includes('sottotitolo'), 'e dire quali mancano');
});

prova('l\'elenco dei testi richiesti è quello usato davvero dal file condiviso', async () => {
  const fs = await import('node:fs');
  const sorgente = fs.readFileSync(RADICE + '/js/lib/rubrica.js', 'utf8');
  // Ogni `testi.qualcosa` che compare nel codice deve essere fra i richiesti:
  // altrimenti è una parola che nessuno controlla.
  const usati = [...sorgente.matchAll(/testi\.([a-zA-Z]+)/g)].map(m => m[1]);
  const fuoriElenco = [...new Set(usati)].filter(k => !TESTI_RICHIESTI.includes(k));
  uguale(fuoriElenco, [], 'testi usati ma non richiesti');
});
