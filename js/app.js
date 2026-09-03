import { auth } from './data/store.js';
import { el, clear, esc, confirmDialog } from './lib/ui.js';
import { SEZIONI, getSezione, ruoloIn, paginaIniziale } from './sezioni.js';
import { renderLogin, renderResetPassword } from './views/auth.js';
import { renderHome } from './views/home.js';
import { renderSezioneVuota, renderSezioneEsterna } from './views/sezioneVuota.js';
import { renderPortaleUtenti } from './views/portaleUtenti.js';
import { renderDashboard } from './views/dashboard.js';
import { renderReport } from './views/report.js';
import { renderProposte } from './views/proposte.js';
import { renderImpostazioni } from './views/impostazioni.js';
import { renderDashboardAttive } from './views/dashboardAttive.js';
import { renderReportAttive } from './views/reportAttive.js';
import { startTour } from './lib/tour.js';
import { ciSonoModificheNonSalvate } from './lib/uscita.js';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

const app = document.getElementById('app');
let currentUser = null;
// Sezione in cui ci si trova adesso (null in home e nelle pagine di portale):
// la aggiorna disegnaNav e serve al pulsante del tour, che deve avviare il
// tour di QUESTA sezione.
let sezioneCorrente = null;

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

// Un account che esiste su Supabase ma che nessuno ha ancora abilitato non
// vede niente (le policy RLS lo escludono): senza questo controllo si
// troverebbe davanti a un portale vuoto, indistinguibile da un errore.
function renderNonAbilitato() {
  clear(app);
  app.appendChild(el(`<div class="login-wrap"><div class="login">
    <div class="brand"><div class="logo">✚</div><div><b>Amministrazione</b><span>CRI Genova</span></div></div>
    <div class="banner warn" style="margin:18px 0"><div class="bi">⏳</div><div>
      <b>Account non ancora abilitato</b>
      <div class="small">L'accesso è riuscito, ma un amministratore del portale deve autorizzare il tuo
      utente (${esc(currentUser.email)}) prima che tu possa entrare in una sezione.</div>
    </div></div>
    <button class="btn" id="esci" style="width:100%;justify-content:center">Esci</button>
  </div></div>`));
  app.querySelector('#esci').addEventListener('click', async () => {
    await auth.signOut(); location.hash = ''; location.reload();
  });
}

let _routerBound = false;
async function startApp() {
  // Utenti creati da un super admin con password provvisoria (vedi
  // Impostazioni → Utenti e autorizzazioni): prima di mostrare qualunque
  // pagina devono impostarne una propria.
  if (currentUser.deveCambiarePassword) {
    renderResetPassword(app, async () => { currentUser = await auth.current(); await startApp(); }, { obbligatorio: true });
    return;
  }
  if (currentUser.ruoloPortale === 'in_attesa') return renderNonAbilitato();
  renderShell();
  if (!_routerBound) { window.addEventListener('hashchange', route); _routerBound = true; }
  if (!location.hash) location.hash = '#/home';
  else route();
}

// ------------------------------------------------------------------
//  MENU DELLO SCADENZIARIO
//  È l'unica sezione con una struttura interna (fatture passive e attive,
//  ognuna con le sue pagine); le altre, per ora, hanno una pagina sola.
// ------------------------------------------------------------------
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
      <a class="brand brand-link" href="#/home" title="Torna alla scelta delle sezioni"><div class="logo">✚</div><div><b>Amministrazione</b><span>CRI Genova</span></div></a>
      <nav class="nav nav-sezioni"></nav>
      <div class="sez-corrente" id="subnav"></div>
      <nav class="nav nav-secondary" id="nav-imp"></nav>
      <div class="foot">
        <div class="who">${esc(currentUser.nome || currentUser.email)}</div>
        <div>${esc(currentUser.ruoloPortale === 'super_admin' ? 'amministratore portale' : 'utente')}</div>
        <button data-logout>Esci</button>
      </div>
    </aside>
    <main class="main" id="view"></main>
  </div>`);
  layout.querySelector('[data-logout]').addEventListener('click', async () => { await auth.signOut(); location.hash = ''; location.reload(); });
  app.appendChild(layout);

  // Elenco delle sezioni: ci sono tutte, anche quelle non autorizzate (che
  // però non sono cliccabili), come nella home.
  const nav = layout.querySelector('.nav-sezioni');
  nav.appendChild(el(`<a href="#/home" data-nav-sezione="home"><span class="ic">🏠</span><span class="txt">Home</span></a>`));
  for (const s of SEZIONI) {
    if (!ruoloIn(currentUser, s.id)) {
      nav.appendChild(el(`<span class="nav-bloccata" title="Non sei autorizzato ad accedere a ${esc(s.label)}"><span class="ic">🔒</span><span class="txt">${esc(s.label)}</span></span>`));
    } else if (s.tipo === 'esterna') {
      nav.appendChild(el(`<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer"><span class="ic">${s.emoji}</span><span class="txt">${esc(s.label)}</span></a>`));
    } else {
      nav.appendChild(el(`<a href="${esc(s.home)}" data-nav-sezione="${s.id}"><span class="ic">${s.emoji}</span><span class="txt">${esc(s.label)}</span></a>`));
    }
  }

  // Il pulsante del tutorial vive fuori da #app (in fondo a <body>, posizione
  // fissa) così resta identico e cliccabile a ogni cambio di pagina, invece di
  // essere ridisegnato da ogni singola vista. Ogni sezione ha il suo tour (o
  // nessuno): compare solo dove ce n'è uno, e racconta quella sezione lì.
  if (!document.querySelector('.tour-fab')) {
    const fab = el(`<button class="tour-fab" type="button" title="Tutorial guidato" aria-label="Avvia il tutorial guidato" hidden>🎓</button>`);
    fab.addEventListener('click', async () => {
      const sezione = getSezione(sezioneCorrente);
      if (!sezione?.tour) return;
      // Il tour cambia pagina da solo: partendo da un editor con modifiche
      // non salvate se le porterebbe via senza che nessuno lo chieda (la
      // sorveglianza intercetta i clic sui link, non le navigazioni fatte dal
      // codice).
      if (ciSonoModificheNonSalvate() && !await confirmDialog(
        'Il tutorial cambia pagina: le modifiche non salvate andranno perse. Vuoi avviarlo lo stesso?',
        { danger: true, okLabel: 'Avvia il tutorial' })) return;
      const { passi } = await sezione.tour();
      startTour(passi({ user: { ...currentUser, ruolo: ruoloIn(currentUser, sezione.id) } }));
    });
    document.body.appendChild(fab);
  }
}

// Disegna il menu della sezione corrente (sotto l'elenco delle sezioni) e le
// voci "Impostazioni". `sezioneId` è null in home e nelle pagine di portale.
function disegnaNav(sezioneId, sottoSezione, sub) {
  document.querySelectorAll('[data-nav-sezione]').forEach(a =>
    a.classList.toggle('active', a.dataset.navSezione === (sezioneId || 'home')));
  document.querySelector('.layout')?.classList.toggle('in-sezione', !!sezioneId);

  const subnav = document.getElementById('subnav');
  const navImp = document.getElementById('nav-imp');
  clear(subnav); clear(navImp);

  sezioneCorrente = sezioneId;
  const sezione = getSezione(sezioneId);
  const fab = document.querySelector('.tour-fab');
  if (fab) fab.hidden = !sezione?.tour;

  // Dentro una sezione l'elenco delle altre sezioni sparisce (lo nasconde il
  // CSS, vedi .layout.in-sezione): resta la sola voce Home. Al suo posto, in
  // cima al menu della sezione, si scrive dove si è — altrimenti la barra
  // laterale non lo direbbe più da nessuna parte.
  if (sezione) {
    subnav.appendChild(el(`<div class="sez-titolo"><span class="ic">${sezione.emoji}</span>${esc(sezione.label)}</div>`));
  }

  if (sezioneId === 'scadenziario') {
    const sw = el(`<div class="section-switch">
      <button data-sotto="passive">🧾 Fatture Passive</button>
      <button data-sotto="attive">💶 Fatture Attive</button>
    </div>`);
    sw.querySelectorAll('[data-sotto]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.sotto === sottoSezione);
      btn.addEventListener('click', () => { location.hash = `#/scadenziario/${btn.dataset.sotto}/fatture`; });
    });
    subnav.appendChild(sw);

    const nav = el('<nav class="nav"></nav>');
    // Su telefono la barra in basso mostra il menu della sezione al posto
    // dell'elenco delle sezioni: senza questa voce non ci sarebbe più modo
    // di tornare alla home.
    nav.appendChild(el('<a href="#/home" class="solo-mobile"><span class="ic">🏠</span><span class="txt">Home</span></a>'));
    for (const n of (sottoSezione === 'attive' ? navItemsAttive() : navItemsPassive())) {
      const a = el(`<a href="#/scadenziario/${sottoSezione}/${n.id}" data-nav="${n.id}"><span class="ic">${n.icon}</span><span class="txt">${n.label}</span></a>`);
      a.classList.toggle('active', n.id === sub);
      nav.appendChild(a);
    }
    subnav.appendChild(nav);

    if (ruoloIn(currentUser, 'scadenziario') === 'admin') {
      const a = el('<a href="#/scadenziario/impostazioni"><span class="ic">⚙️</span><span class="txt">Impostazioni scadenziario</span></a>');
      a.classList.toggle('active', sub === 'impostazioni');
      navImp.appendChild(a);
    }
  } else if (sezioneId) {
    const nav = el('<nav class="nav"></nav>');
    nav.appendChild(el('<a href="#/home" class="solo-mobile"><span class="ic">🏠</span><span class="txt">Home</span></a>'));
    // Sezioni con un menu interno semplice (una voce = una pagina): lo
    // dichiarano in js/sezioni.js. Quelle senza menu (per ora Formazione e
    // Assistenze, ancora vuote) restano con la sola voce Home.
    for (const n of (getSezione(sezioneId)?.menu || [])) {
      const a = el(`<a href="#/${sezioneId}/${n.id}" data-nav="${n.id}"><span class="ic">${n.icon}</span><span class="txt">${esc(n.label)}</span></a>`);
      // `attivoAnche` copre le pagine di dettaglio: aprendo un preventivo
      // (#/trasporti/preventivo/<id>) deve restare evidenziata la voce
      // "Preventivi", da cui ci si è arrivati.
      a.classList.toggle('active', n.id === sub || (n.attivoAnche || []).includes(sub));
      nav.appendChild(a);
    }
    subnav.appendChild(nav);
  }

  if (currentUser.ruoloPortale === 'super_admin') {
    const a = el('<a href="#/portale/utenti"><span class="ic">👥</span><span class="txt">Utenti e autorizzazioni</span></a>');
    a.classList.toggle('active', sezioneId === null && sub === 'utenti');
    navImp.appendChild(a);
  }
}

// Vecchi segnalibri e vecchie schede aperte: prima del portale lo scadenziario
// ERA l'applicazione, quindi le sue rotte non avevano il prefisso di sezione.
// Qui si traducono, così nessun link salvato smette di funzionare.
function normalizzaPercorso(parts) {
  if (!parts.length) return ['home'];
  if (parts[0] === 'passive' || parts[0] === 'attive') return ['scadenziario', ...parts];
  if (['fatture', 'proposte', 'report', 'impostazioni'].includes(parts[0])) return ['scadenziario', 'passive', ...parts];
  if (parts[0] === 'log') return ['scadenziario', 'impostazioni'];   // il registro è confluito nelle impostazioni
  return parts;
}

function nonAutorizzato(view, sezione) {
  view.appendChild(el(`<div class="empty-state"><div class="big">🔒</div>
    <p><b>Accesso non consentito</b></p>
    <p>Non sei autorizzato ad accedere a "${esc(sezione.label)}".<br>
    Chiedi l'abilitazione a un amministratore del portale.</p>
    <p style="margin-top:18px"><a class="btn" href="#/home">← Torna alla home</a></p></div>`));
}

let _routeSeq = 0;
async function route() {
  const view = document.getElementById('view');
  if (!view) return;
  const my = ++_routeSeq;

  const parts = normalizzaPercorso(location.hash.replace(/^#\/?/, '').split('/').filter(Boolean));
  const [primo, ...resto] = parts;

  // --- pagine di portale (fuori da ogni sezione) ---
  if (primo === 'home' || primo === 'portale') {
    const sub = primo === 'portale' ? (resto[0] || 'utenti') : 'home';
    disegnaNav(null, null, sub);
    clear(view);
    const ctx = { user: currentUser, go: (h) => { location.hash = h; } };
    try {
      if (primo === 'portale') await renderPortaleUtenti(view, ctx);
      else await renderHome(view, ctx);
    } catch (e) { mostraErrore(view, e); }
    return;
  }

  const sezione = getSezione(primo);
  if (!sezione) { location.hash = '#/home'; return; }

  const ruolo = ruoloIn(currentUser, sezione.id);
  // Chi non ha accesso non deve nemmeno vedersi comparire il menu interno
  // della sezione: resta con il menu del portale e un avviso in pagina.
  if (!ruolo) {
    disegnaNav(null, null, null);
    clear(view);
    return nonAutorizzato(view, sezione);
  }

  const sottoSezione = sezione.id === 'scadenziario' ? (['passive', 'attive'].includes(resto[0]) ? resto[0] : 'passive') : null;
  const sub = sezione.id === 'scadenziario'
    ? (resto[0] === 'impostazioni' ? 'impostazioni' : (resto[1] || 'fatture'))
    : (resto[0] || paginaIniziale(sezione) || sezione.menu?.[0]?.id || null);
  // Terzo pezzo del percorso, quando c'è: per ora è l'id del preventivo in
  // #/trasporti/preventivo/<id>.
  const param = sezione.id === 'scadenziario' ? null : (resto[1] || null);
  disegnaNav(sezione.id, sottoSezione, sub);
  svuotaConRitorno(view, sezione);

  // Le viste dello scadenziario (e quelle che verranno) leggono ctx.user.ruolo
  // aspettandosi 'admin' o 'operatore': qui `ruolo` è già quello DELLA
  // SEZIONE, non quello di portale, così non devono sapere nulla del resto.
  const ctx = { user: { ...currentUser, ruolo }, ruoloSezione: ruolo, go: (h) => { location.hash = h; } };

  view.appendChild(el('<div class="spinner" style="margin-top:60px"></div>'));
  try {
    if (my !== _routeSeq) return;
    svuotaConRitorno(view, sezione);
    if (sezione.tipo === 'esterna') { await renderSezioneEsterna(view, ctx, sezione); return; }
    // La sezione trasporti si carica solo quando la si apre: porta con sé il
    // calcolo dei preventivi, la tabella dei prezzi carburante europei e la
    // stampa, che non servono a chi entra solo nello scadenziario.
    if (sezione.id === 'trasporti') {
      const { renderTrasporti } = await import('./trasporti/sezione.js');
      await renderTrasporti(view, ctx, sub, param);
      return;
    }
    if (sezione.id === 'assistenze') {
      const { renderAssistenze } = await import('./assistenze/sezione.js');
      await renderAssistenze(view, ctx, sub, param);
      return;
    }
    if (sezione.id !== 'scadenziario') { await renderSezioneVuota(view, ctx, sezione); return; }

    if (sub === 'impostazioni') await renderImpostazioni(view, ctx);
    else if (sottoSezione === 'attive') {
      if (sub === 'report') await renderReportAttive(view, ctx);
      else await renderDashboardAttive(view, ctx);
    }
    else if (sub === 'report') await renderReport(view, ctx);
    else if (sub === 'proposte') await renderProposte(view, ctx);
    else await renderDashboard(view, ctx);
  } catch (e) {
    mostraErrore(view, e);
  }
}

// Svuota la pagina e vi rimette in cima la riga con il ritorno alla home:
// dentro una sezione, la voce "Home" nel menu laterale non basta a far
// capire che si può tornare alla scelta delle sezioni (e sul telefono quel
// menu è pure sostituito da quello della sezione), così il modo per uscire
// sta dove si sta guardando.
function svuotaConRitorno(view, sezione) {
  clear(view);
  view.appendChild(el(`<div class="sez-crumb">
    <a href="#/home">← Tutte le sezioni</a>
    <span class="sep">/</span>
    <b>${esc(sezione.label)}</b>
  </div>`));
}

function mostraErrore(view, e) {
  clear(view);
  view.appendChild(el(`<div class="empty-state"><div class="big">⚠️</div><p>Errore: ${esc(e.message)}</p></div>`));
  console.error(e);
}

boot();
