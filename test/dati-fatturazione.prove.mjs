// ============================================================
//  Il modulo pubblico dei dati di fatturazione: le regole dei campi
//  (js/lib/datiFatturazione.mjs) e l'endpoint che il cliente chiama senza
//  login (functions/api/dati-fatturazione.js), provato davvero su un
//  database finto. È l'unico punto del portale in cui scrive qualcuno che
//  non è un utente: deve dire il minimo, accettare solo dati in regola e
//  solo da un link valido.
// ============================================================
import { gruppo, prova, uguale, vero } from './aiuto.mjs';
import { controllaDati, partitaIvaValida, codiceFiscaleValido, nuovoToken, FORMA_TOKEN } from '../js/lib/datiFatturazione.mjs';
import { onRequestPost, MAX_INVII, proposta } from '../functions/api/dati-fatturazione.js';

gruppo('Dati di fatturazione — regole dei campi');

const AZIENDA = {
  tipo: 'azienda', ragione_sociale: 'Omnia Service s.r.l.', partita_iva: '00743110157',
  indirizzo: 'Via Cornigliano 34', cap: '16152', comune: 'Genova', provincia: 'ge',
  codice_destinatario: 'm5uxcr1', privacy: true,
};

prova('partita IVA e codice fiscale con la cifra di controllo', () => {
  vero(partitaIvaValida('00743110157'));
  vero(!partitaIvaValida('00743110158'), 'cifra di controllo sbagliata');
  vero(codiceFiscaleValido('RSSMRA80A01H501U'));
  vero(!codiceFiscaleValido('RSSMRA80A01H501X'));
  vero(codiceFiscaleValido('00743110157'), 'il codice fiscale numerico degli enti');
});

prova('un\'azienda in regola passa, ripulita', () => {
  const r = controllaDati({ ...AZIENDA, partita_iva: 'IT 00743110157', estraneo: '<script>' });
  vero(r.ok, JSON.stringify(r.errori));
  uguale(r.dati.partita_iva, '00743110157');
  uguale(r.dati.provincia, 'GE');
  uguale(r.dati.codice_destinatario, 'M5UXCR1');
  vero(!('estraneo' in r.dati), 'i campi che il modulo non prevede non si salvano');
});

prova('azienda: serve il codice destinatario oppure la PEC', () => {
  uguale(Object.keys(controllaDati({ ...AZIENDA, codice_destinatario: '' }).errori), ['pec']);
  vero(controllaDati({ ...AZIENDA, codice_destinatario: '0000000', pec: 'omnia@pec.it' }).ok, 'sette zeri più PEC');
  uguale(Object.keys(controllaDati({ ...AZIENDA, codice_destinatario: '0000000' }).errori), ['pec'], 'sette zeri da soli non bastano');
});

prova('ente pubblico: codice ufficio di 6 caratteri, CIG e CUP nella loro forma', () => {
  const pa = { ...AZIENDA, tipo: 'ente_pubblico', codice_destinatario: 'UFX9AB', cig: 'z1234567ab', split_payment: true };
  const r = controllaDati(pa);
  vero(r.ok, JSON.stringify(r.errori));
  uguale([r.dati.cig, r.dati.split_payment], ['Z1234567AB', true]);
  uguale(Object.keys(controllaDati({ ...pa, codice_destinatario: 'M5UXCR1' }).errori), ['codice_destinatario']);
  uguale(Object.keys(controllaDati({ ...pa, cup: '123' }).errori), ['cup']);
});

prova('privato: codice fiscale, niente P.IVA né campi della PA', () => {
  const r = controllaDati({ tipo: 'privato', ragione_sociale: 'Mario Rossi', codice_fiscale: 'rssmra80a01h501u',
    partita_iva: '00743110157', cig: 'Z1234567AB', indirizzo: 'Via Roma 1', cap: '16100', comune: 'Genova', provincia: 'GE', privacy: true });
  vero(r.ok, JSON.stringify(r.errori));
  uguale([r.dati.codice_fiscale, r.dati.partita_iva, r.dati.cig], ['RSSMRA80A01H501U', '', '']);
});

prova('senza consenso al trattamento non si invia', () => {
  uguale(Object.keys(controllaDati({ ...AZIENDA, privacy: false }).errori), ['privacy']);
});

prova('i campi hanno un tetto di lunghezza', () => {
  uguale(controllaDati({ ...AZIENDA, ragione_sociale: 'x'.repeat(5000) }).dati.ragione_sociale.length, 200);
});

prova('il codice del link è lungo e nella forma attesa', () => {
  const a = nuovoToken(), b = nuovoToken();
  vero(FORMA_TOKEN.test(a) && a !== b);
});

prova('quello che il preventivo sa già fa da punto di partenza', () => {
  uguale(proposta({ cliente: 'Omnia', cliente_cf: '00743110157', cliente_indirizzo: 'Via X 1' }).partita_iva, '00743110157');
  uguale(proposta({ cliente: 'Mario', cliente_cf: 'RSSMRA80A01H501U' }).tipo, 'privato');
});

// ---------- L'endpoint, con un Supabase finto ----------
gruppo('Dati di fatturazione — endpoint pubblico');

const TOKEN = nuovoToken();
const PREV = '22222222-2222-2222-2222-222222222222';
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'k', SUPABASE_URL: 'https://db' };
let db, richieste;
function nuovoDb() {
  richieste = [];
  db = {
    dati_fatturazione: [{ id: 'r1', sezione: 'formazione', preventivo_id: PREV, token: TOKEN, revocato: false,
      scade_il: new Date(Date.now() + 86400000).toISOString(), dati: null, inviato_il: null, invii: 0 }],
    preventivi_formazione: [{ id: PREV, cliente: 'Omnia Service s.r.l.', cliente_cf: '00743110157', cliente_indirizzo: 'Via Cornigliano 34',
      oggetto: 'PREVENTIVO CORSI BLSD', protocollo: '12', data_documento: '2026-10-28', totale: 999 }],
  };
}
const finto = async (url, opz = {}) => {
  const u = new URL(url);
  richieste.push(decodeURIComponent(u.pathname + u.search));
  const tabella = u.pathname.split('/').pop();
  const sel = u.searchParams.get('select');
  const filtri = [...u.searchParams].filter(([k]) => k !== 'select');
  const passa = (r) => filtri.every(([k, v]) => String(r[k]) === v.slice(v.indexOf('.') + 1));
  const proietta = (r) => (sel ? Object.fromEntries(sel.split(',').map(c => [c, r[c]])) : r);
  const righe = db[tabella];
  if ((opz.method || 'GET') === 'GET') return new Response(JSON.stringify(righe.filter(passa).map(proietta)), { status: 200 });
  if (opz.method === 'PATCH') {
    const toccate = righe.filter(passa);
    toccate.forEach(r => Object.assign(r, JSON.parse(opz.body)));
    return new Response(JSON.stringify(toccate), { status: 200 });
  }
  return new Response('[]', { status: 405 });
};
async function chiama(corpo, env = ENV) {
  const request = new Request('https://x/api/dati-fatturazione', { method: 'POST', body: typeof corpo === 'string' ? corpo : JSON.stringify(corpo) });
  const vero = globalThis.fetch;
  globalThis.fetch = finto;
  try {
    const res = await onRequestPost({ request, env });
    return { status: res.status, corpo: await res.json(), cache: res.headers.get('Cache-Control') };
  } finally { globalThis.fetch = vero; }
}

prova('leggi: solo l\'intestazione del preventivo, non il totale né altro', async () => {
  nuovoDb();
  const r = await chiama({ azione: 'leggi', token: TOKEN });
  uguale(r.status, 200);
  uguale(r.cache, 'no-store');
  uguale(r.corpo.intestazione.cliente, 'Omnia Service s.r.l.');
  vero(!JSON.stringify(r.corpo).includes('999'), 'il totale del preventivo non deve uscire');
  uguale(r.corpo.dati.partita_iva, '00743110157', 'si parte da quello che il preventivo sa');
});

prova('link inesistente, scaduto o revocato: stessa risposta, nessuna differenza da sfruttare', async () => {
  nuovoDb();
  const altro = await chiama({ azione: 'leggi', token: nuovoToken() });
  db.dati_fatturazione[0].revocato = true;
  const revocato = await chiama({ azione: 'leggi', token: TOKEN });
  db.dati_fatturazione[0].revocato = false;
  db.dati_fatturazione[0].scade_il = new Date(Date.now() - 1000).toISOString();
  const scaduto = await chiama({ azione: 'leggi', token: TOKEN });
  uguale([altro.status, revocato.status, scaduto.status], [404, 404, 404]);
  uguale(new Set([altro.corpo.error, revocato.corpo.error, scaduto.corpo.error]).size, 1);
});

prova('un codice malformato non arriva nemmeno al database', async () => {
  nuovoDb();
  const r = await chiama({ azione: 'leggi', token: 'abc&token=neq.x' });
  uguale(r.status, 404);
  uguale(richieste.length, 0);
});

prova('invia: dati in regola salvati, ripuliti, e contati', async () => {
  nuovoDb();
  const r = await chiama({ azione: 'invia', token: TOKEN, dati: { ...AZIENDA, extra: 'x' } });
  uguale(r.status, 200, JSON.stringify(r.corpo));
  const riga = db.dati_fatturazione[0];
  uguale([riga.invii, riga.dati.provincia, 'extra' in riga.dati], [1, 'GE', false]);
  vero(!!riga.inviato_il);
  uguale(db.preventivi_formazione[0].cliente, 'Omnia Service s.r.l.', 'il preventivo non si tocca');
});

prova('invia: dati sbagliati respinti col dettaglio dei campi', async () => {
  nuovoDb();
  const r = await chiama({ azione: 'invia', token: TOKEN, dati: { ...AZIENDA, partita_iva: '123' } });
  uguale(r.status, 422);
  uguale(Object.keys(r.corpo.errori), ['partita_iva']);
  uguale(db.dati_fatturazione[0].invii, 0);
});

prova('invia: oltre il tetto di invii lo stesso link non scrive più', async () => {
  nuovoDb();
  db.dati_fatturazione[0].invii = MAX_INVII;
  uguale((await chiama({ azione: 'invia', token: TOKEN, dati: AZIENDA })).status, 429);
});

prova('richieste rotte o troppo grandi, e server senza chiave', async () => {
  nuovoDb();
  uguale((await chiama('non è json')).status, 400);
  uguale((await chiama({ azione: 'cancella', token: TOKEN })).status, 400);
  uguale((await chiama({ azione: 'invia', token: TOKEN, dati: { note: 'x'.repeat(30000) } })).status, 413);
  uguale((await chiama({ azione: 'leggi', token: TOKEN }, {})).status, 503);
});

prova('il link compare nel documento del preventivo solo se c\'è', async () => {
  const { costruisciBlocchi } = await import('../js/formazione/lib/documento.js');
  const { DEFAULT_IMPOSTAZIONI } = await import('../js/formazione/calc.js');
  const testi = (prev) => costruisciBlocchi(prev, DEFAULT_IMPOSTAZIONI).blocchi.map(b => b.testo || '').join('\n');
  const prev = { cliente: 'Omnia', righe: [{ id: 'blsd', nome: 'BLSD', discenti: 5, prezzo: 50, listino: 50 }] };
  vero(!testi(prev).includes('dati-fatturazione.html'));
  vero(testi({ ...prev, _linkFatturazione: 'https://amministrazione.crigenova.it/dati-fatturazione.html#abc' })
    .includes('https://amministrazione.crigenova.it/dati-fatturazione.html#abc'));
});
