import { fattureAttive } from '../data/storeAttive.js';
import { el, clear, esc, fmtEuro } from '../lib/ui.js';

const MESI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
const FILTRO_CLIENTE_KEY = 'reportAttive:filtroCliente';

export async function renderReportAttive(view, ctx) {
  let tutte = [];
  try { tutte = await fattureAttive.list(); }
  catch (e) { view.appendChild(el(`<div class="empty-state"><div class="big">⚠️</div><p>Errore nel caricamento: ${esc(e.message)}</p></div>`)); return; }

  // Anni disponibili: dalla data fattura, così anche fatture senza scadenza
  // rientrano nel filtro. Ordinati dal più recente.
  const anni = [...new Set(tutte.filter(f => f.data_fattura).map(f => f.data_fattura.slice(0, 4)))].sort().reverse();
  // Default: dal 1° gennaio dell'anno più recente, senza limite superiore.
  const state = { da: anni[0] ? `${anni[0]}-01-01` : '', a: '', ricerca: '' };

  const wrap = el(`<div>
    <div class="page-head">
      <div><h1>Report</h1><p>Riepilogo di incassi per cliente e nel tempo — Croce Rossa Italiana Genova</p></div>
      <div class="actions">
        <input type="date" id="r-da" title="Data fattura da" value="${esc(state.da)}">
        <input type="date" id="r-a" title="Data fattura a" value="${esc(state.a)}">
        <button class="btn ghost sm" id="r-reset">Tutto il periodo</button>
        <button class="btn" id="r-csv">📊 Esporta per cliente (CSV)</button>
      </div>
    </div>
    <div class="muted" id="r-nota-filtri" style="font-size:13px;margin:-12px 0 10px"></div>
    <div class="grid stats" id="r-stats" style="margin-bottom:22px"></div>
    <div class="card" style="margin-bottom:22px">
      <div class="card-h">
        <span>Incassi per cliente</span>
        <div class="search" style="flex:none;min-width:220px"><span class="search-icon">🔎</span><input type="text" id="r-ricerca" placeholder="Cerca cliente…"></div>
      </div>
      <div class="card-b tbl-wrap" id="r-clienti"></div>
    </div>
    <div class="card">
      <div class="card-h">Andamento mensile</div>
      <div class="card-b tbl-wrap" id="r-mesi" style="padding:18px"></div>
    </div>
  </div>`);
  view.appendChild(wrap);

  wrap.querySelector('#r-da').addEventListener('change', e => { state.da = e.target.value; refresh(); });
  wrap.querySelector('#r-a').addEventListener('change', e => { state.a = e.target.value; refresh(); });
  wrap.querySelector('#r-reset').addEventListener('click', () => {
    state.da = ''; state.a = '';
    wrap.querySelector('#r-da').value = ''; wrap.querySelector('#r-a').value = '';
    refresh();
  });
  wrap.querySelector('#r-ricerca').addEventListener('input', e => { state.ricerca = e.target.value; renderClienti(wrap.querySelector('#r-clienti'), gruppiClienti(), state.ricerca.trim(), ctx); });
  wrap.querySelector('#r-csv').addEventListener('click', () => esportaClientiCSV(gruppiClienti()));

  function filtrate() {
    let r = tutte;
    if (state.da) r = r.filter(f => f.data_fattura && f.data_fattura >= state.da);
    if (state.a) r = r.filter(f => f.data_fattura && f.data_fattura <= state.a);
    return r;
  }

  function gruppiClienti() {
    const gruppi = perCliente(filtrate());
    const termine = state.ricerca.trim().toLowerCase();
    if (!termine) return gruppi;
    return gruppi.filter(g => g.cliente.toLowerCase().includes(termine));
  }

  // Un filtro per data esclude necessariamente le fatture prive di data
  // fattura: senza avvisare, sembrerebbero sparite (stesso avviso della
  // dashboard fatture per il filtro sulla scadenza).
  function mostraNotaFiltri() {
    const zona = wrap.querySelector('#r-nota-filtri');
    const filtroData = !!(state.da || state.a);
    const escluse = filtroData ? tutte.filter(f => !f.data_fattura).length : 0;
    zona.textContent = escluse
      ? escluse + (escluse === 1 ? ' fattura senza data non rientra' : ' fatture senza data non rientrano') + ' nel periodo selezionato.'
      : '';
  }

  function refresh() {
    const righe = filtrate();
    mostraNotaFiltri();
    renderStats(wrap.querySelector('#r-stats'), righe);
    renderClienti(wrap.querySelector('#r-clienti'), gruppiClienti(), state.ricerca.trim(), ctx);
    renderMesiChart(wrap.querySelector('#r-mesi'), perMese(righe, tutte, state.da, state.a));
  }

  refresh();
}

// Giorni impiegati a incassare una fattura: da data_fattura all'ultimo
// incasso REALE registrato (mai la data di una nota di credito). Ha senso
// solo per fatture chiuse per intero (stato 'incassata' o 'stornata') — un
// acconto parziale non dice quando la fattura sarà chiusa. Vedi il commento
// gemello in report.js per il caso "stornata con almeno un incasso vero".
function giorniIncasso(f) {
  const chiusa = f.stato === 'incassata' || f.stato === 'stornata';
  if (!chiusa || !f.data_fattura || !(f.incassi || []).length) return null;
  const ultimo = f.incassi.reduce((max, p) => (p.data_incasso && p.data_incasso > max ? p.data_incasso : max), '');
  if (!ultimo) return null;
  const a = new Date(f.data_fattura + 'T00:00:00');
  const b = new Date(ultimo + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}

function media(numeri) {
  return numeri.length ? numeri.reduce((s, n) => s + n, 0) / numeri.length : null;
}

function renderStats(node, righe) {
  clear(node);
  const fatturato = righe.reduce((s, f) => s + Number(f.importo || 0), 0);
  const incassato = righe.reduce((s, f) => s + f._incassato, 0);
  const stornato = righe.reduce((s, f) => s + (f._stornato || 0), 0);
  const residuo = righe.reduce((s, f) => s + f._residuo, 0);
  const giorni = righe.map(giorniIncasso).filter(g => g !== null);
  const mediaGiorni = media(giorni);
  const cards = [
    { k: 'FATTURATO', v: fmtEuro(fatturato), s: `${righe.length} fatture`, cls: 'accent' },
    { k: 'INCASSATO', v: fmtEuro(incassato), s: fatturato ? Math.round(incassato / fatturato * 100) + '% del totale' : '—', cls: 'ok' },
    { k: 'DA INCASSARE', v: fmtEuro(residuo), s: righe.filter(f => f._residuo > 0).length + ' fatture aperte', cls: residuo > 0 ? 'warn' : '' },
    { k: 'TEMPO MEDIO DI INCASSO', v: mediaGiorni !== null ? Math.round(mediaGiorni) + ' giorni' : '—', s: `${giorni.length} fatture chiuse`, cls: '' },
  ];
  if (stornato > 0) cards.push({ k: 'STORNATO (NOTE DI CREDITO)', v: fmtEuro(stornato), s: righe.filter(f => f._stornato > 0).length + ' fatture', cls: '' });
  for (const c of cards) node.appendChild(el(`<div class="stat ${c.cls}"><div class="k">${esc(c.k)}</div><div class="v">${c.v}</div><div class="s">${esc(String(c.s))}</div></div>`));
}

// Raggruppa per cliente, ordinato alfabeticamente.
function perCliente(righe) {
  const mappa = new Map();
  for (const f of righe) {
    const chiave = f.cliente || '—';
    const g = mappa.get(chiave) || { cliente: chiave, n: 0, fatturato: 0, incassato: 0, stornato: 0, residuo: 0, giorni: [] };
    g.n++; g.fatturato += Number(f.importo || 0); g.incassato += f._incassato; g.stornato += (f._stornato || 0); g.residuo += f._residuo;
    const gi = giorniIncasso(f);
    if (gi !== null) g.giorni.push(gi);
    mappa.set(chiave, g);
  }
  for (const g of mappa.values()) g.giorniMedi = media(g.giorni);
  return [...mappa.values()].sort((a, b) => a.cliente.localeCompare(b.cliente));
}

// Cliccando una riga si passa alla dashboard fatture attive già filtrata su
// quel cliente (via sessionStorage, letto una tantum da renderDashboardAttive).
function renderClienti(node, gruppi, ricerca, ctx) {
  clear(node);
  if (!gruppi.length) {
    const msg = ricerca ? `Nessun cliente trovato per "${esc(ricerca)}".` : 'Nessuna fattura nel periodo selezionato.';
    node.appendChild(el(`<div class="empty-state"><div class="big">🧾</div><p>${msg}</p></div>`));
    return;
  }
  const mostraStornato = gruppi.some(g => g.stornato > 0);
  const table = el(`<table class="tbl"><thead><tr>
    <th>Cliente</th><th>N. Fatture</th><th class="money-col">Fatturato</th><th class="money-col">Incassato</th>${mostraStornato ? '<th class="money-col">Stornato</th>' : ''}<th class="money-col">Residuo</th><th>Giorni medi incasso</th>
  </tr></thead><tbody></tbody></table>`);
  const tbody = table.querySelector('tbody');
  for (const g of gruppi) {
    const tr = el(`<tr title="Vedi le fatture di ${esc(g.cliente)}">
      <td>${esc(g.cliente)}</td>
      <td>${g.n}</td>
      <td class="money money-col">${fmtEuro(g.fatturato)}</td>
      <td class="money money-col">${fmtEuro(g.incassato)}</td>
      ${mostraStornato ? `<td class="money money-col">${fmtEuro(g.stornato)}</td>` : ''}
      <td class="money money-col">${fmtEuro(g.residuo)}</td>
      <td>${g.giorniMedi !== null ? Math.round(g.giorniMedi) + ' gg' : '—'}</td>
    </tr>`);
    tr.addEventListener('click', () => {
      sessionStorage.setItem(FILTRO_CLIENTE_KEY, g.cliente === '—' ? '' : g.cliente);
      ctx.go('#/attive/fatture');
    });
    tbody.appendChild(tr);
  }
  node.appendChild(table);
}

// Fatturato del mese = fatture con data_fattura in quel mese (usa
// `righeFatturato`, già filtrato per periodo se selezionato). Incassato del
// mese = incassi effettuati in quel mese, DI QUALUNQUE FATTURA anche se
// datata fuori dal periodo — per questo scorre sempre `tutte`, l'elenco
// completo non filtrato, e filtra i singoli incassi per data, non per la
// fattura di appartenenza: sono due cose distinte e vanno lette come tali,
// non sommate.
function perMese(righeFatturato, tutte, da, a) {
  const mappa = new Map();
  const key = (iso) => iso.slice(0, 7);
  const voce = (k) => {
    if (!mappa.has(k)) mappa.set(k, { chiave: k, fatturato: 0, incassato: 0 });
    return mappa.get(k);
  };
  for (const f of righeFatturato) {
    if (!f.data_fattura) continue;
    voce(key(f.data_fattura)).fatturato += Number(f.importo || 0);
  }
  for (const f of tutte) {
    for (const p of (f.incassi || [])) {
      if (!p.data_incasso) continue;
      if (da && p.data_incasso < da) continue; // l'incasso può cadere fuori dal periodo della fattura
      if (a && p.data_incasso > a) continue;
      voce(key(p.data_incasso)).incassato += Number(p.importo || 0);
    }
  }
  return [...mappa.values()].sort((a, b) => a.chiave.localeCompare(b.chiave));
}

// Grafico a barre (fatturato vs incassato per mese) invece di una tabella:
// vedi il commento gemello in report.js.
function renderMesiChart(node, righe) {
  clear(node);
  if (!righe.length) { node.appendChild(el(`<div class="empty-state"><div class="big">📅</div><p>Nessun dato nel periodo selezionato.</p></div>`)); return; }
  const maxVal = Math.max(1, ...righe.flatMap(r => [r.fatturato, r.incassato]));
  const slotW = 64, barW = 22, barGap = 4, chartH = 190, padTop = 6, padBottom = 30, padX = 14;
  const W = righe.length * slotW + padX * 2;
  const H = chartH + padTop + padBottom;
  const scale = v => Math.round((v / maxVal) * chartH);

  let bars = '';
  righe.forEach((r, i) => {
    const x0 = padX + i * slotW;
    const hF = scale(r.fatturato), hI = scale(r.incassato);
    const [anno, mese] = r.chiave.split('-');
    const etichetta = `${MESI[Number(mese) - 1] || mese} ${anno.slice(2)}`;
    bars += `
      <rect x="${x0}" y="${padTop + chartH - hF}" width="${barW}" height="${hF}" rx="3" fill="var(--cri-red)"><title>${esc(etichetta)} — Fatturato: ${esc(fmtEuro(r.fatturato))}</title></rect>
      <rect x="${x0 + barW + barGap}" y="${padTop + chartH - hI}" width="${barW}" height="${hI}" rx="3" fill="var(--ok)"><title>${esc(etichetta)} — Incassato: ${esc(fmtEuro(r.incassato))}</title></rect>
      <text x="${x0 + barW + barGap / 2}" y="${padTop + chartH + 18}" text-anchor="middle" font-size="11" fill="var(--ink-soft)">${esc(etichetta)}</text>`;
  });

  node.appendChild(el(`<div>
    <div style="display:flex;gap:16px;align-items:center;margin-bottom:10px;font-size:12.5px;color:var(--ink-soft)">
      <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:var(--cri-red);margin-right:5px;vertical-align:middle"></span>Fatturato</span>
      <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:var(--ok);margin-right:5px;vertical-align:middle"></span>Incassato</span>
    </div>
    <svg width="${W}" height="${H}" style="display:block">
      <line x1="${padX}" y1="${padTop + chartH}" x2="${W - padX}" y2="${padTop + chartH}" stroke="var(--line)" stroke-width="1"/>
      ${bars}
    </svg>
  </div>`));
}

function esportaClientiCSV(gruppi) {
  const lines = ['Cliente;N. Fatture;Fatturato;Incassato;Stornato;Residuo;Giorni medi incasso'];
  for (const g of gruppi) {
    lines.push([g.cliente, g.n, g.fatturato.toFixed(2).replace('.', ','), g.incassato.toFixed(2).replace('.', ','), g.stornato.toFixed(2).replace('.', ','), g.residuo.toFixed(2).replace('.', ','), g.giorniMedi !== null ? Math.round(g.giorniMedi) : '']
      .map(v => '"' + String(v).replace(/"/g, '""') + '"').join(';'));
  }
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'report-clienti.csv';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export { FILTRO_CLIENTE_KEY };
