// ============================================================
//  Prove sulle parti che proteggono qualcosa.
//  Nascono dalla revisione del 05/09/2026: mancava una famiglia di prove
//  su permessi, endpoint e generazione di credenziali, cioè proprio dove
//  un errore costa di più. Qui c'è quello che si può verificare senza un
//  database e senza rete; il resto (le policy RLS, la sospensione che
//  toglie l'accesso ai dati) va provato sul database, con la query di
//  verifica in coda a patch-2026-09-05-sospensione-e-quote.sql.
// ============================================================
import { gruppo, prova, uguale, vero } from './aiuto.mjs';
import { generaPassword, ALFABETO_PASSWORD } from '../functions/api/crea-utente.js';
import { LIMITI, consumaQuota } from '../functions/_lib/quota.js';
import { intestazioneUtente } from '../functions/_lib/auth.js';
import { HEADER_SICUREZZA } from '../js/lib/securityHeaders.mjs';

gruppo('Sicurezza — password provvisoria');

prova('è lunga quanto chiesto e usa solo caratteri leggibili a voce', () => {
  for (const lunghezza of [8, 12, 20]) {
    const pw = generaPassword(lunghezza);
    uguale(pw.length, lunghezza, 'lunghezza');
    for (const c of pw) {
      vero(ALFABETO_PASSWORD.includes(c), `carattere fuori alfabeto: "${c}"`);
    }
  }
  // L'alfabeto esclude di proposito le coppie che si confondono quando la
  // password si comunica al telefono.
  for (const ambiguo of ['0', 'O', '1', 'l', 'I']) {
    vero(!ALFABETO_PASSWORD.includes(ambiguo), `l'alfabeto contiene ${ambiguo}, ambiguo da dettare`);
  }
});

prova('scarta i byte che falserebbero il sorteggio, invece di ripiegarli', () => {
  // 55 caratteri: i byte da 220 a 255 vanno buttati, perché tenerli con un
  // modulo renderebbe i primi 36 caratteri più probabili degli altri.
  // Qui si serve una sequenza fatta di soli byte da scartare seguiti da
  // zeri: se il codice li ripiegasse col modulo, la password comincerebbe
  // con i caratteri corrispondenti a 220 % 55 = 0, 221 % 55 = 1, …
  // Scartandoli correttamente, escono invece tutte 'A' (byte 0).
  const vero_ = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
  let chiamate = 0;
  globalThis.crypto.getRandomValues = (arr) => {
    chiamate++;
    arr.fill(chiamate === 1 ? 250 : 0);   // primo giro: tutti da scartare
    return arr;
  };
  try {
    const pw = generaPassword(6);
    uguale(pw, 'AAAAAA', 'i byte oltre la soglia non devono produrre caratteri');
    vero(chiamate >= 2, 'esauriti i byte validi, deve chiederne altri');
  } finally {
    globalThis.crypto.getRandomValues = vero_;
  }
});

prova('due password di fila non sono uguali', () => {
  // Non è una prova di casualità — non si fa con due estrazioni — ma
  // coglie l'errore grosso: un generatore che restituisce sempre lo stesso
  // valore, o che dimentica di sorteggiare.
  vero(generaPassword() !== generaPassword(), 'due password identiche di fila');
});

gruppo('Sicurezza — quote e intestazioni');

prova('ogni endpoint a pagamento ha un tetto giornaliero, e non è zero', () => {
  for (const chiave of ['estrai-fattura', 'geocode', 'route', 'prezzo-eu']) {
    const limite = LIMITI[chiave];
    vero(Number.isInteger(limite) && limite > 0, `manca il limite per ${chiave}`);
  }
});

prova('le intestazioni di sicurezza dicono le cose che devono dire', () => {
  const h = HEADER_SICUREZZA;
  vero(/max-age=\d{7,}/.test(h['Strict-Transport-Security'] || ''),
    'HSTS assente o con una durata troppo breve per contare');
  vero(!/preload/.test(h['Strict-Transport-Security'] || ''),
    'niente preload: iscriversi alla lista è irreversibile in pratica');
  const csp = h['Content-Security-Policy'] || '';
  vero(/script-src 'self'(;|$)/.test(csp),
    'script-src deve restare ai soli file nostri: nessun host esterno può eseguire codice');
  vero(!/unsafe-eval/.test(csp), 'unsafe-eval nella CSP');
  vero(/frame-ancestors 'none'/.test(csp), 'manca frame-ancestors: la pagina sarebbe incorniciabile');
  uguale(h['X-Content-Type-Options'], 'nosniff');
});

gruppo('Sicurezza — tetto giornaliero degli endpoint');

// fetch finto: registra le intestazioni mandate al contatore e risponde come
// gli si dice (un numero, oppure un errore HTTP).
async function conFetchFinto(risposta, fn) {
  const originale = globalThis.fetch;
  const viste = [];
  globalThis.fetch = async (url, opzioni = {}) => {
    viste.push(opzioni.headers || {});
    return risposta();
  };
  try { return { esito: await fn(), viste }; } finally { globalThis.fetch = originale; }
}
const richiesta = (auth) => new Request('https://esempio.test/api/x', { method: 'POST', headers: auth ? { Authorization: auth } : {} });

prova('il token arriva al contatore sempre come «Bearer …», anche se il client lo manda nudo', async () => {
  uguale(intestazioneUtente(richiesta('abc.def.ghi')), 'Bearer abc.def.ghi');
  uguale(intestazioneUtente(richiesta('bearer   abc.def.ghi ')), 'Bearer abc.def.ghi');
  uguale(intestazioneUtente(richiesta(null)), '');
  const { viste } = await conFetchFinto(() => new Response('3', { status: 200 }),
    () => consumaQuota(richiesta('abc.def.ghi'), {}, 'promemoria-prova'));
  uguale(viste[0].Authorization, 'Bearer abc.def.ghi', 'senza «Bearer» PostgREST la vedeva anonima e il tetto saltava');
});

prova('oltre il tetto si ferma, sotto si passa', async () => {
  const sopra = await conFetchFinto(() => new Response(String(LIMITI['promemoria-prova'] + 1)),
    () => consumaQuota(richiesta('Bearer t'), {}, 'promemoria-prova'));
  uguale(sopra.esito.ok, false);
  const sotto = await conFetchFinto(() => new Response('1'),
    () => consumaQuota(richiesta('Bearer t'), {}, 'promemoria-prova'));
  uguale(sotto.esito.ok, true);
});

prova('email di prova: se il contatore non risponde si blocca, le altre funzioni passano', async () => {
  const avviso = console.warn; console.warn = () => {};
  try {
    const email = await conFetchFinto(() => new Response('{}', { status: 401 }),
      () => consumaQuota(richiesta('Bearer t'), {}, 'promemoria-prova', { bloccaSeNonRisponde: true }));
    uguale(email.esito.ok, false);
    uguale(email.esito.nonDisponibile, true);
    const ai = await conFetchFinto(() => { throw new Error('rete giù'); },
      () => consumaQuota(richiesta('Bearer t'), {}, 'estrai-fattura'));
    uguale(ai.esito.ok, true, 'la lettura delle fatture non si ferma per un contatore che manca');
  } finally { console.warn = avviso; }
});

prova('connect-src apre solo il nostro progetto Supabase, lo stesso di js/config.js', async () => {
  const { CONFIG } = await import('../js/config.js');
  const csp = HEADER_SICUREZZA['Content-Security-Policy'] || '';
  const connect = (csp.match(/connect-src ([^;]+)/) || [])[1] || '';
  vero(connect.split(/\s+/).includes(CONFIG.supabase.url), `connect-src senza ${CONFIG.supabase.url}: il portale non potrebbe parlare col database`);
  vero(!connect.includes('*'), 'niente caratteri jolly: un host qualunque potrebbe ricevere i dati');
});
