import { amministrazione } from '../data/store.js';
import { SEZIONI } from '../sezioni.js';
import { el, esc, toast, openModal, confirmDialog } from '../lib/ui.js';

// ============================================================
//  UTENTI E AUTORIZZAZIONI — pannello del super admin.
//  Una riga per utente, una colonna per sezione: la tendina dice se quella
//  persona in quella sezione non entra ("Nessuno"), la usa ("Operatore") o
//  la amministra ("Admin"). È l'unico posto in cui si distribuiscono gli
//  accessi del portale.
// ============================================================

const RUOLI_SEZIONE = { '': 'Nessuno', operatore: 'Operatore', admin: 'Admin' };

export async function renderPortaleUtenti(view, ctx) {
  if (ctx.user.ruoloPortale !== 'super_admin') {
    view.appendChild(el(`<div class="empty-state"><div class="big">🔒</div>
      <p>Solo un amministratore del portale può gestire utenti e autorizzazioni.</p></div>`));
    return;
  }

  const wrap = el(`<div>
    <div class="page-head"><div>
      <h1>Utenti e autorizzazioni</h1>
      <p>Chi entra nel portale e a quali sezioni ha accesso.</p>
    </div></div>

    <div class="card"><div class="card-b">
      <h3 style="margin:0 0 4px">Aggiungi un utente</h3>
      <p class="hint" style="margin:0 0 14px">Crea l'account con una password provvisoria generata automaticamente: comunicala tu stesso all'utente (telefono, di persona, ecc. — non viene inviata via email). Al primo accesso dovrà impostarne una propria. Puoi già assegnargli le sezioni qui sotto, oppure farlo dopo dalla tabella.</p>
      <div class="form-row">
        <div class="field"><label>Email</label><input type="text" id="nu-email" placeholder="nome@cri.it" autocomplete="off"></div>
        <div class="field"><label>Nome (opzionale)</label><input type="text" id="nu-nome" autocomplete="off"></div>
      </div>
      <div class="perm-nuovo">
        ${SEZIONI.map(s => `<div class="field">
          <label>${esc(s.label)}</label>
          <select data-nuova-sezione="${s.id}">${opzioni('')}</select>
        </div>`).join('')}
      </div>
      <button class="btn primary" id="nu-crea" style="margin-top:12px">Crea utente</button>
      <div id="nu-err" style="color:var(--danger);font-size:13px;margin-top:10px"></div>
    </div></div>

    <div class="card" style="margin-top:22px"><div class="card-b">
      <h3 style="margin:0 0 4px">Utenti del portale</h3>
      <p class="hint" style="margin:0 0 14px">Chi si registra da solo nasce <b>In attesa</b>: non entra da nessuna parte finché non gli assegni almeno una sezione.
      L'<b>operatore</b> usa la sezione, l'<b>admin</b> ne gestisce anche le impostazioni. Il ruolo di <b>super admin</b> (accesso completo a tutto, compresa questa pagina) si assegna solo dal database.</p>
      <div class="tbl-wrap" id="utenti-zone"><div class="spinner" style="margin:20px auto"></div></div>
    </div></div>
  </div>`);
  view.appendChild(wrap);

  wrap.querySelector('#nu-crea').addEventListener('click', async () => {
    const err = wrap.querySelector('#nu-err'); err.textContent = '';
    const email = wrap.querySelector('#nu-email').value.trim();
    const nome = wrap.querySelector('#nu-nome').value.trim();
    const autorizzazioni = {};
    wrap.querySelectorAll('[data-nuova-sezione]').forEach(s => { if (s.value) autorizzazioni[s.dataset.nuovaSezione] = s.value; });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = 'Inserisci un\'email valida.'; return; }
    const btn = wrap.querySelector('#nu-crea'); const old = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<span class="spinner sm"></span> Creazione…';
    try {
      const risultato = await amministrazione.creaUtente({ email, nome, autorizzazioni });
      if (risultato.error) toast(risultato.error, 'err');   // account creato ma profilo/permessi da controllare a mano
      mostraPasswordGenerata(risultato.email, risultato.passwordProvvisoria);
      wrap.querySelector('#nu-email').value = '';
      wrap.querySelector('#nu-nome').value = '';
      wrap.querySelectorAll('[data-nuova-sezione]').forEach(s => { s.value = ''; });
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
      renderTabellaUtenti(zona, await amministrazione.listaUtenti(), ctx, disegnaUtenti);
    } catch (e) {
      zona.replaceChildren(el(`<div class="empty-state"><div class="big">⚠️</div><p>Errore: ${esc(e.message)}</p></div>`));
    }
  }
  disegnaUtenti();
}

function opzioni(valore) {
  return Object.entries(RUOLI_SEZIONE)
    .map(([v, t]) => `<option value="${v}" ${valore === v ? 'selected' : ''}>${t}</option>`).join('');
}

function renderTabellaUtenti(zona, utenti, ctx, ricarica) {
  if (!utenti.length) { zona.replaceChildren(el('<div class="empty-state"><div class="big">👤</div><p>Nessun utente.</p></div>')); return; }
  const table = el(`<table class="tbl perm-tbl"><thead><tr>
    <th>Utente</th><th>Stato</th>${SEZIONI.map(s => `<th>${esc(s.label)}</th>`).join('')}
  </tr></thead><tbody></tbody></table>`);
  const tbody = table.querySelector('tbody');

  for (const u of utenti) {
    const sonoIo = u.id === ctx.user.id;
    const superAdmin = u.ruolo === 'super_admin';
    const tr = el(`<tr>
      <td>
        <div style="font-weight:600">${esc(u.nome || '—')}${sonoIo ? ' <span class="chip">tu</span>' : ''}</div>
        <div class="muted" style="font-size:12.5px">${esc(u.email || '—')}</div>
      </td>
      <td data-stato></td>
      ${superAdmin
        ? `<td colspan="${SEZIONI.length}" class="muted" style="font-style:italic">accesso completo a tutte le sezioni</td>`
        : SEZIONI.map(s => `<td><select data-sezione="${s.id}" style="min-width:120px">${opzioni(u.sezioni[s.id] || '')}</select></td>`).join('')}
    </tr>`);

    disegnaStato(tr.querySelector('[data-stato]'), u, sonoIo, ricarica);

    tr.querySelectorAll('[data-sezione]').forEach(select => {
      const sezioneId = select.dataset.sezione;
      const etichetta = SEZIONI.find(s => s.id === sezioneId).label;
      let precedente = u.sezioni[sezioneId] || '';
      select.addEventListener('change', async () => {
        const nuovo = select.value;
        const domanda = nuovo === ''
          ? `Revocare a ${u.email} l'accesso a "${etichetta}"? Non vedrà più i dati di questa sezione.`
          : `Dare a ${u.email} il ruolo di ${RUOLI_SEZIONE[nuovo].toLowerCase()} in "${etichetta}"?`;
        if (!await confirmDialog(domanda, { danger: nuovo === '', okLabel: nuovo === '' ? 'Revoca' : 'Conferma' })) {
          select.value = precedente;   // annullato: la tendina torna com'era
          return;
        }
        select.disabled = true;
        try {
          if (nuovo === '') {
            await amministrazione.revocaAutorizzazione(u.id, sezioneId);
          } else {
            await amministrazione.impostaAutorizzazione(u.id, sezioneId, nuovo);
            // Un profilo ancora "in attesa" non potrebbe entrare comunque: dargli
            // una sezione significa volerlo dentro, quindi lo si attiva insieme
            // al permesso invece di lasciarlo bloccato senza un motivo visibile.
            if (u.ruolo === 'in_attesa') {
              await amministrazione.aggiornaUtente(u.id, { ruolo: 'utente' });
              u.ruolo = 'utente';
            }
          }
          precedente = nuovo;
          toast('Autorizzazioni aggiornate', 'ok');
          ricarica();
        } catch (e) {
          select.value = precedente;
          toast('Errore: ' + e.message, 'err');
        } finally { select.disabled = false; }
      });
    });

    tbody.appendChild(tr);
  }
  zona.replaceChildren(table);
}

// Stato di portale: un utente "sospeso" (ruolo in_attesa) non entra da nessuna
// parte, anche se le sue autorizzazioni di sezione restano scritte — così
// riattivarlo non costringe a riassegnargliele una per una.
function disegnaStato(td, u, sonoIo, ricarica) {
  if (u.ruolo === 'super_admin') { td.replaceChildren(el('<span class="chip ok">super admin</span>')); return; }
  const attivo = u.ruolo === 'utente';
  const chip = attivo ? '<span class="chip ok">attivo</span>' : '<span class="chip warn">in attesa</span>';
  const provvisoria = u.deve_cambiare_password ? '<div><span class="chip warn" style="margin-top:4px">password provvisoria</span></div>' : '';
  td.replaceChildren(el(`<div>${chip}${provvisoria}</div>`));
  if (sonoIo) return;

  const azioni = el('<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px"></div>');
  const btn = el(`<button class="btn ghost sm">${attivo ? 'Sospendi' : 'Riattiva'}</button>`);
  btn.addEventListener('click', async () => {
    const domanda = attivo
      ? `Sospendere ${u.email}? Non potrà più entrare in nessuna sezione, ma le autorizzazioni che gli hai dato restano salvate.`
      : `Riattivare ${u.email}? Tornerà ad accedere alle sezioni che gli sono già assegnate.`;
    if (!await confirmDialog(domanda, { danger: attivo, okLabel: attivo ? 'Sospendi' : 'Riattiva' })) return;
    btn.disabled = true;
    try {
      await amministrazione.aggiornaUtente(u.id, { ruolo: attivo ? 'in_attesa' : 'utente' });
      toast(attivo ? 'Utente sospeso' : 'Utente riattivato', 'ok');
      ricarica();
    } catch (e) {
      toast('Errore: ' + e.message, 'err');
      btn.disabled = false;
    }
  });

  // Eliminazione definitiva. Sta accanto a "Sospendi" di proposito: quasi
  // sempre la cosa giusta è sospendere, e vedere le due possibilità una di
  // fianco all'altra rende evidente la differenza tra il gesto reversibile e
  // quello che non lo è.
  const btnElimina = el('<button class="btn sm danger">Elimina</button>');
  btnElimina.addEventListener('click', async () => {
    if (!await confermaEliminazione(u)) return;
    btnElimina.disabled = true; btn.disabled = true;
    try {
      await amministrazione.eliminaUtente(u.id);
      toast(`${u.email} è stato eliminato`, 'ok');
      ricarica();
    } catch (e) {
      toast('Errore: ' + e.message, 'err');
      btnElimina.disabled = false; btn.disabled = false;
    }
  });

  azioni.append(btn, btnElimina);
  td.firstElementChild.appendChild(azioni);
}

// Conferma dell'eliminazione: non un semplice sì/no, ma la digitazione
// dell'email. È l'unica azione del portale che distrugge un account senza
// rimedio, e il pulsante sta a pochi pixel da "Sospendi": far riscrivere
// l'indirizzo costringe a guardare *quale* riga si sta cancellando.
function confermaEliminazione(u) {
  return new Promise(res => {
    let esito = false;
    const body = el(`<div>
      <p style="margin:0 0 10px">Stai per eliminare <b>${esc(u.email)}</b> per sempre. L'account sparisce da Supabase e con lui i suoi permessi: non si può annullare.</p>
      <p class="hint" style="margin:0 0 10px">Le fatture, le assistenze e i trasporti che ha inserito <b>restano tutti</b>: perdono soltanto il collegamento al suo account. Il registro modifiche continua a mostrare il suo nome.</p>
      <p class="hint" style="margin:0 0 14px">Se ti serve solo impedirgli di entrare, chiudi qui e usa <b>Sospendi</b>: blocca l'accesso conservando i permessi, ed è reversibile.</p>
      <div class="field">
        <label>Per confermare, scrivi l'email dell'utente</label>
        <input type="text" id="el-conferma" placeholder="${esc(u.email)}" autocomplete="off" spellcheck="false">
      </div>
    </div>`);
    const foot = el(`<div style="display:flex;gap:10px">
      <button class="btn" data-no>Annulla</button>
      <button class="btn danger" data-yes disabled>Elimina definitivamente</button></div>`);
    const { close } = openModal({ title: 'Eliminare questo utente?', body, footer: foot, onClose: () => res(esito) });

    const input = body.querySelector('#el-conferma');
    const ok = foot.querySelector('[data-yes]');
    const corrisponde = () => input.value.trim().toLowerCase() === String(u.email || '').toLowerCase();
    input.addEventListener('input', () => { ok.disabled = !corrisponde(); });
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && corrisponde()) ok.click(); });
    foot.querySelector('[data-no]').onclick = () => close();
    ok.onclick = () => { if (!corrisponde()) return; esito = true; close(); };
    input.focus();
  });
}

// La password provvisoria viene mostrata una sola volta: non viene salvata da
// nessuna parte oltre alla risposta di questa chiamata, quindi va copiata o
// annotata subito, prima di chiudere il riquadro.
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
