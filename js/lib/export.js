import { fmtDate, fmtEuro } from './ui.js';

const COLS = [
  { k: 'fornitore', h: 'Fornitore' },
  { k: 'numero_fattura', h: 'N. Fattura' },
  { k: 'data_fattura', h: 'Data', fmt: fmtDate },
  { k: 'importo', h: 'Importo', fmt: v => Number(v || 0).toFixed(2).replace('.', ',') },
  { k: 'scadenza', h: 'Scadenza', fmt: fmtDate },
  { k: 'stato', h: 'Stato', fmt: statoLabel },
  { k: '_pagato', h: 'Pagato', fmt: v => Number(v || 0).toFixed(2).replace('.', ',') },
  { k: '_residuo', h: 'Residuo', fmt: v => Number(v || 0).toFixed(2).replace('.', ',') },
  { k: 'metodo_pagamento', h: 'Metodo' },
  { k: 'note', h: 'Note' },
];

function statoLabel(s) {
  return { da_pagare: 'Da pagare', pagata_parziale: 'Pagata parzialmente', pagata: 'Pagata', stornata: 'Stornata' }[s] || s;
}

// CSV con separatore ; (si apre correttamente in Excel con locale italiana)
export function exportCSV(righe, filename = 'scadenziario.csv') {
  const lines = [COLS.map(c => c.h).join(';')];
  for (const r of righe) {
    lines.push(COLS.map(c => {
      const raw = r[c.k];
      const v = c.fmt ? c.fmt(raw) : (raw ?? '');
      return '"' + String(v).replace(/"/g, '""') + '"';
    }).join(';'));
  }
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, filename);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Apre una finestra con una tabella pulita e lancia la stampa: dal dialogo di
// stampa del browser si può scegliere "Salva come PDF" senza dipendenze extra.
export function exportPDF(righe, titolo = 'Scadenziario fatture') {
  const w = window.open('', '_blank');
  if (!w) { alert('Consenti i popup per generare il PDF.'); return; }
  const rowsHtml = righe.map(r => `<tr>
    <td>${esc(r.fornitore)}</td>
    <td>${esc(r.numero_fattura || '')}</td>
    <td>${fmtDate(r.data_fattura)}</td>
    <td class="num">${fmtEuro(r.importo)}</td>
    <td>${fmtDate(r.scadenza)}</td>
    <td>${esc(statoLabel(r.stato))}</td>
    <td class="num">${fmtEuro(r._residuo)}</td>
  </tr>`).join('');
  const totale = righe.reduce((s, r) => s + Number(r.importo || 0), 0);
  const residuo = righe.reduce((s, r) => s + Number(r._residuo || 0), 0);
  w.document.write(`<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"><title>${esc(titolo)}</title>
  <style>
    body{font-family:system-ui,Arial,sans-serif;padding:24px;color:#1c2024}
    h1{font-size:18px;margin:0 0 4px}
    .sub{color:#5a6570;font-size:12px;margin-bottom:16px}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #e4e8ec}
    th{background:#f4f6f8;text-transform:uppercase;font-size:10px;letter-spacing:.02em}
    td.num,th.num{text-align:right}
    tfoot td{font-weight:700;border-top:2px solid #1c2024}
  </style></head><body>
  <h1>${esc(titolo)}</h1>
  <div class="sub">Croce Rossa Italiana — Genova · generato il ${new Date().toLocaleString('it-IT')}</div>
  <table>
    <thead><tr><th>Fornitore</th><th>N. Fattura</th><th>Data</th><th class="num">Importo</th><th>Scadenza</th><th>Stato</th><th class="num">Residuo</th></tr></thead>
    <tbody>${rowsHtml}</tbody>
    <tfoot><tr><td colspan="3">Totale (${righe.length} fatture)</td><td class="num">${fmtEuro(totale)}</td><td colspan="2"></td><td class="num">${fmtEuro(residuo)}</td></tr></tfoot>
  </table>
  </body></html>`);
  w.document.close();
  // La stampa viene lanciata da qui e non da uno <script> dentro la pagina
  // generata: uno script inline sarebbe bloccato dalla Content-Security-Policy
  // servita dal Worker (la finestra about:blank eredita quella di chi la apre).
  setTimeout(() => { try { w.focus(); w.print(); } catch { /* finestra chiusa dall'utente */ } }, 300);
}

function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ============================================================
//  FATTURE ATTIVE — stesse funzioni sopra, adattate al lessico
//  cliente/incasso e con la colonna "Sollecito" in più.
// ============================================================
const COLS_ATTIVE = [
  { k: 'cliente', h: 'Cliente' },
  { k: 'numero_fattura', h: 'N. Fattura' },
  { k: 'data_fattura', h: 'Data', fmt: fmtDate },
  { k: 'importo', h: 'Importo', fmt: v => Number(v || 0).toFixed(2).replace('.', ',') },
  { k: 'stato', h: 'Stato', fmt: statoLabelAttiva },
  { k: '_incassato', h: 'Incassato', fmt: v => Number(v || 0).toFixed(2).replace('.', ',') },
  { k: '_residuo', h: 'Residuo', fmt: v => Number(v || 0).toFixed(2).replace('.', ',') },
  { k: 'data_sollecito', h: 'Ultimo sollecito', fmt: fmtDate },
  { k: 'metodo_incasso', h: 'Metodo' },
  { k: 'note', h: 'Note' },
];

function statoLabelAttiva(s) {
  return { da_incassare: 'Da incassare', incassata_parziale: 'Incassata parzialmente', incassata: 'Incassata', stornata: 'Stornata' }[s] || s;
}

export function exportCSVAttive(righe, filename = 'fatture-attive.csv') {
  const lines = [COLS_ATTIVE.map(c => c.h).join(';')];
  for (const r of righe) {
    lines.push(COLS_ATTIVE.map(c => {
      const raw = r[c.k];
      const v = c.fmt ? c.fmt(raw) : (raw ?? '');
      return '"' + String(v).replace(/"/g, '""') + '"';
    }).join(';'));
  }
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, filename);
}

export function exportPDFAttive(righe, titolo = 'Fatture attive') {
  const w = window.open('', '_blank');
  if (!w) { alert('Consenti i popup per generare il PDF.'); return; }
  const rowsHtml = righe.map(r => `<tr>
    <td>${esc(r.cliente)}</td>
    <td>${esc(r.numero_fattura || '')}</td>
    <td>${fmtDate(r.data_fattura)}</td>
    <td class="num">${fmtEuro(r.importo)}</td>
    <td>${esc(statoLabelAttiva(r.stato))}</td>
    <td class="num">${fmtEuro(r._residuo)}</td>
    <td>${fmtDate(r.data_sollecito)}</td>
  </tr>`).join('');
  const totale = righe.reduce((s, r) => s + Number(r.importo || 0), 0);
  const residuo = righe.reduce((s, r) => s + Number(r._residuo || 0), 0);
  w.document.write(`<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"><title>${esc(titolo)}</title>
  <style>
    body{font-family:system-ui,Arial,sans-serif;padding:24px;color:#1c2024}
    h1{font-size:18px;margin:0 0 4px}
    .sub{color:#5a6570;font-size:12px;margin-bottom:16px}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #e4e8ec}
    th{background:#f4f6f8;text-transform:uppercase;font-size:10px;letter-spacing:.02em}
    td.num,th.num{text-align:right}
    tfoot td{font-weight:700;border-top:2px solid #1c2024}
  </style></head><body>
  <h1>${esc(titolo)}</h1>
  <div class="sub">Croce Rossa Italiana — Genova · generato il ${new Date().toLocaleString('it-IT')}</div>
  <table>
    <thead><tr><th>Cliente</th><th>N. Fattura</th><th>Data</th><th class="num">Importo</th><th>Stato</th><th class="num">Residuo</th><th>Ultimo sollecito</th></tr></thead>
    <tbody>${rowsHtml}</tbody>
    <tfoot><tr><td colspan="3">Totale (${righe.length} fatture)</td><td class="num">${fmtEuro(totale)}</td><td></td><td class="num">${fmtEuro(residuo)}</td><td></td></tr></tfoot>
  </table>
  </body></html>`);
  w.document.close();
  setTimeout(() => { try { w.focus(); w.print(); } catch { /* finestra chiusa dall'utente */ } }, 300);
}
