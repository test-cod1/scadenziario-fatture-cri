import { fatture, proposte } from '../data/store.js';
import { el, clear, esc, fmtDate, fmtEuro, giorniDa, debounce, toast, rendiCliccabile } from '../lib/ui.js';
import { exportCSV, exportPDF } from '../lib/export.js';
import { apriEditor, apriUpload, apriPagamentoRapido, apriProponiPagamento, apriNuovaNotaCredito } from './fattura.js';
import { FILTRO_FORNITORE_KEY } from './report.js';

const STATO_LABEL = { da_pagare: 'Da pagare', pagata_parziale: 'Pagata parz.', pagata: 'Pagata', stornata: 'Stornata' };
const STATO_CHIP = { da_pagare: 'warn', pagata_parziale: 'red', pagata: 'ok', stornata: 'info' };
const STATI_CHIUSI = ['pagata', 'stornata']; // niente altro da pagare: il chip non apre più pagamento/proposta

export async function renderDashboard(view, ctx) {
  let tutte = [];
  try { tutte = await fatture.list(); }
  catch (e) { view.appendChild(el(`<div class="empty-state"><div class="big">⚠️</div><p>Errore nel caricamento: ${esc(e.message)}</p></div>`)); return; }
  let proposteInAttesa = await caricaProposteInAttesa();

  const state = { q: '', stato: '', da: '', aData: '', importoMin: '', importoMax: '' };
  // Arrivo da un click su un fornitore nel Report: preimposta la ricerca e
  // consuma subito la chiave, altrimenti resterebbe applicata a ogni rientro
  // nella dashboard finché non viene aperto di nuovo il Report.
  const filtroFornitore = sessionStorage.getItem(FILTRO_FORNITORE_KEY);
  if (filtroFornitore !== null) { state.q = filtroFornitore; sessionStorage.removeItem(FILTRO_FORNITORE_KEY); }

  const wrap = el(`<div>
    <div class="page-head">
      <div><h1>Scadenziario Fatture</h1><p>Fatture fornitori — Croce Rossa Italiana Genova</p></div>
      <div class="actions">
        <button class="btn" id="exp-csv">📊 Esporta Excel (CSV)</button>
        <button class="btn" id="exp-pdf">🖨️ Esporta PDF</button>
        <button class="btn" id="carica">📎 Carica PDF/XML</button>
        <button class="btn" id="nuova-nc">+ Nota di credito</button>
        <button class="btn primary" id="nuova">+ Nuova fattura</button>
      </div>
    </div>
    <div id="alert-zone"></div>
    <div class="grid stats" id="stats" style="margin-bottom:22px"></div>
    <div class="toolbar">
      <div class="search"><span class="search-icon">🔎</span><input type="text" id="q" placeholder="Cerca fornitore, numero fattura, note…"></div>
      <select id="f-stato">
        <option value="">Tutti gli stati</option>
        <option value="da_pagare">Da pagare</option>
        <option value="pagata_parziale">Pagata parzialmente</option>
        <option value="pagata">Pagata</option>
        <option value="stornata">Stornata</option>
      </select>
      <input type="date" id="f-da" title="Scadenza da">
      <input type="date" id="f-a" title="Scadenza a">
      <input type="number" id="f-min" placeholder="Importo min €" style="width:120px">
      <input type="number" id="f-max" placeholder="Importo max €" style="width:120px">
      <button class="btn ghost sm" id="f-reset">Azzera filtri</button>
    </div>
    <div class="muted" id="nota-filtri" style="font-size:13px;margin:-8px 0 10px"></div>
    <div class="card"><div class="card-b tbl-wrap" id="tbl-zone"></div></div>
    <div class="drop-page-overlay" id="drop-overlay"><div class="box">📎 Rilascia qui i file per caricare le fatture</div></div>
  </div>`);
  view.appendChild(wrap);

  // Drag&drop di file PDF/immagini/XML ovunque sulla pagina, non solo dal
  // pulsante "Carica PDF/XML": conta gli enter/leave perché dragleave scatta
  // anche passando sopra un elemento figlio, non solo uscendo dalla pagina.
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
    if (e.dataTransfer.files.length) apriUpload(ctx, ricarica, e.dataTransfer.files);
  });

  renderStats(wrap.querySelector('#stats'), tutte);
  renderAlert(wrap.querySelector('#alert-zone'), tutte);
  if (state.q) wrap.querySelector('#q').value = state.q;

  function applyFilters() {
    let r = tutte;
    if (state.q) {
      const q = state.q.toLowerCase();
      r = r.filter(f => (f.fornitore || '').toLowerCase().includes(q) || (f.numero_fattura || '').toLowerCase().includes(q) || (f.note || '').toLowerCase().includes(q));
    }
    if (state.stato) r = r.filter(f => f.stato === state.stato);
    if (state.da) r = r.filter(f => f.scadenza && f.scadenza >= state.da);
    if (state.aData) r = r.filter(f => f.scadenza && f.scadenza <= state.aData);
    if (state.importoMin) r = r.filter(f => Number(f.importo) >= Number(state.importoMin));
    if (state.importoMax) r = r.filter(f => Number(f.importo) <= Number(state.importoMax));
    return r;
  }

  function refreshTable() {
    renderTable(wrap.querySelector("#tbl-zone"), applyFilters(), ctx, ricarica, proposteInAttesa);
    mostraNotaSenzaScadenza();
  }

  // Un filtro per data esclude necessariamente le fatture prive di scadenza:
  // senza avvisare, sembravano sparite. Qui lo si dice esplicitamente.
  function mostraNotaSenzaScadenza() {
    const zona = wrap.querySelector("#nota-filtri");
    const filtroData = !!(state.da || state.aData);
    const escluse = filtroData ? tutte.filter(f => !f.scadenza).length : 0;
    zona.textContent = escluse
      ? escluse + (escluse === 1 ? " fattura senza data di scadenza non rientra" : " fatture senza data di scadenza non rientrano") + " nel filtro per data."
      : "";
  }

  async function ricarica() {
    tutte = await fatture.list();
    proposteInAttesa = await caricaProposteInAttesa();
    renderStats(wrap.querySelector('#stats'), tutte);
    renderAlert(wrap.querySelector('#alert-zone'), tutte);
    refreshTable();
  }

  const onSearch = debounce(v => { state.q = v; refreshTable(); }, 250);
  wrap.querySelector('#q').addEventListener('input', e => onSearch(e.target.value));
  wrap.querySelector('#f-stato').addEventListener('change', e => { state.stato = e.target.value; refreshTable(); });
  wrap.querySelector('#f-da').addEventListener('change', e => { state.da = e.target.value; refreshTable(); });
  wrap.querySelector('#f-a').addEventListener('change', e => { state.aData = e.target.value; refreshTable(); });
  wrap.querySelector('#f-min').addEventListener('input', debounce(e => { state.importoMin = e.target.value; refreshTable(); }, 250));
  wrap.querySelector('#f-max').addEventListener('input', debounce(e => { state.importoMax = e.target.value; refreshTable(); }, 250));
  wrap.querySelector('#f-reset').addEventListener('click', () => {
    Object.assign(state, { q: '', stato: '', da: '', aData: '', importoMin: '', importoMax: '' });
    wrap.querySelectorAll('#q,#f-stato,#f-da,#f-a,#f-min,#f-max').forEach(i => i.value = '');
    refreshTable();
  });
  wrap.querySelector('#exp-csv').addEventListener('click', () => exportCSV(applyFilters()));
  wrap.querySelector('#exp-pdf').addEventListener('click', () => exportPDF(applyFilters()));
  wrap.querySelector('#nuova').addEventListener('click', () => apriEditor(null, ctx, ricarica));
  wrap.querySelector('#carica').addEventListener('click', () => apriUpload(ctx, ricarica));
  wrap.querySelector('#nuova-nc').addEventListener('click', () => apriNuovaNotaCredito(ctx, ricarica));

  refreshTable();
}

// Mappa fattura_id -> n. proposte in attesa: usata solo per mostrare un
// avviso accanto allo stato, così non si propone due volte la stessa cosa
// senza accorgersene. Se la tabella non esiste ancora (patch SQL non
// eseguita) si degrada in silenzio a "nessuna proposta", senza rompere la
// dashboard.
async function caricaProposteInAttesa() {
  try {
    const righe = await proposte.list();
    const mappa = new Map();
    for (const r of righe) if (r.stato === 'proposta') mappa.set(r.fattura_id, (mappa.get(r.fattura_id) || 0) + 1);
    return mappa;
  } catch { return new Map(); }
}

function renderStats(node, tutte) {
  clear(node);
  const nonPagate = tutte.filter(f => !STATI_CHIUSI.includes(f.stato));
  const totaleDovuto = nonPagate.reduce((s, f) => s + f._residuo, 0);
  const oggi = new Date().toISOString().slice(0, 10);
  const scadute = nonPagate.filter(f => f.scadenza && f.scadenza < oggi);
  const totaleScaduto = scadute.reduce((s, f) => s + f._residuo, 0);
  const meseCorrente = oggi.slice(0, 7);
  const annoCorrente = oggi.slice(0, 4);
  const pagatoMese = tutte.reduce((s, f) => s + (f.pagamenti || []).filter(p => (p.data_pagamento || '').slice(0, 7) === meseCorrente).reduce((a, p) => a + Number(p.importo || 0), 0), 0);
  const pagatoAnno = tutte.reduce((s, f) => s + (f.pagamenti || []).filter(p => (p.data_pagamento || '').slice(0, 4) === annoCorrente).reduce((a, p) => a + Number(p.importo || 0), 0), 0);
  const inScadenza7 = nonPagate.filter(f => { const g = giorniDa(f.scadenza); return g !== null && g >= 0 && g <= 7; });

  const cards = [
    { k: 'DA PAGARE (TOTALE)', v: fmtEuro(totaleDovuto), s: `${nonPagate.length} fatture`, cls: 'accent' },
    { k: 'SCADUTO E NON PAGATO', v: fmtEuro(totaleScaduto), s: `${scadute.length} fatture in ritardo`, cls: totaleScaduto > 0 ? 'warn' : '' },
    { k: 'IN SCADENZA (7 GIORNI)', v: inScadenza7.length, s: fmtEuro(inScadenza7.reduce((s, f) => s + f._residuo, 0)), cls: '' },
    { k: 'PAGATO QUESTO MESE', v: fmtEuro(pagatoMese), s: new Date().toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }), cls: 'ok' },
    { k: 'PAGATO QUEST\'ANNO', v: fmtEuro(pagatoAnno), s: annoCorrente, cls: 'ok' },
  ];
  for (const c of cards) node.appendChild(el(`<div class="stat ${c.cls}"><div class="k">${esc(c.k)}</div><div class="v">${c.v}</div><div class="s">${esc(String(c.s))}</div></div>`));
}

function renderAlert(node, tutte) {
  clear(node);
  const oggi = new Date().toISOString().slice(0, 10);
  const nonPagate = tutte.filter(f => !STATI_CHIUSI.includes(f.stato) && f.scadenza);
  const scadute = nonPagate.filter(f => f.scadenza < oggi);
  const entro7 = nonPagate.filter(f => { const g = giorniDa(f.scadenza); return g >= 0 && g <= 7; });
  if (!scadute.length && !entro7.length) return;
  const parts = [];
  if (scadute.length) parts.push(`<b>⚠️ ${scadute.length} fattura/e scadute e non pagate</b>`);
  if (entro7.length) parts.push(`<div style="margin-top:${scadute.length ? '10px' : '0'}"><b>⏰ ${entro7.length} fattura/e in scadenza nei prossimi 7 giorni</b></div>`);
  node.appendChild(el(`<div class="banner ${scadute.length ? 'danger' : 'warn'}"><div class="bi">${scadute.length ? '⚠️' : '⏰'}</div><div>${parts.join('')}</div></div>`));
}

function renderTable(node, righe, ctx, ricarica, proposteInAttesa) {
  clear(node);
  if (!righe.length) { node.appendChild(el(`<div class="empty-state"><div class="big">🧾</div><p>Nessuna fattura trovata con questi filtri.</p></div>`)); return; }
  const isAdmin = ctx.user.ruolo === 'admin';
  const azione = isAdmin ? apriPagamentoRapido : apriProponiPagamento;
  const titoloChip = isAdmin ? 'Clicca per segnare un pagamento' : 'Clicca per proporre un pagamento';
  const oggi = new Date().toISOString().slice(0, 10);
  const table = el(`<table class="tbl tbl-fatture"><thead><tr>
    <th>Fornitore</th><th>N. Fattura</th><th>Data</th><th class="money-col">Importo</th><th>Scadenza</th><th>Stato</th><th class="money-col">Residuo</th><th></th>
  </tr></thead><tbody></tbody></table>`);
  const tbody = table.querySelector('tbody');
  for (const f of righe) {
    const scaduta = !STATI_CHIUSI.includes(f.stato) && f.scadenza && f.scadenza < oggi;
    const nProposte = proposteInAttesa ? (proposteInAttesa.get(f.id) || 0) : 0;
    const tr = el(`<tr class="${scaduta ? 'scaduta' : ''}">
      <td>${esc(f.fornitore)}</td>
      <td>${esc(f.numero_fattura || '—')}</td>
      <td>${fmtDate(f.data_fattura)}</td>
      <td class="money money-col">${fmtEuro(f.importo)}</td>
      <td>${fmtDate(f.scadenza)}</td>
      <td>
        <span class="chip ${STATO_CHIP[f.stato] || ''}" ${!STATI_CHIUSI.includes(f.stato) ? `data-stato title="${esc(titoloChip)}"` : ''}>${STATO_LABEL[f.stato] || f.stato}</span>
        ${nProposte ? `<span class="chip" title="${isAdmin ? 'In attesa di conferma' : 'Hai già una proposta in attesa per questa fattura'}" style="margin-left:4px">📨 ${nProposte}</span>` : ''}
      </td>
      <td class="money money-col">${fmtEuro(f._residuo)}</td>
      <td style="text-align:right"><button class="btn ghost sm" data-edit>✏️</button></td>
    </tr>`);
    rendiCliccabile(tr, (e) => { if (!e.target.closest('[data-edit]') && !e.target.closest('[data-stato]')) apriEditor(f.id, ctx, ricarica); });
    tr.querySelector('[data-edit]').addEventListener('click', (e) => { e.stopPropagation(); apriEditor(f.id, ctx, ricarica); });
    const chipStato = tr.querySelector('[data-stato]');
    if (chipStato) rendiCliccabile(chipStato, (e) => { e.stopPropagation(); azione(f, ctx, ricarica); });
    tbody.appendChild(tr);
  }
  node.appendChild(table);
}
