// ============================================================
//  RICHIESTE DI PATENTE — la pagina principale della sezione.
//  Quello che i volontari hanno mandato dal modulo pubblico, le più
//  recenti in cima. La segreteria segna a che punto è ognuna e ci scrive
//  le sue note; l'admin della sezione può eliminarle. Quelle a cui manca
//  qualche documento su Gaia sono richieste di supporto: il volontario ha
//  risposto No e ha chiesto aiuto alla segreteria.
// ============================================================
import { richieste as store } from '../data/store.js';
import { PERCORSI, STATI, documentiMancanti, supportoDaGestire } from '../../lib/patenti.mjs';
import { el, clear, esc, toast, confirmDialog, openModal, rendiCliccabile, fmtDateTime } from '../../lib/ui.js';
import { contaSupportoDaGestire, segnaNelMenu } from '../avviso.js';

// Il numerino nel menu si ricalcola a ogni modifica: prendere in mano una
// richiesta di supporto lo deve spegnere subito.
const aggiornaAvviso = () => contaSupportoDaGestire().then(segnaNelMenu).catch(() => {});

const ETICHETTA_STATO = Object.fromEntries(STATI);

export async function renderRichieste(view, ctx) {
  let elenco = await store.list();
  const admin = ctx.ruolo === 'admin';

  view.appendChild(el(`<div class="page-head">
    <div><h1>Richieste di patente</h1><p>Quelle inviate dai volontari con il modulo, dalla più recente</p></div>
    <div class="actions"><a class="btn" href="#/patenti/link">🔗 Link per i volontari</a></div>
  </div>`));

  const stats = el('<div class="grid stats" style="margin:18px 0 20px"></div>');
  const toolbar = el(`<div class="toolbar">
    <div class="search"><span class="search-icon" aria-hidden="true">🔍</span>
      <input type="text" id="q" placeholder="Cerca per nome o cognome…"></div>
    <select id="f-stato" aria-label="Filtra per stato">
      <option value="aperte">Da gestire</option>
      <option value="supporto">Serve supporto</option>
      <option value="">Tutte</option>
      ${STATI.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}
    </select>
    <select id="f-patente" aria-label="Filtra per patente">
      <option value="">Ogni patente</option>
      ${[1, 2, 3, 4, 5, 6, 7, 8].map(n => `<option value="${n}">Patente ${n}</option>`).join('')}
    </select>
  </div>`);
  const vuoto = el(`<div class="empty-state" hidden><div class="big">🪪</div>
    <p><b>Nessuna richiesta</b></p>
    <p>Quando un volontario compila il modulo, la sua richiesta compare qui.<br>
    Il link da mandare è in «Link per i volontari».</p></div>`);
  const card = el(`<div class="card"><div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Inviata</th><th>Volontario</th><th>Patente</th><th>Documenti su Gaia</th><th>Stato</th><th>Note</th><th></th></tr></thead>
    <tbody></tbody></table></div></div>`);
  view.append(stats, toolbar, vuoto, card);
  const tbody = card.querySelector('tbody');
  const $ = (s) => toolbar.querySelector(s);

  function disegnaStats() {
    clear(stats);
    const filtro = $('#f-stato').value;
    // Lo stesso conto del pallino in home e del numero nel menu.
    const nSupporto = elenco.filter(supportoDaGestire).length;
    if (nSupporto) {
      const nodo = el(`<div class="stat stat-clickable warn" aria-pressed="${filtro === 'supporto'}">
        <div class="k">Serve supporto</div><div class="v">${nSupporto}</div><div class="s">documenti mancanti su Gaia</div></div>`);
      rendiCliccabile(nodo, () => { $('#f-stato').value = filtro === 'supporto' ? 'aperte' : 'supporto'; draw(); });
      stats.appendChild(nodo);
    }
    for (const [v, l] of STATI) {
      const n = elenco.filter(r => r.stato === v).length;
      const classe = v === 'nuova' ? (n ? 'warn' : '') : v === 'completata' ? 'ok' : 'accent';
      const nodo = el(`<div class="stat stat-clickable ${classe}" aria-pressed="${filtro === v}">
        <div class="k">${esc(l)}</div><div class="v">${n}</div></div>`);
      rendiCliccabile(nodo, () => { $('#f-stato').value = filtro === v ? 'aperte' : v; draw(); });
      stats.appendChild(nodo);
    }
  }

  function draw() {
    disegnaStats();
    vuoto.hidden = elenco.length > 0;
    toolbar.hidden = card.hidden = !elenco.length;
    const q = $('#q').value.toLowerCase().trim();
    const st = $('#f-stato').value;
    const pat = $('#f-patente').value;
    const righe = elenco
      .filter(r => !st || (st === 'aperte' ? r.stato !== 'completata' : st === 'supporto' ? supportoDaGestire(r) : r.stato === st))
      .filter(r => !pat || String(r.patente) === pat)
      .filter(r => !q || `${r.nome} ${r.cognome} ${r.cognome} ${r.nome}`.toLowerCase().includes(q));
    clear(tbody);
    if (!righe.length && elenco.length) {
      tbody.appendChild(el('<tr><td colspan="7" style="text-align:center;color:var(--ink-soft);padding:22px">Nessuna richiesta con questi filtri.</td></tr>'));
    }
    for (const r of righe) tbody.appendChild(riga(r));
  }

  function riga(r) {
    const mancanti = documentiMancanti(r.documenti_gaia, r.tipo);
    const tr = el(`<tr>
      <td style="white-space:nowrap">${esc(fmtDateTime(r.created_at))}</td>
      <td><b>${esc(r.cognome)} ${esc(r.nome)}</b></td>
      <td style="white-space:nowrap">${r.tipo === 'rinnovo' ? '<span class="chip">Rinnovo</span>' : r.tipo === 'nuova' ? '<span class="chip">Nuova</span>' : ''}
        Patente ${r.patente}<div class="hint">${r.tipo === 'rinnovo' ? 'visita medica di conferma' : esc(PERCORSI[r.percorso]?.etichetta || '')}</div></td>
      <td>${!mancanti.length ? '<span class="chip">✓ tutti caricati</span>'
        : `<span class="chip red">🆘 serve supporto</span><div class="hint" style="margin-top:4px">Mancano: ${mancanti.map(d => esc(d.breve)).join(', ')}</div>`}</td>
      <td><select aria-label="Stato della richiesta">${STATI.map(([v, l]) => `<option value="${v}" ${r.stato === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></td>
      <td style="max-width:260px">${r.note ? esc(r.note) : '<span class="hint">—</span>'}</td>
      <td style="white-space:nowrap;text-align:right">
        <button class="btn ghost sm" data-note title="Scrivi una nota" aria-label="Scrivi una nota">✏️</button>
        ${admin ? '<button class="btn ghost sm" data-elimina title="Elimina" aria-label="Elimina la richiesta">🗑️</button>' : ''}
      </td></tr>`);

    tr.querySelector('select').addEventListener('change', async (e) => {
      try { sostituisci(await store.aggiorna(r, { stato: e.target.value })); toast(`Segnata «${ETICHETTA_STATO[e.target.value]}»`, 'ok'); }
      catch (err) { toast(err.message, 'err'); e.target.value = r.stato; }
    });
    tr.querySelector('[data-note]').addEventListener('click', () => modificaNote(r));
    tr.querySelector('[data-elimina]')?.addEventListener('click', async () => {
      if (!await confirmDialog(`Eliminare la richiesta di ${r.nome} ${r.cognome}? Non si potrà recuperare.`, { danger: true, okLabel: 'Elimina' })) return;
      try { await store.remove(r.id); elenco = elenco.filter(x => x.id !== r.id); draw(); aggiornaAvviso(); toast('Richiesta eliminata', 'ok'); }
      catch (err) { toast(err.message, 'err'); }
    });
    return tr;
  }

  function sostituisci(nuova) {
    elenco = elenco.map(x => x.id === nuova.id ? nuova : x);
    draw();
    aggiornaAvviso();
  }

  function modificaNote(r) {
    const body = el(`<div class="field" style="margin:0"><label for="f-note-p">Note della segreteria</label>
      <textarea id="f-note-p" rows="5" maxlength="2000" placeholder="es. prova pratica fissata il…">${esc(r.note || '')}</textarea></div>`);
    const foot = el('<div style="display:flex;gap:10px"><button class="btn" data-no>Annulla</button><button class="btn primary" data-si>Salva</button></div>');
    const { close } = openModal({ title: `${r.nome} ${r.cognome} — patente ${r.patente}`, body, footer: foot });
    foot.querySelector('[data-no]').onclick = close;
    foot.querySelector('[data-si]').onclick = async () => {
      try { sostituisci(await store.aggiorna(r, { note: body.querySelector('textarea').value })); close(); toast('Nota salvata', 'ok'); }
      catch (err) { toast(err.message, 'err'); }
    };
  }

  $('#q').addEventListener('input', draw);
  if (ctx.filtro === 'supporto') $('#f-stato').value = 'supporto';
  $('#f-stato').addEventListener('change', draw);
  $('#f-patente').addEventListener('change', draw);
  draw();
}
