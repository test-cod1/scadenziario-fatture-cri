// ============================================================
//  Patenti CRI: le regole del modulo (js/lib/patenti.mjs) e l'endpoint
//  pubblico che i volontari chiamano senza login (functions/api/
//  patenti.js), provato su un database finto. Il link è uno per tutti:
//  l'endpoint deve accettare solo richieste in regola e tenere a bada chi
//  volesse usarlo per riempire la tabella.
// ============================================================
import { gruppo, prova, uguale, vero } from './aiuto.mjs';
import { controllaRichiesta, PATENTI, percorsoDi } from '../js/lib/patenti.mjs';
import { onRequestPost, MAX_PER_MITTENTE, MAX_AL_GIORNO, impronta } from '../functions/api/patenti.js';

gruppo('Patenti — regole del modulo');

const TUTTI = { fototessera: true, patente_civile: true, carta_identita: true };
const OK = { nome: '  Mario ', cognome: 'Rossi', patente: '5', documenti_gaia: TUTTI };

prova('i percorsi delle otto patenti', () => {
  uguale(PATENTI.map(p => p.percorso), ['diretta', 'diretta', 'diretta', 'pratica', 'esame', 'pratica', 'pratica', 'pratica']);
  uguale(percorsoDi(9), null);
});

prova('una richiesta in regola passa, ripulita e col suo percorso', () => {
  const r = controllaRichiesta({ ...OK, estraneo: '<script>' });
  vero(r.ok, JSON.stringify(r.errori));
  uguale(r.dati, { nome: 'Mario', cognome: 'Rossi', patente: 5, documenti_gaia: ['fototessera', 'patente_civile', 'carta_identita'], percorso: 'esame' });
});

prova('nome, cognome e una patente da 1 a 8 sono obbligatori', () => {
  uguale(Object.keys(controllaRichiesta({ ...OK, nome: ' ', cognome: '', patente: 9 }).errori), ['nome', 'cognome', 'patente']);
  vero(!controllaRichiesta(null).ok);
});

prova('senza tutti e tre i documenti su Gaia non si invia', () => {
  uguale(Object.keys(controllaRichiesta({ ...OK, documenti_gaia: { ...TUTTI, carta_identita: false } }).errori), ['documenti_gaia']);
  uguale(Object.keys(controllaRichiesta({ ...OK, documenti_gaia: { ...TUTTI, fototessera: 'true' } }).errori), ['documenti_gaia'], 'vale solo true');
});

prova('i nomi hanno un tetto di lunghezza', () => {
  uguale(controllaRichiesta({ ...OK, nome: 'x'.repeat(500) }).dati.nome.length, 80);
});

// ---------- L'endpoint, con un Supabase finto ----------
gruppo('Patenti — endpoint pubblico');

const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'chiave-di-servizio-di-prova-lunga', SUPABASE_URL: 'https://db' };
let righe;
const finto = async (url, opz = {}) => {
  const u = new URL(url);
  const filtri = [...u.searchParams].filter(([k]) => k !== 'select');
  const passa = (r) => filtri.every(([k, v]) => {
    const [op, val] = [v.slice(0, v.indexOf('.')), v.slice(v.indexOf('.') + 1)];
    return op === 'gte' ? r[k] >= val : String(r[k]) === val;
  });
  if (opz.method === 'HEAD') {
    const n = righe.filter(passa).length;
    return new Response(null, { status: 200, headers: { 'Content-Range': `0-0/${n}` } });
  }
  if (opz.method === 'POST') {
    righe.push({ ...JSON.parse(opz.body), created_at: new Date().toISOString() });
    return new Response(null, { status: 201 });
  }
  return new Response('[]', { status: 405 });
};
async function chiama(corpo, { env = ENV, ip = '1.2.3.4' } = {}) {
  const request = new Request('https://x/api/patenti', { method: 'POST', headers: { 'CF-Connecting-IP': ip },
    body: typeof corpo === 'string' ? corpo : JSON.stringify(corpo) });
  const vero = globalThis.fetch;
  globalThis.fetch = finto;
  try {
    const res = await onRequestPost({ request, env });
    return { status: res.status, corpo: await res.json(), cache: res.headers.get('Cache-Control') };
  } finally { globalThis.fetch = vero; }
}

prova('una richiesta in regola si salva, con l\'impronta e non l\'IP', async () => {
  righe = [];
  const r = await chiama(OK);
  uguale([r.status, r.corpo.ok, r.cache], [200, true, 'no-store']);
  uguale(righe.length, 1);
  uguale([righe[0].nome, righe[0].percorso], ['Mario', 'esame']);
  vero(!JSON.stringify(righe[0]).includes('1.2.3.4'), 'l\'IP in chiaro non va salvato');
  uguale(righe[0].ip_hash, await impronta('1.2.3.4', ENV.SUPABASE_SERVICE_ROLE_KEY));
});

prova('dati non in regola: 422 con gli errori, niente salvato', async () => {
  righe = [];
  const r = await chiama({ ...OK, documenti_gaia: {} });
  uguale(r.status, 422);
  uguale(Object.keys(r.corpo.errori), ['documenti_gaia']);
  uguale(righe.length, 0);
});

prova('corpo non JSON o troppo grande', async () => {
  righe = [];
  uguale((await chiama('{rotto')).status, 400);
  uguale((await chiama({ ...OK, nome: 'x'.repeat(5000) })).status, 413);
});

prova('il campo trappola risponde ok senza salvare', async () => {
  righe = [];
  const r = await chiama({ ...OK, sito: 'http://spam' });
  uguale([r.status, righe.length], [200, 0]);
});

prova(`dallo stesso mittente al massimo ${MAX_PER_MITTENTE} richieste l'ora`, async () => {
  righe = [];
  for (let i = 0; i < MAX_PER_MITTENTE; i++) uguale((await chiama(OK)).status, 200);
  uguale((await chiama(OK)).status, 429);
  uguale((await chiama(OK, { ip: '5.6.7.8' })).status, 200, 'un altro volontario passa');
});

prova(`oltre ${MAX_AL_GIORNO} richieste al giorno il modulo si ferma per tutti`, async () => {
  const adesso = new Date().toISOString();
  righe = Array.from({ length: MAX_AL_GIORNO }, (_, i) => ({ ip_hash: `h${i}`, created_at: adesso }));
  uguale((await chiama(OK)).status, 429);
});

prova('senza chiave di servizio il modulo dice che non è disponibile', async () => {
  righe = [];
  uguale((await chiama(OK, { env: {} })).status, 503);
});
