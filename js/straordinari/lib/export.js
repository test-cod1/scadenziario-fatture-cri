// ============================================================
//  ESPORTAZIONI DELLA SEZIONE STRAORDINARI
//  Due formati, per due destinatari diversi:
//   * Excel — l'elenco delle righe, per l'ufficio personale che deve
//     rimetterle in busta paga (una riga per straordinario, non una griglia:
//     una griglia in Excel non si somma né si filtra).
//   * Stampa — la griglia mensile dipendenti × giorni, cioè il foglio che oggi
//     si consegna firmato. È l'unico punto in cui la forma del vecchio PDF
//     resta utile: su carta serve la vista d'insieme.
// ============================================================
import { buildXlsxBlob } from '../../lib/xlsx.js';
import { esc } from '../../lib/ui.js';
import { fmtOre, giorniDelMese, etichettaMese, tipoDi, statoDi, totali } from '../calc.js';
import { fmtOrario } from './ui.js';

const COLS = [
  { header: 'Data', tipo: 'data', get: r => r.data },
  { header: 'Dipendente', tipo: 'testo', get: r => r.dipendente_nome || '' },
  { header: 'Dalle', tipo: 'testo', get: r => String(r.dalle || '').slice(0, 5) },
  { header: 'Alle', tipo: 'testo', get: r => String(r.alle || '').slice(0, 5) },
  // Le ore vanno in Excel come NUMERO con il segno del tipo: è la colonna che
  // l'ufficio personale somma, e un recupero sommato in positivo sarebbe un
  // errore di due volte le sue ore.
  { header: 'Ore', tipo: 'numero', get: r => tipoDi(r.tipo).segno * (Number(r.ore) || 0) },
  { header: 'Tipo', tipo: 'testo', get: r => tipoDi(r.tipo).label },
  { header: 'Causale', tipo: 'testo', get: r => r.causale || '' },
  { header: 'Servizio', tipo: 'testo', get: r => r.servizio || '' },
  { header: 'Stato', tipo: 'testo', get: r => statoDi(r.stato).label },
  { header: 'Richiesto da', tipo: 'testo', get: r => r.richiesto_da_nome || '' },
  { header: 'Note', tipo: 'testo', get: r => r.note || '' },
];

export function exportXLSX(righe, mese) {
  scarica(buildXlsxBlob(COLS, righe), `straordinari-${mese}.xlsx`);
}

function scarica(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Griglia mensile stampabile: gli dipendenti in riga, i giorni in colonna, le
// ore nelle celle. In fondo il totale di giornata, a destra il saldo del
// mese; i sabati e le domeniche hanno lo sfondo grigio, come si è abituati a
// leggerli sul tabellone dei turni.
export function stampaRiepilogo(riepilogo, perGiorno, mese, { righe = [] } = {}) {
  const w = window.open('', '_blank');
  if (!w) { alert('Consenti i popup per generare la stampa.'); return; }
  const giorni = giorniDelMese(mese);
  const t = totali(righe);

  const intestazione = giorni.map(g =>
    `<th class="${g.festivo ? 'fest' : ''}"><span class="dow">${g.iso ? nomeDow(g.dow) : ''}</span>${g.numero}</th>`).join('');

  const corpo = riepilogo.map(r => {
    const celle = giorni.map(g => {
      const cella = r.giorni[g.iso];
      const ore = cella ? cella.ore : 0;
      if (!ore) return `<td class="${g.festivo ? 'fest' : ''}"></td>`;
      return `<td class="${g.festivo ? 'fest' : ''} ${ore < 0 ? 'neg' : 'pos'}">${numero(ore)}</td>`;
    }).join('');
    return `<tr>
      <th class="nome">${esc(r.nome)}${r.oreContratto ? ` <span class="oc">${numero(r.oreContratto)}</span>` : ''}</th>
      ${celle}
      <td class="tot">${numero(r.positive)}</td>
      <td class="tot">${r.recuperi ? '−' + numero(r.recuperi) : ''}</td>
      <td class="tot saldo">${numero(r.saldo)}</td>
    </tr>`;
  }).join('');

  const piede = giorni.map(g =>
    `<td class="${g.festivo ? 'fest' : ''} tot">${perGiorno[g.iso] ? numero(perGiorno[g.iso]) : ''}</td>`).join('');

  w.document.write(`<!DOCTYPE html><html lang="it"><head><meta charset="utf-8">
  <title>Straordinari ${esc(etichettaMese(mese))}</title>
  <style>
    @page{size:A4 landscape;margin:12mm}
    body{font-family:system-ui,Arial,sans-serif;color:#1c2024;padding:0;margin:0}
    h1{font-size:16px;margin:0 0 2px}
    .sub{color:#5a6570;font-size:11px;margin-bottom:12px}
    table{width:100%;border-collapse:collapse;font-size:9.5px;table-layout:fixed}
    th,td{border:1px solid #cfd6dc;padding:2px 1px;text-align:center;font-variant-numeric:tabular-nums}
    thead th{background:#f4f6f8;font-size:8.5px;font-weight:700}
    thead th .dow{display:block;font-weight:400;color:#6b7580;text-transform:lowercase}
    th.nome{width:104px;text-align:left;padding-left:5px;font-size:10px;background:#f4f6f8;white-space:nowrap;overflow:hidden}
    th.nome .oc{color:#6b7580;font-weight:400}
    td.fest,th.fest{background:#eef1f4}
    td.pos{font-weight:700}
    td.neg{font-weight:700;color:#9b1c1c}
    td.tot{background:#f8fafb;font-weight:700}
    td.tot.saldo{background:#fdeaec}
    tfoot td,tfoot th{background:#f4f6f8;font-weight:700}
    .firme{margin-top:22px;display:flex;gap:40px;font-size:10px;color:#5a6570}
    .firme div{flex:1;border-top:1px solid #9aa4ae;padding-top:4px}
  </style></head><body>
  <h1>Straordinari — ${esc(etichettaMese(mese))}</h1>
  <div class="sub">Croce Rossa Italiana — Comitato di Genova · Centrale operativa ·
    ore richieste ${numero(t.positive)}, recuperi ${numero(t.recuperi)}, saldo ${numero(t.saldo)}
    ${t.daConfermare ? ` · ATTENZIONE: ${t.daConfermare} righe ancora da confermare` : ''}</div>
  <table>
    <thead><tr><th class="nome">Dipendente</th>${intestazione}<th class="tot">Str.</th><th class="tot">Rec.</th><th class="tot">Saldo</th></tr></thead>
    <tbody>${corpo || `<tr><td colspan="${giorni.length + 4}">Nessuno straordinario registrato in questo mese.</td></tr>`}</tbody>
    <tfoot><tr><th class="nome">Totale giornata</th>${piede}<td class="tot">${numero(t.positive)}</td><td class="tot">${numero(t.recuperi)}</td><td class="tot saldo">${numero(t.saldo)}</td></tr></tfoot>
  </table>
  <div class="firme"><div>Il responsabile della centrale operativa</div><div>Ufficio personale</div></div>
  </body></html>`);
  w.document.close();
  w.focus();
  w.print();
}

// Elenco stampabile delle righe di un mese (o del filtro in corso): è la
// versione "che si legge" del registro, quella da allegare quando qualcuno
// chiede conto di una singola giornata.
export function stampaElenco(righe, mese, sottotitolo = '') {
  const w = window.open('', '_blank');
  if (!w) { alert('Consenti i popup per generare la stampa.'); return; }
  const t = totali(righe);
  const corpo = righe.map(r => `<tr>
    <td>${esc(new Date(r.data + 'T00:00:00').toLocaleDateString('it-IT'))}</td>
    <td>${esc(r.dipendente_nome || '')}</td>
    <td>${esc(fmtOrario(r.dalle, r.alle))}</td>
    <td class="num">${numero(tipoDi(r.tipo).segno * (Number(r.ore) || 0))}</td>
    <td>${esc(tipoDi(r.tipo).label)}</td>
    <td>${esc(r.causale || '')}${r.servizio ? ` <span class="sv">(${esc(r.servizio)})</span>` : ''}</td>
    <td>${esc(statoDi(r.stato).label)}</td>
    <td>${esc(r.richiesto_da_nome || '')}</td>
  </tr>`).join('');

  w.document.write(`<!DOCTYPE html><html lang="it"><head><meta charset="utf-8">
  <title>Straordinari ${esc(etichettaMese(mese))}</title>
  <style>
    @page{size:A4;margin:14mm}
    body{font-family:system-ui,Arial,sans-serif;color:#1c2024}
    h1{font-size:17px;margin:0 0 2px}
    .sub{color:#5a6570;font-size:11.5px;margin-bottom:14px}
    table{width:100%;border-collapse:collapse;font-size:11px}
    th,td{text-align:left;padding:5px 7px;border-bottom:1px solid #e4e8ec}
    th{background:#f4f6f8;text-transform:uppercase;font-size:9.5px;letter-spacing:.02em}
    td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
    .sv{color:#6b7580}
    tfoot td{font-weight:700;border-top:2px solid #cfd6dc}
  </style></head><body>
  <h1>Straordinari — ${esc(etichettaMese(mese))}</h1>
  <div class="sub">Croce Rossa Italiana — Comitato di Genova · Centrale operativa${sottotitolo ? ' · ' + esc(sottotitolo) : ''}</div>
  <table>
    <thead><tr><th>Data</th><th>Dipendente</th><th>Orario</th><th class="num">Ore</th><th>Tipo</th><th>Causale</th><th>Stato</th><th>Richiesto da</th></tr></thead>
    <tbody>${corpo || '<tr><td colspan="8">Nessuna riga.</td></tr>'}</tbody>
    <tfoot><tr><td colspan="3">Totale (${righe.length} righe)</td><td class="num">${numero(t.saldo)}</td><td colspan="4">straordinari ${numero(t.positive)} · recuperi ${numero(t.recuperi)}</td></tr></tfoot>
  </table>
  </body></html>`);
  w.document.close();
  w.focus();
  w.print();
}

function numero(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('it-IT', { maximumFractionDigits: 2 });
}
function nomeDow(dow) {
  return ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'][dow] || '';
}

// fmtOre è usata solo dalle viste: qui i numeri vanno senza unità perché
// stanno in colonne strette con l'unità nell'intestazione.
export { fmtOre };
