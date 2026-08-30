// ============================================================
//  Service worker — abilita l'uso come PWA (installabile, con una minima
//  cache di riserva se la rete cade a metà utilizzo).
//
//  Il worker.js manda "Cache-Control: no-cache" su tutto apposta (vedi
//  commento lì) per evitare versioni vecchie dopo un deploy: qui seguiamo
//  la stessa filosofia con una strategia "network-first" — si usa sempre
//  la versione più recente da rete, la cache serve solo come fallback
//  quando la richiesta di rete fallisce (offline), non come sostituto.
//  Niente precache statico di un elenco di file: si popola da sola con
//  quello che l'utente visita, così non va tenuta allineata a mano ogni
//  volta che si aggiunge una vista.
// ------------------------------------------------------------
//  Le chiamate verso *.supabase.co e le /api/* non vengono mai messe in
//  cache: richiedono sempre dati aggiornati (o falliscono onestamente se
//  offline, invece di rispondere con dati vecchi silenziosamente).
// ============================================================

const CACHE_NAME = 'scadenziario-v1';
const NO_CACHE_PATHS = ['/api/'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
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

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === 'navigate') {
          const shell = await caches.match('/index.html');
          if (shell) return shell;
        }
        throw new Error('offline-senza-cache');
      })
  );
});
