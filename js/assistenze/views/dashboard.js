import { preventivi } from '../data/store.js';
import { fmtData } from '../lib/documento.js';
import { el, clear, esc, toast, confirmDialog, fmtEuro } from '../../lib/ui.js';

// ============================================================
//  ELENCO DEI PREVENTIVI DI ASSISTENZA
// ============================================================

const STATO_CHIP = { bozza: '', inviato: 'info', confermato: 'ok', annullato: 'danger' };

export async function renderDashboard(view, ctx) {
  const list = await preventivi.list();

  view.appendChild(el(`<div class="page-head">
    <div><h1>Preventivi</h1><p>Assistenze sanitarie a manifestazioni ed eventi</p></div>
    <a class="btn primary" href="#/assistenze/nuovo">➕ Nuovo preventivo</a>
  </div>`));

  const confermati = list.filter(p => p.stato === 'confermato');
  view.appendChild(el(`<div class="grid stats" style="margin-bottom:22px">
    <div class="stat accent"><div class="k">Preventivi</div><div class="v">${list.length}</div><div class="s">in archivio</div></div>
    <div class="stat"><div class="k">Confermati</div><div class="v">${confermati.length}</div>
      <div class="s">${fmtEuro(confermati.reduce((s, p) => s + Number(p.totale || 0), 0))}</div></div>
    <div class="stat"><div class="k">Valore totale</div><div class="v">${fmtEuro(list.reduce((s, p) => s + Number(p.totale || 0), 0))}</div></div>
  </div>`));

  if (!list.length) {
    view.appendChild(el(`<div class="empty-state"><div class="big">⛑️</div>
      <p>Nessun preventivo ancora.<br>Creane uno con "Nuovo preventivo".</p></div>`));
    return;
  }

  const toolbar = el(`<div class="toolbar">
    <div class="search"><span class="search-icon" aria-hidden="true">🔍</span>
      <input type="text" id="q" placeholder="Cerca per cliente, evento o luogo…"></div>
  </div>`);
  view.appendChild(toolbar);

  const card = el(`<div class="card"><div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Cliente</th><th>Evento</th><th>Data</th><th>Turni</th><th>Totale</th><th>Stato</th><th></th></tr></thead>
    <tbody></tbody></table></div></div>`);
  view.appendChild(card);
  const tbody = card.querySelector('tbody');

  function draw() {
    const q = toolbar.querySelector('#q').value.toLowerCase().trim();
    clear(tbody);
    const filtrati = list.filter(p => !q ||
      [p.cliente, p.oggetto, p.luogo].join(' ').toLowerCase().includes(q));
    if (!filtrati.length) {
      tbody.appendChild(el('<tr><td colspan="7" class="muted" style="text-align:center;padding:26px">Nessun risultato</td></tr>'));
      return;
    }
    for (const p of filtrati) {
      const tr = el(`<tr>
        <td><b>${esc(p.cliente || '—')}</b></td>
        <td>${esc(p.oggetto || '—')}</td>
        <td>${fmtData(p.data_documento)}</td>
        <td>${(p.calendario || []).length}</td>
        <td class="money">${fmtEuro(p.totale)}</td>
        <td><span class="chip ${STATO_CHIP[p.stato] || ''}">${esc(p.stato || 'bozza')}</span></td>
        <td style="white-space:nowrap;text-align:right">
          <button class="btn ghost sm" data-word title="Scarica in Word">📄</button>
          <button class="btn ghost sm" data-pdf title="Stampa / PDF">🖨️</button>
          <button class="btn ghost sm" data-del title="Elimina">🗑️</button>
        </td>
      </tr>`);
      tr.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        ctx.go(`#/assistenze/preventivo/${p.id}`);
      });
      tr.querySelector('[data-pdf]').addEventListener('click', async () => {
        try {
          const { stampaPreventivo } = await import('../lib/stampa.js');
          await stampaPreventivo(p, ctx.imp);
        } catch (e) { toast('Stampa non riuscita: ' + e.message, 'err'); }
      });
      tr.querySelector('[data-word]').addEventListener('click', async () => {
        try {
          const { scaricaDocx } = await import('../lib/docx.js');
          await scaricaDocx(p, ctx.imp);
        } catch (e) { toast('Generazione Word non riuscita: ' + e.message, 'err'); }
      });
      tr.querySelector('[data-del]').addEventListener('click', async () => {
        if (!await confirmDialog(`Eliminare il preventivo per "${p.cliente || 'senza cliente'}"?`,
          { danger: true, okLabel: 'Elimina' })) return;
        await preventivi.remove(p.id);
        toast('Preventivo eliminato', 'ok');
        clear(view);
        renderDashboard(view, ctx);
      });
      tbody.appendChild(tr);
    }
  }
  toolbar.querySelector('#q').addEventListener('input', draw);
  draw();
}
