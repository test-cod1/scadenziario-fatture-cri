// ============================================================
//  Service worker — abilita l'uso come PWA (installabile, utilizzabile
//  offline) e, sul sito pubblicato, rende istantanee le visite successive.
//
//  DUE MODI DI LAVORARE, decisi da VERSIONE qui sotto:
//
//  1. PUBBLICATO (Cloudflare Pages). tools/build-pages.mjs, a ogni deploy,
//     scrive in VERSIONE un'impronta del contenuto del sito e in PRECACHE
//     l'elenco dei file dell'avvio. Ogni versione ha la SUA cache, e i file
//     si servono da lì senza chiedere nulla alla rete ("cache-first").
//     Prima, con "network-first" e Cache-Control: no-cache, ogni visita
//     faceva una richiesta per ciascun file (33 per la sola home) solo per
//     sentirsi dire "non è cambiato": su telefono, secondi di attesa per
//     niente. Adesso la rete si usa solo per i file mai visti da questa
//     versione.
//     Un deploy cambia l'impronta, quindi cambia questo file: il browser lo
//     nota (lo ricontrolla a ogni apertura, e la pagina glielo chiede anche
//     ogni ora), installa la versione nuova accanto a quella in uso e la
//     pagina decide quando passarci (vedi gestisciAggiornamenti in
//     js/app.js). Il passaggio è tutto in una volta: una pagina non si trova
//     mai con metà moduli vecchi e metà nuovi, che è il rischio vero di una
//     cache senza versioni.
//
//  2. SVILUPPO (server.js in locale, e il Worker, che pubblica i file così
//     come sono). VERSIONE resta il segnaposto: si lavora "network-first"
//     come sempre, la cache serve solo quando la rete manca. Chi modifica un
//     file in locale lo vede al primo ricaricamento, senza svuotare niente.
// ------------------------------------------------------------
//  Le chiamate verso *.supabase.co e le /api/* non passano mai di qui:
//  richiedono sempre dati aggiornati (o falliscono onestamente se offline,
//  invece di rispondere con dati vecchi silenziosamente).
// ============================================================

const VERSIONE = '__VERSIONE__';
const PRECACHE = [/* __PRECACHE__ */];

const IN_SVILUPPO = VERSIONE.startsWith('__');
const CACHE_NAME = IN_SVILUPPO ? 'amministrazione-cri-v2' : `amministrazione-cri-${VERSIONE}`;
const NO_CACHE_PATHS = ['/api/'];

// Indirizzo del guscio dell'applicazione. Il portale è una pagina sola con le
// rotte nel frammento (#/trasporti/…), che al server non arriva: qualunque
// pagina si stia guardando, il browser chiede sempre '/'. È quindi con questo
// indirizzo — non con '/index.html', che non chiede mai nessuno — che il
// guscio finisce in cache ed è da qui che va ripescato.
const GUSCIO = '/';

self.addEventListener('install', (event) => {
  // In sviluppo si prende subito il controllo, come sempre. Pubblicato,
  // invece, la versione nuova ASPETTA: la pagina aperta sta usando i moduli
  // della versione in corso, e passarle sotto i piedi quelli nuovi a metà
  // lavoro vorrebbe dire mescolarli. È la pagina a dire quando (messaggio
  // 'attiva', qui sotto).
  if (IN_SVILUPPO) self.skipWaiting();
  // Il guscio e i file dell'avvio si mettono da parte subito: un portale
  // appena aggiunto alla schermata home deve aprirsi anche senza rete.
  // `cache: 'reload'` li prende dalla rete e non dalla cache HTTP del
  // browser, così non si archivia una copia vecchia proprio all'avvio.
  const elenco = [...new Set([GUSCIO, ...PRECACHE])];
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(elenco.map((u) => new Request(u, { cache: 'reload' }))))
      .catch(() => { /* offline durante l'installazione: si popolerà navigando */ })
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'attiva') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (NO_CACHE_PATHS.some((p) => url.pathname.startsWith(p))) return;

  event.respondWith(IN_SVILUPPO ? daReteConRiserva(request) : daCacheDellaVersione(request));
});

// Pubblicato: prima la cache di questa versione, poi la rete.
async function daCacheDellaVersione(request) {
  const cache = await caches.open(CACHE_NAME);
  // Qualunque navigazione è il guscio (vedi GUSCIO); ignoreSearch perché
  // '/?utm=…' o '/?mode=local' sono la stessa pagina.
  const chiave = request.mode === 'navigate' ? GUSCIO : request;
  const inCache = await cache.match(chiave, { ignoreSearch: request.mode === 'navigate' });
  if (inCache) return inCache;
  try {
    const response = await fetch(request);
    if (memorizzabile(request, response)) {
      cache.put(chiave, response.clone()).catch(() => { /* quota piena: pazienza */ });
    }
    return response;
  } catch (e) {
    if (request.mode === 'navigate') return paginaOffline();
    throw e;
  }
}

// Sviluppo: sempre la rete, la cache solo quando la rete manca.
async function daReteConRiserva(request) {
  try {
    const response = await fetch(request);
    if (memorizzabile(request, response)) {
      const copy = response.clone();
      caches.open(CACHE_NAME)
        .then((cache) => cache.put(request, copy))
        .catch(() => { /* quota piena o risposta non memorizzabile: pazienza */ });
    }
    return response;
  } catch {
    // ignoreSearch: una pagina raggiunta con un parametro in coda
    // (?utm=…, ?mode=local) è la stessa che sta in cache senza.
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const guscio = await caches.match(GUSCIO, { ignoreSearch: true });
      if (guscio) return guscio;
      return paginaOffline();
    }
    throw new Error('offline-senza-cache');
  }
}

// Si mette in cache SOLO una risposta buona, e del tipo che ci si aspetta.
// - Solo 200 "basic": un 404 o un 500 passeggero salvato verrebbe riproposto
//   per sempre, e cache.put va in errore sulle risposte parziali (206).
// - Il tipo deve corrispondere a quello che si è chiesto: su Pages un file
//   che non esiste (per esempio un modulo rinominato da un deploy, chiesto
//   da una scheda rimasta aperta) risponde con index.html e stato 200.
//   Salvato sotto l'indirizzo del .js, sarebbe stato riproposto come
//   "modulo" anche offline, con un errore di tipo MIME a ogni avvio.
function memorizzabile(request, response) {
  if (!response.ok || response.status !== 200 || response.type !== 'basic') return false;
  const tipo = response.headers.get('Content-Type') || '';
  const percorso = new URL(request.url).pathname;
  if (request.mode === 'navigate') return tipo.includes('text/html');
  if (/\.m?js$/.test(percorso)) return tipo.includes('javascript');
  if (/\.css$/.test(percorso)) return tipo.includes('text/css');
  if (/\.json$/.test(percorso)) return !tipo.includes('text/html');
  return true;
}

// Ultima spiaggia: si è offline e del portale non c'è nemmeno il guscio in
// cache (primo avvio senza rete). Meglio una pagina che dice cosa sta
// succedendo, con l'aspetto del portale, della schermata di errore del
// browser — che parla di DNS e di connessioni rifiutate a chi voleva solo
// vedere le fatture.
function paginaOffline() {
  const html = `<!doctype html><html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Amministrazione CRI — sei offline</title>
<style>
  html { color-scheme: light; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
         background:#f5f6f8; color:#1c2024;
         font-family:-apple-system,"Segoe UI",Roboto,Arial,sans-serif; }
  .box { background:#fff; border:1px solid #e4e8ec; border-radius:14px; padding:28px 26px;
         max-width:380px; margin:20px; box-shadow:0 6px 24px rgba(0,0,0,.06); text-align:center; }
  .logo { width:46px; height:46px; margin:0 auto 14px; border-radius:10px; background:#EE0000;
          color:#fff; font-size:28px; font-weight:800; display:flex; align-items:center; justify-content:center; }
  h1 { font-size:18px; margin:0 0 8px; }
  p { margin:0 0 16px; color:#5a6570; font-size:14px; line-height:1.5; }
  a.btn { display:inline-block; font-weight:600; text-decoration:none; color:#1c2024;
          padding:9px 18px; border-radius:8px; border:1px solid #d7dce1; background:#fff; }
</style></head><body>
  <div class="box">
    <div class="logo">✚</div>
    <h1>Sei offline</h1>
    <p>Il portale non è raggiungibile e su questo dispositivo non ce n'è ancora una copia salvata.
       Riprova quando torna la connessione.</p>
    <a class="btn" href="/">Riprova</a>
  </div>
</body></html>`;
  return new Response(html, {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
