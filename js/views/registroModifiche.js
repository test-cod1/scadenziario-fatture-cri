import { logModifiche } from '../data/store.js';
import { logModificheAttive } from '../data/storeAttive.js';
import { el, clear, esc, fmtDateTime } from '../lib/ui.js';

const AZIONE_LABEL = {
  creazione: { t: 'Creazione fattura', ic: '➕', cls: 'ok' },
  modifica: { t: 'Modifica fattura', ic: '✏️', cls: 'warn' },
  cancellazione: { t: 'Cancellazione fattura', ic: '🗑️', cls: 'danger' },
  pagamento_aggiunto: { t: 'Pagamento registrato', ic: '💶', cls: 'ok' },
  pagamento_rimosso: { t: 'Pagamento rimosso', ic: '↩️', cls: 'danger' },
  incasso_aggiunto: { t: 'Incasso registrato', ic: '💶', cls: 'ok' },
  incasso_rimosso: { t: 'Incasso rimosso', ic: '↩️', cls: 'danger' },
  nota_credito_aggiunta: { t: 'Nota di credito registrata', ic: '🧾', cls: 'info' },
  nota_credito_rimossa: { t: 'Nota di credito rimossa', ic: '↩️', cls: 'danger' },
};
const TIPO_LABEL = { passiva: { t: 'Passiva', cls: '' }, attiva: { t: 'Attiva', cls: 'info' } };

// Unico registro per fatture passive (fornitori) e attive (clienti): le due
// tabelle di log hanno la stessa forma a parte fornitore/cliente e
// pagamento/incasso, quindi vengono fuse in un'unica lista ordinata dalla
// più recente, con un filtro per tipologia invece di due pagine separate.
// Il chiamante (Impostazioni, unico punto d'accesso — già riservato agli
// admin) fornisce il nodo dove disegnare le righe e il <select> del filtro.
export async function renderRegistroModifiche(zone, selectTipo, ctx) {
  let righe = [];
  try {
    const [passive, attive] = await Promise.all([logModifiche.list(), logModificheAttive.list()]);
    righe = [
      ...passive.map(r => ({ ...r, _tipo: 'passiva', _soggetto: r.fornitore_snapshot })),
      ...attive.map(r => ({ ...r, _tipo: 'attiva', _soggetto: r.cliente_snapshot })),
    ].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  } catch (e) {
    zone.appendChild(el(`<div class="empty-state"><div class="big">⚠️</div><p>Errore: ${esc(e.message)}</p></div>`));
    return;
  }

  const refresh = () => renderRighe(zone, selectTipo.value ? righe.filter(r => r._tipo === selectTipo.value) : righe);
  selectTipo.addEventListener('change', refresh);
  refresh();
}

function renderRighe(zone, righe) {
  clear(zone);
  if (!righe.length) { zone.appendChild(el('<div class="empty-state"><div class="big">📭</div><p>Nessuna operazione registrata.</p></div>')); return; }
  for (const r of righe) {
    const info = AZIONE_LABEL[r.azione] || { t: r.azione, ic: '•', cls: '' };
    const tipoInfo = TIPO_LABEL[r._tipo];
    const row = el(`<div class="log-row">
      <div class="l-head">
        <span class="chip ${info.cls}">${info.ic} ${esc(info.t)}</span>
        <span class="chip ${tipoInfo.cls}">${esc(tipoInfo.t)}</span>
        <span><b>${esc(r._soggetto || '—')}</b>${r.numero_snapshot ? ' · ' + esc(r.numero_snapshot) : ''}</span>
        <span class="muted">${esc(r.utente_nome || r.utente_email || 'utente sconosciuto')}</span>
        <span class="l-when">${fmtDateTime(r.created_at)}</span>
      </div>
      <details><summary class="muted" style="cursor:pointer">Dettagli tecnici</summary><pre>${esc(JSON.stringify(r.dettagli, null, 2))}</pre></details>
    </div>`);
    zone.appendChild(row);
  }
}
