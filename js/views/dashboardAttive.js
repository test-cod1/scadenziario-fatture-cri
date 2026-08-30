import { fattureAttive, incassi } from '../data/storeAttive.js';
import { el, clear, esc, fmtDate, fmtEuro, debounce, rendiCliccabile } from '../lib/ui.js';
import { exportXLSXAttive, exportPDFAttive } from '../lib/export.js';
import { apriEditorAttiva, apriUploadAttive, apriIncassoRapido, apriNuovaNotaCreditoAttiva, apriSollecitoRapido } from './fatturaAttiva.js';
import { FILTRO_CLIENTE_KEY } from './reportAttive.js';

const STATO_LABEL = { da_incassare: 'Da incassare', incassata_parziale: 'Incassata parz.', incassata: 'Incassata', stornata: 'Stornata' };
const STATO_CHIP = { da_incassare: 'warn', incassata_parziale: 'red', incassata: 'ok', stornata: 'info' };
const STATI_CHIUSI = ['incassata', 'stornata'];

// Vedi il commento gemello in dashboard.js.
function confiniPeriodoCorrente() {
  const oggi = new Date().toISOString().slice(0, 10);
  return { oggi, inizioMese: oggi.slice(0, 7) + '-01', inizioAnno: oggi.slice(0, 4) + '-01-01' };
}

export async function renderDashboardAttive(view, ctx) {
  let tutte = [], incassatoMese = 0, incassatoAnno = 0, contaArchivio = 0;
  try {
    const { oggi, inizioMese, inizioAnno } = confiniPeriodoCorrente();
    [tutte, incassatoMese, incassatoAnno, contaArchivio] = await Promise.all([
      fattureAttive.listAperte(),
      incassi.sommaPeriodo(inizioMese, oggi),
      incassi.sommaPeriodo(inizioAnno, oggi),
      fattureAttive.contaArchivio(),
    ]);
  }
  catch (e) { view.appendChild(el(`<div class="empty-state"><div class="big">⚠️</div><p>Errore nel caricamento: ${esc(e.message)}</p></div>`)); return; }
  let archivioCaricato = false;

  const state = { q: '', stato: '', importoMin: '', importoMax: '' };
  // Arrivo da un click su un cliente nel Report: preimposta la ricerca e
  // consuma subito la chiave, altrimenti resterebbe applicata a ogni rientro
  // nella dashboard finché non viene aperto di nuovo il Report.
  const filtroCliente = sessionStorage.getItem(FILTRO_CLIENTE_KEY);
  if (filtroCliente !== null) { state.q = filtroCliente; sessionStorage.removeItem(FILTRO_CLIENTE_KEY); }

  const wrap = el(`<div>
    <div class="page-head">
      <div><h1>Fatture Attive</h1><p>Fatture emesse ai clienti — CRI Genova</p></div>
      <div class="actions">
        <button class="btn" id="exp-csv">📊 Esporta Excel</button>
        <button class="btn" id="exp-pdf">🖨️ Esporta PDF</button>
        <button class="btn" id="carica">📎 Carica PDF/XML</button>
        <button class="btn" id="nuova-nc">+ Nota di credito</button>
        <button class="btn primary" id="nuova">+ Nuova fattura</button>
      </div>
    </div>
    <div class="grid stats" id="stats" style="margin-bottom:22px"></div>
    <div class="toolbar">
      <div class="search"><span class="search-icon">🔎</span><input type="text" id="q" placeholder="Cerca cliente, numero fattura, note…"></div>
      <select id="f-stato">
        <option value="">Tutti gli stati</option>
        <option value="da_incassare">Da incassare</option>
        <option value="incassata_parziale">Incassata parzialmente</option>
        <option value="incassata">Incassata</option>
        <option value="stornata">Stornata</option>
      </select>
      <input type="number" id="f-min" placeholder="Importo min €" style="width:120px">
      <input type="number" id="f-max" placeholder="Importo max €" style="width:120px">
      <button class="btn ghost sm" id="f-reset">Azzera filtri</button>
    </div>
    <div class="card"><div class="card-b tbl-wrap" id="tbl-zone"></div></div>
    <details class="card" id="archivio" style="margin-top:22px">
      <summary class="card-h">
        <span>📁 Archivio fatture concluse (<span id="archivio-conta">${contaArchivio}</span>)</span>
        <span class="archivio-freccia">▸</span>
      </summary>
      <div class="card-b tbl-wrap" id="archivio-zone">
        <div class="muted" style="padding:6px 0">Fatture incassate/stornate di anni precedenti: si caricano aprendo questo pannello.</div>
      </div>
    </details>
    <div class="drop-page-overlay" id="drop-overlay"><div class="box">📎 Rilascia qui i file per caricare le fatture</div></div>
  </div>`);
  view.appendChild(wrap);

  const overlay = wrap.querySelector('#drop-overlay');
  let dragDepth = 0;
  wrap.addEventListener('dragenter', e => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    dragDepth++;
    overlay.classList.add('show');
  });
  wrap.addEventListener('dragover', e => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); });
  wrap.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) overlay.classList.remove('show'); });
  wrap.addEventListener('drop', e => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    dragDepth = 0; overlay.classList.remove('show');
    if (e.dataTransfer.files.length) apriUploadAttive(ctx, ricarica, e.dataTransfer.files);
  });

  renderStats(wrap.querySelector('#stats'), tutte, incassatoMese, incassatoAnno);
  if (state.q) wrap.querySelector('#q').value = state.q;

  // Vedi il commento gemello in dashboard.js: l'archivio si carica solo alla
  // prima apertura del pannello.
  async function caricaArchivio() {
    if (archivioCaricato) return;
    const zona = wrap.querySelector('#archivio-zone');
    clear(zona);
    zona.appendChild(el('<div class="spinner" style="margin:20px auto"></div>'));
    try {
      const righe = await fattureAttive.listArchivio();
      archivioCaricato = true;
      renderTable(zona, righe, ctx, ricarica);
    } catch (e) {
      clear(zona);
      zona.appendChild(el(`<div class="empty-state"><div class="big">⚠️</div><p>Errore: ${esc(e.message)}</p></div>`));
    }
  }
  wrap.querySelector('#archivio').addEventListener('toggle', (e) => { if (e.target.open) caricaArchivio(); });

  function applyFilters() {
    let r = tutte;
    if (state.q) {
      const q = state.q.toLowerCase();
      r = r.filter(f => (f.cliente || '').toLowerCase().includes(q) || (f.numero_fattura || '').toLowerCase().includes(q) || (f.note || '').toLowerCase().includes(q));
    }
    if (state.stato) r = r.filter(f => f.stato === state.stato);
    if (state.importoMin) r = r.filter(f => Number(f.importo) >= Number(state.importoMin));
    if (state.importoMax) r = r.filter(f => Number(f.importo) <= Number(state.importoMax));
    return r;
  }

  function refreshTable() {
    renderTable(wrap.querySelector("#tbl-zone"), applyFilters(), ctx, ricarica);
  }

  // Vedi il commento gemello in dashboard.js: si ricaricano sempre sia il
  // sottoinsieme attivo sia, se il pannello è già aperto, l'archivio.
  async function ricarica() {
    const { oggi, inizioMese, inizioAnno } = confiniPeriodoCorrente();
    let contaArchivio;
    [tutte, incassatoMese, incassatoAnno, contaArchivio] = await Promise.all([
      fattureAttive.listAperte(),
      incassi.sommaPeriodo(inizioMese, oggi),
      incassi.sommaPeriodo(inizioAnno, oggi),
      fattureAttive.contaArchivio(),
    ]);
    renderStats(wrap.querySelector('#stats'), tutte, incassatoMese, incassatoAnno);
    refreshTable();
    wrap.querySelector('#archivio-conta').textContent = contaArchivio;
    if (wrap.querySelector('#archivio').open) { archivioCaricato = false; await caricaArchivio(); }
  }

  const onSearch = debounce(v => { state.q = v; refreshTable(); }, 250);
  wrap.querySelector('#q').addEventListener('input', e => onSearch(e.target.value));
  wrap.querySelector('#f-stato').addEventListener('change', e => { state.stato = e.target.value; refreshTable(); });
  wrap.querySelector('#f-min').addEventListener('input', debounce(e => { state.importoMin = e.target.value; refreshTable(); }, 250));
  wrap.querySelector('#f-max').addEventListener('input', debounce(e => { state.importoMax = e.target.value; refreshTable(); }, 250));
  wrap.querySelector('#f-reset').addEventListener('click', () => {
    Object.assign(state, { q: '', stato: '', importoMin: '', importoMax: '' });
    wrap.querySelectorAll('#q,#f-stato,#f-min,#f-max').forEach(i => i.value = '');
    refreshTable();
  });
  wrap.querySelector('#exp-csv').addEventListener('click', () => exportXLSXAttive(applyFilters()));
  wrap.querySelector('#exp-pdf').addEventListener('click', () => exportPDFAttive(applyFilters()));
  wrap.querySelector('#nuova').addEventListener('click', () => apriEditorAttiva(null, ctx, ricarica));
  wrap.querySelector('#carica').addEventListener('click', () => apriUploadAttive(ctx, ricarica));
  wrap.querySelector('#nuova-nc').addEventListener('click', () => apriNuovaNotaCreditoAttiva(ctx, ricarica));

  refreshTable();
}

// `tutte` è il sottoinsieme "attivo" (fattureAttive.listAperte): esclude le
// fatture chiuse di anni precedenti, ormai in archivio. "Incassato questo
// mese/anno" arriva già calcolato da fuori (incassi.sommaPeriodo,
// indipendente da cosa è archiviato) — vedi il commento gemello in
// dashboard.js.
function renderStats(node, tutte, incassatoMese, incassatoAnno) {
  clear(node);
  const nonIncassate = tutte.filter(f => !STATI_CHIUSI.includes(f.stato));
  const totaleDovuto = nonIncassate.reduce((s, f) => s + f._residuo, 0);
  const oggi = new Date().toISOString().slice(0, 10);
  const annoCorrente = oggi.slice(0, 4);

  const cards = [
    { k: 'DA INCASSARE (TOTALE)', v: fmtEuro(totaleDovuto), s: `${nonIncassate.length} fatture`, cls: 'accent' },
    { k: 'INCASSATO QUESTO MESE', v: fmtEuro(incassatoMese), s: new Date().toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }), cls: 'ok' },
    { k: 'INCASSATO QUEST\'ANNO', v: fmtEuro(incassatoAnno), s: annoCorrente, cls: 'ok' },
  ];
  for (const c of cards) node.appendChild(el(`<div class="stat ${c.cls}"><div class="k">${esc(c.k)}</div><div class="v">${c.v}</div><div class="s">${esc(String(c.s))}</div></div>`));
}

function renderTable(node, righe, ctx, ricarica) {
  clear(node);
  if (!righe.length) { node.appendChild(el(`<div class="empty-state"><div class="big">🧾</div><p>Nessuna fattura trovata con questi filtri.</p></div>`)); return; }
  const table = el(`<table class="tbl tbl-fatture"><thead><tr>
    <th>Cliente</th><th>N. Fattura</th><th>Data</th><th class="money-col">Importo</th><th>Stato</th><th class="money-col">Residuo</th><th>Sollecito</th><th></th>
  </tr></thead><tbody></tbody></table>`);
  const tbody = table.querySelector('tbody');
  for (const f of righe) {
    const tr = el(`<tr>
      <td>${esc(f.cliente)}</td>
      <td>${esc(f.numero_fattura || '—')}</td>
      <td>${fmtDate(f.data_fattura)}</td>
      <td class="money money-col">${fmtEuro(f.importo)}</td>
      <td>
        <span class="chip ${STATO_CHIP[f.stato] || ''}" ${!STATI_CHIUSI.includes(f.stato) ? `data-stato title="Clicca per segnare un incasso"` : ''}>${STATO_LABEL[f.stato] || f.stato}</span>
      </td>
      <td class="money money-col">${fmtEuro(f._residuo)}</td>
      <td><span class="chip ${f.data_sollecito ? 'info' : ''}" data-sollecito title="Clicca per aggiornare il sollecito">${f.data_sollecito ? '🔔 ' + fmtDate(f.data_sollecito) : '— nessuno'}</span></td>
      <td style="text-align:right"><button class="btn ghost sm" data-edit>✏️</button></td>
    </tr>`);
    rendiCliccabile(tr, (e) => { if (!e.target.closest('[data-edit]') && !e.target.closest('[data-stato]') && !e.target.closest('[data-sollecito]')) apriEditorAttiva(f.id, ctx, ricarica); });
    tr.querySelector('[data-edit]').addEventListener('click', (e) => { e.stopPropagation(); apriEditorAttiva(f.id, ctx, ricarica); });
    const chipStato = tr.querySelector('[data-stato]');
    if (chipStato) rendiCliccabile(chipStato, (e) => { e.stopPropagation(); apriIncassoRapido(f, ctx, ricarica); });
    rendiCliccabile(tr.querySelector('[data-sollecito]'), (e) => { e.stopPropagation(); apriSollecitoRapido(f, ctx, ricarica); });
    tbody.appendChild(tr);
  }
  node.appendChild(table);
}
