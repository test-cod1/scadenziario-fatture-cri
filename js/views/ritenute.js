// ============================================================
//  RITENUTE D'ACCONTO — che cosa versare il 16
// ------------------------------------------------------------
//  Le fatture passive con ritenuta, raggruppate per MESE DI PAGAMENTO:
//  ogni mese è un F24 da versare entro il 16 del mese dopo. Per ognuno si
//  vede quali fatture sono state pagate, la quota di ritenuta di ciascun
//  pagamento, il totale per codice tributo, la scadenza e se è già stato
//  versato. L'admin segna il versamento; l'operatore guarda.
//  I conti stanno in js/lib/ritenute.js.
// ============================================================
import { ritenute } from '../data/store.js';
import { el, clear, esc, fmtDate, fmtEuro, toast, todayISO, openModal, confirmDialog, parseEuro, rendiCliccabile, cellaCsv } from '../lib/ui.js';
import { CAMPO_DECIMALE, testoDecimale } from '../lib/importi.js';
import { riepilogoMesi, nomeMese, primoDelMese, ritenutaDaNote, quoteRitenute, scadenzaVersamento, CODICE_TRIBUTO_DEFAULT } from '../lib/ritenute.js';

const apriEditor = (...a) => import('./fattura.js').then(m => m.apriEditor(...a))
  .catch(e => toast('Impossibile aprire la fattura: ' + e.message, 'err'));

const STATO = {
  in_corso:   { chip: 'info',   label: 'Mese in corso' },
  da_versare: { chip: 'warn',   label: 'Da versare' },
  scaduto:    { chip: 'danger', label: 'Scaduto' },
  versato:    { chip: 'ok',     label: 'Versato' },
  differenza: { chip: 'warn',   label: 'Versato, importo diverso' },
};

const euro2 = (n) => (Math.round(n * 100) / 100).toFixed(2).replace('.', ',');

export async function renderRitenute(view, ctx) {
  const isAdmin = ctx.user.ruolo === 'admin';
  let fatt = [], vers = [], daNote = [];
  async function carica() {
    [fatt, vers, daNote] = await Promise.all([ritenute.fatture(), ritenute.versamenti(), ritenute.daNote().catch(() => [])]);
  }
  try { await carica(); }
  catch (e) {
    const manca = /ritenut/i.test(e.message || '') && /(column|relation|schema)/i.test(e.message || '');
    view.appendChild(el(`<div class="empty-state"><div class="big">⚠️</div><p>${manca
      ? "Il database non ha ancora i campi per le ritenute: va eseguita la patch <code>supabase/patch-2026-11-09-ritenute.sql</code>."
      : 'Errore nel caricamento: ' + esc(e.message)}</p></div>`));
    return;
  }

  const oggi = todayISO();
  const state = { anno: oggi.slice(0, 4) };

  const wrap = el(`<div>
    <div class="page-head">
      <div><h1>Ritenute d'acconto</h1><p>Le ritenute trattenute sui pagamenti di ogni mese, da versare con l'F24 entro il 16 del mese successivo</p></div>
      <div class="actions">
        <select id="rt-anno" title="Anno dei pagamenti"></select>
        <button class="btn" id="rt-csv">📊 Esporta (CSV)</button>
      </div>
    </div>
    <div id="rt-avvisi"></div>
    <div class="grid stats" id="rt-stats" style="margin-bottom:22px"></div>
    <div id="rt-mesi"></div>
    <div id="rt-aperte"></div>
    <div id="rt-note"></div>
  </div>`);
  view.appendChild(wrap);

  wrap.querySelector('#rt-anno').addEventListener('change', e => { state.anno = e.target.value; disegna(); });
  wrap.querySelector('#rt-csv').addEventListener('click', () => esportaCsv(mesiFiltrati(), state.anno));

  async function ricarica() {
    try { await carica(); disegna(); }
    catch (e) { toast('Errore nel caricamento: ' + e.message, 'err'); }
  }

  let mesi = [];
  function mesiFiltrati() { return state.anno ? mesi.filter(m => m.mese.startsWith(state.anno)) : mesi; }

  function disegna() {
    mesi = riepilogoMesi(fatt, vers, oggi);
    const anni = [...new Set([oggi.slice(0, 4), ...mesi.map(m => m.mese.slice(0, 4))])].sort().reverse();
    if (state.anno && !anni.includes(state.anno)) state.anno = anni[0];
    const sel = wrap.querySelector('#rt-anno');
    sel.innerHTML = anni.map(a => `<option value="${a}" ${a === state.anno ? 'selected' : ''}>${a}</option>`).join('')
      + `<option value="" ${!state.anno ? 'selected' : ''}>Tutti gli anni</option>`;
    disegnaAvvisi();
    disegnaStats();
    disegnaMesi();
    disegnaAperte();
    disegnaNote();
  }

  // Quello che c'è da fare, di qualunque anno: un mese scaduto del
  // dicembre scorso non deve sparire perché il filtro è sull'anno nuovo.
  function disegnaAvvisi() {
    const zona = wrap.querySelector('#rt-avvisi'); clear(zona);
    const scaduti = mesi.filter(m => m.stato === 'scaduto');
    const daVersare = mesi.filter(m => m.stato === 'da_versare');
    const differenze = mesi.filter(m => m.stato === 'differenza');
    if (scaduti.length) {
      zona.appendChild(el(`<div class="banner danger"><div class="bi">⏰</div><div>
        <b>${scaduti.length === 1 ? 'Un mese di ritenute non risulta versato' : scaduti.length + ' mesi di ritenute non risultano versati'} e la scadenza è passata</b>
        <ul>${scaduti.map(m => `<li>pagamenti di ${esc(nomeMese(m.mese))}: <b style="display:inline">${fmtEuro(m.totale)}</b>, da versare entro il ${fmtDate(m.scadenza)}</li>`).join('')}</ul>
        <div class="small" style="margin-top:6px">Se l'F24 è stato pagato, segnalo come versato. Altrimenti si può ancora regolarizzare con il ravvedimento operoso.</div>
      </div></div>`));
    }
    if (daVersare.length) {
      zona.appendChild(el(`<div class="banner warn"><div class="bi">📅</div><div>
        <b>Da versare con il prossimo F24</b>
        <ul>${daVersare.map(m => `<li>pagamenti di ${esc(nomeMese(m.mese))}: <b style="display:inline">${fmtEuro(m.totale)}</b> entro il ${fmtDate(m.scadenza)}${codiciTesto(m)}</li>`).join('')}</ul>
      </div></div>`));
    }
    if (differenze.length) {
      zona.appendChild(el(`<div class="banner info"><div class="bi">🔎</div><div>
        <b>Versamenti che non tornano più con i pagamenti registrati</b>
        <ul>${differenze.map(m => `<li>${esc(nomeMese(m.mese))}: versati ${fmtEuro(m.versamento.importo)}, ritenute sui pagamenti ${fmtEuro(m.totale)}</li>`).join('')}</ul>
        <div class="small" style="margin-top:6px">Succede se un pagamento è stato registrato, corretto o tolto dopo aver segnato il versamento. Va controllato, ed eventualmente versata la differenza.</div>
      </div></div>`));
    }
  }

  function disegnaStats() {
    const zona = wrap.querySelector('#rt-stats'); clear(zona);
    const filtrati = mesiFiltrati();
    const totale = filtrati.reduce((s, m) => s + m.totale, 0);
    const versato = filtrati.reduce((s, m) => s + (m.versamento ? Number(m.versamento.importo) : 0), 0);
    const corrente = mesi.find(m => m.mese === oggi.slice(0, 7));
    const daVersare = mesi.filter(m => m.stato === 'da_versare' || m.stato === 'scaduto').reduce((s, m) => s + m.totale, 0);
    const periodo = state.anno ? `pagamenti del ${state.anno}` : 'tutti gli anni';
    zona.append(
      el(`<div class="stat ${daVersare ? 'warn' : 'ok'}"><div class="k">Da versare ora</div><div class="v">${fmtEuro(daVersare)}</div><div class="s">mesi chiusi non ancora versati</div></div>`),
      el(`<div class="stat"><div class="k">Mese in corso</div><div class="v">${fmtEuro(corrente ? corrente.totale : 0)}</div><div class="s">maturate finora, scadenza ${fmtDate(scadenzaVersamento(oggi.slice(0, 7)))}</div></div>`),
      el(`<div class="stat"><div class="k">Ritenute maturate</div><div class="v">${fmtEuro(totale)}</div><div class="s">${esc(periodo)}</div></div>`),
      el(`<div class="stat ok"><div class="k">Versate</div><div class="v">${fmtEuro(versato)}</div><div class="s">${esc(periodo)}</div></div>`),
    );
  }

  function disegnaMesi() {
    const zona = wrap.querySelector('#rt-mesi'); clear(zona);
    const filtrati = mesiFiltrati();
    if (!filtrati.length) {
      zona.appendChild(el(`<div class="card" style="margin-bottom:22px"><div class="card-b"><div class="empty-state" style="padding:20px 0">
        <div class="big">🧾</div><p><b>Nessuna ritenuta maturata${state.anno ? ' nel ' + esc(state.anno) : ''}</b></p>
        <p class="muted">Una fattura con ritenuta d'acconto compare qui quando viene pagata. La ritenuta si segna nella scheda della fattura («Con ritenuta d'acconto»), e la lettura da XML o con l'AI la compila da sola.</p>
      </div></div></div>`));
      return;
    }
    for (const m of filtrati) zona.appendChild(cardMese(m));
  }

  function cardMese(m) {
    const st = STATO[m.stato];
    const card = el(`<div class="card" style="margin-bottom:18px">
      <div class="card-h" style="flex-wrap:wrap">
        <span>Pagamenti di ${esc(nomeMese(m.mese))} <span class="chip ${st.chip}" style="margin-left:6px">${st.label}</span></span>
        <span style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-weight:600">
          <span class="muted" style="font-weight:400;font-size:13px">versamento entro il ${fmtDate(m.scadenza)}</span>
          <span>${fmtEuro(m.totale)}</span>
          <span class="rt-azioni"></span>
        </span>
      </div>
      <div class="card-b" style="padding-top:10px">
        <div class="rt-versamento"></div>
        <div class="tbl-wrap">
          <table class="tbl">
            <thead><tr><th>Pagata il</th><th>Fornitore</th><th>Fattura</th><th>Codice</th><th class="money-col">Pagato</th><th class="money-col">Ritenuta</th></tr></thead>
            <tbody></tbody>
            ${Object.keys(m.perCodice).length > 1 ? `<tfoot>${Object.entries(m.perCodice).map(([c, v]) =>
              `<tr><td colspan="5" style="text-align:right;color:var(--ink-soft)">Codice tributo ${esc(c)}</td><td class="money-col"><b>${fmtEuro(v)}</b></td></tr>`).join('')}</tfoot>` : ''}
          </table>
        </div>
      </div>
    </div>`);
    const tbody = card.querySelector('tbody');
    if (!m.righe.length) tbody.appendChild(el(`<tr><td colspan="6" class="muted">Nessun pagamento con ritenuta registrato in questo mese.</td></tr>`));
    for (const r of m.righe) {
      const f = r.fattura;
      const tr = el(`<tr title="Apri la fattura">
        <td>${fmtDate(r.pagamento.data_pagamento)}</td>
        <td>${esc(f.fornitore)}</td>
        <td>${f.numero_fattura ? 'n. ' + esc(f.numero_fattura) : '—'}${f.data_fattura ? ` <span class="muted">del ${fmtDate(f.data_fattura)}</span>` : ''}</td>
        <td>${esc(f.ritenuta_codice_tributo || CODICE_TRIBUTO_DEFAULT)}</td>
        <td class="money-col">${fmtEuro(r.pagamento.importo)}</td>
        <td class="money-col"><b>${fmtEuro(r.quota)}</b>${Number(r.quota) !== Number(f.ritenuta) ? `<div class="muted" style="font-size:12px">quota di ${fmtEuro(f.ritenuta)}</div>` : ''}</td>
      </tr>`);
      rendiCliccabile(tr, () => apriEditor(f.id, ctx, ricarica));
      tbody.appendChild(tr);
    }

    const vz = card.querySelector('.rt-versamento');
    if (m.versamento) {
      vz.appendChild(el(`<div class="muted" style="font-size:13px;margin-bottom:10px">✅ Versato il <b style="color:var(--ink)">${fmtDate(m.versamento.data_versamento)}</b>: ${fmtEuro(m.versamento.importo)}${m.versamento.note ? ' — ' + esc(m.versamento.note) : ''}</div>`));
    }
    const az = card.querySelector('.rt-azioni');
    if (isAdmin && (m.stato !== 'in_corso' || m.versamento)) {
      const b = el(`<button class="btn ${m.versamento ? 'ghost' : 'primary'} sm">${m.versamento ? 'Modifica versamento' : 'Segna versato'}</button>`);
      b.addEventListener('click', () => apriVersamento(m));
      az.appendChild(b);
    }
    return card;
  }

  function apriVersamento(m) {
    const v = m.versamento;
    const body = el(`<div>
      <p style="margin-top:0">Ritenute sui pagamenti di <b>${esc(nomeMese(m.mese))}</b>: <b>${fmtEuro(m.totale)}</b>${codiciTesto(m)}. Scadenza ${fmtDate(m.scadenza)}.</p>
      <div class="form-row">
        <div class="field"><label>Data del versamento (F24)</label><input type="date" id="v-data" value="${esc(v ? v.data_versamento : (oggi < m.scadenza ? oggi : m.scadenza))}"></div>
        <div class="field"><label>Importo versato (€)</label><input ${CAMPO_DECIMALE} id="v-importo" value="${testoDecimale(v ? v.importo : m.totale)}"></div>
      </div>
      <div class="field"><label>Note</label><input type="text" id="v-note" value="${esc(v?.note || '')}" placeholder="es. F24 quietanza n. …, ravvedimento"></div>
      <div id="v-err" style="color:var(--danger);font-size:13px"></div>
    </div>`);
    const footer = el(`<div style="display:flex;gap:10px;width:100%">
      ${v ? '<button class="btn danger" id="v-del">Annulla versamento</button>' : ''}
      <div style="flex:1"></div>
      <button class="btn" id="v-cancel">Chiudi</button>
      <button class="btn primary" id="v-save">Salva</button>
    </div>`);
    const { close } = openModal({ title: 'Versamento ritenute — ' + nomeMese(m.mese), body, footer });
    footer.querySelector('#v-cancel').addEventListener('click', close);
    if (v) footer.querySelector('#v-del').addEventListener('click', async () => {
      if (!await confirmDialog(`Togliere il versamento di ${nomeMese(m.mese)}? Il mese tornerà fra quelli da versare.`, { danger: true, okLabel: 'Togli' })) return;
      try { await ritenute.annullaVersamento(v.id); toast('Versamento tolto', 'ok'); close(); ricarica(); }
      catch (e) { toast('Errore: ' + e.message, 'err'); }
    });
    footer.querySelector('#v-save').addEventListener('click', async () => {
      const err = body.querySelector('#v-err'); err.textContent = '';
      const data_versamento = body.querySelector('#v-data').value;
      const importo = parseEuro(body.querySelector('#v-importo').value);
      if (!data_versamento) { err.textContent = 'Indica la data del versamento.'; return; }
      if (importo === null || importo < 0) { err.textContent = "Indica l'importo versato."; return; }
      const btn = footer.querySelector('#v-save'); btn.disabled = true;
      try {
        await ritenute.segnaVersato({ mese: primoDelMese(m.mese), data_versamento, importo, note: body.querySelector('#v-note').value.trim() });
        toast('Versamento registrato', 'ok'); close(); ricarica();
      } catch (e) { err.textContent = 'Errore: ' + e.message; btn.disabled = false; }
    });
  }

  // Ritenute che matureranno: fatture con ritenuta non ancora saldate.
  function disegnaAperte() {
    const zona = wrap.querySelector('#rt-aperte'); clear(zona);
    const maturate = new Map();
    for (const q of quoteRitenute(fatt)) maturate.set(q.fattura.id, (maturate.get(q.fattura.id) || 0) + q.quota);
    const aperte = fatt.filter(f => f.stato === 'da_pagare' || f.stato === 'pagata_parziale')
      .map(f => ({ f, resta: Math.max(0, Number(f.ritenuta) - (maturate.get(f.id) || 0)) }))
      .filter(x => x.resta > 0.004)
      .sort((a, b) => String(a.f.data_fattura || '').localeCompare(String(b.f.data_fattura || '')));
    if (!aperte.length) return;
    const tot = aperte.reduce((s, x) => s + x.resta, 0);
    const card = el(`<details class="card" style="margin-bottom:18px">
      <summary class="card-h" style="cursor:pointer"><span>Fatture con ritenuta ancora da pagare <span class="chip" style="margin-left:6px">${aperte.length}</span></span><span>${fmtEuro(tot)}</span></summary>
      <div class="card-b tbl-wrap" style="padding-top:10px">
        <div class="muted" style="font-size:13px;margin-bottom:8px">La loro ritenuta si verserà il 16 del mese dopo quello in cui verranno pagate.</div>
        <table class="tbl"><thead><tr><th>Fornitore</th><th>Fattura</th><th class="money-col">Netto</th><th class="money-col">Ritenuta da maturare</th></tr></thead><tbody></tbody></table>
      </div>
    </details>`);
    const tbody = card.querySelector('tbody');
    for (const { f, resta } of aperte) {
      const tr = el(`<tr title="Apri la fattura"><td>${esc(f.fornitore)}</td>
        <td>${f.numero_fattura ? 'n. ' + esc(f.numero_fattura) : '—'}${f.data_fattura ? ` <span class="muted">del ${fmtDate(f.data_fattura)}</span>` : ''}</td>
        <td class="money-col">${fmtEuro(f.importo)}</td><td class="money-col">${fmtEuro(resta)}</td></tr>`);
      rendiCliccabile(tr, () => apriEditor(f.id, ctx, ricarica));
      tbody.appendChild(tr);
    }
    zona.appendChild(card);
  }

  // Fatture registrate prima del campo ritenuta, che la citano nelle note.
  function disegnaNote() {
    const zona = wrap.querySelector('#rt-note'); clear(zona);
    const righe = daNote.map(f => ({ f, importo: ritenutaDaNote(f.note) })).filter(x => x.importo);
    if (!righe.length) return;
    const card = el(`<details class="card" style="margin-bottom:18px" open>
      <summary class="card-h" style="cursor:pointer"><span>Da controllare: ritenuta scritta solo nelle note <span class="chip warn" style="margin-left:6px">${righe.length}</span></span></summary>
      <div class="card-b tbl-wrap" style="padding-top:10px">
        <div class="muted" style="font-size:13px;margin-bottom:8px">Fatture registrate prima che esistesse il campo «ritenuta d'acconto»: nelle note se ne parla, ma la ritenuta non è segnata e quindi non entra nei conti qui sopra. Controlla l'importo e segnala: con «Segna» si usa l'importo letto e il codice tributo 1040, con «Apri» si corregge dalla scheda.</div>
        <table class="tbl"><thead><tr><th>Fornitore</th><th>Fattura</th><th>Note</th><th class="money-col">Ritenuta letta</th><th></th></tr></thead><tbody></tbody></table>
      </div>
    </details>`);
    const tbody = card.querySelector('tbody');
    for (const { f, importo } of righe) {
      const tr = el(`<tr><td>${esc(f.fornitore)}</td>
        <td>${f.numero_fattura ? 'n. ' + esc(f.numero_fattura) : '—'}${f.data_fattura ? ` <span class="muted">del ${fmtDate(f.data_fattura)}</span>` : ''}</td>
        <td class="muted" style="font-size:12.5px;max-width:420px">${esc(f.note)}</td>
        <td class="money-col"><b>${fmtEuro(importo)}</b></td>
        <td style="white-space:nowrap"><button class="btn primary sm" data-segna>Segna</button> <button class="btn ghost sm" data-apri>Apri</button></td></tr>`);
      tr.querySelector('[data-segna]').addEventListener('click', async (e) => {
        e.stopPropagation();
        const b = e.currentTarget; b.disabled = true;
        try { await ritenute.segna(f.id, importo, CODICE_TRIBUTO_DEFAULT); toast(`Ritenuta di ${fmtEuro(importo)} segnata su ${f.fornitore}`, 'ok'); ricarica(); }
        catch (err) { toast('Errore: ' + err.message, 'err'); b.disabled = false; }
      });
      tr.querySelector('[data-apri]').addEventListener('click', (e) => { e.stopPropagation(); apriEditor(f.id, ctx, ricarica); });
      tbody.appendChild(tr);
    }
    zona.appendChild(card);
  }

  disegna();
}

function codiciTesto(m) {
  const voci = Object.entries(m.perCodice);
  if (!voci.length) return '';
  return ' (' + voci.map(([c, v]) => `codice ${esc(c)}${voci.length > 1 ? ' ' + fmtEuro(v) : ''}`).join(', ') + ')';
}

function esportaCsv(mesi, anno) {
  const lines = ["Mese pagamenti;Scadenza versamento;Stato;Data pagamento;Fornitore;Partita IVA;Numero fattura;Data fattura;Codice tributo;Pagato;Ritenuta;Versato il;Importo versato"];
  for (const m of [...mesi].reverse()) {
    for (const r of m.righe) {
      const f = r.fattura;
      lines.push([m.mese, m.scadenza, STATO[m.stato].label, r.pagamento.data_pagamento, f.fornitore, f.partita_iva || '', f.numero_fattura || '', f.data_fattura || '',
        f.ritenuta_codice_tributo || CODICE_TRIBUTO_DEFAULT, euro2(Number(r.pagamento.importo)), euro2(r.quota),
        m.versamento?.data_versamento || '', m.versamento ? euro2(Number(m.versamento.importo)) : ''].map(cellaCsv).join(';'));
    }
  }
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `ritenute-${anno || 'tutte'}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

