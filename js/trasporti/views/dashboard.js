import { preventivi } from '../data/store.js';
import { el, clear, fmtEuro, fmtDate, fmtKm, esc, toast, confirmDialog } from '../lib/ui.js';
import { stampaPreventivo } from '../lib/pdf.js';

export async function renderDashboard(view, ctx) {
  // Niente clear(view): la pagina la svuota gia' il router del portale, che ci
  // lascia in cima la riga di ritorno alla home delle sezioni.
  const list = await preventivi.list();

  const head = el(`<div class="page-head">
    <div><h1>Preventivi</h1><p>Trasporti sanitari fuori Genova · storico e nuovi preventivi</p></div>
    <a class="btn primary" href="#/trasporti/nuovo">➕ Nuovo preventivo</a>
  </div>`);
  view.appendChild(head);

  // stats
  const totAddebito = list.reduce((s, p) => s + (p.risultato?.addebito || 0), 0);
  const totMargine = list.reduce((s, p) => s + (p.risultato?.margine || 0), 0);
  const stats = el(`<div class="grid stats" style="margin-bottom:22px">
    <div class="stat accent"><div class="k">Preventivi</div><div class="v">${list.length}</div><div class="s">in archivio</div></div>
    <div class="stat"><div class="k">Valore totale (addebito)</div><div class="v">${fmtEuro(totAddebito)}</div></div>
    <div class="stat"><div class="k">Margine stimato totale</div><div class="v">${fmtEuro(totMargine)}</div></div>
  </div>`);
  view.appendChild(stats);

  if (!list.length) {
    view.appendChild(el(`<div class="empty-state"><div class="big">📋</div>
      <p>Nessun preventivo ancora.<br>Creane uno con "Nuovo preventivo".</p></div>`));
    return;
  }

  // toolbar
  const toolbar = el(`<div class="toolbar">
    <div class="search"><span class="search-icon" aria-hidden="true">🔍</span><input type="text" id="q" placeholder="Cerca per titolo o destinazione…"></div>
  </div>`);
  view.appendChild(toolbar);

  const card = el(`<div class="card"><div class="tbl-wrap"><table class="tbl">
    <thead><tr>
      <th>Titolo</th><th>Creato il</th><th>Destinazione</th>
      <th>Km</th><th>Spesa reale</th><th>Addebito</th><th></th>
    </tr></thead><tbody></tbody>
  </table></div></div>`);
  view.appendChild(card);
  const tbody = card.querySelector('tbody');

  function draw() {
    const q = toolbar.querySelector('#q').value.toLowerCase().trim();
    clear(tbody);
    const filtered = list.filter(p => {
      if (!q) return true;
      const hay = [p.titolo, destLabel(p)].join(' ').toLowerCase();
      return hay.includes(q);
    });
    if (!filtered.length) {
      tbody.appendChild(el(`<tr><td colspan="7" class="muted" style="text-align:center;padding:26px">Nessun risultato</td></tr>`));
      return;
    }
    for (const p of filtered) {
      const tr = el(`<tr>
        <td><b>${esc(p.titolo || 'Senza titolo')}</b></td>
        <td>${fmtDate(p.created_at)}</td>
        <td>${esc(destLabel(p))}</td>
        <td class="money">${fmtKm(p.km_totali)}</td>
        <td class="money">${fmtEuro(p.risultato?.spesaReale)}</td>
        <td class="money">${fmtEuro(p.risultato?.addebito)}</td>
        <td style="white-space:nowrap;text-align:right">
          <button class="btn ghost sm" data-pdf title="Stampa / PDF">🖨️</button>
          <button class="btn ghost sm" data-del title="Elimina">🗑️</button>
        </td>
      </tr>`);
      tr.addEventListener('click', (e) => {
        if (e.target.closest('[data-pdf]') || e.target.closest('[data-del]')) return;
        ctx.go(`#/trasporti/preventivo/${p.id}`);
      });
      tr.querySelector('[data-pdf]').addEventListener('click', () => stampaPreventivo(p, ctx.imp));
      tr.querySelector('[data-del]').addEventListener('click', async () => {
        if (await confirmDialog(`Eliminare il preventivo "${p.titolo || 'senza titolo'}"?`, { danger: true, okLabel: 'Elimina' })) {
          await preventivi.remove(p.id);
          toast('Preventivo eliminato', 'ok');
          renderDashboard(view, ctx);
        }
      });
      tbody.appendChild(tr);
    }
  }
  toolbar.querySelector('#q').addEventListener('input', draw);
  draw();
}

function destLabel(p) {
  const tappe = p.tappe || [];
  const last = tappe[tappe.length - 1];
  return p.paese_dest_nome || (last ? shortAddr(last.label) : '—');
}
function shortAddr(s) {
  if (!s) return '—';
  return s.split(',').slice(0, 2).join(',').trim();
}
