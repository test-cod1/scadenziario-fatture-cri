import { auth } from './data/store.js';
import { el, clear, esc, confirmDialog } from './lib/ui.js';
import { SEZIONI, getSezione, ruoloIn, paginaIniziale } from './sezioni.js';
import { renderLogin, renderResetPassword } from './views/auth.js';
import { renderHome } from './views/home.js';
import { renderSezioneVuota, renderSezioneEsterna } from './views/sezioneVuota.js';
import { ciSonoModificheNonSalvate } from './lib/uscita.js';

// Le viste dello scadenziario, la pagina utenti e il tour NON si importano
// qui in cima: si caricano con import() quando si apre la loro pagina, come
// già le altre sezioni. Importate staticamente si portavano dietro l'editor
// delle fatture, la lettura degli XML e l'export Excel (zip compreso): 20
// moduli e ~284 KB scaricati e valutati prima di poter disegnare perfino il
// login, mentre alla home ne servono 9. Misurato il 27/09/2026: l'ultimo
// modulo arrivava a 2,7 s e solo allora partiva il controllo della sessione.
const VISTE_SCADENZIARIO = {
  impostazioni: () => import('./views/impostazioni.js').then(m => m.renderImpostazioni),
  report: () => import('./views/report.js').then(m => m.renderReport),
  proposte: () => import('./views/proposte.js').then(m => m.renderProposte),
  fatture: () => import('./views/dashboard.js').then(m => m.renderDashboard),
  reportAttive: () => import('./views/reportAttive.js').then(m => m.renderReportAttive),
  clientiAttive: () => import('./views/clientiAttive.js').then(m => m.renderClientiAttive),
  fattureAttive: () => import('./views/dashboardAttive.js').then(m => m.renderDashboardAttive),
};

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(gestisciAggiornamenti).catch(() => {});
  });
}

// Aggiornamenti del sito pubblicato. Il service worker serve ogni versione
// dalla sua cache (vedi sw.js): dopo un deploy quella nuova si installa in
// background e resta in attesa finché la pagina non le dice di subentrare.
// - Se la novità arriva appena aperto il portale e non c'è niente in
//   sospeso, si passa subito: la pagina si ricarica da sola ed è come aver
//   aperto direttamente la versione nuova.
// - Altrimenti (si sta lavorando, magari con un editor aperto) compare un
//   avviso con il pulsante "Aggiorna": ricaricare da soli potrebbe portare
//   via una finestra aperta o un filtro appena impostato.
// Il browser ricontrolla sw.js a ogni apertura; per chi tiene il portale
// aperto tutto il giorno lo si chiede anche ogni ora.
const APERTO_ALLE = Date.now();
function gestisciAggiornamenti(reg) {
  // Alla prima installazione non c'è niente da aggiornare: il service worker
  // prende il controllo della pagina già aperta, e ricaricarla sarebbe
  // inutile.
  const eraControllata = !!navigator.serviceWorker.controller;
  let ricaricata = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!eraControllata || ricaricata) return;
    // Può essere stata un'altra scheda a dare il via all'aggiornamento: se
    // in questa c'è un lavoro in corso non la si ricarica di forza, si
    // chiede di farlo appena salvato.
    if (ciSonoModificheNonSalvate()) return avvisoAggiornamento(null);
    ricaricata = true;
    location.reload();
  });
  const proponi = (worker) => {
    if (!worker || !eraControllata) return;
    const appenaAperto = Date.now() - APERTO_ALLE < 15000;
    if (appenaAperto && !ciSonoModificheNonSalvate()) worker.postMessage('attiva');
    else avvisoAggiornamento(worker);
  };
  if (reg.waiting) proponi(reg.waiting);
  reg.addEventListener('updatefound', () => {
    const nuovo = reg.installing;
    nuovo?.addEventListener('statechange', () => { if (nuovo.state === 'installed') proponi(nuovo); });
  });
  setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
}

function avvisoAggiornamento(worker) {
  if (document.querySelector('.avviso-aggiornamento')) return;
  const avviso = el(`<div class="avviso-aggiornamento" role="status"
      style="position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:9999;display:flex;gap:12px;align-items:center;background:#1c2024;color:#fff;padding:10px 12px 10px 16px;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.25);font-size:14px;max-width:calc(100vw - 32px)">
    <span>È disponibile una versione nuova del portale.</span>
    <button class="btn primary" type="button">Aggiorna</button>
  </div>`);
  avviso.querySelector('button').addEventListener('click', async () => {
    if (ciSonoModificheNonSalvate() && !await confirmDialog(
      'Aggiornando, le modifiche non salvate andranno perse. Vuoi aggiornare lo stesso?',
      { danger: true, okLabel: 'Aggiorna' })) return;
    // Senza worker l'aggiornamento è già avvenuto (da un'altra scheda):
    // resta solo da ricaricare.
    if (worker) worker.postMessage('attiva'); else location.reload();
  });
  document.body.appendChild(avviso);
}

const app = document.getElementById('app');
let currentUser = null;
// Sezione in cui ci si trova adesso (null in home e nelle pagine di portale):
// la aggiorna disegnaNav e serve al pulsante del tour, che deve avviare il
// tour di QUESTA sezione.
let sezioneCorrente = null;

async function boot() {
  // Link dell'email (reset password, invito) scaduto o già usato: Supabase
  // rimanda qui con #error=…&error_code=otp_expired. Prima si vedeva il
  // login e basta, senza capire perché il link "non funzionasse".
  const erroreLink = new URLSearchParams(location.hash.replace(/^#\/?/, '')).get('error_code');
  const avvisoLink = erroreLink
    ? (erroreLink === 'otp_expired'
      ? "Il link dell'email è scaduto o è già stato usato: richiedine uno nuovo con «Password dimenticata?»."
      : "Il link dell'email non è valido: richiedine uno nuovo con «Password dimenticata?».")
    : '';
  if (erroreLink) history.replaceState(null, '', location.pathname);
  const match = location.hash.match(/type=(recovery|invite|signup)/);
  const isInvite = match && match[1] !== 'recovery';
  const isSetPassword = !!match;
  currentUser = await auth.current();
  if (isSetPassword) {
    renderResetPassword(app, async () => { currentUser = await auth.current(); await startApp(); }, { invite: isInvite });
    return;
  }
  if (!currentUser) {
    renderLogin(app, async () => { currentUser = await auth.current(); await startApp(); }, { avviso: avvisoLink });
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
    <div class="brand"><div class="logo">✚</div><div><b>Amministrazione</b><span>Croce Rossa Italiana — Comitato di Genova</span></div></div>
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
//  È l'unica sezione divisa in DUE PARTI (fatture passive e attive), ognuna
//  col suo menu: le altre hanno un elenco di pagine e se lo costruiscono da
//  sé, dalla propria voce in js/sezioni.js.
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
    // I clienti stanno solo sotto le attive: il nome del fornitore, sulle
    // passive, arriva dalla fattura ricevuta e non lo scriviamo noi.
    { id: 'clienti', icon: '🏛️', label: 'Clienti' },
  ];
}

function renderShell() {
  clear(app);
  const layout = el(`<div class="layout">
    <aside class="sidebar">
      <a class="brand brand-link" href="#/home" title="Torna alla scelta delle sezioni"><div class="logo">✚</div><div><b>Amministrazione</b><span>Croce Rossa Italiana — Comitato di Genova</span></div></a>
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
      const [{ passi }, { startTour }] = await Promise.all([sezione.tour(), import('./lib/tour.js')]);
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
    // dichiarano in js/sezioni.js. Una sezione che non dichiara un menu
    // resta con la sola voce Home — è il caso di quelle ancora da fare.
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
    const r = el('<a href="#/portale/registro"><span class="ic">📜</span><span class="txt">Registro modifiche</span></a>');
    r.classList.toggle('active', sezioneId === null && sub === 'registro');
    navImp.appendChild(r);
  }

  // Promemoria email: solo per chi vede almeno una delle sezioni che ne
  // mandano (scadenziario, impegni del Direttore, Scadenze).
  if (ruoloIn(currentUser, 'scadenziario') || ruoloIn(currentUser, 'direttore') || ruoloIn(currentUser, 'scadenze')) {
    const p = el('<a href="#/portale/promemoria"><span class="ic">🔔</span><span class="txt">Promemoria email</span></a>');
    p.classList.toggle('active', sezioneId === null && sub === 'promemoria');
    navImp.appendChild(p);
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
    // Stesso motivo delle sezioni (vedi più sotto): la vista disegna in un
    // contenitore suo, così se nel frattempo si passa altrove il suo lavoro
    // finisce in un nodo ormai staccato invece che sopra la pagina nuova.
    clear(view);
    const zona = el('<div class="vista"></div>');
    view.appendChild(zona);
    const ctx = { user: currentUser, go: (h) => { location.hash = h; } };
    try {
      if (primo === 'portale' && sub === 'promemoria') {
        const { renderPromemoria } = await import('./views/promemoria.js');
        if (my !== _routeSeq) return;
        await renderPromemoria(zona, { ...ctx, puoScadenziario: !!ruoloIn(currentUser, 'scadenziario'), puoDirettore: !!ruoloIn(currentUser, 'direttore'), puoScadenze: !!ruoloIn(currentUser, 'scadenze') });
      } else if (primo === 'portale' && sub === 'registro') {
        const { renderRegistroPortale } = await import('./views/registroPortale.js');
        if (my !== _routeSeq) return;
        await renderRegistroPortale(zona, ctx);
      } else if (primo === 'portale') {
        const { renderPortaleUtenti } = await import('./views/portaleUtenti.js');
        if (my !== _routeSeq) return;
        await renderPortaleUtenti(zona, ctx);
      }
      else await renderHome(zona, ctx);
    } catch (e) { if (my === _routeSeq) mostraErrore(zona, e); }
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

  // Le viste dello scadenziario (e quelle che verranno) leggono ctx.user.ruolo
  // aspettandosi 'admin' o 'operatore': qui `ruolo` è già quello DELLA
  // SEZIONE, non quello di portale, così non devono sapere nulla del resto.
  const ctx = { user: { ...currentUser, ruolo }, ruoloSezione: ruolo, go: (h) => { location.hash = h; } };

  // Ogni rotta disegna dentro un contenitore TUTTO SUO, creato adesso da
  // svuotaConRitorno. Prima le viste scrivevano direttamente in #view, che il
  // router riempie e svuota ma non sostituisce mai: cambiando sezione mentre
  // una vista lenta stava ancora caricando i suoi dati, quella finiva per
  // attaccare il proprio contenuto sotto la pagina già disegnata da quella
  // nuova, e in pagina si vedevano due sezioni mescolate. Adesso la rotta
  // successiva svuota #view, e con esso stacca il contenitore della
  // precedente: quello che la vista superata disegna finisce in un nodo che
  // non è più nel documento, e non si vede.
  let zona = svuotaConRitorno(view, sezione);
  zona.appendChild(el('<div class="spinner" style="margin-top:60px"></div>'));
  const sorpassata = () => my !== _routeSeq;
  const disegna = async (fn) => {
    if (sorpassata()) return;
    zona = svuotaConRitorno(view, sezione);
    await fn(zona);
  };
  try {
    if (sezione.tipo === 'esterna') return await disegna(z => renderSezioneEsterna(z, ctx, sezione));
    // La sezione trasporti si carica solo quando la si apre: porta con sé il
    // calcolo dei preventivi, la tabella dei prezzi carburante europei e la
    // stampa, che non servono a chi entra solo nello scadenziario.
    if (sezione.id === 'trasporti') {
      const { renderTrasporti } = await import('./trasporti/sezione.js');
      return await disegna(z => renderTrasporti(z, ctx, sub, param));
    }
    if (sezione.id === 'formazione') {
      const { renderFormazione } = await import('./formazione/sezione.js');
      return await disegna(z => renderFormazione(z, ctx, sub, param));
    }
    if (sezione.id === 'assistenze') {
      const { renderAssistenze } = await import('./assistenze/sezione.js');
      return await disegna(z => renderAssistenze(z, ctx, sub, param));
    }
    if (sezione.id === 'straordinari') {
      const { renderStraordinari } = await import('./straordinari/sezione.js');
      return await disegna(z => renderStraordinari(z, ctx, sub, param));
    }
    if (sezione.id === 'direttore') {
      const { renderDirettore } = await import('./direttore/sezione.js');
      return await disegna(z => renderDirettore(z, ctx, sub, param));
    }
    if (sezione.id === 'scadenze') {
      const { renderScadenze } = await import('./scadenze/sezione.js');
      return await disegna(z => renderScadenze(z, ctx, sub, param));
    }
    if (sezione.id === 'analisi') {
      const { renderAnalisi } = await import('./analisi/sezione.js');
      return await disegna(z => renderAnalisi(z, ctx, sub, param));
    }
    if (sezione.id !== 'scadenziario') return await disegna(z => renderSezioneVuota(z, ctx, sezione));

    const vista = sub === 'impostazioni' ? 'impostazioni'
      : sottoSezione === 'attive'
        ? (sub === 'report' ? 'reportAttive' : sub === 'clienti' ? 'clientiAttive' : 'fattureAttive')
        : (sub === 'report' || sub === 'proposte' ? sub : 'fatture');
    const render = await VISTE_SCADENZIARIO[vista]();
    await disegna(z => render(z, ctx));
  } catch (e) {
    // L'errore di una rotta ormai superata non deve cancellare la pagina che
    // l'utente sta già guardando.
    if (!sorpassata()) mostraErrore(zona, e);
  }
}

// Svuota la pagina, vi rimette in cima la riga con il ritorno alla home e
// restituisce il contenitore in cui la vista deve disegnare. Dentro una
// sezione, la voce "Home" nel menu laterale non basta a far capire che si può
// tornare alla scelta delle sezioni (e sul telefono quel menu è pure
// sostituito da quello della sezione), così il modo per uscire sta dove si sta
// guardando — e va tenuto fuori dal contenitore della vista, altrimenti una
// vista che si ridisegna svuotandosi se lo porterebbe via.
function svuotaConRitorno(view, sezione) {
  clear(view);
  view.appendChild(el(`<div class="sez-crumb">
    <a href="#/home">← Tutte le sezioni</a>
    <span class="sep">/</span>
    <b>${esc(sezione.label)}</b>
  </div>`));
  const zona = el('<div class="vista"></div>');
  view.appendChild(zona);
  return zona;
}

function mostraErrore(view, e) {
  clear(view);
  view.appendChild(el(`<div class="empty-state"><div class="big">⚠️</div><p>Errore: ${esc(e.message)}</p></div>`));
  console.error(e);
}

boot();
