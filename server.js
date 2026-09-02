// ============================================================
//  Server statico per lo sviluppo locale + le /api/* del portale
//  Avvio:  node server.js      (poi apri http://localhost:4323)
//
//  Le chiavi si mettono in un file .dev.vars, una per riga:
//    GEMINI_API_KEY=...             lettura AI delle fatture (PDF/immagini)
//    SUPABASE_SERVICE_ROLE_KEY=...  creazione utenti (Supabase > Settings > API)
//    ORS_KEY=...                    percorsi e indirizzi dei preventivi trasporti
//  In alternativa si passano come variabili d'ambiente:
//    Windows PowerShell:  $env:GEMINI_API_KEY="la-tua-chiave"; node server.js
//    macOS/Linux:         GEMINI_API_KEY=la-tua-chiave node server.js
//  Senza chiavi il resto dell'app funziona comunque: manca solo la funzione
//  che dipende dalla chiave assente.
// ============================================================
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = process.env.PORT || 4323;

// Chiavi dal file .dev.vars (stesso formato dei secret di Cloudflare): quelle
// già presenti nell'ambiente hanno la precedenza.
try {
  for (const riga of fs.readFileSync(path.join(ROOT, '.dev.vars'), 'utf8').split('\n')) {
    const m = riga.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {}

// Le stesse intestazioni di sicurezza servite in produzione dal Worker (unica
// fonte in js/lib/securityHeaders.mjs, un modulo ES caricato qui con un
// import() dinamico perché questo file è CommonJS): se in locale non ci
// fossero, una violazione della CSP verrebbe scoperta solo dopo il deploy.
let HEADER_SICUREZZA = {};

// File e cartelle che non fanno parte del sito e non vanno mai serviti:
// stesso elenco di .assetsignore (che svolge questo ruolo in produzione).
const NON_SERVIBILI = [
  '.dev.vars', '.env', '.git', '.wrangler', 'node_modules',
  'supabase', 'functions', 'server.js', 'worker.js', 'wrangler.jsonc',
  'package.json', 'package-lock.json', '.assetsignore', '.gitignore',
];
function nonServibile(relativo) {
  const primoPezzo = relativo.split(path.sep)[0];
  return NON_SERVIBILI.includes(primoPezzo) || primoPezzo.startsWith('.');
}

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.pdf': 'application/pdf',
};

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://${req.headers.host}`);

  if (API[u.pathname]) return apiFunction(req, res, u.pathname);

  let p = decodeURIComponent(u.pathname);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  // path.sep in coda: senza, una cartella FRATELLA il cui nome inizia come
  // ROOT (es. "…-backup") avrebbe superato il controllo.
  if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
  // Stessa lista di .assetsignore, che in produzione tiene questi file fuori
  // dagli asset serviti dal Worker: in locale mancava, e `GET /.dev.vars`
  // restituiva in chiaro la chiave Gemini e la service_role key di Supabase.
  if (nonServibile(path.relative(ROOT, file))) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    res.writeHead(200, Object.assign({
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    }, HEADER_SICUREZZA));
    res.end(data);
  });
});
import('./js/lib/securityHeaders.mjs').then(({ HEADER_SICUREZZA: h }) => {
  HEADER_SICUREZZA = h;
  const stato = (n) => `${n} ${process.env[n] ? 'presente' : 'ASSENTE'}`;
  server.listen(PORT, () => console.log(
    `Server attivo su http://localhost:${PORT}  (${stato('GEMINI_API_KEY')}, ${stato('SUPABASE_SERVICE_ROLE_KEY')}, ${stato('ORS_KEY')})`));
});

// ============================================================
//  /api/* — qui girano LE STESSE function che stanno in produzione
//  (functions/api/*.js), non una loro copia riscritta per Node: prima erano
//  duplicate a mano in questo file e le due versioni finivano per divergere
//  (il controllo del ruolo in /api/crea-utente era rimasto indietro di una
//  riscrittura). Le function sono scritte per l'ambiente Worker, che espone
//  le stesse API standard del web disponibili in Node: si costruisce una
//  Request, si chiama l'handler e si riversa la Response nella risposta HTTP.
// ============================================================
const API = {
  '/api/estrai-fattura': './functions/api/estrai-fattura.js',
  '/api/estrai-fattura-attiva': './functions/api/estrai-fattura-attiva.js',
  '/api/crea-utente': './functions/api/crea-utente.js',
  '/api/geocode': './functions/api/geocode.js',
  '/api/route': './functions/api/route.js',
  '/api/prezzo-italia': './functions/api/prezzo-italia.js',
  '/api/prezzo-eu': './functions/api/prezzo-eu.js',
};

// La cache edge di Cloudflare (usata da /api/prezzo-italia per non riscaricare
// l'elenco dei distributori ad ogni richiesta) in Node non esiste: qui si
// finge una cache sempre vuota, così la function funziona lo stesso e in
// locale i dati sono semplicemente sempre freschi.
if (!globalThis.caches) {
  globalThis.caches = { default: { match: async () => undefined, put: async () => {} } };
}

function leggiCorpo(req) {
  return new Promise((res) => {
    const pezzi = [];
    req.on('data', (c) => pezzi.push(c));
    req.on('end', () => res(Buffer.concat(pezzi)));
  });
}

async function apiFunction(req, res, pathname) {
  const mod = await import(API[pathname]);
  const handler = req.method === 'POST' ? mod.onRequestPost
    : req.method === 'GET' ? mod.onRequestGet : null;
  if (!handler) {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Metodo non ammesso.' }));
  }
  const corpo = ['GET', 'HEAD'].includes(req.method) ? undefined : await leggiCorpo(req);
  // Le intestazioni di Node possono avere valori multipli (array): la Request
  // standard vuole stringhe.
  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) headers[k] = Array.isArray(v) ? v.join(', ') : v;
  const request = new Request(`http://localhost:${PORT}${req.url}`, { method: req.method, headers, body: corpo });

  try {
    // `waitUntil` serve alle function che continuano un lavoro dopo aver
    // risposto (in produzione: salvare in cache). Qui non c'è nulla da tenere
    // in vita — il processo resta acceso comunque — ma la funzione deve
    // esistere, altrimenti la chiamata va in errore.
    const out = await handler({ request, env: process.env, waitUntil: (p) => Promise.resolve(p).catch(() => {}) });
    const buf = Buffer.from(await out.arrayBuffer());
    res.writeHead(out.status, Object.fromEntries(out.headers));
    res.end(buf);
  } catch (e) {
    console.error(`[api] ${pathname}:`, e);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Errore interno: ' + e.message }));
  }
}

