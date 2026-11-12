import { SEZIONI, ruoloIn } from '../sezioni.js';
import { el, esc, toast } from '../lib/ui.js';
import { amministrazione } from '../data/store.js';

// ============================================================
//  HOME DEL PORTALE — la griglia da cui si sceglie la sezione.
//  Di regola le card ci sono tutte, anche quelle a cui l'utente non ha
//  accesso: così sa che la sezione esiste e a chi chiederne l'abilitazione.
//  Il super admin può però nascondere la card di una sezione a chi non vi è
//  abilitato (l'occhio sotto ogni card, che vede solo lui): chi è abilitato
//  la vede sempre.
// ============================================================

export async function renderHome(view, ctx) {
  const superAdmin = ctx.user?.ruoloPortale === 'super_admin';
  const nascoste = await amministrazione.sezioniNascoste();
  const wrap = el(`<div class="home">
    <div class="home-head">
      <h1>Seleziona una sezione</h1>
      <p>Croce Rossa Italiana — Comitato di Genova</p>
    </div>
    <div class="home-grid"></div>
  </div>`);
  const grid = wrap.querySelector('.home-grid');

  for (const s of SEZIONI) {
    const ruolo = ruoloIn(ctx.user, s.id);
    if (!ruolo && nascoste.has(s.id)) continue;
    const card = ruolo ? cardAperta(s, ruolo) : cardBloccata(s);
    grid.appendChild(superAdmin ? cellaConOcchio(card, s, nascoste.has(s.id)) : card);
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

  // Richieste di patente che chiedono supporto e che nessuno ha ancora
  // preso in mano: un pallino rosso con il numero sulla card Patenti, come
  // le notifiche delle app. La card porta allora dritta a quelle richieste.
  // Si disegna dopo la griglia per non far aspettare la home.
  if (ruoloIn(ctx.user, 'patenti')) {
    import('../patenti/avviso.js').then(m => m.contaSupportoDaGestire()).then(n => {
      const card = grid.querySelector('[data-sezione="patenti"]');
      if (!n || !card || !wrap.isConnected) return;
      const testo = `${n} ${n === 1 ? 'richiesta chiede' : 'richieste chiedono'} supporto`;
      card.appendChild(el(`<span class="hc-notifica" title="${testo}" aria-label="${testo}">${n > 99 ? '99+' : n}</span>`));
      card.href = '#/patenti/richieste/supporto';
      card.title = `${testo}: apri le richieste`;
    }).catch(() => {});
  }
}

// La card del super admin con, sotto, l'interruttore della visibilità per
// gli altri. Sta fuori dalla card perché la card è un link: un pulsante
// dentro un link non è un controllo valido, e il clic aprirebbe la sezione.
function cellaConOcchio(card, s, nascosta) {
  const cella = el('<div class="home-cella"></div>');
  const btn = el('<button type="button" class="hc-occhio"></button>');
  const disegna = (n) => {
    card.classList.toggle('nascosta-altri', n);
    btn.classList.toggle('spento', n);
    btn.innerHTML = n ? '🙈 Nascosta agli altri' : '👁 Visibile a tutti';
    btn.setAttribute('aria-pressed', String(n));
    btn.title = n
      ? `Chi non è abilitato a ${s.label} non vede questa card. Clic per mostrarla di nuovo.`
      : `Tutti vedono questa card (chi non è abilitato col lucchetto). Clic per nasconderla a chi non è abilitato.`;
  };
  disegna(nascosta);
  btn.addEventListener('click', async () => {
    const nuova = btn.getAttribute('aria-pressed') !== 'true';
    btn.disabled = true;
    try {
      await amministrazione.impostaSezioneNascosta(s.id, nuova);
      disegna(nuova);
      toast(nuova ? `«${s.label}» nascosta a chi non è abilitato` : `«${s.label}» di nuovo visibile a tutti`, 'ok');
    } catch (e) {
      toast(e.message || 'Modifica non riuscita', 'err');
    } finally { btn.disabled = false; }
  });
  cella.append(card, btn);
  return cella;
}

function cardAperta(s, ruolo) {
  // Le sezioni "esterne" sono gestionali che vivono su un altro indirizzo:
  // si aprono in una scheda nuova, così il portale resta dov'era.
  const esterna = s.tipo === 'esterna';
  const href = esterna ? s.url : s.home;
  const card = el(`<a class="home-card" data-sezione="${esc(s.id)}" href="${esc(href)}"
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
