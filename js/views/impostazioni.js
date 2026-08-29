import { impostazioni, amministrazione } from '../data/store.js';
import { el, esc, toast, openModal } from '../lib/ui.js';

export async function renderImpostazioni(view, ctx) {
  if (ctx.user.ruolo !== 'admin') {
    view.appendChild(el(`<div class="empty-state"><div class="big">🔒</div><p>Solo gli amministratori possono modificare le impostazioni.</p></div>`));
    return;
  }
  let rec;
  try { rec = await impostazioni.get(); }
  catch (e) { view.appendChild(el(`<div class="empty-state"><div class="big">⚠️</div><p>Errore: ${esc(e.message)}</p></div>`)); return; }

  const wrap = el(`<div>
    <div class="page-head"><div><h1>Impostazioni</h1><p>Configurazione generale dello scadenziario.</p></div></div>
    <div class="card"><div class="card-b">
      <div class="field" style="max-width:260px">
        <label>Scadenza di default (giorni)</label>
        <input type="number" min="0" step="1" id="giorni">
        <div class="hint">Se una fattura non riporta una data di scadenza (lettura AI, XML o inserimento manuale), viene calcolata automaticamente come data fattura + questo numero di giorni.</div>
      </div>
      <button class="btn primary" id="save" style="margin-top:14px">Salva</button>
    </div></div>

    <div class="card" style="margin-top:22px"><div class="card-b">
      <h3 style="margin:0 0 4px">Aggiungi un utente</h3>
      <p class="hint" style="margin:0 0 14px">Crea l'account con una password provvisoria generata automaticamente: comunicala tu stesso all'utente (telefono, di persona, ecc. — non viene inviata via email). Al primo accesso dovrà impostarne una propria prima di poter usare il gestionale.</p>
      <div class="form-row">
        <div class="field"><label>Email</label><input type="text" id="nu-email" placeholder="nome@cri.it" autocomplete="off"></div>
        <div class="field"><label>Nome (opzionale)</label><input type="text" id="nu-nome" autocomplete="off"></div>
      </div>
      <div class="field" style="max-width:220px">
        <label>Ruolo</label>
        <select id="nu-ruolo">
          <option value="operatore">Operatore</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <button class="btn primary" id="nu-crea" style="margin-top:6px">Crea utente</button>
      <div id="nu-err" style="color:var(--danger);font-size:13px;margin-top:10px"></div>
    </div></div>
  </div>`);
  view.appendChild(wrap);
  wrap.querySelector('#giorni').value = rec.giorni_scadenza_default;

  wrap.querySelector('#save').addEventListener('click', async () => {
    const input = wrap.querySelector('#giorni');
    const giorni = parseInt(input.value, 10);
    if (!Number.isFinite(giorni) || giorni < 0) { toast('Inserisci un numero di giorni valido (0 o superiore)', 'err'); return; }
    const btn = wrap.querySelector('#save'); const old = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<span class="spinner sm"></span> Salvataggio…';
    try {
      await impostazioni.save({ giorni_scadenza_default: giorni });
      toast('Impostazioni salvate', 'ok');
    } catch (e) {
      toast('Errore: ' + e.message, 'err');
    } finally {
      btn.disabled = false; btn.innerHTML = old;
    }
  });

  wrap.querySelector('#nu-crea').addEventListener('click', async () => {
    const err = wrap.querySelector('#nu-err'); err.textContent = '';
    const email = wrap.querySelector('#nu-email').value.trim();
    const nome = wrap.querySelector('#nu-nome').value.trim();
    const ruolo = wrap.querySelector('#nu-ruolo').value;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = 'Inserisci un\'email valida.'; return; }
    const btn = wrap.querySelector('#nu-crea'); const old = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<span class="spinner sm"></span> Creazione…';
    try {
      const risultato = await amministrazione.creaUtente({ email, nome, ruolo });
      if (risultato.error) toast(risultato.error, 'err'); // utente creato ma profilo da controllare a mano
      mostraPasswordGenerata(risultato.email, risultato.passwordProvvisoria);
      wrap.querySelector('#nu-email').value = '';
      wrap.querySelector('#nu-nome').value = '';
      wrap.querySelector('#nu-ruolo').value = 'operatore';
    } catch (e) {
      err.textContent = 'Errore: ' + e.message;
    } finally {
      btn.disabled = false; btn.innerHTML = old;
    }
  });
}

// La password provvisoria viene mostrata una sola volta: non viene salvata
// da nessuna parte oltre alla risposta di questa chiamata, quindi va copiata
// o annotata subito, prima di chiudere il riquadro.
function mostraPasswordGenerata(email, password) {
  const body = el(`<div>
    <p>Account creato per <b>${esc(email)}</b>. Comunica questa password provvisoria all'utente: gliela chiederà l'app al primo accesso, sostituendola con una propria.</p>
    <div style="display:flex;gap:8px;align-items:center;margin-top:10px">
      <code id="pw-box" style="flex:1;padding:10px 12px;background:var(--bg);border:1px solid var(--line);border-radius:10px;font-size:16px;font-weight:600;letter-spacing:.5px">${esc(password)}</code>
      <button class="btn sm" id="pw-copia">📋 Copia</button>
    </div>
    <p class="hint" style="margin-top:10px">Non verrà mostrata di nuovo: se la perdi, dovrai reimpostarla da Supabase o ricreare l'utente.</p>
  </div>`);
  const footer = el(`<div style="display:flex;justify-content:flex-end;width:100%"><button class="btn primary" id="pw-chiudi">Ho annotato la password</button></div>`);
  const { close } = openModal({ title: 'Utente creato', body, footer });
  footer.querySelector('#pw-chiudi').addEventListener('click', close);
  body.querySelector('#pw-copia').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(password); toast('Password copiata', 'ok'); }
    catch { toast('Copia non riuscita: selezionala e copiala a mano.', 'err'); }
  });
}
