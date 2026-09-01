import { SEZIONI, ruoloIn } from '../sezioni.js';
import { el, esc, toast } from '../lib/ui.js';

// ============================================================
//  HOME DEL PORTALE — la griglia da cui si sceglie la sezione.
//  Le card ci sono tutte, anche quelle a cui l'utente non ha accesso: così
//  sa che la sezione esiste e a chi chiederne l'abilitazione, invece di
//  trovarsi una home diversa da quella del collega senza capire perché.
// ============================================================

export async function renderHome(view, ctx) {
  const wrap = el(`<div class="home">
    <div class="home-head">
      <h1>Seleziona una sezione</h1>
      <p>Portale gestionale CRI Genova</p>
    </div>
    <div class="home-grid"></div>
  </div>`);
  const grid = wrap.querySelector('.home-grid');

  for (const s of SEZIONI) {
    const ruolo = ruoloIn(ctx.user, s.id);
    const card = ruolo ? cardAperta(s, ruolo) : cardBloccata(s);
    grid.appendChild(card);
  }

  const nessuna = SEZIONI.every(s => !ruoloIn(ctx.user, s.id));
  if (nessuna) {
    wrap.insertBefore(el(`<div class="banner warn"><div class="bi">⏳</div><div>
      <b>Nessuna sezione abilitata</b>
      <div class="small">Il tuo account (${esc(ctx.user.email)}) è attivo ma non è ancora stato
      autorizzato ad accedere a nessuna sezione: chiedi a un amministratore del portale di abilitarti.</div>
    </div></div>`), wrap.querySelector('.home-grid'));
  }

  view.appendChild(wrap);
}

function cardAperta(s, ruolo) {
  // Le sezioni "esterne" sono gestionali che vivono su un altro indirizzo:
  // si aprono in una scheda nuova, così il portale resta dov'era.
  const esterna = s.tipo === 'esterna';
  const href = esterna ? s.url : s.home;
  const card = el(`<a class="home-card" href="${esc(href)}"
      ${esterna ? 'target="_blank" rel="noopener noreferrer"' : ''}
      style="--c:${s.colore};--o:${s.ombra}" title="${esc(s.descrizione)}">
    <div class="hc-top">
      <span class="hc-ico">${s.icona}</span>
      ${ruolo === 'admin' ? '<span class="hc-badge">admin</span>' : ''}
    </div>
    <div class="hc-bot">
      <div class="hc-line"></div>
      <div class="hc-title">${esc(s.label)}${esterna ? ' <span class="hc-ext" aria-label="si apre in una nuova scheda">↗</span>' : ''}</div>
    </div>
  </a>`);
  return card;
}

function cardBloccata(s) {
  const card = el(`<div class="home-card locked" style="--c:${s.colore};--o:${s.ombra}"
      role="button" tabindex="0" aria-disabled="true" title="Non sei autorizzato ad accedere a ${esc(s.label)}">
    <div class="hc-top">
      <span class="hc-ico">${s.icona}</span>
      <span class="hc-badge lock">🔒</span>
    </div>
    <div class="hc-bot">
      <div class="hc-line"></div>
      <div class="hc-title">${esc(s.label)}</div>
    </div>
  </div>`);
  const avvisa = () => toast(`Non sei autorizzato ad accedere a "${s.label}". Chiedi l'abilitazione a un amministratore del portale.`, 'warn');
  card.addEventListener('click', avvisa);
  card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); avvisa(); } });
  return card;
}
