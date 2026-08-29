import { auth } from './data/store.js';
import { el, clear, esc } from './lib/ui.js';
import { renderLogin, renderResetPassword } from './views/auth.js';
import { renderDashboard } from './views/dashboard.js';
import { renderLog } from './views/log.js';

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

let _routerBound = false;
async function startApp() {
  renderShell();
  if (!_routerBound) { window.addEventListener('hashchange', route); _routerBound = true; }
  if (!location.hash) location.hash = '#/fatture';
  else route();
}

function navItems() {
  const items = [{ id: 'fatture', icon: '🧾', label: 'Fatture' }];
  if (currentUser.ruolo === 'admin') items.push({ id: 'log', icon: '📋', label: 'Registro modifiche' });
  return items;
}

function renderShell() {
  clear(app);
  const layout = el(`<div class="layout">
    <aside class="sidebar">
      <div class="brand"><div class="logo">✚</div><div><b>Scadenziario Fatture</b><span>Croce Rossa Italiana</span></div></div>
      <nav class="nav"></nav>
      <div class="foot">
        <div class="who">${esc(currentUser.nome || currentUser.email)}</div>
        <div>${esc(currentUser.ruolo)}</div>
        <button data-logout>Esci</button>
      </div>
    </aside>
    <main class="main" id="view"></main>
  </div>`);
  const nav = layout.querySelector('.nav');
  for (const n of navItems()) {
    nav.appendChild(el(`<a href="#/${n.id}" data-nav="${n.id}"><span class="ic">${n.icon}</span><span class="txt">${n.label}</span></a>`));
  }
  layout.querySelector('[data-logout]').addEventListener('click', async () => { await auth.signOut(); location.hash = ''; location.reload(); });
  app.appendChild(layout);
}

function setActive(id) {
  document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('active', a.dataset.nav === id));
}

let _routeSeq = 0;
async function route() {
  const view = document.getElementById('view');
  if (!view) return;
  const my = ++_routeSeq;
  const hash = location.hash.replace(/^#\//, '') || 'fatture';
  const [section] = hash.split('/');
  setActive(section);
  clear(view);
  view.appendChild(el('<div class="spinner" style="margin-top:60px"></div>'));
  const ctx = { user: currentUser, go: (h) => { location.hash = h; } };
  try {
    if (my !== _routeSeq) return;
    clear(view);
    if (section === 'log') await renderLog(view, ctx);
    else await renderDashboard(view, ctx);
  } catch (e) {
    clear(view);
    view.appendChild(el(`<div class="empty-state"><div class="big">⚠️</div><p>Errore: ${esc(e.message)}</p></div>`));
    console.error(e);
  }
}

boot();
