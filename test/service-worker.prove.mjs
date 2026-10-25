// Il service worker, eseguito davvero: si ricreano `self`, `caches`,
// `Request` e `fetch` quel tanto che basta, e si prova quello che succede
// quando la rete cade. È l'unico modo per verificarlo senza staccare il wifi
// a mano e sperare di ricordarsi di rifarlo al prossimo deploy.
import { gruppo, prova, uguale, vero, falso, RADICE } from './aiuto.mjs';
import { pathToFileURL } from 'node:url';

const ORIGINE = 'https://portale.test';
const GUSCIO_HTML = '<!doctype html><html><body><div id="app">portale</div></body></html>';

const handlers = {};
const archivi = new Map();
let rete = 'ok';

// Gli originali si rimettono a posto in fondo: gli altri file di prova usano
// fetch per leggere la carta intestata.
const originali = { fetch: globalThis.fetch, Request: globalThis.Request, self: globalThis.self, caches: globalThis.caches };

class FintaCache {
  constructor() { this.map = new Map(); }
  async put(req, res) { this.map.set(chiave(req).href, res); }
  async add(req) { const r = await globalThis.fetch(req); if (!r.ok) throw new Error('add fallita'); await this.put(req, r); }
  async addAll(reqs) { for (const r of reqs) await this.add(r); }
  async match(req, { ignoreSearch = false } = {}) {
    const u = chiave(req);
    if (this.map.has(u.href)) return this.map.get(u.href);
    if (ignoreSearch) for (const [k, v] of this.map) if (new URL(k).pathname === u.pathname) return v;
    return undefined;
  }
}
const chiave = (r) => new URL(typeof r === 'string' ? new URL(r, ORIGINE + '/').href : r.url);

function preparaAmbienteWorker() {
  globalThis.self = {
    addEventListener: (tipo, h) => { handlers[tipo] = h; },
    skipWaiting: () => {}, clients: { claim: () => {} },
    location: new URL(`${ORIGINE}/sw.js`),
  };
  globalThis.Request = class {
    constructor(url, opts = {}) {
      this.url = new URL(url, ORIGINE + '/').href;
      this.method = opts.method || 'GET';
      this.mode = opts.mode || 'no-cors';
    }
  };
  globalThis.caches = {
    async open(nome) { if (!archivi.has(nome)) archivi.set(nome, new FintaCache()); return archivi.get(nome); },
    async keys() { return [...archivi.keys()]; },
    async delete(nome) { return archivi.delete(nome); },
    async match(req, opt) { for (const c of archivi.values()) { const r = await c.match(req, opt); if (r) return r; } },
  };
  globalThis.fetch = async () => {
    if (rete === 'giu') throw new TypeError('Failed to fetch');
    const res = new Response(GUSCIO_HTML, { status: 200, headers: { 'Content-Type': 'text/html' } });
    Object.defineProperty(res, 'type', { value: 'basic' });
    return res;
  };
}

async function navigazione(url) {
  const richiesta = { method: 'GET', url: new URL(url, ORIGINE).href, mode: 'navigate' };
  let risposta;
  handlers.fetch({ request: richiesta, respondWith: (p) => { risposta = p; } });
  return await risposta;
}

let installato = false;
async function installa() {
  if (installato) return;
  preparaAmbienteWorker();
  await import(pathToFileURL(RADICE + '/sw.js').href);
  let attesa;
  handlers.install({ waitUntil: (p) => { attesa = p; } });
  await attesa;
  installato = true;
}

gruppo('Service worker (uso offline)');

prova('all\'installazione mette da parte il guscio dell\'app', async () => {
  rete = 'ok';
  await installa();
  const guscio = await globalThis.caches.match('/');
  vero(!!guscio, 'senza, un portale appena installato e aperto offline non mostra niente');
});

prova('offline serve il guscio dalla cache', async () => {
  await installa();
  rete = 'giu';
  const r = await navigazione('/');
  uguale(r.status, 200);
  vero((await r.clone().text()).includes('portale'));
});

prova('offline funziona anche con un parametro in coda', async () => {
  await installa();
  rete = 'giu';
  const r = await navigazione('/?mode=local');
  uguale(r.status, 200, 'ignoreSearch: ?mode=local è la stessa pagina');
});

prova('senza niente in cache risponde una pagina che si capisce', async () => {
  await installa();
  rete = 'giu';
  archivi.clear();
  const r = await navigazione('/');
  const testo = await r.clone().text();
  uguale(r.status, 503);
  vero(/Sei offline/.test(testo), 'meglio di un errore di rete che parla di DNS');
  falso(/<script|onclick=/i.test(testo), 'niente script inline: la pagina deve valere anche con la CSP del portale');
});

prova('le chiamate /api/ non passano mai dalla cache', async () => {
  await installa();
  let intercettata = false;
  handlers.fetch({
    request: { method: 'GET', url: `${ORIGINE}/api/geocode?text=x`, mode: 'cors' },
    respondWith: () => { intercettata = true; },
  });
  falso(intercettata, 'una risposta di rete vecchia al posto di quella vera sarebbe peggio di un errore');
});

// ------------------------------------------------------------
//  Il service worker come esce dalla build di Pages: versione scritta,
//  file dell'avvio in cache, e i file serviti dalla cache senza rete.
// ------------------------------------------------------------
const { scriviVersione, fileAvvio } = await import(pathToFileURL(RADICE + '/tools/versione-sw.mjs').href);
const fs = await import('node:fs');
const os = await import('node:os');
const pathMod = await import('node:path');

let richiesteDiRete = [];
let prodInstallato = false;
async function installaPubblicato() {
  if (prodInstallato) return;
  preparaAmbienteWorker();
  archivi.clear();
  globalThis.fetch = async (req) => {
    const u = new URL(typeof req === 'string' ? req : req.url, ORIGINE);
    richiesteDiRete.push(u.pathname);
    if (rete === 'giu') throw new TypeError('Failed to fetch');
    // Come Pages: un file inesistente risponde con index.html e 200.
    const esiste = ['/', '/js/app.js', '/css/styles.css'].includes(u.pathname) || u.pathname === '/js/views/report.js';
    const js = esiste && u.pathname.endsWith('.js');
    const res = new Response(esiste && !js && u.pathname !== '/css/styles.css' ? GUSCIO_HTML : (js ? 'export const x = 1;' : (esiste ? 'body{}' : GUSCIO_HTML)),
      { status: 200, headers: { 'Content-Type': js ? 'text/javascript' : (u.pathname.endsWith('.css') && esiste ? 'text/css' : 'text/html') } });
    Object.defineProperty(res, 'type', { value: 'basic' });
    return res;
  };
  const sorgente = fs.readFileSync(pathMod.join(RADICE, 'sw.js'), 'utf8');
  const file = pathMod.join(os.tmpdir(), `sw-prova-${process.pid}.mjs`);
  fs.writeFileSync(file, scriviVersione(sorgente, 'abc123', ['/', '/js/app.js', '/css/styles.css']));
  await import(pathToFileURL(file).href);
  fs.rmSync(file, { force: true });
  let attesa;
  handlers.install({ waitUntil: (p) => { attesa = p; } });
  rete = 'ok';
  await attesa;
  prodInstallato = true;
}
async function richiesta(url, mode = 'no-cors') {
  let risposta;
  handlers.fetch({ request: { method: 'GET', url: new URL(url, ORIGINE).href, mode }, respondWith: (p) => { risposta = p; } });
  return await risposta;
}

gruppo('Service worker pubblicato (cache per versione)');

prova('la build scrive versione ed elenco, e si ferma se mancano i segnaposto', () => {
  const out = scriviVersione("const VERSIONE = '__VERSIONE__';\nconst PRECACHE = [/* __PRECACHE__ */];", 'v1', ['/', '/a.js']);
  vero(out.includes('const VERSIONE = "v1"'));
  vero(out.includes('const PRECACHE = ["/","/a.js"]'));
  let errore = null;
  try { scriviVersione('const VERSIONE = 1;', 'v1', []); } catch (e) { errore = e; }
  vero(errore, 'un sw.js senza segnaposto deve fermare la build');
});

prova("i file dell'avvio sono quelli che index.html chiede", () => {
  const indice = fs.readFileSync(pathMod.join(RADICE, 'index.html'), 'utf8');
  const elenco = fileAvvio(indice);
  vero(elenco.includes('/') && elenco.includes('/js/app.js') && elenco.includes('/css/styles.css'));
  vero(elenco.includes('/js/data/store.js'), "i modulepreload fanno parte dell'avvio");
  falso(elenco.some(u => u.startsWith('/data:') || u.includes('http')), 'niente favicon data: né indirizzi esterni');
});

prova("all'installazione mette in cache i file dell'avvio, nella cache della versione", async () => {
  richiesteDiRete = [];
  await installaPubblicato();
  vero(archivi.has('amministrazione-cri-abc123'), 'la cache porta il nome della versione');
  const cache = archivi.get('amministrazione-cri-abc123');
  vero(await cache.match('/js/app.js'), 'app.js in cache');
  vero(await cache.match('/'), 'guscio in cache');
});

prova('una volta in cache i file non richiedono più la rete', async () => {
  await installaPubblicato();
  richiesteDiRete = [];
  rete = 'ok';
  const r = await richiesta('/js/app.js');
  uguale(r.status, 200);
  const nav = await richiesta('/?utm=x', 'navigate');
  uguale(nav.status, 200);
  uguale(richiesteDiRete.length, 0, 'né per i moduli né per la pagina: è proprio quello che si vuole evitare');
});

prova('un modulo mai visto si scarica e poi resta in cache', async () => {
  await installaPubblicato();
  richiesteDiRete = [];
  await richiesta('/js/views/report.js');
  await richiesta('/js/views/report.js');
  uguale(richiesteDiRete.filter(p => p === '/js/views/report.js').length, 1);
});

prova('un .js che risponde con la pagina HTML non finisce in cache', async () => {
  // Su Pages un modulo che non esiste più risponde con index.html e 200:
  // salvato, sarebbe riproposto come modulo anche offline.
  await installaPubblicato();
  await richiesta('/js/views/sparito.js');
  const cache = archivi.get('amministrazione-cri-abc123');
  falso(await cache.match('/js/views/sparito.js'), 'HTML salvato al posto di un modulo');
});

prova('pubblicato, la versione nuova aspetta il via della pagina', async () => {
  await installaPubblicato();
  let saltata = false;
  globalThis.self.skipWaiting = () => { saltata = true; };
  handlers.install({ waitUntil: () => {} });
  falso(saltata, 'non deve subentrare da sola a metà lavoro');
  handlers.message({ data: 'attiva' });
  vero(saltata, 'al messaggio della pagina subentra');

  // Rimette il mondo com'era per gli altri file di prova.
  Object.assign(globalThis, originali);
});
