import { fattureAttive, incassi, noteCreditoAttive } from '../data/storeAttive.js';
import { svuotaCacheNomi } from '../data/store.js';
import { el, clear, esc, openModal, confirmDialog, toast, fmtEuro, fmtDate, todayISO, parseEuro, debounce } from '../lib/ui.js';
import { isFileFatturaElettronica, isXmlFatturaElettronica, leggiXmlFattura, parseFatturaAttivaXml, METODI } from '../lib/xmlFattura.js';
import { renderAnteprimaFile, bannerErroreLettura, fileToBase64, metodoAmmesso, nuovoIdFattura, confermaSeSuperaResiduo, collegaAutocompletamento, aggiornaDopo } from '../lib/documenti.js';

export { METODI };

// ============================================================
//  Editor di una singola fattura attiva (nuova o esistente)
// ============================================================
export async function apriEditorAttiva(id, ctx, onSaved) {
  // Vedi il commento gemello in fattura.js: senza questo try, un errore nel
  // caricamento lasciava il clic sulla riga senza alcun effetto visibile.
  let rec;
  try {
    rec = id ? await fattureAttive.get(id) : {
      cliente: '', numero_fattura: '', data_fattura: todayISO(), importo: '',
      stato: 'da_incassare', metodo_incasso: '', note: '', data_sollecito: '', estratta_da_ai: false,
    };
  } catch (e) {
    toast('Impossibile aprire la fattura: ' + e.message, 'err');
    return;
  }
  let viaAI = false;
  let datiModificati = false;
  let previewUrl = null;

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
          <div class="field"><label>Cliente *</label><input type="text" id="f-cliente" value="${esc(rec.cliente)}"></div>
          <div class="field"><label>Numero fattura</label><input type="text" id="f-numero" value="${esc(rec.numero_fattura || '')}"></div>
        </div>
        <div class="form-row">
          <div class="field"><label>Data fattura</label><input type="date" id="f-data" value="${esc(rec.data_fattura || '')}"></div>
          <div class="field"><label>Importo (€) *</label><input type="number" step="0.01" id="f-importo" value="${esc(rec.importo ?? '')}"></div>
        </div>
        <div class="form-row three">
          <div class="field"><label>Metodo di incasso</label><select id="f-metodo">${METODI.map(m => `<option value="${esc(m)}" ${rec.metodo_incasso === m ? 'selected' : ''}>${m || '—'}</option>`).join('')}</select></div>
          <div class="field"><label>Ultimo sollecito inviato</label><input type="date" id="f-sollecito" value="${esc(rec.data_sollecito || '')}"></div>
          <div class="field" style="justify-content:flex-end"><label>&nbsp;</label><button type="button" class="btn ghost sm" id="sollecito-oggi">🔔 Segna sollecito oggi</button></div>
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

  // Suggerisce i clienti già usati mentre si scrive (vedi il commento
  // gemello in fattura.js).
  collegaAutocompletamento(body.querySelector('#f-cliente'), () => fattureAttive.clientiNoti());

  body.querySelector('#sollecito-oggi').addEventListener('click', () => {
    body.querySelector('#f-sollecito').value = todayISO();
  });

  function disegnaIncassiENote() {
    renderIncassi(body.querySelector('#pag-zone'), rec, ctx, refreshIncassiENote);
    renderNoteCreditoAttive(body.querySelector('#note-credito-zone'), rec, ctx, refreshIncassiENote);
  }
  function refreshIncassiENote(fresh) {
    rec = fresh; datiModificati = true;
    disegnaIncassiENote();
  }
  if (id) disegnaIncassiENote();

  body.querySelector('#file-in').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // Vedi il commento gemello in fattura.js.
    e.target.value = '';
    mostraAnteprima(file);
    const hint = body.querySelector('#upload-hint');
    const status = body.querySelector('#upload-status');
    clear(status);
    hint.textContent = 'Lettura in corso…';
    try {
      const estratti = await estraiCampiDaFile(file);
      if (estratti.cliente) body.querySelector('#f-cliente').value = estratti.cliente;
      if (estratti.numero_fattura) body.querySelector('#f-numero').value = estratti.numero_fattura;
      if (estratti.data_fattura) body.querySelector('#f-data').value = estratti.data_fattura;
      if (estratti.importo !== null && estratti.importo !== undefined) body.querySelector('#f-importo').value = estratti.importo;
      if (estratti.metodo_pagamento) body.querySelector('#f-metodo').value = metodoAmmesso(estratti.metodo_pagamento);
      if (estratti.note) body.querySelector('#f-note').value = estratti.note;
      viaAI = !!estratti._viaAI;
      hint.textContent = '✅ Campi compilati automaticamente — confronta con l\'anteprima qui a fianco e correggi se necessario prima di salvare.';
    } catch (err) {
      hint.textContent = '';
      status.appendChild(bannerErroreLettura(err.message));
    }
  });

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
    title: id ? 'Modifica fattura attiva' : 'Nuova fattura attiva', body, footer, wide: true,
    onClose: () => { if (previewUrl) URL.revokeObjectURL(previewUrl); if (datiModificati) onSaved(); },
  });
  modal.style.maxWidth = '1400px';

  footer.querySelector('#cancel').addEventListener('click', close);
  if (id) footer.querySelector('#del').addEventListener('click', async () => {
    if (!await confirmDialog(`Eliminare la fattura di ${rec.cliente}? L'operazione è definitiva (resta traccia nel registro modifiche).`, { danger: true, okLabel: 'Elimina' })) return;
    try { await fattureAttive.remove(id); toast('Fattura eliminata', 'ok'); datiModificati = true; close(); }
    catch (e) { toast('Errore: ' + e.message, 'err'); }
  });
  footer.querySelector('#save').addEventListener('click', async () => {
    const err = body.querySelector('#err'); err.textContent = '';
    const payload = {
      id: id || undefined,
      cliente: body.querySelector('#f-cliente').value.trim(),
      numero_fattura: body.querySelector('#f-numero').value.trim() || null,
      data_fattura: body.querySelector('#f-data').value || null,
      importo: parseEuro(body.querySelector('#f-importo').value),
      metodo_incasso: body.querySelector('#f-metodo').value || null,
      data_sollecito: body.querySelector('#f-sollecito').value || null,
      note: body.querySelector('#f-note').value.trim() || null,
    };
    if (!payload.cliente) { err.textContent = 'Il cliente è obbligatorio.'; return; }
    if (payload.importo === null || payload.importo <= 0) { err.textContent = 'Indica un importo valido.'; return; }
    if (!await confermaSeDuplicato(payload, id)) return;
    const btn = footer.querySelector('#save'); const old = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<span class="spinner sm"></span> Salvataggio…';
    try {
      await salvaFatturaAttiva(payload, viaAI);
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
//  Incasso rapido — popup minimale aperto cliccando sul chip di stato in
//  dashboard, per registrare un incasso senza aprire l'intero editor.
// ============================================================
export function apriIncassoRapido(rec, ctx, onSaved) {
  const body = el(`<div>
    <p class="muted" style="margin:0 0 14px;font-size:14px">${esc(rec.cliente)} ${rec.numero_fattura ? '· ' + esc(rec.numero_fattura) : ''} — residuo <b>${fmtEuro(rec._residuo)}</b></p>
    <div class="form-row three" style="align-items:end">
      <div class="field"><label>Data</label><input type="date" id="qp-data" value="${todayISO()}"></div>
      <div class="field"><label>Importo (€)</label><input type="number" step="0.01" id="qp-importo" value="${rec._residuo > 0 ? rec._residuo.toFixed(2) : ''}"></div>
      <div class="field"><label>Metodo</label><select id="qp-metodo">${METODI.map(m => `<option value="${esc(m)}" ${rec.metodo_incasso === m ? 'selected' : ''}>${m || '—'}</option>`).join('')}</select></div>
    </div>
    <div id="qp-err" style="color:var(--danger);font-size:13px"></div>
  </div>`);
  const footer = el(`<div style="display:flex;gap:10px;width:100%">
    <div style="flex:1"></div>
    <button class="btn" id="qp-cancel">Annulla</button>
    <button class="btn primary" id="qp-save">Registra incasso</button>
  </div>`);
  const { close } = openModal({ title: 'Segna incasso — ' + rec.cliente, body, footer });
  footer.querySelector('#qp-cancel').addEventListener('click', close);
  footer.querySelector('#qp-save').addEventListener('click', async () => {
    const err = body.querySelector('#qp-err'); err.textContent = '';
    const importo = parseEuro(body.querySelector('#qp-importo').value);
    const data_incasso = body.querySelector('#qp-data').value;
    if (!importo || importo <= 0) { err.textContent = 'Indica un importo valido.'; return; }
    if (!data_incasso) { err.textContent = 'Indica la data dell\'incasso.'; return; }
    if (!await confermaSeSuperaResiduo(importo, rec._residuo)) return;
    const btn = footer.querySelector('#qp-save'); const old = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<span class="spinner sm"></span> Registrazione…';
    try {
      await incassi.add(rec.id, { importo, data_incasso, metodo: body.querySelector('#qp-metodo').value || null });
      toast('Incasso registrato', 'ok');
      close();
      onSaved();
    } catch (e) {
      err.textContent = 'Errore: ' + e.message;
      btn.disabled = false; btn.innerHTML = old;
    }
  });
}

// ============================================================
//  Sollecito rapido — aperto cliccando sulla colonna "Sollecito" in
//  dashboard, per aggiornare la data senza aprire l'intero editor.
// ============================================================
export function apriSollecitoRapido(rec, ctx, onSaved) {
  const body = el(`<div>
    <p class="muted" style="margin:0 0 14px;font-size:14px">${esc(rec.cliente)} ${rec.numero_fattura ? '· ' + esc(rec.numero_fattura) : ''}</p>
    <div class="field"><label>Data sollecito</label><input type="date" id="sl-data" value="${esc(rec.data_sollecito || todayISO())}"></div>
  </div>`);
  const footer = el(`<div style="display:flex;gap:10px;width:100%">
    ${rec.data_sollecito ? '<button class="btn" id="sl-rimuovi">Rimuovi data</button>' : ''}
    <div style="flex:1"></div>
    <button class="btn" id="sl-cancel">Annulla</button>
    <button class="btn primary" id="sl-save">Salva</button>
  </div>`);
  const { close } = openModal({ title: 'Sollecito di pagamento', body, footer });
  footer.querySelector('#sl-cancel').addEventListener('click', close);
  const salva = async (valore) => {
    try {
      await fattureAttive.segnaSollecito(rec.id, valore);
      toast('Sollecito aggiornato', 'ok');
      close();
      onSaved();
    } catch (e) { toast('Errore: ' + e.message, 'err'); }
  };
  footer.querySelector('#sl-save').addEventListener('click', () => salva(body.querySelector('#sl-data').value || null));
  const rimuovi = footer.querySelector('#sl-rimuovi');
  if (rimuovi) rimuovi.addEventListener('click', () => salva(null));
}

function renderIncassi(node, rec, ctx, onChange) {
  clear(node);
  const wrap = el(`<div class="card" style="margin-top:6px"><div class="card-h">Incassi / acconti</div><div class="card-b">
    <div class="pag-list"></div>
    <div class="residuo-box"><span>Incassato: <b>${fmtEuro(rec._incassato)}</b></span>${rec._stornato > 0 ? `<span>Stornato: <b>${fmtEuro(rec._stornato)}</b></span>` : ''}<span>Residuo: <b>${fmtEuro(rec._residuo)}</b></span></div>
    <button class="btn sm" style="margin-top:10px" id="add-pag">+ Aggiungi incasso</button><div id="add-pag-form" style="display:none;margin-top:10px"></div>
  </div></div>`);
  const list = wrap.querySelector('.pag-list');
  for (const p of (rec.incassi || []).slice().sort((a, b) => (a.data_incasso || '').localeCompare(b.data_incasso || ''))) {
    const row = el(`<div class="pag-row"><span>${fmtDate(p.data_incasso)} · ${fmtEuro(p.importo)} ${p.metodo ? '· ' + esc(p.metodo) : ''} ${p.note ? '· ' + esc(p.note) : ''}</span><button class="rm" data-id="${p.id}">✕</button></div>`);
    row.querySelector('.rm').addEventListener('click', async () => {
      if (!await confirmDialog('Rimuovere questo incasso?', { danger: true, okLabel: 'Rimuovi' })) return;
      try {
        await incassi.remove(p.id);
        onChange(await fattureAttive.get(rec.id));
        toast('Incasso rimosso', 'ok');
      } catch (e) { toast('Errore: ' + e.message, 'err'); }
    });
    list.appendChild(row);
  }
  if (!(rec.incassi || []).length) list.appendChild(el('<div class="muted" style="font-size:13px">Nessun incasso registrato.</div>'));

  wrap.querySelector('#add-pag').addEventListener('click', () => {
    const formZone = wrap.querySelector('#add-pag-form');
    formZone.style.display = 'block';
    clear(formZone);
    const f = el(`<div class="form-row three" style="align-items:end">
      <div class="field"><label>Data</label><input type="date" id="p-data" value="${todayISO()}"></div>
      <div class="field"><label>Importo (€)</label><input type="number" step="0.01" id="p-importo" value="${rec._residuo > 0 ? rec._residuo.toFixed(2) : ''}"></div>
      <div class="field"><label>Metodo</label><select id="p-metodo">${METODI.map(m => `<option value="${esc(m)}">${m || '—'}</option>`).join('')}</select></div>
    </div><button class="btn primary sm" id="p-save">Registra incasso</button>`);
    formZone.appendChild(f);
    // Vedi il commento gemello in fattura.js: senza disabilitare il pulsante,
    // un doppio click registrava due incassi identici.
    f.querySelector('#p-save').addEventListener('click', async () => {
      const importo = parseEuro(f.querySelector('#p-importo').value);
      const data_incasso = f.querySelector('#p-data').value;
      if (!importo || importo <= 0 || !data_incasso) { toast('Inserisci data e importo validi', 'err'); return; }
      if (!await confermaSeSuperaResiduo(importo, rec._residuo)) return;
      const btn = f.querySelector('#p-save'); const old = btn.innerHTML;
      btn.disabled = true; btn.innerHTML = '<span class="spinner sm"></span> Registrazione…';
      try {
        await incassi.add(rec.id, { importo, data_incasso, metodo: f.querySelector('#p-metodo').value || null });
        toast('Incasso registrato', 'ok');
        onChange(await fattureAttive.get(rec.id));   // ridisegna tutto: il pulsante qui sopra non esiste più
      } catch (e) {
        toast('Errore: ' + e.message, 'err');
        btn.disabled = false; btn.innerHTML = old;
      }
    });
  });
  node.appendChild(wrap);
}

// ============================================================
//  Note di credito emesse — a differenza dei veri incassi, anche
//  l'operatore può registrarle e rimuoverle (stessa scelta delle passive).
// ============================================================
function renderNoteCreditoAttive(node, rec, ctx, onChange) {
  clear(node);
  const righe = rec.note_credito_attive_righe || [];
  const wrap = el(`<div class="card" style="margin-top:14px"><div class="card-h">Note di credito</div><div class="card-b">
    <div class="nc-list"></div>
    <button class="btn sm" style="margin-top:10px" id="add-nc">+ Aggiungi nota di credito</button>
  </div></div>`);
  const list = wrap.querySelector('.nc-list');
  for (const n of righe.slice().sort((a, b) => (a.note_credito_attive?.data || '').localeCompare(b.note_credito_attive?.data || ''))) {
    const nc = n.note_credito_attive || {};
    const row = el(`<div class="pag-row"><span>${fmtDate(nc.data)} · ${fmtEuro(n.importo)} ${nc.numero ? '· n. ' + esc(nc.numero) : ''} ${nc.note ? '· ' + esc(nc.note) : ''}</span><button class="rm" data-id="${n.id}">✕</button></div>`);
    row.querySelector('.rm').addEventListener('click', async () => {
      if (!await confirmDialog('Rimuovere il collegamento di questa nota di credito a questa fattura?', { danger: true, okLabel: 'Rimuovi' })) return;
      try {
        await noteCreditoAttive.removeRiga(n.id);
        onChange(await fattureAttive.get(rec.id));
        toast('Nota di credito rimossa', 'ok');
      } catch (e) { toast('Errore: ' + e.message, 'err'); }
    });
    list.appendChild(row);
  }
  if (!righe.length) list.appendChild(el('<div class="muted" style="font-size:13px">Nessuna nota di credito registrata.</div>'));

  wrap.querySelector('#add-nc').addEventListener('click', () => apriNuovaNotaCreditoAttiva(ctx, aggiornaDopo(() => fattureAttive.get(rec.id), onChange), rec));
  node.appendChild(wrap);
}

// ============================================================
//  Nuova nota di credito emessa — può stornare più fatture attive insieme.
// ============================================================
export function apriNuovaNotaCreditoAttiva(ctx, onSaved, fatturaPreselezionata) {
  const body = el(`<div>
    <div class="form-row three">
      <div class="field"><label>Numero</label><input type="text" id="nc-numero"></div>
      <div class="field"><label>Data</label><input type="date" id="nc-data" value="${todayISO()}"></div>
      <div class="field"><label>Note</label><input type="text" id="nc-note"></div>
    </div>
    <div id="nc-pinned"></div>
    <div class="field"><label>Altre fatture stornate da questa nota</label>
      <input type="text" id="nc-cerca" placeholder="Cerca cliente o numero fattura…">
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

  const selezionate = new Map();

  function aggiornaRiepilogo() {
    const tot = [...selezionate.values()].reduce((s, v) => s + v, 0);
    body.querySelector('#nc-n-selezionate').textContent = selezionate.size;
    body.querySelector('#nc-tot-selezionato').textContent = fmtEuro(tot);
  }

  function creaRigaFattura(f, preselezionata) {
    const checked = preselezionata || selezionate.has(f.id);
    if (checked && !selezionate.has(f.id)) selezionate.set(f.id, f._residuo);
    const row = el(`<div class="pag-row" style="align-items:center">
      <label style="display:flex;align-items:center;gap:8px;flex:1;cursor:pointer">
        <input type="checkbox" ${checked ? 'checked' : ''}>
        <span>${esc(f.cliente)} ${f.numero_fattura ? '· n. ' + esc(f.numero_fattura) : ''} · residuo ${fmtEuro(f._residuo)}</span>
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
    // Vedi il commento gemello in fattura.js: anche un valore vuoto o non
    // valido va riportato nella mappa (come 0), altrimenti resta memorizzato
    // l'importo precedente e si salva una cifra diversa da quella a schermo.
    importoInput.addEventListener('input', () => {
      const v = parseEuro(importoInput.value);
      selezionate.set(f.id, v && v > 0 ? v : 0);
      aggiornaRiepilogo();
    });
    return row;
  }

  fattureAttive.list().then(tutte => {
    if (fatturaPreselezionata) {
      body.querySelector('#nc-pinned').appendChild(creaRigaFattura(fatturaPreselezionata, true));
      aggiornaRiepilogo();
    }
    const apribili = tutte.filter(f => f.stato !== 'stornata' && f.id !== fatturaPreselezionata?.id);

    function disegnaElenco(filtro) {
      const elenco = body.querySelector('#nc-elenco');
      clear(elenco);
      const q = (filtro || '').trim().toLowerCase();
      const righeMostrate = apribili.filter(f => !q || (f.cliente || '').toLowerCase().includes(q) || (f.numero_fattura || '').toLowerCase().includes(q));
      if (!righeMostrate.length) { elenco.appendChild(el('<div class="muted" style="font-size:13px">Nessuna fattura trovata.</div>')); return; }
      for (const f of righeMostrate.slice(0, 200)) elenco.appendChild(creaRigaFattura(f, false));
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
    const righe = [...selezionate.entries()].map(([fattura_attiva_id, importo]) => ({ fattura_attiva_id, importo }));
    if (righe.some(r => !r.importo || r.importo <= 0)) { err.textContent = 'Ogni fattura selezionata deve avere un importo valido.'; return; }
    const btn = footer.querySelector('#nc-save'); const old = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<span class="spinner sm"></span> Registrazione…';
    try {
      await noteCreditoAttive.create({
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
//  Caricamento multiplo (dashboard attive → "Carica PDF/XML", o drag&drop)
// ============================================================
export function apriUploadAttive(ctx, onSaved, fileIniziali) {
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
  let salvateAlmenoUna = false;
  const previewUrls = [];
  const { close, modal } = openModal({
    title: 'Carica fatture attive (PDF / XML)', body, footer, wide: true,
    onClose: () => { previewUrls.forEach(u => URL.revokeObjectURL(u)); if (salvateAlmenoUna) onSaved(); },
  });
  modal.style.maxWidth = '1500px';
  footer.querySelector('#chiudi').addEventListener('click', () => close());

  const dz = body.querySelector('#dz');
  const input = body.querySelector('#dz-input');
  dz.addEventListener('click', () => input.click());
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
  dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('drag'); handleFiles(e.dataTransfer.files); });
  // Vedi il commento gemello in fattura.js: il campo si svuota dopo aver preso
  // i file, altrimenti riselezionare lo stesso file non fa scattare "change".
  input.addEventListener('change', () => { handleFiles(input.files); input.value = ''; });

  const coda = [];
  let totale = 0;
  let completate = 0;
  let corrente = null;

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
    if (corrente) return;
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
            <div class="field"><label>Cliente</label><input type="text" class="i-cliente"></div>
            <div class="field"><label>N. fattura</label><input type="text" class="i-numero"></div>
            <div class="field"><label>Data</label><input type="date" class="i-data"></div>
            <div class="field"><label>Importo €</label><input type="number" step="0.01" class="i-importo"></div>
          </div>
          <div class="u-fields" style="margin-top:8px">
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
    collegaAutocompletamento(box.querySelector('.i-cliente'), () => fattureAttive.clientiNoti());

    const { node, url } = renderAnteprimaFile(file);
    if (url) previewUrls.push(url);
    box.querySelector('#file-preview').appendChild(node);

    const status = box.querySelector('.u-status');
    let estrattiCorrenti = {};
    estraiCampiDaFile(file).then(estratti => {
      estrattiCorrenti = estratti;
      status.textContent = estratti._viaAI ? 'Letto con AI — verifica prima di salvare' : 'Letto da XML — verifica prima di salvare';
      if (estratti.cliente) box.querySelector('.i-cliente').value = estratti.cliente;
      if (estratti.numero_fattura) box.querySelector('.i-numero').value = estratti.numero_fattura;
      if (estratti.data_fattura) box.querySelector('.i-data').value = estratti.data_fattura;
      if (estratti.importo !== null && estratti.importo !== undefined) box.querySelector('.i-importo').value = estratti.importo;
      if (estratti.metodo_pagamento) box.querySelector('.i-metodo').value = metodoAmmesso(estratti.metodo_pagamento);
      if (estratti.note) box.querySelector('.i-note').value = estratti.note;
    }).catch(err => {
      status.textContent = '⚠️ errore di lettura';
      box.querySelector('.u-errore-zona').appendChild(bannerErroreLettura(err.message));
    });

    box.querySelector('.i-skip').addEventListener('click', () => completaCorrente());
    box.querySelector('.i-save').addEventListener('click', async () => {
      const payload = {
        cliente: box.querySelector('.i-cliente').value.trim(),
        numero_fattura: box.querySelector('.i-numero').value.trim() || null,
        data_fattura: box.querySelector('.i-data').value || null,
        importo: parseEuro(box.querySelector('.i-importo').value),
        metodo_incasso: box.querySelector('.i-metodo').value || null,
        note: box.querySelector('.i-note').value.trim() || null,
      };
      const err = box.querySelector('.i-err'); err.textContent = '';
      if (!payload.cliente || !payload.importo || payload.importo <= 0) { err.textContent = 'Compila almeno cliente e importo.'; return; }
      if (!await confermaSeDuplicato(payload, null)) return;
      const btn = box.querySelector('.i-save'); btn.disabled = true; btn.innerHTML = '<span class="spinner sm"></span> Salvataggio…';
      try {
        await salvaFatturaAttiva(payload, estrattiCorrenti._viaAI);
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
//  Controllo duplicati (stessa logica delle passive)
// ============================================================
async function confermaSeDuplicato(payload, escludiId) {
  let doppia = null;
  try { doppia = await fattureAttive.trovaDuplicato(payload, escludiId); }
  catch { return true; }
  if (!doppia) return true;
  return confirmDialog(
    "Esiste già una fattura di " + doppia.cliente + " con numero " + doppia.numero_fattura +
    " (del " + fmtDate(doppia.data_fattura) + ", " + fmtEuro(doppia.importo) + "). Salvare comunque?",
    { danger: true, okLabel: "Salva comunque" });
}

// ============================================================
//  Salvataggio di una fattura attiva
// ============================================================
async function salvaFatturaAttiva(payload, viaAI) {
  // Vedi il commento gemello in fattura.js: un cliente appena inserito deve
  // comparire fra i suggerimenti della fattura successiva.
  svuotaCacheNomi();
  if (payload.id) return fattureAttive.save(payload);
  const id = nuovoIdFattura();
  return fattureAttive.save({ ...payload, id, estratta_da_ai: !!viaAI }, { nuovo: true });
}

// ============================================================
//  Estrazione campi: XML fattura elettronica (locale) o PDF/immagine (AI)
// ============================================================
async function estraiCampiDaFile(file) {
  const isXml = isFileFatturaElettronica(file.name);
  if (isXml) {
    const text = await leggiXmlFattura(file);
    if (!isXmlFatturaElettronica(file.name, text)) throw new Error('Il file XML non sembra una Fattura Elettronica nel formato standard.');
    const estratti = parseFatturaAttivaXml(text);
    return { ...estratti, _viaAI: false };
  }
  const { getAccessToken } = await import('../lib/supabase.js');
  const { CONFIG } = await import('../config.js');
  const token = await getAccessToken();
  if (!token) throw new Error('Sessione non valida: ricarica la pagina e riaccedi.');
  const dataBase64 = await fileToBase64(file);
  const res = await fetch(CONFIG.api.estraiFatturaAttiva, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ filename: file.name, mimeType: file.type || 'application/pdf', dataBase64 }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Estrazione non riuscita (${res.status}).`);
  return { ...data.estratti, _viaAI: true };
}

