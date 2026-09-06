// ============================================================
//  Service worker — abilita l'uso come PWA (installabile, con una minima
//  cache di riserva se la rete cade a metà utilizzo).
//
//  Il worker.js manda "Cache-Control: no-cache" su tutto apposta (vedi
//  commento lì) per evitare versioni vecchie dopo un deploy: qui seguiamo
//  la stessa filosofia con una strategia "network-first" — si usa sempre
//  la versione più recente da rete, la cache serve solo come fallback
//  quando la richiesta di rete fallisce (offline), non come sostituto.
//  Niente precache di un elenco di file: la cache si popola da sola con
//  quello che l'utente visita, così non va tenuta allineata a mano ogni
//  volta che si aggiunge una vista. L'unica eccezione è il guscio dell'app
//  ('/', cioè index.html), archiviato all'installazione: senza, un portale
//  appena aggiunto alla schermata home e aperto senza rete non mostrava
//  nulla, nemmeno la propria intestazione.
// ------------------------------------------------------------
//  Le chiamate verso *.supabase.co e le /api/* non vengono mai messe in
//  cache: richiedono sempre dati aggiornati (o falliscono onestamente se
//  offline, invece di rispondere con dati vecchi silenziosamente).
// ============================================================

const CACHE_NAME = 'amministrazione-cri-v2';
const NO_CACHE_PATHS = ['/api/'];

// Indirizzo del guscio dell'applicazione. Il portale è una pagina sola con le
// rotte nel frammento (#/trasporti/…), che al server non arriva: qualunque
// pagina si stia guardando, il browser chiede sempre '/'. È quindi con questo
// indirizzo — non con '/index.html', che non chiede mai nessuno — che il
// guscio finisce in cache ed è da qui che va ripescato quando la rete manca.
const GUSCIO = '/';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  // Il guscio si mette da parte subito, senza aspettare che l'utente ci
  // ripassi: appena installata, l'app aggiunta alla schermata home si apriva
  // offline solo se per caso era già stata visitata con questo service worker
  // attivo. `cache: 'reload'` la prende dalla rete e non dalla cache HTTP del
  // browser, così non si archivia una versione vecchia proprio all'avvio.
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.add(new Request(GUSCIO, { cache: 'reload' })))
      .catch(() => { /* offline durante l'installazione: si popolerà navigando */ })
  );
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
        // Si mette in cache SOLO una risposta buona. Prima ci finiva
        // qualunque cosa: un 404 o un 500 passeggero veniva salvato e poi
        // riproposto come "versione offline" per sempre, cioè la pagina
        // rotta invece di quella giusta. Anche cache.put andava in errore
        // sulle risposte parziali (206), e il rifiuto non era gestito da
        // nessuno.
        if (response.ok && response.status === 200 && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => cache.put(request, copy))
            .catch(() => { /* quota piena o risposta non memorizzabile: pazienza */ });
        }
        return response;
      })
      .catch(async () => {
        // ignoreSearch: una pagina raggiunta con un parametro in coda
        // (?utm=…, ?mode=local) è la stessa che sta in cache senza.
        const cached = await caches.match(request, { ignoreSearch: true });
        if (cached) return cached;
        if (request.mode === 'navigate') {
          // Il ripiego cercava '/index.html', che in cache non c'è mai
          // finito: nessuno lo chiede con quel nome, e quindi il ripiego non
          // è mai scattato — offline usciva l'errore di rete del browser
          // anche avendo il guscio archiviato. Adesso si cerca dove il
          // guscio sta davvero.
          const guscio = await caches.match(GUSCIO, { ignoreSearch: true });
          if (guscio) return guscio;
          return paginaOffline();
        }
        throw new Error('offline-senza-cache');
      })
  );
});

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
  .logo { width:46px; height:46px; margin:0 auto 14px; border-radius:10px; background:#e30613;
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
