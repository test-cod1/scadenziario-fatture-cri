import { logModifiche } from '../data/store.js';
import { el, clear, esc, fmtDateTime } from '../lib/ui.js';

const AZIONE_LABEL = {
  creazione: { t: 'Creazione fattura', ic: '➕', cls: 'ok' },
  modifica: { t: 'Modifica fattura', ic: '✏️', cls: 'warn' },
  cancellazione: { t: 'Cancellazione fattura', ic: '🗑️', cls: 'danger' },
  pagamento_aggiunto: { t: 'Pagamento registrato', ic: '💶', cls: 'ok' },
  pagamento_rimosso: { t: 'Pagamento rimosso', ic: '↩️', cls: 'danger' },
};

export async function renderLog(view, ctx) {
  if (ctx.user.ruolo !== 'admin') {
    view.appendChild(el(`<div class="empty-state"><div class="big">🔒</div><p>Solo gli amministratori possono consultare il registro modifiche.</p></div>`));
    return;
  }
  let righe = [];
  try { righe = await logModifiche.list(); }
  catch (e) { view.appendChild(el(`<div class="empty-state"><div class="big">⚠️</div><p>Errore: ${esc(e.message)}</p></div>`)); return; }

  const wrap = el(`<div>
    <div class="page-head"><div><h1>Registro modifiche</h1><p>Chi ha creato, modificato o cancellato ogni fattura/pagamento — sola lettura, non modificabile.</p></div></div>
    <div class="card"><div class="card-b" id="log-zone"></div></div>
  </div>`);
  view.appendChild(wrap);
  const zone = wrap.querySelector('#log-zone');
  if (!righe.length) { zone.appendChild(el('<div class="empty-state"><div class="big">📭</div><p>Nessuna operazione registrata.</p></div>')); return; }

  for (const r of righe) {
    const info = AZIONE_LABEL[r.azione] || { t: r.azione, ic: '•', cls: '' };
    const row = el(`<div class="log-row">
      <div class="l-head">
        <span class="chip ${info.cls}">${info.ic} ${esc(info.t)}</span>
        <span><b>${esc(r.fornitore_snapshot || '—')}</b>${r.numero_snapshot ? ' · ' + esc(r.numero_snapshot) : ''}</span>
        <span class="muted">${esc(r.utente_nome || r.utente_email || 'utente sconosciuto')}</span>
        <span class="l-when">${fmtDateTime(r.created_at)}</span>
      </div>
      <details><summary class="muted" style="cursor:pointer">Dettagli tecnici</summary><pre>${esc(JSON.stringify(r.dettagli, null, 2))}</pre></details>
    </div>`);
    zone.appendChild(row);
  }
}
