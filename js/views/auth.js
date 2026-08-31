import { auth } from '../data/store.js';
import { el, clear, esc, toast } from '../lib/ui.js';

const BRAND = `<div class="brand"><div class="logo">✚</div><div><b>Scadenziario Fatture</b><span>CRI Genova</span></div></div>`;

export function renderLogin(app, onDone) {
  clear(app);
  const wrap = el(`<div class="login-wrap"><div class="login">
    ${BRAND}
    <div class="field"><label>Email</label><input type="text" id="email" placeholder="nome@cri.it" autocomplete="username"></div>
    ${campoPassword('pw', 'Password', '••••••••', 'current-password')}
    <button class="btn primary" id="go" style="width:100%;justify-content:center;margin-top:6px">Accedi</button>
    <div style="text-align:center;margin-top:14px"><a href="#" id="forgot" style="font-size:13px">Password dimenticata?</a></div>
    <div id="err" style="color:var(--danger);font-size:13px;margin-top:12px;text-align:center"></div>
  </div></div>`);
  app.appendChild(wrap);
  collegaTogglePassword(wrap);

  const err = wrap.querySelector('#err');
  async function doLogin(email, pw) {
    err.textContent = '';
    try { await auth.signIn(email, pw); onDone(); }
    catch (e) { err.textContent = traduci(e.message) || 'Accesso non riuscito'; }
  }
  wrap.querySelector('#go').addEventListener('click', () =>
    doLogin(wrap.querySelector('#email').value.trim(), wrap.querySelector('#pw').value));
  wrap.querySelector('#pw').addEventListener('keydown', e => { if (e.key === 'Enter') wrap.querySelector('#go').click(); });
  wrap.querySelector('#forgot').addEventListener('click', (e) => {
    e.preventDefault();
    renderRichiestaReset(app, onDone, wrap.querySelector('#email').value.trim());
  });
}

function renderRichiestaReset(app, onDone, emailPrecompilata = '') {
  clear(app);
  const wrap = el(`<div class="login-wrap"><div class="login">
    ${BRAND}
    <div class="banner info" style="margin-bottom:18px"><div class="bi">🔑</div><div><b>Recupero password</b><div class="small">Inserisci la tua email: ti invieremo un link per impostare una nuova password.</div></div></div>
    <div class="field"><label>Email</label><input type="text" id="email" placeholder="nome@cri.it" autocomplete="username" value="${esc(emailPrecompilata)}"></div>
    <button class="btn primary" id="send" style="width:100%;justify-content:center;margin-top:6px">Invia link di recupero</button>
    <button class="btn" id="back" style="width:100%;justify-content:center;margin-top:10px">← Torna al login</button>
    <div id="msg" style="font-size:13px;margin-top:12px;text-align:center"></div>
  </div></div>`);
  app.appendChild(wrap);

  const msg = wrap.querySelector('#msg');
  wrap.querySelector('#back').addEventListener('click', () => renderLogin(app, onDone));
  wrap.querySelector('#send').addEventListener('click', async () => {
    const email = wrap.querySelector('#email').value.trim();
    msg.style.color = 'var(--danger)';
    if (!email) { msg.textContent = 'Inserisci la tua email.'; return; }
    const btn = wrap.querySelector('#send'); const old = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<span class="spinner sm"></span> Invio…';
    try {
      await auth.resetPassword(email);
      msg.style.color = 'var(--ok)';
      msg.innerHTML = '✅ Se l\'email è registrata, riceverai a breve un link per reimpostare la password. Controlla anche lo spam.';
    } catch (e) {
      msg.textContent = traduci(e.message) || 'Invio non riuscito.';
    } finally { btn.disabled = false; btn.innerHTML = old; }
  });
  wrap.querySelector('#email').addEventListener('keydown', e => { if (e.key === 'Enter') wrap.querySelector('#send').click(); });
}

export function renderResetPassword(app, onDone, { invite = false, obbligatorio = false } = {}) {
  clear(app);
  const title = invite ? 'Benvenuto! Imposta la tua password'
    : obbligatorio ? 'Imposta la tua password personale'
    : 'Imposta una nuova password';
  const sub = invite ? 'Il tuo account è stato creato: scegli una password per accedere da qui in avanti.'
    : obbligatorio ? 'Un amministratore ha creato il tuo account con una password provvisoria: scegline una tua per continuare.'
    : 'Scegli la nuova password per il tuo account.';
  const wrap = el(`<div class="login-wrap"><div class="login">
    ${BRAND}
    <div class="banner ok" style="margin-bottom:18px"><div class="bi">🔒</div><div><b>${esc(title)}</b><div class="small">${esc(sub)}</div></div></div>
    ${campoPassword('pw1', 'Nuova password', 'almeno 6 caratteri', 'new-password')}
    ${campoPassword('pw2', 'Conferma password', 'ripeti la password', 'new-password')}
    <button class="btn primary" id="save" style="width:100%;justify-content:center;margin-top:6px">${invite || obbligatorio ? 'Crea password e accedi' : 'Salva nuova password'}</button>
    <div id="err" style="color:var(--danger);font-size:13px;margin-top:12px;text-align:center"></div>
  </div></div>`);
  app.appendChild(wrap);
  collegaTogglePassword(wrap);

  const err = wrap.querySelector('#err');
  wrap.querySelector('#save').addEventListener('click', async () => {
    err.textContent = '';
    const pw1 = wrap.querySelector('#pw1').value;
    const pw2 = wrap.querySelector('#pw2').value;
    if (pw1.length < 6) { err.textContent = 'La password deve avere almeno 6 caratteri.'; return; }
    if (pw1 !== pw2) { err.textContent = 'Le due password non coincidono.'; return; }
    const btn = wrap.querySelector('#save'); const old = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<span class="spinner sm"></span> Salvataggio…';
    try {
      await auth.updatePassword(pw1);
      if (obbligatorio) await auth.confermaPasswordImpostata();
      history.replaceState(null, '', location.pathname + '#/passive/fatture');
      toast(invite || obbligatorio ? 'Password creata' : 'Password aggiornata', 'ok');
      onDone();
    } catch (e) {
      err.textContent = traduci(e.message) || 'Aggiornamento non riuscito. Il link potrebbe essere scaduto: richiedine uno nuovo.';
      btn.disabled = false; btn.innerHTML = old;
    }
  });
  wrap.querySelector('#pw2').addEventListener('keydown', e => { if (e.key === 'Enter') wrap.querySelector('#save').click(); });
}

function traduci(m) {
  if (!m) return '';
  const s = String(m).toLowerCase();
  if (s.includes('invalid login credentials')) return 'Email o password non corretti.';
  if (s.includes('email not confirmed')) return 'Email non confermata.';
  if (s.includes('rate limit') || s.includes('too many') || s.includes('for security purposes')) return 'Troppi tentativi, riprova tra qualche minuto.';
  if (s.includes('different from the old') || s.includes('should be different')) return 'La nuova password deve essere diversa da quella attuale.';
  if (s.includes('at least') && (s.includes('character') || s.includes('caratter'))) return 'La password è troppo corta: usa più caratteri.';
  if (s.includes('weak') || s.includes('pwned') || s.includes('compromis') || s.includes('leaked')) return 'Password troppo debole o già compromessa in passato: scegline una più robusta.';
  if (s.includes('auth session missing') || s.includes('session')) return 'Sessione di recupero scaduta: richiedi un nuovo link dal login.';
  if (s.includes('expired') || s.includes('invalid')) return 'Link scaduto o non valido: richiedine uno nuovo.';
  return m;
}

// Campo password con un pulsante per mostrarla in chiaro: utile su una
// password lunga digitata due volte (creazione/conferma), dove finora
// l'unico riscontro era l'errore "le due password non coincidono" dopo
// l'invio.
function campoPassword(id, label, placeholder, autocomplete) {
  return `<div class="field"><label>${esc(label)}</label><div class="pw-wrap">
    <input type="password" id="${id}" placeholder="${esc(placeholder)}" autocomplete="${autocomplete}">
    <button type="button" class="pw-toggle" data-toggle="${id}" aria-label="Mostra password">👁️</button>
  </div></div>`;
}
function collegaTogglePassword(wrap) {
  wrap.querySelectorAll('[data-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = wrap.querySelector('#' + btn.dataset.toggle);
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      btn.textContent = showing ? '👁️' : '🙈';
      btn.setAttribute('aria-label', showing ? 'Mostra password' : 'Nascondi password');
    });
  });
}
