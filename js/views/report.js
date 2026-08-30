import { fatture } from '../data/store.js';
import { el, clear, esc, fmtEuro } from '../lib/ui.js';

const MESI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

export async function renderReport(view, ctx) {
  let tutte = [];
  try { tutte = await fatture.list(); }
  catch (e) { view.appendChild(el(`<div class="empty-state"><div class="big">⚠️</div><p>Errore nel caricamento: ${esc(e.message)}</p></div>`)); return; }

  // Anni disponibili: dalla data fattura, così anche fatture senza scadenza
  // rientrano nel filtro. Ordinati dal più recente.
  const anni = [...new Set(tutte.filter(f => f.data_fattura).map(f => f.data_fattura.slice(0, 4)))].sort().reverse();
  const state = { anno: anni[0] || '' };

  const wrap = el(`<div>
    <div class="page-head">
      <div><h1>Report</h1><p>Riepilogo di spesa per fornitore e nel tempo — Croce Rossa Italiana Genova</p></div>
      <div class="actions">
        <select id="r-anno">
          <option value="">Tutti gli anni</option>
          ${anni.map(a => `<option value="${a}" ${a === state.anno ? 'selected' : ''}>${a}</option>`).join('')}
        </select>
        <button class="btn" id="r-csv">📊 Esporta per fornitore (CSV)</button>
      </div>
    </div>
    <div class="grid stats" id="r-stats" style="margin-bottom:22px"></div>
    <div class="card" style="margin-bottom:22px">
      <div class="card-h">Spesa per fornitore</div>
      <div class="card-b tbl-wrap" id="r-fornitori"></div>
    </div>
    <div class="card">
      <div class="card-h">Andamento mensile</div>
      <div class="card-b tbl-wrap" id="r-mesi"></div>
    </div>
  </div>`);
  view.appendChild(wrap);

  wrap.querySelector('#r-anno').addEventListener('change', e => { state.anno = e.target.value; refresh(); });
  wrap.querySelector('#r-csv').addEventListener('click', () => esportaFornitoriCSV(perFornitore(filtrate())));

  function filtrate() {
    if (!state.anno) return tutte;
    return tutte.filter(f => (f.data_fattura || '').slice(0, 4) === state.anno);
  }

  function refresh() {
    const righe = filtrate();
    renderStats(wrap.querySelector('#r-stats'), righe);
    renderFornitori(wrap.querySelector('#r-fornitori'), perFornitore(righe));
    renderMesi(wrap.querySelector('#r-mesi'), perMese(righe, tutte, state.anno));
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
    { k: 'DA INCASSARE', v: fmtEuro(residuo), s: righe.filter(f => f._residuo > 0).length + ' fatture aperte', cls: residuo > 0 ? 'warn' : '' },
    { k: 'IMPORTO MEDIO', v: fmtEuro(righe.length ? fatturato / righe.length : 0), s: 'per fattura', cls: '' },
    { k: 'TEMPO MEDIO DI PAGAMENTO', v: mediaGiorni !== null ? Math.round(mediaGiorni) + ' giorni' : '—', s: `${giorni.length} fatture saldate`, cls: '' },
  ];
  if (stornato > 0) cards.push({ k: 'STORNATO (NOTE DI CREDITO)', v: fmtEuro(stornato), s: righe.filter(f => f._stornato > 0).length + ' fatture', cls: '' });
  for (const c of cards) node.appendChild(el(`<div class="stat ${c.cls}"><div class="k">${esc(c.k)}</div><div class="v">${c.v}</div><div class="s">${esc(String(c.s))}</div></div>`));
}

// Raggruppa per fornitore, ordinato per fatturato decrescente: chi pesa di
// più sul totale sta in cima, senza dover ordinare a mano una tabella lunga.
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
  return [...mappa.values()].sort((a, b) => b.fatturato - a.fatturato);
}

function renderFornitori(node, gruppi) {
  clear(node);
  if (!gruppi.length) { node.appendChild(el(`<div class="empty-state"><div class="big">🧾</div><p>Nessuna fattura nel periodo selezionato.</p></div>`)); return; }
  const mostraStornato = gruppi.some(g => g.stornato > 0);
  const table = el(`<table class="tbl"><thead><tr>
    <th>Fornitore</th><th>N. Fatture</th><th class="money-col">Fatturato</th><th class="money-col">Pagato</th>${mostraStornato ? '<th class="money-col">Stornato</th>' : ''}<th class="money-col">Residuo</th><th>Giorni medi pagamento</th>
  </tr></thead><tbody></tbody></table>`);
  const tbody = table.querySelector('tbody');
  for (const g of gruppi) {
    tbody.appendChild(el(`<tr>
      <td>${esc(g.fornitore)}</td>
      <td>${g.n}</td>
      <td class="money money-col">${fmtEuro(g.fatturato)}</td>
      <td class="money money-col">${fmtEuro(g.pagato)}</td>
      ${mostraStornato ? `<td class="money money-col">${fmtEuro(g.stornato)}</td>` : ''}
      <td class="money money-col">${fmtEuro(g.residuo)}</td>
      <td>${g.giorniMedi !== null ? Math.round(g.giorniMedi) + ' gg' : '—'}</td>
    </tr>`));
  }
  node.appendChild(table);
}

// Fatturato del mese = fatture con data_fattura in quel mese (usa
// `righeFatturato`, già filtrato per anno se selezionato). Pagato del mese =
// pagamenti effettuati in quel mese, DI QUALUNQUE FATTURA anche se datata in
// un anno diverso (fattura di dicembre pagata a gennaio è tutt'altro che
// rara) — per questo scorre sempre `tutte`, l'elenco completo non filtrato,
// e filtra i singoli pagamenti per data, non per anno della fattura: sono
// due cose distinte e vanno lette come tali, non sommate.
function perMese(righeFatturato, tutte, anno) {
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
      if (anno && !p.data_pagamento.startsWith(anno)) continue; // il pagamento può cadere fuori dall'anno della fattura
      voce(key(p.data_pagamento)).pagato += Number(p.importo || 0);
    }
  }
  return [...mappa.values()].sort((a, b) => a.chiave.localeCompare(b.chiave));
}

function renderMesi(node, righe) {
  clear(node);
  if (!righe.length) { node.appendChild(el(`<div class="empty-state"><div class="big">📅</div><p>Nessun dato nel periodo selezionato.</p></div>`)); return; }
  const table = el(`<table class="tbl"><thead><tr><th>Mese</th><th class="money-col">Fatturato</th><th class="money-col">Pagato</th></tr></thead><tbody></tbody></table>`);
  const tbody = table.querySelector('tbody');
  for (const r of righe) {
    const [anno, mese] = r.chiave.split('-');
    const etichetta = `${MESI[Number(mese) - 1] || mese} ${anno}`;
    tbody.appendChild(el(`<tr><td>${esc(etichetta)}</td><td class="money money-col">${fmtEuro(r.fatturato)}</td><td class="money money-col">${fmtEuro(r.pagato)}</td></tr>`));
  }
  node.appendChild(table);
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
