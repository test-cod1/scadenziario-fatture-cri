import { fatture } from '../data/store.js';
import { el, clear, esc, fmtEuro } from '../lib/ui.js';

const MESI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
const FILTRO_FORNITORE_KEY = 'report:filtroFornitore';

export async function renderReport(view, ctx) {
  let tutte = [];
  try { tutte = await fatture.list(); }
  catch (e) { view.appendChild(el(`<div class="empty-state"><div class="big">⚠️</div><p>Errore nel caricamento: ${esc(e.message)}</p></div>`)); return; }

  // Anni disponibili: dalla data fattura, così anche fatture senza scadenza
  // rientrano nel filtro. Ordinati dal più recente.
  const anni = [...new Set(tutte.filter(f => f.data_fattura).map(f => f.data_fattura.slice(0, 4)))].sort().reverse();
  // Default: dal 1° gennaio dell'anno più recente, senza limite superiore —
  // stesso periodo mostrato di default prima dell'introduzione dell'intervallo.
  const state = { da: anni[0] ? `${anni[0]}-01-01` : '', a: '', ricerca: '', sort: { campo: 'fornitore', dir: 'asc' } };

  const wrap = el(`<div>
    <div class="page-head">
      <div><h1>Report</h1><p>Riepilogo di spesa per fornitore e nel tempo — Croce Rossa Italiana Genova</p></div>
      <div class="actions">
        <input type="date" id="r-da" title="Data fattura da" value="${esc(state.da)}">
        <input type="date" id="r-a" title="Data fattura a" value="${esc(state.a)}">
        <button class="btn ghost sm" id="r-reset">Tutto il periodo</button>
        <button class="btn" id="r-csv">📊 Esporta per fornitore (CSV)</button>
      </div>
    </div>
    <div class="muted" id="r-nota-filtri" style="font-size:13px;margin:-12px 0 10px"></div>
    <div class="grid stats" id="r-stats" style="margin-bottom:22px"></div>
    <div class="card" style="margin-bottom:22px">
      <div class="card-h">
        <span>Spesa per fornitore</span>
        <div class="search" style="flex:none;min-width:220px"><span class="search-icon">🔎</span><input type="text" id="r-ricerca" placeholder="Cerca fornitore…"></div>
      </div>
      <div class="card-b tbl-wrap" id="r-fornitori"></div>
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
  wrap.querySelector('#r-ricerca').addEventListener('input', e => { state.ricerca = e.target.value; disegnaFornitori(); });
  wrap.querySelector('#r-csv').addEventListener('click', () => esportaFornitoriCSV(gruppiFornitori()));

  function filtrate() {
    let r = tutte;
    if (state.da) r = r.filter(f => f.data_fattura && f.data_fattura >= state.da);
    if (state.a) r = r.filter(f => f.data_fattura && f.data_fattura <= state.a);
    return r;
  }

  function gruppiFornitori() {
    let gruppi = perFornitore(filtrate());
    const termine = state.ricerca.trim().toLowerCase();
    if (termine) gruppi = gruppi.filter(g => g.fornitore.toLowerCase().includes(termine));
    return ordina(gruppi, state.sort, 'fornitore');
  }

  // Clic sull'intestazione: stesso campo -> inverte il verso; campo diverso
  // -> lo attiva con il verso più utile (testo: crescente; numeri: dal più
  // alto, per vedere subito chi pesa di più senza dover invertire a mano).
  function disegnaFornitori() {
    renderFornitori(wrap.querySelector('#r-fornitori'), gruppiFornitori(), state.ricerca.trim(), ctx, state.sort, campo => {
      if (state.sort.campo === campo) state.sort.dir = state.sort.dir === 'asc' ? 'desc' : 'asc';
      else state.sort = { campo, dir: campo === 'fornitore' ? 'asc' : 'desc' };
      disegnaFornitori();
    });
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
    disegnaFornitori();
    renderMesiChart(wrap.querySelector('#r-mesi'), perMese(righe, tutte, state.da, state.a));
  }

  refresh();
}

// Giorni impiegati a saldare una fattura: da data_fattura all'ultimo
// pagamento REALE registrato (mai la data di una nota di credito). Ha senso
// solo per fatture chiuse per intero (stato 'pagata' o 'stornata') — un
// acconto parziale non dice quando la fattura sarà chiusa. Una fattura
// chiusa "stornata" ma con almeno un pagamento vero (es. saldata al 95% e
// stornata per il resto con una nota di credito) va comunque contata: ha un
// vero tempo di pagamento da misurare, solo il residuo non è stato pagato
// in denaro. Una fattura stornata SENZA alcun pagamento reale (chiusa solo
// da nota di credito) resta esclusa, perché non c'è nulla da misurare.
function giorniPagamento(f) {
  const chiusa = f.stato === 'pagata' || f.stato === 'stornata';
  if (!chiusa || !f.data_fattura || !(f.pagamenti || []).length) return null;
  const ultimo = f.pagamenti.reduce((max, p) => (p.data_pagamento && p.data_pagamento > max ? p.data_pagamento : max), '');
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
  const pagato = righe.reduce((s, f) => s + f._pagato, 0);
  const stornato = righe.reduce((s, f) => s + (f._stornato || 0), 0);
  const residuo = righe.reduce((s, f) => s + f._residuo, 0);
  const giorni = righe.map(giorniPagamento).filter(g => g !== null);
  const mediaGiorni = media(giorni);
  const cards = [
    { k: 'FATTURATO', v: fmtEuro(fatturato), s: `${righe.length} fatture`, cls: 'accent' },
    { k: 'PAGATO', v: fmtEuro(pagato), s: fatturato ? Math.round(pagato / fatturato * 100) + '% del totale' : '—', cls: 'ok' },
    { k: 'DA PAGARE', v: fmtEuro(residuo), s: righe.filter(f => f._residuo > 0).length + ' fatture aperte', cls: residuo > 0 ? 'warn' : '' },
    { k: 'TEMPO MEDIO DI PAGAMENTO', v: mediaGiorni !== null ? Math.round(mediaGiorni) + ' giorni' : '—', s: `${giorni.length} fatture saldate`, cls: '' },
  ];
  if (stornato > 0) cards.push({ k: 'STORNATO (NOTE DI CREDITO)', v: fmtEuro(stornato), s: righe.filter(f => f._stornato > 0).length + ' fatture', cls: '' });
  for (const c of cards) node.appendChild(el(`<div class="stat ${c.cls}"><div class="k">${esc(c.k)}</div><div class="v">${c.v}</div><div class="s">${esc(String(c.s))}</div></div>`));
}

// Raggruppa per fornitore (l'ordine lo decide poi `ordina`, in base
// all'intestazione su cui l'utente ha cliccato).
function perFornitore(righe) {
  const mappa = new Map();
  for (const f of righe) {
    const chiave = f.fornitore || '—';
    const g = mappa.get(chiave) || { fornitore: chiave, n: 0, fatturato: 0, pagato: 0, stornato: 0, residuo: 0, giorni: [] };
    g.n++; g.fatturato += Number(f.importo || 0); g.pagato += f._pagato; g.stornato += (f._stornato || 0); g.residuo += f._residuo;
    const gp = giorniPagamento(f);
    if (gp !== null) g.giorni.push(gp);
    mappa.set(chiave, g);
  }
  for (const g of mappa.values()) g.giorniMedi = media(g.giorni);
  return [...mappa.values()];
}

// Ordina un array di gruppi (fornitori/clienti) secondo {campo, dir}. Il
// campo testuale (`campoTesto`) usa il confronto alfabetico; tutti gli altri
// sono numerici, con i valori nulli (giorni medi quando non c'è ancora
// nessuna fattura chiusa) sempre in fondo indipendentemente dal verso —
// altrimenti invertendo l'ordine finirebbero in cima, il che non ha senso
// per un dato che semplicemente manca.
function ordina(gruppi, sort, campoTesto) {
  const { campo, dir } = sort;
  const mul = dir === 'desc' ? -1 : 1;
  const arr = [...gruppi];
  arr.sort((a, b) => {
    if (campo === campoTesto) return a[campo].localeCompare(b[campo]) * mul;
    const va = a[campo], vb = b[campo];
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    return (va - vb) * mul;
  });
  return arr;
}

// Etichetta di un'intestazione cliccabile per l'ordinamento, con la
// freccina sulla colonna attiva.
function thOrdinabile(label, campo, extraClass, sort) {
  const attiva = sort.campo === campo;
  const freccia = attiva ? (sort.dir === 'desc' ? ' ▼' : ' ▲') : '';
  return `<th${extraClass ? ` class="${extraClass}"` : ''} data-sort="${campo}" style="cursor:pointer;user-select:none">${esc(label)}${freccia}</th>`;
}

// Cliccando una riga si passa alla dashboard fatture già filtrata su quel
// fornitore (via sessionStorage, letto una tantum da renderDashboard): utile
// quando un residuo alto fa venire la domanda "quali fatture pesano?".
function renderFornitori(node, gruppi, ricerca, ctx, sort, onSort) {
  clear(node);
  if (!gruppi.length) {
    const msg = ricerca ? `Nessun fornitore trovato per "${esc(ricerca)}".` : 'Nessuna fattura nel periodo selezionato.';
    node.appendChild(el(`<div class="empty-state"><div class="big">🧾</div><p>${msg}</p></div>`));
    return;
  }
  const mostraStornato = gruppi.some(g => g.stornato > 0);
  const table = el(`<table class="tbl"><thead><tr>
    ${thOrdinabile('Fornitore', 'fornitore', '', sort)}
    ${thOrdinabile('N. Fatture', 'n', '', sort)}
    ${thOrdinabile('Fatturato', 'fatturato', 'money-col', sort)}
    ${thOrdinabile('Pagato', 'pagato', 'money-col', sort)}
    ${mostraStornato ? thOrdinabile('Stornato', 'stornato', 'money-col', sort) : ''}
    ${thOrdinabile('Residuo', 'residuo', 'money-col', sort)}
    ${thOrdinabile('Giorni medi pagamento', 'giorniMedi', '', sort)}
  </tr></thead><tbody></tbody></table>`);
  table.querySelectorAll('th[data-sort]').forEach(th => th.addEventListener('click', () => onSort(th.dataset.sort)));
  const tbody = table.querySelector('tbody');
  for (const g of gruppi) {
    const tr = el(`<tr title="Vedi le fatture di ${esc(g.fornitore)}">
      <td>${esc(g.fornitore)}</td>
      <td>${g.n}</td>
      <td class="money money-col">${fmtEuro(g.fatturato)}</td>
      <td class="money money-col">${fmtEuro(g.pagato)}</td>
      ${mostraStornato ? `<td class="money money-col">${fmtEuro(g.stornato)}</td>` : ''}
      <td class="money money-col">${fmtEuro(g.residuo)}</td>
      <td>${g.giorniMedi !== null ? Math.round(g.giorniMedi) + ' gg' : '—'}</td>
    </tr>`);
    tr.addEventListener('click', () => {
      sessionStorage.setItem(FILTRO_FORNITORE_KEY, g.fornitore === '—' ? '' : g.fornitore);
      ctx.go('#/passive/fatture');
    });
    tbody.appendChild(tr);
  }
  node.appendChild(table);
}

// Fatturato del mese = fatture con data_fattura in quel mese (usa
// `righeFatturato`, già filtrato per periodo se selezionato). Pagato del
// mese = pagamenti effettuati in quel mese, DI QUALUNQUE FATTURA anche se
// datata fuori dal periodo (fattura di dicembre pagata a gennaio è tutt'altro
// che rara) — per questo scorre sempre `tutte`, l'elenco completo non
// filtrato, e filtra i singoli pagamenti per data, non per la fattura di
// appartenenza: sono due cose distinte e vanno lette come tali, non sommate.
function perMese(righeFatturato, tutte, da, a) {
  const mappa = new Map();
  const key = (iso) => iso.slice(0, 7);
  const voce = (k) => {
    if (!mappa.has(k)) mappa.set(k, { chiave: k, fatturato: 0, pagato: 0 });
    return mappa.get(k);
  };
  for (const f of righeFatturato) {
    if (!f.data_fattura) continue;
    voce(key(f.data_fattura)).fatturato += Number(f.importo || 0);
  }
  for (const f of tutte) {
    for (const p of (f.pagamenti || [])) {
      if (!p.data_pagamento) continue;
      if (da && p.data_pagamento < da) continue; // il pagamento può cadere fuori dal periodo della fattura
      if (a && p.data_pagamento > a) continue;
      voce(key(p.data_pagamento)).pagato += Number(p.importo || 0);
    }
  }
  return [...mappa.values()].sort((a, b) => a.chiave.localeCompare(b.chiave));
}

// Grafico a barre (fatturato vs pagato per mese) invece di una tabella: con
// più di un paio di mesi una tabella di sole cifre non fa vedere trend o
// stagionalità a colpo d'occhio. Dimensioni in pixel reali (non viewBox
// scalato): con molti mesi il grafico scorre in orizzontale come farebbe una
// tabella larga, invece di schiacciarsi. Il valore esatto resta comunque
// consultabile passandoci sopra (tooltip nativo del <title> nell'SVG).
function renderMesiChart(node, righe) {
  clear(node);
  if (!righe.length) { node.appendChild(el(`<div class="empty-state"><div class="big">📅</div><p>Nessun dato nel periodo selezionato.</p></div>`)); return; }
  const maxVal = Math.max(1, ...righe.flatMap(r => [r.fatturato, r.pagato]));
  const slotW = 64, barW = 22, barGap = 4, chartH = 190, padTop = 6, padBottom = 30, padX = 14;
  const W = righe.length * slotW + padX * 2;
  const H = chartH + padTop + padBottom;
  const scale = v => Math.round((v / maxVal) * chartH);

  let bars = '';
  righe.forEach((r, i) => {
    const x0 = padX + i * slotW;
    const hF = scale(r.fatturato), hP = scale(r.pagato);
    const [anno, mese] = r.chiave.split('-');
    const etichetta = `${MESI[Number(mese) - 1] || mese} ${anno.slice(2)}`;
    bars += `
      <rect x="${x0}" y="${padTop + chartH - hF}" width="${barW}" height="${hF}" rx="3" fill="var(--cri-red)"><title>${esc(etichetta)} — Fatturato: ${esc(fmtEuro(r.fatturato))}</title></rect>
      <rect x="${x0 + barW + barGap}" y="${padTop + chartH - hP}" width="${barW}" height="${hP}" rx="3" fill="var(--ok)"><title>${esc(etichetta)} — Pagato: ${esc(fmtEuro(r.pagato))}</title></rect>
      <text x="${x0 + barW + barGap / 2}" y="${padTop + chartH + 18}" text-anchor="middle" font-size="11" fill="var(--ink-soft)">${esc(etichetta)}</text>`;
  });

  node.appendChild(el(`<div>
    <div style="display:flex;gap:16px;align-items:center;margin-bottom:10px;font-size:12.5px;color:var(--ink-soft)">
      <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:var(--cri-red);margin-right:5px;vertical-align:middle"></span>Fatturato</span>
      <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:var(--ok);margin-right:5px;vertical-align:middle"></span>Pagato</span>
    </div>
    <svg width="${W}" height="${H}" style="display:block">
      <line x1="${padX}" y1="${padTop + chartH}" x2="${W - padX}" y2="${padTop + chartH}" stroke="var(--line)" stroke-width="1"/>
      ${bars}
    </svg>
  </div>`));
}

function esportaFornitoriCSV(gruppi) {
  const lines = ['Fornitore;N. Fatture;Fatturato;Pagato;Stornato;Residuo;Giorni medi pagamento'];
  for (const g of gruppi) {
    lines.push([g.fornitore, g.n, g.fatturato.toFixed(2).replace('.', ','), g.pagato.toFixed(2).replace('.', ','), g.stornato.toFixed(2).replace('.', ','), g.residuo.toFixed(2).replace('.', ','), g.giorniMedi !== null ? Math.round(g.giorniMedi) : '']
      .map(v => '"' + String(v).replace(/"/g, '""') + '"').join(';'));
  }
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'report-fornitori.csv';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export { FILTRO_FORNITORE_KEY };
