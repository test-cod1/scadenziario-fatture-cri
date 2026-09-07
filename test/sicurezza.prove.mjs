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
import { LIMITI } from '../functions/_lib/quota.js';
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
