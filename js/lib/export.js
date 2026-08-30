import { fmtDate, fmtEuro, esc } from './ui.js';
import { buildXlsxBlob } from './xlsx.js';

// Colonne dell'export Excel: "tipo" dice a xlsx.js come scrivere la cella
// (testo/valuta/data) così Excel non deve indovinarlo da solo — è proprio
// quel meccanismo a rompersi con i numeri di fattura lunghi (diventano
// notazione scientifica) e con le date (restano testo, non riconosciute).
const COLS = [
  { header: 'Fornitore', tipo: 'testo', get: r => r.fornitore },
  { header: 'N. Fattura', tipo: 'testo', get: r => r.numero_fattura || '' },
  { header: 'Data', tipo: 'data', get: r => r.data_fattura },
  { header: 'Importo', tipo: 'valuta', get: r => r.importo },
  { header: 'Scadenza', tipo: 'data', get: r => r.scadenza },
  { header: 'Stato', tipo: 'testo', get: r => statoLabel(r.stato) },
  { header: 'Pagato', tipo: 'valuta', get: r => r._pagato },
  { header: 'Residuo', tipo: 'valuta', get: r => r._residuo },
  { header: 'Metodo', tipo: 'testo', get: r => r.metodo_pagamento || '' },
  { header: 'Note', tipo: 'testo', get: r => r.note || '' },
];

function statoLabel(s) {
  return { da_pagare: 'Da pagare', pagata_parziale: 'Pagata parzialmente', pagata: 'Pagata', stornata: 'Stornata' }[s] || s;
}

export function exportXLSX(righe, filename = 'scadenziario.xlsx') {
  downloadBlob(buildXlsxBlob(COLS, righe), filename);
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
  <div class="sub">CRI Genova · generato il ${new Date().toLocaleString('it-IT')}</div>
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

// ============================================================
//  FATTURE ATTIVE — stesse funzioni sopra, adattate al lessico
//  cliente/incasso e con la colonna "Sollecito" in più.
// ============================================================
const COLS_ATTIVE = [
  { header: 'Cliente', tipo: 'testo', get: r => r.cliente },
  { header: 'N. Fattura', tipo: 'testo', get: r => r.numero_fattura || '' },
  { header: 'Data', tipo: 'data', get: r => r.data_fattura },
  { header: 'Importo', tipo: 'valuta', get: r => r.importo },
  { header: 'Stato', tipo: 'testo', get: r => statoLabelAttiva(r.stato) },
  { header: 'Incassato', tipo: 'valuta', get: r => r._incassato },
  { header: 'Residuo', tipo: 'valuta', get: r => r._residuo },
  { header: 'Ultimo sollecito', tipo: 'data', get: r => r.data_sollecito },
  { header: 'Metodo', tipo: 'testo', get: r => r.metodo_incasso || '' },
  { header: 'Note', tipo: 'testo', get: r => r.note || '' },
];

function statoLabelAttiva(s) {
  return { da_incassare: 'Da incassare', incassata_parziale: 'Incassata parzialmente', incassata: 'Incassata', stornata: 'Stornata' }[s] || s;
}

export function exportXLSXAttive(righe, filename = 'fatture-attive.xlsx') {
  downloadBlob(buildXlsxBlob(COLS_ATTIVE, righe), filename);
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
  <div class="sub">CRI Genova · generato il ${new Date().toLocaleString('it-IT')}</div>
  <table>
    <thead><tr><th>Cliente</th><th>N. Fattura</th><th>Data</th><th class="num">Importo</th><th>Stato</th><th class="num">Residuo</th><th>Ultimo sollecito</th></tr></thead>
    <tbody>${rowsHtml}</tbody>
    <tfoot><tr><td colspan="3">Totale (${righe.length} fatture)</td><td class="num">${fmtEuro(totale)}</td><td></td><td class="num">${fmtEuro(residuo)}</td><td></td></tr></tfoot>
  </table>
  </body></html>`);
  w.document.close();
  setTimeout(() => { try { w.focus(); w.print(); } catch { /* finestra chiusa dall'utente */ } }, 300);
}
