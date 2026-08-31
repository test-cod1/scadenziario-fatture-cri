import { impostazioni, amministrazione } from '../data/store.js';
import { el, esc, toast, openModal, confirmDialog } from '../lib/ui.js';
import { renderRegistroModifiche } from './registroModifiche.js';

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

    <div class="card" style="margin-top:22px"><div class="card-b">
      <h3 style="margin:0 0 4px">Utenti</h3>
      <p class="hint" style="margin:0 0 14px">Chi si registra da solo nasce <b>In attesa</b> e non vede alcun dato finché non lo abiliti qui.
      Gli <b>operatori</b> inseriscono e modificano fatture e propongono pagamenti; gli <b>admin</b> vedono anche Impostazioni e registro modifiche, e registrano i pagamenti effettivi.</p>
      <div class="tbl-wrap" id="utenti-zone"><div class="spinner" style="margin:20px auto"></div></div>
    </div></div>

    <details class="card" id="log-panel" style="margin-top:22px">
      <summary class="card-h">
        <span>📋 Registro modifiche</span>
        <span class="archivio-freccia">▸</span>
      </summary>
      <div class="card-b">
        <div style="display:flex;justify-content:flex-end;margin-bottom:14px">
          <select id="log-tipo">
            <option value="">Tutte le fatture</option>
            <option value="passiva">Solo fatture passive (fornitori)</option>
            <option value="attiva">Solo fatture attive (clienti)</option>
          </select>
        </div>
        <div id="log-zone"><div class="muted" style="padding:6px 0">Si carica aprendo questo pannello.</div></div>
      </div>
    </details>
  </div>`);
  view.appendChild(wrap);
  // Non appesantisce il caricamento della pagina Impostazioni: il registro
  // (due tabelle, fino a 300 righe ciascuna) si scarica dal server solo alla
  // prima apertura del pannello, non ad ogni volta che si apre questa pagina.
  let logCaricato = false;
  wrap.querySelector('#log-panel').addEventListener('toggle', (e) => {
    if (!e.target.open || logCaricato) return;
    logCaricato = true;
    const zona = wrap.querySelector('#log-zone');
    zona.innerHTML = '<div class="spinner" style="margin:20px auto"></div>';
    renderRegistroModifiche(zona, wrap.querySelector('#log-tipo'), ctx);
  });
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
      disegnaUtenti();   // il nuovo utente deve comparire subito nell'elenco qui sotto
    } catch (e) {
      err.textContent = 'Errore: ' + e.message;
    } finally {
      btn.disabled = false; btn.innerHTML = old;
    }
  });

  async function disegnaUtenti() {
    const zona = wrap.querySelector('#utenti-zone');
    zona.replaceChildren(el('<div class="spinner" style="margin:20px auto"></div>'));
    try {
      renderUtenti(zona, await amministrazione.listaUtenti(), ctx, disegnaUtenti);
    } catch (e) {
      zona.replaceChildren(el(`<div class="empty-state"><div class="big">⚠️</div><p>Errore: ${esc(e.message)}</p></div>`));
    }
  }
  disegnaUtenti();
}

const RUOLO_LABEL = { admin: 'Admin', operatore: 'Operatore', in_attesa: 'In attesa' };
const RUOLO_CHIP = { admin: 'ok', operatore: '', in_attesa: 'warn' };

// Elenco utenti con il ruolo modificabile da una tendina. Il proprio account
// è mostrato ma non modificabile: la policy prof_admin_update rifiuterebbe
// comunque un auto-declassamento, e vale la pena dirlo prima invece di far
// scoprire il divieto da un errore del database.
function renderUtenti(zona, utenti, ctx, ricarica) {
  if (!utenti.length) { zona.replaceChildren(el('<div class="empty-state"><div class="big">👤</div><p>Nessun utente.</p></div>')); return; }
  const table = el(`<table class="tbl"><thead><tr>
    <th>Nome</th><th>Email</th><th>Ruolo</th><th>Stato</th><th></th>
  </tr></thead><tbody></tbody></table>`);
  const tbody = table.querySelector('tbody');
  for (const u of utenti) {
    const sonoIo = u.id === ctx.user.id;
    const tr = el(`<tr>
      <td>${esc(u.nome || '—')}</td>
      <td>${esc(u.email || '—')}${sonoIo ? ' <span class="chip">tu</span>' : ''}</td>
      <td>${sonoIo
        ? `<span class="chip ${RUOLO_CHIP[u.ruolo] || ''}">${esc(RUOLO_LABEL[u.ruolo] || u.ruolo)}</span>`
        : `<select data-ruolo style="min-width:130px">${Object.entries(RUOLO_LABEL).map(([v, t]) =>
            `<option value="${v}" ${u.ruolo === v ? 'selected' : ''}>${t}</option>`).join('')}</select>`}</td>
      <td>${u.deve_cambiare_password ? '<span class="chip warn">password provvisoria</span>' : '<span class="muted">attivo</span>'}</td>
      <td style="text-align:right"><span class="muted" data-esito style="font-size:12.5px"></span></td>
    </tr>`);
    const select = tr.querySelector('[data-ruolo]');
    if (select) {
      const esito = tr.querySelector('[data-esito]');
      let precedente = u.ruolo;
      select.addEventListener('change', async () => {
        const nuovo = select.value;
        if (!await confirmDialog(
          `Cambiare il ruolo di ${u.email} da "${RUOLO_LABEL[precedente]}" a "${RUOLO_LABEL[nuovo]}"?` +
          (nuovo === 'in_attesa' ? ' Non vedrà più alcun dato finché non lo riabiliti.' : ''),
          { okLabel: 'Cambia ruolo' })) {
          select.value = precedente;   // annullato: la tendina torna com'era
          return;
        }
        select.disabled = true; esito.textContent = 'salvataggio…';
        try {
          await amministrazione.aggiornaUtente(u.id, { ruolo: nuovo });
          precedente = nuovo;
          esito.textContent = '✅ salvato';
          toast('Ruolo aggiornato', 'ok');
          ricarica();
        } catch (e) {
          select.value = precedente;
          esito.textContent = '';
          toast('Errore: ' + e.message, 'err');
        } finally { select.disabled = false; }
      });
    }
    tbody.appendChild(tr);
  }
  zona.replaceChildren(table);
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
