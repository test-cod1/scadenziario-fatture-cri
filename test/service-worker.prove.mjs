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

  // Rimette il mondo com'era per gli altri file di prova.
  Object.assign(globalThis, originali);
});
