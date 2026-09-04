import { proposte } from '../data/store.js';
import { el, clear, esc, openModal, confirmDialog, toast, fmtEuro, fmtDate, todayISO, parseEuro } from '../lib/ui.js';
import { METODI } from '../lib/xmlFattura.js';
import { confermaSeSuperaResiduo } from '../lib/documenti.js';

const ESITO_CHIP = { proposta: 'warn', confermata: 'ok', rifiutata: 'danger' };
const ESITO_LABEL = { proposta: 'In attesa', confermata: 'Confermata', rifiutata: 'Rifiutata' };

export async function renderProposte(view, ctx) {
  const isAdmin = ctx.user.ruolo === 'admin';
  let righe = [];
  try { righe = await proposte.list(); }
  catch (e) { view.appendChild(el(`<div class="empty-state"><div class="big">⚠️</div><p>Errore nel caricamento: ${esc(e.message)}</p></div>`)); return; }

  const wrap = el(`<div>
    <div class="page-head"><div><h1>Proposte di pagamento</h1><p>${isAdmin
      ? 'Proposte inviate dagli operatori: confermale quando esegui davvero il pagamento, o rifiutale.'
      : 'Le tue proposte di pagamento: le crei da "Fatture", cliccando sullo stato di una fattura non ancora saldata.'}</p></div></div>
    <div class="card" style="margin-bottom:22px">
      <div class="card-h">In attesa</div>
      <div class="card-b tbl-wrap" id="p-attesa"></div>
    </div>
    <div class="card">
      <div class="card-h">Storico</div>
      <div class="card-b tbl-wrap" id="p-storico"></div>
    </div>
  </div>`);
  view.appendChild(wrap);

  // Come nelle dashboard: `ricarica` viene chiamata dai gestori dei click
  // senza che nessuno ne aspetti la promise, quindi un errore di rete qui
  // diventerebbe un rifiuto non gestito — nessun messaggio, e l'elenco fermo
  // a prima della conferma, come se l'operazione non fosse andata a buon fine.
  async function ricarica() {
    try {
      righe = await proposte.list();
      disegna();
    } catch (e) {
      toast('Aggiornamento non riuscito: ' + e.message + ' — ricarica la pagina.', 'err');
    }
  }

  function disegna() {
    const inAttesa = righe.filter(r => r.stato === 'proposta');
    const storico = righe.filter(r => r.stato !== 'proposta');
    renderInAttesa(wrap.querySelector('#p-attesa'), inAttesa, ctx, ricarica);
    renderStorico(wrap.querySelector('#p-storico'), storico);
  }

  disegna();
}

function renderInAttesa(node, righe, ctx, ricarica) {
  clear(node);
  const isAdmin = ctx.user.ruolo === 'admin';
  if (!righe.length) { node.appendChild(el(`<div class="empty-state"><div class="big">📭</div><p>Nessuna proposta in attesa.</p></div>`)); return; }
  const table = el(`<table class="tbl"><thead><tr>
    <th>Fornitore</th><th>N. Fattura</th><th class="money-col">Residuo fattura</th><th class="money-col">Importo proposto</th><th>Data prevista</th><th>Metodo</th>${isAdmin ? '<th>Proposto da</th>' : ''}<th>Note</th><th></th>
  </tr></thead><tbody></tbody></table>`);
  const tbody = table.querySelector('tbody');
  for (const r of righe) {
    const f = r.fatture || {};
    // Il residuo può essere già coperto da un pagamento nel frattempo (es.
    // un'altra proposta confermata, o un pagamento diretto): evidenziarlo
    // qui evita di scoprirlo solo dopo aver confermato per errore un
    // pagamento che eccede quanto resta davvero da pagare.
    const residuoBasso = f._residuo !== undefined && f._residuo <= 0;
    const tr = el(`<tr>
      <td>${esc(f.fornitore || '—')}</td>
      <td>${esc(f.numero_fattura || '—')}</td>
      <td class="money money-col">${f._residuo !== undefined ? fmtEuro(f._residuo) : '—'}${residuoBasso ? ' ⚠️' : ''}</td>
      <td class="money money-col">${fmtEuro(r.importo)}</td>
      <td>${fmtDate(r.data_prevista)}</td>
      <td>${esc(r.metodo || '—')}</td>
      ${isAdmin ? `<td>${esc(r.proposta_da_nome || r.proposta_da_email || '—')}</td>` : ''}
      <td>${esc(r.note || '—')}</td>
      <td style="text-align:right;white-space:nowrap"></td>
    </tr>`);
    const azioni = tr.lastElementChild;
    if (isAdmin) {
      const btnConferma = el('<button class="btn primary sm">✅ Conferma</button>');
      const btnRifiuta = el('<button class="btn ghost sm" style="margin-left:6px">✕ Rifiuta</button>');
      btnConferma.addEventListener('click', () => apriConfermaProposta(r, f, ctx, ricarica));
      btnRifiuta.addEventListener('click', () => apriRifiutaProposta(r, ctx, ricarica));
      azioni.append(btnConferma, btnRifiuta);
    } else {
      const btnRitira = el('<button class="btn ghost sm">Ritira</button>');
      btnRitira.addEventListener('click', async () => {
        if (!await confirmDialog('Ritirare questa proposta di pagamento?', { danger: true, okLabel: 'Ritira' })) return;
        try { await proposte.remove(r.id); toast('Proposta ritirata', 'ok'); ricarica(); }
        catch (e) { toast('Errore: ' + e.message, 'err'); }
      });
      azioni.appendChild(btnRitira);
    }
    tbody.appendChild(tr);
  }
  node.appendChild(table);
}

function renderStorico(node, righe) {
  clear(node);
  if (!righe.length) { node.appendChild(el(`<div class="empty-state"><div class="big">📋</div><p>Nessuna proposta ancora decisa.</p></div>`)); return; }
  const table = el(`<table class="tbl"><thead><tr>
    <th>Fornitore</th><th>N. Fattura</th><th class="money-col">Importo</th><th>Esito</th><th>Decisa da</th><th>Quando</th><th>Motivo rifiuto</th>
  </tr></thead><tbody></tbody></table>`);
  const tbody = table.querySelector('tbody');
  for (const r of righe.slice().sort((a, b) => (b.decisa_il || '').localeCompare(a.decisa_il || ''))) {
    const f = r.fatture || {};
    tbody.appendChild(el(`<tr>
      <td>${esc(f.fornitore || '—')}</td>
      <td>${esc(f.numero_fattura || '—')}</td>
      <td class="money money-col">${fmtEuro(r.importo)}</td>
      <td><span class="chip ${ESITO_CHIP[r.stato] || ''}">${ESITO_LABEL[r.stato] || r.stato}</span></td>
      <td>${esc(r.decisa_da_nome || '—')}</td>
      <td>${r.decisa_il ? fmtDate(r.decisa_il.slice(0, 10)) : '—'}</td>
      <td>${esc(r.motivo_rifiuto || '—')}</td>
    </tr>`));
  }
  node.appendChild(table);
}

// L'admin può correggere importo/data/metodo rispetto a quanto proposto,
// nel caso il pagamento effettivo sia stato eseguito in modo leggermente
// diverso (es. un acconto invece dell'intero importo).
function apriConfermaProposta(proposta, fattura, ctx, ricarica) {
  const body = el(`<div>
    <p class="muted" style="margin:0 0 14px;font-size:14px">${esc(fattura.fornitore || '')} ${fattura.numero_fattura ? '· ' + esc(fattura.numero_fattura) : ''} — proposto da ${esc(proposta.proposta_da_nome || proposta.proposta_da_email || 'un operatore')}${fattura._residuo !== undefined ? ` — residuo <b>${fmtEuro(fattura._residuo)}</b>` : ''}</p>
    <div class="form-row three" style="align-items:end">
      <div class="field"><label>Data pagamento</label><input type="date" id="cp-data" value="${proposta.data_prevista || todayISO()}"></div>
      <div class="field"><label>Importo (€)</label><input type="number" step="0.01" id="cp-importo" value="${Number(proposta.importo).toFixed(2)}"></div>
      <div class="field"><label>Metodo</label><select id="cp-metodo">${METODI.map(m => `<option value="${esc(m)}" ${proposta.metodo === m ? 'selected' : ''}>${m || '—'}</option>`).join('')}</select></div>
    </div>
    <div id="cp-err" style="color:var(--danger);font-size:13px"></div>
  </div>`);
  const footer = el(`<div style="display:flex;gap:10px;width:100%">
    <div style="flex:1"></div>
    <button class="btn" id="cp-cancel">Annulla</button>
    <button class="btn primary" id="cp-save">Conferma pagamento eseguito</button>
  </div>`);
  const { close } = openModal({ title: 'Conferma pagamento — ' + (fattura.fornitore || ''), body, footer });
  footer.querySelector('#cp-cancel').addEventListener('click', close);
  footer.querySelector('#cp-save').addEventListener('click', async () => {
    const err = body.querySelector('#cp-err'); err.textContent = '';
    const importo = parseEuro(body.querySelector('#cp-importo').value);
    const data_pagamento = body.querySelector('#cp-data').value;
    if (!importo || importo <= 0) { err.textContent = 'Indica un importo valido.'; return; }
    if (!data_pagamento) { err.textContent = 'Indica la data del pagamento.'; return; }
    if (fattura._residuo !== undefined && !await confermaSeSuperaResiduo(importo, fattura._residuo)) return;
    const btn = footer.querySelector('#cp-save'); const old = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<span class="spinner sm"></span> Conferma…';
    try {
      await proposte.confermare(proposta, { importo, data_pagamento, metodo: body.querySelector('#cp-metodo').value || null }, ctx.user);
      toast('Pagamento confermato e registrato', 'ok');
      close();
      ricarica();
    } catch (e) {
      err.textContent = 'Errore: ' + e.message;
      btn.disabled = false; btn.innerHTML = old;
    }
  });
}

function apriRifiutaProposta(proposta, ctx, ricarica) {
  const body = el(`<div>
    <p style="margin:0 0 10px">Perché rifiuti questa proposta di pagamento? (opzionale, l'operatore lo vedrà nello storico)</p>
    <textarea id="rp-motivo" rows="3" style="width:100%"></textarea>
  </div>`);
  const footer = el(`<div style="display:flex;gap:10px;width:100%">
    <div style="flex:1"></div>
    <button class="btn" id="rp-cancel">Annulla</button>
    <button class="btn danger" id="rp-save">Rifiuta proposta</button>
  </div>`);
  const { close } = openModal({ title: 'Rifiuta proposta', body, footer });
  footer.querySelector('#rp-cancel').addEventListener('click', close);
  footer.querySelector('#rp-save').addEventListener('click', async () => {
    const btn = footer.querySelector('#rp-save'); const old = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<span class="spinner sm"></span> …';
    try {
      await proposte.rifiutare(proposta.id, body.querySelector('#rp-motivo').value.trim(), ctx.user);
      toast('Proposta rifiutata', 'ok');
      close();
      ricarica();
    } catch (e) {
      toast('Errore: ' + e.message, 'err');
      btn.disabled = false; btn.innerHTML = old;
    }
  });
}
