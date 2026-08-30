import { fatture, pagamenti, noteCredito, impostazioni, proposte } from '../data/store.js';
import { el, clear, esc, openModal, confirmDialog, toast, fmtEuro, fmtDate, todayISO, parseEuro, debounce } from '../lib/ui.js';
import { isFileFatturaElettronica, isXmlFatturaElettronica, leggiXmlFattura, parseFatturaXml, METODI } from '../lib/xmlFattura.js';

export { METODI };

// Riporta un valore qualsiasi dentro la lista: così un metodo non previsto
// diventa "altro" invece di sparire senza dire nulla.
function metodoAmmesso(v) {
  if (!v) return "";
  return METODI.includes(v) ? v : "altro";
}

// ============================================================
//  Editor di una singola fattura (nuova o esistente)
// ============================================================
export async function apriEditor(id, ctx, onSaved) {
  let rec = id ? await fatture.get(id) : {
    fornitore: '', numero_fattura: '', data_fattura: todayISO(), importo: '', scadenza: '',
    stato: 'da_pagare', metodo_pagamento: '', note: '', estratta_da_ai: false,
  };
  let viaAI = false; // il file non viene conservato: serve solo a sapere se i campi vengono dall'AI
  // I pagamenti vengono scritti sul database subito, non al "Salva": se non
  // segnassimo la cosa, chiudendo con Annulla/✕ la dashboard resterebbe ferma
  // a stato e residuo precedenti.
  let datiModificati = false;
  let previewUrl = null; // anteprima del file appena scelto: solo in memoria, mai caricata da nessuna parte

  const body = el(`<div>
    <div id="upload-row" ${id ? 'style="display:none"' : ''}>
      <div class="field">
        <label>Compila automaticamente da file (opzionale)</label>
        <input type="file" id="file-in" accept=".pdf,.xml,.p7m,image/*">
        <div class="hint" id="upload-hint">PDF/immagine → letti con AI (Gemini). XML di fattura elettronica, anche firmato (.p7m) → letto direttamente, gratis e senza AI.</div>
        <div id="upload-status"></div>
      </div>
    </div>
    <div class="editor-2col">
      <div class="col">
        <div class="form-row">
          <div class="field"><label>Fornitore *</label><input type="text" id="f-fornitore" value="${esc(rec.fornitore)}"></div>
          <div class="field"><label>Numero fattura</label><input type="text" id="f-numero" value="${esc(rec.numero_fattura || '')}"></div>
        </div>
        <div class="form-row three">
          <div class="field"><label>Data fattura</label><input type="date" id="f-data" value="${esc(rec.data_fattura || '')}"></div>
          <div class="field"><label>Importo (€) *</label><input type="number" step="0.01" id="f-importo" value="${esc(rec.importo ?? '')}"></div>
          <div class="field"><label>Scadenza</label><input type="date" id="f-scadenza" value="${esc(rec.scadenza || '')}"></div>
        </div>
        <div class="form-row">
          <div class="field"><label>Metodo di pagamento</label><select id="f-metodo">${METODI.map(m => `<option value="${esc(m)}" ${rec.metodo_pagamento === m ? 'selected' : ''}>${m || '—'}</option>`).join('')}</select></div>
        </div>
        <div class="field"><label>Note</label><textarea id="f-note" rows="2">${esc(rec.note || '')}</textarea></div>
        <div id="pag-zone"></div>
        <div id="note-credito-zone"></div>
        <div id="err" style="color:var(--danger);font-size:13px"></div>
      </div>
      <div class="col" id="preview-col" style="display:none">
        <div class="file-preview" id="file-preview"></div>
      </div>
    </div>
  </div>`);

  // Pagamenti e note di credito concorrono entrambi a "quanto resta da
  // pagare": un cambiamento nell'uno deve aggiornare anche il riepilogo
  // mostrato nell'altro, non solo la propria lista. Il primo disegno (al
  // solo apertura dell'editor) NON deve segnare datiModificati: altrimenti
  // anche solo guardando una fattura, senza toccare nulla, la dashboard
  // sottostante verrebbe ricaricata inutilmente alla chiusura.
  function disegnaPagamentiENote() {
    renderPagamenti(body.querySelector('#pag-zone'), rec, ctx, refreshPagamentiENote);
    renderNoteCredito(body.querySelector('#note-credito-zone'), rec, ctx, refreshPagamentiENote);
  }
  function refreshPagamentiENote(fresh) {
    rec = fresh; datiModificati = true;
    disegnaPagamentiENote();
  }
  if (id) disegnaPagamentiENote();

  body.querySelector('#file-in').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    mostraAnteprima(file);
    const hint = body.querySelector('#upload-hint');
    const status = body.querySelector('#upload-status');
    clear(status);
    hint.textContent = 'Lettura in corso…';
    try {
      const estratti = await estraiCampiDaFile(file);
      if (estratti.fornitore) body.querySelector('#f-fornitore').value = estratti.fornitore;
      if (estratti.numero_fattura) body.querySelector('#f-numero').value = estratti.numero_fattura;
      if (estratti.data_fattura) body.querySelector('#f-data').value = estratti.data_fattura;
      if (estratti.importo !== null && estratti.importo !== undefined) body.querySelector('#f-importo').value = estratti.importo;
      if (estratti.scadenza) body.querySelector('#f-scadenza').value = estratti.scadenza;
      if (estratti.metodo_pagamento) body.querySelector('#f-metodo').value = metodoAmmesso(estratti.metodo_pagamento);
      if (estratti.note) body.querySelector('#f-note').value = estratti.note;
      viaAI = !!estratti._viaAI;
      hint.textContent = '✅ Campi compilati automaticamente — confronta con l\'anteprima qui a fianco e correggi se necessario prima di salvare.';
    } catch (err) {
      hint.textContent = '';
      status.appendChild(bannerErroreLettura(err.message));
    }
  });

  // L'anteprima resta solo lato client (URL.createObjectURL): il file non
  // viene mai inviato altrove né conservato, serve solo per il confronto
  // visivo con i campi letti prima di salvare.
  function mostraAnteprima(file) {
    const col = body.querySelector('#preview-col');
    const box = body.querySelector('#file-preview');
    clear(box);
    if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
    const { node, url } = renderAnteprimaFile(file);
    previewUrl = url;
    box.appendChild(node);
    col.style.display = '';
  }

  const footer = el(`<div style="display:flex;gap:10px;width:100%">
    ${id ? '<button class="btn danger" id="del">Elimina</button>' : ''}
    <div style="flex:1"></div>
    <button class="btn" id="cancel">Annulla</button>
    <button class="btn primary" id="save">Salva</button>
  </div>`);

  const { close, modal } = openModal({
    title: id ? 'Modifica fattura' : 'Nuova fattura', body, footer, wide: true,
    onClose: () => { if (previewUrl) URL.revokeObjectURL(previewUrl); if (datiModificati) onSaved(); },
  });
  modal.style.maxWidth = '1400px'; // largo abbastanza da rendere l'anteprima del documento leggibile

  footer.querySelector('#cancel').addEventListener('click', close);
  if (id) footer.querySelector('#del').addEventListener('click', async () => {
    if (!await confirmDialog(`Eliminare la fattura di ${rec.fornitore}? L'operazione è definitiva (resta traccia nel registro modifiche).`, { danger: true, okLabel: 'Elimina' })) return;
    try { await fatture.remove(id); toast('Fattura eliminata', 'ok'); datiModificati = true; close(); }
    catch (e) { toast('Errore: ' + e.message, 'err'); }
  });
  footer.querySelector('#save').addEventListener('click', async () => {
    const err = body.querySelector('#err'); err.textContent = '';
    const payload = {
      id: id || undefined,
      fornitore: body.querySelector('#f-fornitore').value.trim(),
      numero_fattura: body.querySelector('#f-numero').value.trim() || null,
      data_fattura: body.querySelector('#f-data').value || null,
      importo: parseEuro(body.querySelector('#f-importo').value),
      scadenza: body.querySelector('#f-scadenza').value || null,
      metodo_pagamento: body.querySelector('#f-metodo').value || null,
      note: body.querySelector('#f-note').value.trim() || null,
    };
    if (!payload.fornitore) { err.textContent = 'Il fornitore è obbligatorio.'; return; }
    if (payload.importo === null || payload.importo <= 0) { err.textContent = 'Indica un importo valido.'; return; }
    if (!await confermaSeDuplicato(payload, id)) return;
    const btn = footer.querySelector('#save'); const old = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<span class="spinner sm"></span> Salvataggio…';
    try {
      await salvaFattura(payload, viaAI);
      toast(id ? 'Fattura aggiornata' : 'Fattura creata', 'ok');
      datiModificati = true;
      close();
    } catch (e) {
      err.textContent = 'Errore: ' + e.message;
      btn.disabled = false; btn.innerHTML = old;
    }
  });
}

// ============================================================
//  Pagamento rapido — popup minimale aperto cliccando sul chip di stato in
//  dashboard, per registrare un pagamento senza aprire l'intero editor.
//  Precompila l'importo con il residuo (saldo per intero con un click), ma
//  resta modificabile per registrare un acconto.
// ============================================================
export function apriPagamentoRapido(rec, ctx, onSaved) {
  const body = el(`<div>
    <p class="muted" style="margin:0 0 14px;font-size:14px">${esc(rec.fornitore)} ${rec.numero_fattura ? '· ' + esc(rec.numero_fattura) : ''} — residuo <b>${fmtEuro(rec._residuo)}</b></p>
    <div class="form-row three" style="align-items:end">
      <div class="field"><label>Data</label><input type="date" id="qp-data" value="${todayISO()}"></div>
      <div class="field"><label>Importo (€)</label><input type="number" step="0.01" id="qp-importo" value="${rec._residuo > 0 ? rec._residuo.toFixed(2) : ''}"></div>
      <div class="field"><label>Metodo</label><select id="qp-metodo">${METODI.map(m => `<option value="${esc(m)}" ${rec.metodo_pagamento === m ? 'selected' : ''}>${m || '—'}</option>`).join('')}</select></div>
    </div>
    <div id="qp-err" style="color:var(--danger);font-size:13px"></div>
  </div>`);
  const isAdmin = ctx.user.ruolo === 'admin';
  const footer = el(`<div style="display:flex;gap:10px;width:100%">
    ${isAdmin ? '<button class="btn ghost" id="qp-proponi">Proponi pagamento</button>' : ''}
    <div style="flex:1"></div>
    <button class="btn" id="qp-cancel">Annulla</button>
    <button class="btn primary" id="qp-save">Registra pagamento</button>
  </div>`);
  const { close } = openModal({ title: 'Segna pagamento — ' + rec.fornitore, body, footer });
  footer.querySelector('#qp-cancel').addEventListener('click', close);
  const btnProponi = footer.querySelector('#qp-proponi');
  if (btnProponi) btnProponi.addEventListener('click', () => { close(); apriProponiPagamento(rec, ctx, onSaved); });
  footer.querySelector('#qp-save').addEventListener('click', async () => {
    const err = body.querySelector('#qp-err'); err.textContent = '';
    const importo = parseEuro(body.querySelector('#qp-importo').value);
    const data_pagamento = body.querySelector('#qp-data').value;
    if (!importo || importo <= 0) { err.textContent = 'Indica un importo valido.'; return; }
    if (!data_pagamento) { err.textContent = 'Indica la data del pagamento.'; return; }
    if (!await confermaSeSuperaResiduo(importo, rec._residuo)) return;
    const btn = footer.querySelector('#qp-save'); const old = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<span class="spinner sm"></span> Registrazione…';
    try {
      await pagamenti.add(rec.id, { importo, data_pagamento, metodo: body.querySelector('#qp-metodo').value || null }, ctx.user);
      toast('Pagamento registrato', 'ok');
      close();
      onSaved();
    } catch (e) {
      err.textContent = 'Errore: ' + e.message;
      btn.disabled = false; btn.innerHTML = old;
    }
  });
}

// ============================================================
//  Proposta di pagamento — l'operatore la invia, ma non registra il
//  pagamento vero e proprio: solo l'admin, confermandola, lo fa (vedi
//  proposte.confermare in data/store.js). Stessa forma della finestra di
//  pagamento rapido, così l'esperienza resta coerente fra i due ruoli.
// ============================================================
export function apriProponiPagamento(rec, ctx, onSaved) {
  const body = el(`<div>
    <p class="muted" style="margin:0 0 14px;font-size:14px">${esc(rec.fornitore)} ${rec.numero_fattura ? '· ' + esc(rec.numero_fattura) : ''} — residuo <b>${fmtEuro(rec._residuo)}</b></p>
    <div class="form-row three" style="align-items:end">
      <div class="field"><label>Data prevista</label><input type="date" id="pp-data" value="${todayISO()}"></div>
      <div class="field"><label>Importo (€)</label><input type="number" step="0.01" id="pp-importo" value="${rec._residuo > 0 ? rec._residuo.toFixed(2) : ''}"></div>
      <div class="field"><label>Metodo</label><select id="pp-metodo">${METODI.map(m => `<option value="${esc(m)}" ${(rec.metodo_pagamento || 'bonifico') === m ? 'selected' : ''}>${m || '—'}</option>`).join('')}</select></div>
    </div>
    <div class="field"><label>Note per l'admin (opzionale)</label><textarea id="pp-note" rows="2"></textarea></div>
    <div id="pp-err" style="color:var(--danger);font-size:13px"></div>
  </div>`);
  const footer = el(`<div style="display:flex;gap:10px;width:100%">
    <div style="flex:1"></div>
    <button class="btn" id="pp-cancel">Annulla</button>
    <button class="btn primary" id="pp-save">Invia proposta</button>
  </div>`);
  const { close } = openModal({ title: 'Proponi pagamento — ' + rec.fornitore, body, footer });
  footer.querySelector('#pp-cancel').addEventListener('click', close);
  footer.querySelector('#pp-save').addEventListener('click', async () => {
    const err = body.querySelector('#pp-err'); err.textContent = '';
    const importo = parseEuro(body.querySelector('#pp-importo').value);
    const data_prevista = body.querySelector('#pp-data').value || null;
    if (!importo || importo <= 0) { err.textContent = 'Indica un importo valido.'; return; }
    try {
      const giaInAttesa = await proposte.contaInAttesaPerFattura(rec.id);
      if (giaInAttesa > 0 && !await confirmDialog(
        `Per questa fattura c'è già ${giaInAttesa === 1 ? 'una proposta' : giaInAttesa + ' proposte'} in attesa di conferma. Inviarne comunque un'altra?`,
        { danger: true, okLabel: 'Invia comunque' })) return;
    } catch { /* un intoppo nel controllo non deve impedire l'invio */ }
    const btn = footer.querySelector('#pp-save'); const old = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<span class="spinner sm"></span> Invio…';
    try {
      await proposte.create(rec.id, {
        importo, data_prevista,
        metodo: body.querySelector('#pp-metodo').value || null,
        note: body.querySelector('#pp-note').value.trim() || null,
      }, ctx.user);
      toast('Proposta inviata all\'amministratore', 'ok');
      close();
      onSaved();
    } catch (e) {
      err.textContent = 'Errore: ' + e.message;
      btn.disabled = false; btn.innerHTML = old;
    }
  });
}

function renderPagamenti(node, rec, ctx, onChange) {
  clear(node);
  const isAdmin = ctx.user.ruolo === 'admin';
  const wrap = el(`<div class="card" style="margin-top:6px"><div class="card-h">Pagamenti / acconti</div><div class="card-b">
    <div class="pag-list"></div>
    <div class="residuo-box"><span>Pagato: <b>${fmtEuro(rec._pagato)}</b></span>${rec._stornato > 0 ? `<span>Stornato: <b>${fmtEuro(rec._stornato)}</b></span>` : ''}<span>Residuo: <b>${fmtEuro(rec._residuo)}</b></span></div>
    ${isAdmin ? '<button class="btn sm" style="margin-top:10px" id="add-pag">+ Aggiungi pagamento</button><div id="add-pag-form" style="display:none;margin-top:10px"></div>' : ''}
    ${rec._residuo > 0
      ? `<button class="btn ${isAdmin ? 'ghost' : ''} sm" style="margin-top:10px" id="proponi-pag">+ Proponi pagamento</button>${isAdmin ? '' : '<p class="hint" style="margin-top:8px">Solo l\'amministratore registra i pagamenti effettivi: qui puoi solo proporli.</p>'}`
      : ''}
  </div></div>`);
  const list = wrap.querySelector('.pag-list');
  for (const p of (rec.pagamenti || []).slice().sort((a, b) => (a.data_pagamento || '').localeCompare(b.data_pagamento || ''))) {
    const row = el(`<div class="pag-row"><span>${fmtDate(p.data_pagamento)} · ${fmtEuro(p.importo)} ${p.metodo ? '· ' + esc(p.metodo) : ''} ${p.note ? '· ' + esc(p.note) : ''}</span>${isAdmin ? `<button class="rm" data-id="${p.id}">✕</button>` : ''}</div>`);
    if (isAdmin) row.querySelector('.rm').addEventListener('click', async () => {
      if (!await confirmDialog('Rimuovere questo pagamento?', { danger: true, okLabel: 'Rimuovi' })) return;
      try {
        await pagamenti.remove(p.id);
        onChange(await fatture.get(rec.id));
        toast('Pagamento rimosso', 'ok');
      } catch (e) { toast('Errore: ' + e.message, 'err'); }
    });
    list.appendChild(row);
  }
  if (!(rec.pagamenti || []).length) list.appendChild(el('<div class="muted" style="font-size:13px">Nessun pagamento registrato.</div>'));

  if (isAdmin) {
    wrap.querySelector('#add-pag').addEventListener('click', () => {
      const formZone = wrap.querySelector('#add-pag-form');
      formZone.style.display = 'block';
      clear(formZone);
      const f = el(`<div class="form-row three" style="align-items:end">
        <div class="field"><label>Data</label><input type="date" id="p-data" value="${todayISO()}"></div>
        <div class="field"><label>Importo (€)</label><input type="number" step="0.01" id="p-importo" value="${rec._residuo > 0 ? rec._residuo.toFixed(2) : ''}"></div>
        <div class="field"><label>Metodo</label><select id="p-metodo">${METODI.map(m => `<option value="${esc(m)}">${m || '—'}</option>`).join('')}</select></div>
      </div><button class="btn primary sm" id="p-save">Registra pagamento</button>`);
      formZone.appendChild(f);
      f.querySelector('#p-save').addEventListener('click', async () => {
        const importo = parseEuro(f.querySelector('#p-importo').value);
        const data_pagamento = f.querySelector('#p-data').value;
        if (!importo || importo <= 0 || !data_pagamento) { toast('Inserisci data e importo validi', 'err'); return; }
        if (!await confermaSeSuperaResiduo(importo, rec._residuo)) return;
        try {
          await pagamenti.add(rec.id, { importo, data_pagamento, metodo: f.querySelector('#p-metodo').value || null }, ctx.user);
          onChange(await fatture.get(rec.id));
          toast('Pagamento registrato', 'ok');
        } catch (e) { toast('Errore: ' + e.message, 'err'); }
      });
    });
  }
  const btnProponi = wrap.querySelector('#proponi-pag');
  if (btnProponi) btnProponi.addEventListener('click', () => apriProponiPagamento(rec, ctx, async () => onChange(await fatture.get(rec.id))));
  node.appendChild(wrap);
}

// ============================================================
//  Note di credito — documenti ricevuti dai fornitori: a differenza dei
//  pagamenti veri e propri, anche l'operatore può registrarle e rimuoverle.
// ============================================================
function renderNoteCredito(node, rec, ctx, onChange) {
  clear(node);
  const righe = rec.note_credito_righe || [];
  const wrap = el(`<div class="card" style="margin-top:14px"><div class="card-h">Note di credito</div><div class="card-b">
    <div class="nc-list"></div>
    <button class="btn sm" style="margin-top:10px" id="add-nc">+ Aggiungi nota di credito</button>
  </div></div>`);
  const list = wrap.querySelector('.nc-list');
  for (const n of righe.slice().sort((a, b) => (a.note_credito?.data || '').localeCompare(b.note_credito?.data || ''))) {
    const nc = n.note_credito || {};
    const row = el(`<div class="pag-row"><span>${fmtDate(nc.data)} · ${fmtEuro(n.importo)} ${nc.numero ? '· n. ' + esc(nc.numero) : ''} ${nc.note ? '· ' + esc(nc.note) : ''}</span><button class="rm" data-id="${n.id}">✕</button></div>`);
    row.querySelector('.rm').addEventListener('click', async () => {
      if (!await confirmDialog('Rimuovere il collegamento di questa nota di credito a questa fattura?', { danger: true, okLabel: 'Rimuovi' })) return;
      try {
        await noteCredito.removeRiga(n.id);
        onChange(await fatture.get(rec.id));
        toast('Nota di credito rimossa', 'ok');
      } catch (e) { toast('Errore: ' + e.message, 'err'); }
    });
    list.appendChild(row);
  }
  if (!righe.length) list.appendChild(el('<div class="muted" style="font-size:13px">Nessuna nota di credito registrata.</div>'));

  wrap.querySelector('#add-nc').addEventListener('click', () => apriNuovaNotaCredito(ctx, async () => onChange(await fatture.get(rec.id)), rec));
  node.appendChild(wrap);
}

// ============================================================
//  Nuova nota di credito — può stornare più fatture insieme, ciascuna per
//  una quota diversa: capita spesso nella pratica che un unico documento
//  copra più fatture dello stesso fornitore. Aperta sia da qui (con la
//  fattura corrente già preselezionata) sia dalla dashboard come inserimento
//  manuale a sé stante (nessuna fattura preselezionata).
// ============================================================
export function apriNuovaNotaCredito(ctx, onSaved, fatturaPreselezionata) {
  const body = el(`<div>
    <div class="form-row three">
      <div class="field"><label>Numero</label><input type="text" id="nc-numero"></div>
      <div class="field"><label>Data</label><input type="date" id="nc-data" value="${todayISO()}"></div>
      <div class="field"><label>Note</label><input type="text" id="nc-note"></div>
    </div>
    <div id="nc-pinned"></div>
    <div class="field"><label>Altre fatture stornate da questa nota</label>
      <input type="text" id="nc-cerca" placeholder="Cerca fornitore o numero fattura…">
    </div>
    <div id="nc-elenco" style="max-height:320px;overflow-y:auto;margin-top:8px"><div class="spinner sm"></div></div>
    <div class="residuo-box" style="margin-top:10px"><span>Fatture selezionate: <b id="nc-n-selezionate">0</b></span><span>Totale storno: <b id="nc-tot-selezionato">€ 0,00</b></span></div>
    <div id="nc-err" style="color:var(--danger);font-size:13px;margin-top:8px"></div>
  </div>`);
  const footer = el(`<div style="display:flex;gap:10px;width:100%">
    <div style="flex:1"></div>
    <button class="btn" id="nc-cancel">Annulla</button>
    <button class="btn primary" id="nc-save">Registra nota di credito</button>
  </div>`);
  const { close } = openModal({ title: 'Nuova nota di credito', body, footer, wide: true });
  footer.querySelector('#nc-cancel').addEventListener('click', close);

  const selezionate = new Map(); // fattura_id -> importo

  function aggiornaRiepilogo() {
    const tot = [...selezionate.values()].reduce((s, v) => s + v, 0);
    body.querySelector('#nc-n-selezionate').textContent = selezionate.size;
    body.querySelector('#nc-tot-selezionato').textContent = fmtEuro(tot);
  }

  // Riga selezionabile per una fattura: usata sia per l'elenco cercabile sia
  // per la fattura preselezionata "appuntata" in cima, così restano sempre
  // coerenti fra loro. Il default è il residuo VERO (anche se 0): meglio
  // costringere a scrivere un importo a mano che proporre per sbaglio
  // l'intero valore di una fattura già saldata.
  function creaRigaFattura(f, preselezionata) {
    const checked = preselezionata || selezionate.has(f.id);
    if (checked && !selezionate.has(f.id)) selezionate.set(f.id, f._residuo);
    const row = el(`<div class="pag-row" style="align-items:center">
      <label style="display:flex;align-items:center;gap:8px;flex:1;cursor:pointer">
        <input type="checkbox" ${checked ? 'checked' : ''}>
        <span>${esc(f.fornitore)} ${f.numero_fattura ? '· n. ' + esc(f.numero_fattura) : ''} · residuo ${fmtEuro(f._residuo)}</span>
      </label>
      <input type="number" step="0.01" style="width:110px" placeholder="Importo €" value="${checked ? selezionate.get(f.id).toFixed(2) : ''}" ${checked ? '' : 'disabled'}>
    </div>`);
    const checkbox = row.querySelector('input[type=checkbox]');
    const importoInput = row.querySelector('input[type=number]');
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        selezionate.set(f.id, f._residuo);
        importoInput.value = f._residuo.toFixed(2);
        importoInput.disabled = false;
      } else {
        selezionate.delete(f.id);
        importoInput.value = '';
        importoInput.disabled = true;
      }
      aggiornaRiepilogo();
    });
    importoInput.addEventListener('input', () => {
      const v = parseEuro(importoInput.value);
      if (v && v > 0) selezionate.set(f.id, v);
      aggiornaRiepilogo();
    });
    return row;
  }

  fatture.list().then(tutte => {
    // La fattura preselezionata ha una riga fissa, sempre visibile, separata
    // dall'elenco cercabile qui sotto: così resta sempre sotto controllo,
    // anche se ce ne sono più di 200 (il limite di visualizzazione
    // dell'elenco cercabile) o se non compare nella pagina corrente.
    if (fatturaPreselezionata) {
      body.querySelector('#nc-pinned').appendChild(creaRigaFattura(fatturaPreselezionata, true));
      aggiornaRiepilogo();
    }
    const apribili = tutte.filter(f => f.stato !== 'stornata' && f.id !== fatturaPreselezionata?.id);

    function disegnaElenco(filtro) {
      const elenco = body.querySelector('#nc-elenco');
      clear(elenco);
      const q = (filtro || '').trim().toLowerCase();
      const righeMostrate = apribili.filter(f => !q || (f.fornitore || '').toLowerCase().includes(q) || (f.numero_fattura || '').toLowerCase().includes(q));
      if (!righeMostrate.length) { elenco.appendChild(el('<div class="muted" style="font-size:13px">Nessuna fattura trovata.</div>')); return; }
      for (const f of righeMostrate.slice(0, 200)) elenco.appendChild(creaRigaFattura(f, false)); // limite di visualizzazione: la ricerca restringe, non serve mostrarle tutte
    }

    disegnaElenco('');
    aggiornaRiepilogo();
    body.querySelector('#nc-cerca').addEventListener('input', debounce(e => disegnaElenco(e.target.value), 200));
  });

  footer.querySelector('#nc-save').addEventListener('click', async () => {
    const err = body.querySelector('#nc-err'); err.textContent = '';
    const data = body.querySelector('#nc-data').value;
    if (!data) { err.textContent = 'Indica la data della nota di credito.'; return; }
    if (!selezionate.size) { err.textContent = 'Seleziona almeno una fattura da stornare.'; return; }
    const righe = [...selezionate.entries()].map(([fattura_id, importo]) => ({ fattura_id, importo }));
    if (righe.some(r => !r.importo || r.importo <= 0)) { err.textContent = 'Ogni fattura selezionata deve avere un importo valido.'; return; }
    const btn = footer.querySelector('#nc-save'); const old = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<span class="spinner sm"></span> Registrazione…';
    try {
      await noteCredito.create({
        numero: body.querySelector('#nc-numero').value.trim() || null,
        data,
        note: body.querySelector('#nc-note').value.trim() || null,
      }, righe);
      toast(`Nota di credito registrata su ${righe.length} fattura/e`, 'ok');
      close();
      onSaved();
    } catch (e) {
      err.textContent = 'Errore: ' + e.message;
      btn.disabled = false; btn.innerHTML = old;
    }
  });
}

// ============================================================
//  Caricamento multiplo (dashboard → "Carica PDF/XML", o drag&drop sulla
//  dashboard: in quel caso i file arrivano già in `fileIniziali`).
// ------------------------------------------------------------
//  Le fatture si elaborano una alla volta, a grandezza piena (stessa
//  anteprima dell'editor singolo): con più file mostrati assieme
//  l'anteprima di ciascuno era troppo piccola per essere leggibile. Salvando
//  o scartando la fattura corrente si passa automaticamente alla successiva
//  in coda; si possono comunque trascinare altri file mentre si lavora.
// ============================================================
export function apriUpload(ctx, onSaved, fileIniziali) {
  const body = el(`<div>
    <div class="dropzone" id="dz">
      <div class="big">📎</div>
      <div><b>Trascina qui i file</b> oppure clicca per selezionarli</div>
      <div class="hint">PDF/immagini (letti con AI Gemini) o XML di fattura elettronica, anche firmati .p7m (letti gratis, senza AI). Si elaborano una alla volta.</div>
      <input type="file" id="dz-input" multiple accept=".pdf,.xml,.p7m,image/*" style="display:none">
    </div>
    <div class="upload-progress" id="up-progress" style="display:none"></div>
    <div id="up-corrente"></div>
  </div>`);
  const footer = el(`<div style="display:flex;justify-content:flex-end;width:100%"><button class="btn" id="chiudi">Chiudi</button></div>`);
  // Le fatture si salvano una alla volta: la dashboard va ricaricata a
  // prescindere da come si chiude la finestra (pulsante Chiudi, ✕, Esc, sfondo).
  let salvateAlmenoUna = false;
  const previewUrls = []; // anteprime create per i file di questa sessione: revocate tutte alla chiusura
  const { close, modal } = openModal({
    title: 'Carica fatture (PDF / XML)', body, footer, wide: true,
    onClose: () => { previewUrls.forEach(u => URL.revokeObjectURL(u)); if (salvateAlmenoUna) onSaved(); },
  });
  modal.style.maxWidth = '1500px'; // largo abbastanza da rendere l'anteprima del documento leggibile
  footer.querySelector('#chiudi').addEventListener('click', () => close());

  const dz = body.querySelector('#dz');
  const input = body.querySelector('#dz-input');
  dz.addEventListener('click', () => input.click());
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
  dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('drag'); handleFiles(e.dataTransfer.files); });
  input.addEventListener('change', () => handleFiles(input.files));

  const coda = [];
  let totale = 0;       // file arrivati in totale in questa sessione
  let completate = 0;   // salvate o scartate
  let corrente = null;  // file mostrato adesso, o null se la coda è libera

  if (fileIniziali && fileIniziali.length) handleFiles(fileIniziali);

  function handleFiles(fileList) {
    for (const file of fileList) { coda.push(file); totale++; }
    aggiornaProgresso();
    avanza();
  }

  function aggiornaProgresso() {
    const prog = body.querySelector('#up-progress');
    if (!totale) { prog.style.display = 'none'; return; }
    prog.style.display = '';
    prog.textContent = `Fattura ${Math.min(completate + 1, totale)} di ${totale}`;
  }

  function avanza() {
    if (corrente) return; // una fattura è già in visualizzazione: si aspetta salva/scarta
    const zona = body.querySelector('#up-corrente');
    if (!coda.length) {
      clear(zona);
      if (totale) zona.appendChild(el(`<div class="empty-state"><div class="big">✅</div><p>Tutti i file caricati sono stati elaborati.</p></div>`));
      return;
    }
    corrente = coda.shift();
    aggiornaProgresso();
    mostraCorrente(corrente);
  }

  function completaCorrente() {
    corrente = null;
    completate++;
    avanza();
  }

  function mostraCorrente(file) {
    const zona = body.querySelector('#up-corrente');
    clear(zona);
    const box = el(`<div class="upload-item">
      <div class="u-head"><span>📄 ${esc(file.name)}</span><span class="u-status">Lettura in corso…</span></div>
      <div class="u-errore-zona"></div>
      <div class="editor-2col">
        <div class="col">
          <div class="u-fields">
            <div class="field"><label>Fornitore</label><input type="text" class="i-fornitore"></div>
            <div class="field"><label>N. fattura</label><input type="text" class="i-numero"></div>
            <div class="field"><label>Data</label><input type="date" class="i-data"></div>
            <div class="field"><label>Importo €</label><input type="number" step="0.01" class="i-importo"></div>
          </div>
          <div class="u-fields" style="margin-top:8px">
            <div class="field"><label>Scadenza</label><input type="date" class="i-scadenza"></div>
            <div class="field"><label>Metodo</label><select class="i-metodo">${METODI.map(m => `<option value="${esc(m)}">${m || '—'}</option>`).join('')}</select></div>
            <div class="field" style="grid-column:span 2"><label>Note</label><input type="text" class="i-note"></div>
          </div>
          <div style="display:flex;gap:8px;margin-top:12px">
            <button class="btn primary i-save">💾 Salva fattura</button>
            <button class="btn ghost i-skip">Scarta</button>
          </div>
          <div class="i-err" style="color:var(--danger);font-size:13px;margin-top:8px"></div>
        </div>
        <div class="col" id="preview-col"><div class="file-preview" id="file-preview"></div></div>
      </div>
    </div>`);
    zona.appendChild(box);

    const { node, url } = renderAnteprimaFile(file);
    if (url) previewUrls.push(url);
    box.querySelector('#file-preview').appendChild(node);

    const status = box.querySelector('.u-status');
    let estrattiCorrenti = {};
    estraiCampiDaFile(file).then(estratti => {
      estrattiCorrenti = estratti;
      status.textContent = estratti._viaAI ? 'Letto con AI — verifica prima di salvare' : 'Letto da XML — verifica prima di salvare';
      if (estratti.fornitore) box.querySelector('.i-fornitore').value = estratti.fornitore;
      if (estratti.numero_fattura) box.querySelector('.i-numero').value = estratti.numero_fattura;
      if (estratti.data_fattura) box.querySelector('.i-data').value = estratti.data_fattura;
      if (estratti.importo !== null && estratti.importo !== undefined) box.querySelector('.i-importo').value = estratti.importo;
      if (estratti.scadenza) box.querySelector('.i-scadenza').value = estratti.scadenza;
      if (estratti.metodo_pagamento) box.querySelector('.i-metodo').value = metodoAmmesso(estratti.metodo_pagamento);
      if (estratti.note) box.querySelector('.i-note').value = estratti.note;
    }).catch(err => {
      status.textContent = '⚠️ errore di lettura';
      box.querySelector('.u-errore-zona').appendChild(bannerErroreLettura(err.message));
    });

    box.querySelector('.i-skip').addEventListener('click', () => completaCorrente());
    box.querySelector('.i-save').addEventListener('click', async () => {
      const payload = {
        fornitore: box.querySelector('.i-fornitore').value.trim(),
        numero_fattura: box.querySelector('.i-numero').value.trim() || null,
        data_fattura: box.querySelector('.i-data').value || null,
        importo: parseEuro(box.querySelector('.i-importo').value),
        scadenza: box.querySelector('.i-scadenza').value || null,
        metodo_pagamento: box.querySelector('.i-metodo').value || null,
        note: box.querySelector('.i-note').value.trim() || null,
      };
      const err = box.querySelector('.i-err'); err.textContent = '';
      if (!payload.fornitore || !payload.importo || payload.importo <= 0) { err.textContent = 'Compila almeno fornitore e importo.'; return; }
      if (!await confermaSeDuplicato(payload, null)) return;
      const btn = box.querySelector('.i-save'); btn.disabled = true; btn.innerHTML = '<span class="spinner sm"></span> Salvataggio…';
      try {
        await salvaFattura(payload, estrattiCorrenti._viaAI);
        salvateAlmenoUna = true;
        toast('Fattura salvata', 'ok');
        completaCorrente();
      } catch (e) {
        err.textContent = 'Errore: ' + e.message;
        btn.disabled = false; btn.innerHTML = '💾 Salva fattura';
      }
    });
  }
}

// ============================================================
//  Controllo duplicati
// ------------------------------------------------------------
//  Non esiste un vincolo di unicità nel database: fornitori diversi possono
//  usare la stessa numerazione, e reinserire volutamente un documento deve
//  restare possibile. Qui ci si limita ad avvisare quando esiste già una
//  fattura con lo stesso numero dello stesso fornitore, chiedendo conferma:
//  prima il doppione veniva creato in silenzio e finiva nei totali due volte.
//  Ritorna true se si può procedere.
// ============================================================
// Avviso non bloccante quando un pagamento supera il residuo indicato: un
// errore di battitura (un importo con uno zero di troppo) altrimenti registra
// un "sovrapagamento" che sparisce silenziosamente, perché _residuo resta
// clampato a 0 (vedi withResiduo in data/store.js) invece di segnalare
// l'anomalia. Esportata perché usata anche da proposte.js nella conferma.
export async function confermaSeSuperaResiduo(importo, residuo) {
  if (importo <= residuo) return true;
  return confirmDialog(
    `L'importo (${fmtEuro(importo)}) supera il residuo della fattura (${fmtEuro(residuo)}). Registrare comunque?`,
    { danger: true, okLabel: 'Registra comunque' });
}

async function confermaSeDuplicato(payload, escludiId) {
  let doppia = null;
  try { doppia = await fatture.trovaDuplicato(payload, escludiId); }
  catch { return true; }   // un intoppo nella verifica non deve impedire il salvataggio
  if (!doppia) return true;
  return confirmDialog(
    "Esiste già una fattura di " + doppia.fornitore + " con numero " + doppia.numero_fattura +
    " (del " + fmtDate(doppia.data_fattura) + ", " + fmtEuro(doppia.importo) + "). Salvare comunque?",
    { danger: true, okLabel: "Salva comunque" });
}

// ============================================================
//  Salvataggio di una fattura
// ------------------------------------------------------------
//  Il file caricato serve solo per estrarre i campi (AI o parsing XML): non
//  viene conservato da nessuna parte, quindi qui si salva solo il record.
//  Se manca la scadenza di una fattura NUOVA (senza data indicata, letta o
//  inserita a mano) si applica lo scadenzario di default configurato in
//  Impostazioni. Solo alla creazione, non in modifica: altrimenti svuotare
//  deliberatamente la scadenza di una fattura già esistente non aveva alcun
//  effetto, perché veniva ricalcolata da capo ad ogni salvataggio.
// ============================================================
async function salvaFattura(payload, viaAI) {
  if (payload.id) return fatture.save(payload);
  if (!payload.scadenza) payload.scadenza = await scadenzaDefault(payload.data_fattura);
  const id = nuovoIdFattura();
  return fatture.save({ ...payload, id, estratta_da_ai: !!viaAI }, { nuovo: true });
}

async function scadenzaDefault(dataFattura) {
  if (!dataFattura) return null;   // niente da cui calcolare un'offset
  let giorni = 60;
  try {
    const s = await impostazioni.get();
    if (Number.isFinite(s?.giorni_scadenza_default)) giorni = s.giorni_scadenza_default;
  } catch { /* un intoppo nella lettura non deve impedire il salvataggio: si usa il default */ }
  const d = new Date(dataFattura + 'T00:00:00');
  d.setDate(d.getDate() + giorni);
  return d.toISOString().slice(0, 10);
}

function nuovoIdFattura() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  // Fallback per browser datati o contesti non sicuri (dove randomUUID manca).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ============================================================
//  Estrazione campi: XML fattura elettronica (locale) o PDF/immagine (AI)
// ============================================================
async function estraiCampiDaFile(file) {
  const isXml = isFileFatturaElettronica(file.name);
  if (isXml) {
    const text = await leggiXmlFattura(file);   // sbusta anche i .p7m firmati
    if (!isXmlFatturaElettronica(file.name, text)) throw new Error('Il file XML non sembra una Fattura Elettronica nel formato standard.');
    const estratti = parseFatturaXml(text);
    return { ...estratti, _viaAI: false };
  }
  const { getAccessToken } = await import('../lib/supabase.js');
  const { CONFIG } = await import('../config.js');
  const token = await getAccessToken();
  if (!token) throw new Error('Sessione non valida: ricarica la pagina e riaccedi.');
  const dataBase64 = await fileToBase64(file);
  const res = await fetch(CONFIG.api.estraiFattura, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ filename: file.name, mimeType: file.type || 'application/pdf', dataBase64 }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Estrazione non riuscita (${res.status}).`);
  return { ...data.estratti, _viaAI: true };
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ============================================================
//  Anteprima del file caricato — solo lato client (URL.createObjectURL):
//  il file non viene mai inviato altrove né conservato, serve solo per
//  confrontare a colpo d'occhio il documento originale con i campi letti.
//  Il chiamante è responsabile di revocare l'url (URL.revokeObjectURL)
//  quando l'anteprima non serve più, per non trattenere il file in memoria.
// ============================================================
function renderAnteprimaFile(file) {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  const isImg = /^image\//.test(file.type);
  if (isPdf || isImg) {
    const url = URL.createObjectURL(file);
    const node = isPdf
      ? el(`<iframe class="fp-frame" src="${esc(url)}" title="Anteprima ${esc(file.name)}"></iframe>`)
      : el(`<img class="fp-img" src="${esc(url)}" alt="Anteprima ${esc(file.name)}">`);
    return { node, url };
  }
  return {
    node: el(`<div class="fp-empty">📄 ${esc(file.name)}<br>Anteprima non disponibile per questo formato: verifica i campi qui a fianco.</div>`),
    url: null,
  };
}

// Errore di lettura (quota AI esaurita, formato non riconosciuto, ecc.):
// un banner ben visibile invece di una riga di testo grigia, che passava
// facilmente inosservata mescolata agli altri messaggi di stato.
function bannerErroreLettura(messaggio) {
  return el(`<div class="banner warn" style="margin:10px 0 0">
    <div class="bi">⚠️</div>
    <div><b>Lettura automatica non riuscita</b><div class="small">${esc(messaggio)} Compila i campi a mano, confrontando con l'anteprima.</div></div>
  </div>`);
}
