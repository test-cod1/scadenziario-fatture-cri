import { auth } from './data/store.js';
import { el, clear, esc } from './lib/ui.js';
import { renderLogin, renderResetPassword } from './views/auth.js';
import { renderDashboard } from './views/dashboard.js';
import { renderReport } from './views/report.js';
import { renderProposte } from './views/proposte.js';
import { renderImpostazioni } from './views/impostazioni.js';
import { renderDashboardAttive } from './views/dashboardAttive.js';
import { renderReportAttive } from './views/reportAttive.js';
import { startTour } from './lib/tour.js';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

const app = document.getElementById('app');
let currentUser = null;

async function boot() {
  const match = location.hash.match(/type=(recovery|invite|signup)/);
  const isInvite = match && match[1] !== 'recovery';
  const isSetPassword = !!match;
  currentUser = await auth.current();
  if (isSetPassword) {
    renderResetPassword(app, async () => { currentUser = await auth.current(); await startApp(); }, { invite: isInvite });
    return;
  }
  if (!currentUser) {
    renderLogin(app, async () => { currentUser = await auth.current(); await startApp(); });
    return;
  }
  await startApp();
}

const RUOLI_ABILITATI = ['admin', 'operatore'];

// Un account che esiste su Supabase ma non è stato abilitato da un admin non
// vede alcun dato (le policy RLS lo escludono): senza questo controllo si
// troverebbe davanti a una dashboard vuota, indistinguibile da un errore.
function renderNonAbilitato() {
  clear(app);
  app.appendChild(el(`<div class="login-wrap"><div class="login">
    <div class="brand"><div class="logo">✚</div><div><b>Scadenziario Fatture</b><span>CRI Genova</span></div></div>
    <div class="banner warn" style="margin:18px 0"><div class="bi">⏳</div><div>
      <b>Account non ancora abilitato</b>
      <div class="small">L'accesso è riuscito, ma un amministratore deve autorizzare il tuo utente
      (${esc(currentUser.email)}) prima che tu possa consultare le fatture.</div>
    </div></div>
    <button class="btn" id="esci" style="width:100%;justify-content:center">Esci</button>
  </div></div>`));
  app.querySelector('#esci').addEventListener('click', async () => {
    await auth.signOut(); location.hash = ''; location.reload();
  });
}

let _routerBound = false;
async function startApp() {
  // Utenti creati da un admin con password provvisoria (vedi Impostazioni →
  // Utenti): prima di mostrare qualunque pagina devono impostarne una propria.
  if (currentUser.deveCambiarePassword) {
    renderResetPassword(app, async () => { currentUser = await auth.current(); await startApp(); }, { obbligatorio: true });
    return;
  }
  if (!RUOLI_ABILITATI.includes(currentUser.ruolo)) return renderNonAbilitato();
  renderShell();
  if (!_routerBound) { window.addEventListener('hashchange', route); _routerBound = true; }
  if (!location.hash) location.hash = '#/passive/fatture';
  else route();
}

// Le due sezioni (fatture fornitori e fatture clienti) sono percorsi
// indipendenti sotto #/passive/... e #/attive/...: un vecchio segnalibro
// senza prefisso (es. #/log) resta valido e ricade sotto "passive" (vedi
// route()), così non si rompe nulla per chi aveva già l'app aperta.
const SEZIONI = ['passive', 'attive'];

// Il Registro modifiche non ha più una voce di menu propria: è un'unica
// pagina condivisa fra passive e attive, raggiungibile da Impostazioni
// (vedi anche il redirect dei vecchi segnalibri "…/log" in route()).
function navItemsPassive() {
  return [
    { id: 'fatture', icon: '🧾', label: 'Fatture' },
    { id: 'proposte', icon: '📨', label: 'Proposte pagamento' },
    { id: 'report', icon: '📊', label: 'Report' },
  ];
}
function navItemsAttive() {
  return [
    { id: 'fatture', icon: '💶', label: 'Fatture' },
    { id: 'report', icon: '📊', label: 'Report' },
  ];
}

function renderShell() {
  clear(app);
  const layout = el(`<div class="layout">
    <aside class="sidebar">
      <div class="brand"><div class="logo">✚</div><div><b>Scadenziario Fatture</b><span>CRI Genova</span></div></div>
      <div class="section-switch">
        <button data-sezione="passive">🧾 Fatture Passive</button>
        <button data-sezione="attive">💶 Fatture Attive</button>
      </div>
      <nav class="nav"></nav>
      ${currentUser.ruolo === 'admin' ? '<nav class="nav nav-secondary"><a href="#/passive/impostazioni" data-nav-imp><span class="ic">⚙️</span><span class="txt">Impostazioni</span></a></nav>' : ''}
      <div class="foot">
        <div class="who">${esc(currentUser.nome || currentUser.email)}</div>
        <div>${esc(currentUser.ruolo)}</div>
        <button data-logout>Esci</button>
      </div>
    </aside>
    <main class="main" id="view"></main>
  </div>`);
  layout.querySelectorAll('[data-sezione]').forEach(btn => {
    btn.addEventListener('click', () => { location.hash = `#/${btn.dataset.sezione}/fatture`; });
  });
  layout.querySelector('[data-logout]').addEventListener('click', async () => { await auth.signOut(); location.hash = ''; location.reload(); });
  app.appendChild(layout);

  // Il pulsante vive fuori da #app (in fondo a <body>, posizione fissa) così
  // resta identico e cliccabile a ogni cambio di pagina, invece di essere
  // ridisegnato da ogni singola vista: lo si crea una sola volta qui, dove
  // renderShell() gira una volta sola dopo il login.
  if (!document.querySelector('.tour-fab')) {
    const fab = el(`<button class="tour-fab" type="button" title="Tutorial guidato" aria-label="Avvia il tutorial guidato">🎓</button>`);
    fab.addEventListener('click', () => startTour({ user: currentUser }));
    document.body.appendChild(fab);
  }
}

function disegnaNav(sezione, sub) {
  const nav = document.querySelector('.nav:not(.nav-secondary)');
  if (!nav) return;
  clear(nav);
  const items = sezione === 'attive' ? navItemsAttive() : navItemsPassive();
  for (const n of items) {
    nav.appendChild(el(`<a href="#/${sezione}/${n.id}" data-nav="${n.id}"><span class="ic">${n.icon}</span><span class="txt">${n.label}</span></a>`));
  }
  nav.querySelectorAll('a').forEach(a => a.classList.toggle('active', a.dataset.nav === sub));
  document.querySelectorAll('[data-sezione]').forEach(btn => btn.classList.toggle('active', btn.dataset.sezione === sezione));
  const impLink = document.querySelector('[data-nav-imp]');
  if (impLink) impLink.classList.toggle('active', sezione === 'passive' && sub === 'impostazioni');
}

let _routeSeq = 0;
async function route() {
  const view = document.getElementById('view');
  if (!view) return;
  const my = ++_routeSeq;
  const hash = location.hash.replace(/^#\//, '') || 'passive/fatture';
  let [section, sub] = hash.split('/');
  if (!SEZIONI.includes(section)) { sub = section; section = 'passive'; }   // vecchi segnalibri senza prefisso di sezione
  if (!sub) sub = 'fatture';
  // Il Registro modifiche è confluito in un'unica pagina dentro Impostazioni
  // (vedi navItemsPassive/navItemsAttive): un vecchio segnalibro su
  // "…/log", di qualunque sezione, ci finisce comunque.
  if (sub === 'log') { location.hash = '#/passive/impostazioni'; return; }
  disegnaNav(section, sub);
  clear(view);
  view.appendChild(el('<div class="spinner" style="margin-top:60px"></div>'));
  const ctx = { user: currentUser, go: (h) => { location.hash = h; } };
  try {
    if (my !== _routeSeq) return;
    clear(view);
    if (section === 'attive') {
      if (sub === 'report') await renderReportAttive(view, ctx);
      else await renderDashboardAttive(view, ctx);
    } else if (sub === 'report') await renderReport(view, ctx);
    else if (sub === 'proposte') await renderProposte(view, ctx);
    else if (sub === 'impostazioni') await renderImpostazioni(view, ctx);
    else await renderDashboard(view, ctx);
  } catch (e) {
    clear(view);
    view.appendChild(el(`<div class="empty-state"><div class="big">⚠️</div><p>Errore: ${esc(e.message)}</p></div>`));
    console.error(e);
  }
}

boot();
