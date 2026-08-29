import { fatture, pagamenti } from '../data/store.js';
import { el, clear, esc, openModal, confirmDialog, toast, fmtEuro, fmtDate, todayISO, parseEuro } from '../lib/ui.js';
import { isFileFatturaElettronica, isXmlFatturaElettronica, leggiXmlFattura, parseFatturaXml } from '../lib/xmlFattura.js';

// Valori ammessi per il metodo di pagamento: la lista deve restare allineata
// a quanto può produrre traduciModalita() in lib/xmlFattura.js, altrimenti i
// valori letti dalle fatture elettroniche non trovano posto nella tendina.
const METODI = ['', 'bonifico', 'RIBA', 'RID', 'contanti', 'assegno', 'carta', 'altro'];

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
    stato: 'da_pagare', metodo_pagamento: '', note: '', pdf_path: null, estratta_da_ai: false,
  };
  let pendingFile = null; // file scelto ma non ancora caricato su storage (si carica al salvataggio)
  // I pagamenti vengono scritti sul database subito, non al "Salva": se non
  // segnassimo la cosa, chiudendo con Annulla/✕ la dashboard resterebbe ferma
  // a stato e residuo precedenti.
  let datiModificati = false;

  const body = el(`<div>
    <div id="upload-row" ${id ? 'style="display:none"' : ''}>
      <div class="field">
        <label>Compila automaticamente da file (opzionale)</label>
        <input type="file" id="file-in" accept=".pdf,.xml,.p7m,image/*">
        <div class="hint" id="upload-hint">PDF/immagine → letti con AI (Gemini). XML di fattura elettronica, anche firmato (.p7m) → letto direttamente, gratis e senza AI.</div>
      </div>
    </div>
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
      <div class="field"><label>File originale</label><div id="pdf-link" class="hint">${rec.pdf_path ? '' : 'nessuno'}</div></div>
    </div>
    <div class="field"><label>Note</label><textarea id="f-note" rows="2">${esc(rec.note || '')}</textarea></div>
    <div id="pag-zone"></div>
    <div id="err" style="color:var(--danger);font-size:13px"></div>
  </div>`);

  if (rec.pdf_path) {
    fatture.urlPdf(rec.pdf_path).then(url => {
      const a = el(`<a href="${esc(url)}" target="_blank" rel="noopener">📎 Apri file originale</a>`);
      clear(body.querySelector('#pdf-link')); body.querySelector('#pdf-link').appendChild(a);
    }).catch(() => {});
  }

  if (id) renderPagamenti(body.querySelector('#pag-zone'), rec, ctx, (r) => { rec = r; datiModificati = true; });

  body.querySelector('#file-in').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const hint = body.querySelector('#upload-hint');
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
      pendingFile = { file, viaAI: estratti._viaAI };
      hint.textContent = '✅ Campi compilati automaticamente — controlla e correggi se necessario prima di salvare.';
    } catch (err) {
      hint.textContent = '⚠️ ' + err.message + ' Compila i campi a mano.';
    }
  });

  const footer = el(`<div style="display:flex;gap:10px;width:100%">
    ${id ? '<button class="btn danger" id="del">Elimina</button>' : ''}
    <div style="flex:1"></div>
    <button class="btn" id="cancel">Annulla</button>
    <button class="btn primary" id="save">Salva</button>
  </div>`);

  const { close } = openModal({
    title: id ? 'Modifica fattura' : 'Nuova fattura', body, footer, wide: true,
    onClose: () => { if (datiModificati) onSaved(); },
  });

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
      const { erroreAllegato } = await salvaFattura(payload, pendingFile);
      if (erroreAllegato) toast('Fattura salvata, ma il caricamento del file allegato è fallito: ' + erroreAllegato, 'err');
      toast(id ? 'Fattura aggiornata' : 'Fattura creata', 'ok');
      datiModificati = true;
      close();
    } catch (e) {
      err.textContent = 'Errore: ' + e.message;
      btn.disabled = false; btn.innerHTML = old;
    }
  });
}

function renderPagamenti(node, rec, ctx, onChange) {
  clear(node);
  const wrap = el(`<div class="card" style="margin-top:6px"><div class="card-h">Pagamenti / acconti</div><div class="card-b">
    <div class="pag-list"></div>
    <div class="residuo-box"><span>Pagato: <b>${fmtEuro(rec._pagato)}</b></span><span>Residuo: <b>${fmtEuro(rec._residuo)}</b></span></div>
    <button class="btn sm" style="margin-top:10px" id="add-pag">+ Aggiungi pagamento</button>
    <div id="add-pag-form" style="display:none;margin-top:10px"></div>
  </div></div>`);
  const list = wrap.querySelector('.pag-list');
  for (const p of (rec.pagamenti || []).slice().sort((a, b) => (a.data_pagamento || '').localeCompare(b.data_pagamento || ''))) {
    const row = el(`<div class="pag-row"><span>${fmtDate(p.data_pagamento)} · ${fmtEuro(p.importo)} ${p.metodo ? '· ' + esc(p.metodo) : ''} ${p.note ? '· ' + esc(p.note) : ''}</span><button class="rm" data-id="${p.id}">✕</button></div>`);
    row.querySelector('.rm').addEventListener('click', async () => {
      if (!await confirmDialog('Rimuovere questo pagamento?', { danger: true, okLabel: 'Rimuovi' })) return;
      try {
        await pagamenti.remove(p.id);
        const fresh = await fatture.get(rec.id);
        onChange(fresh);
        renderPagamenti(node, fresh, ctx, onChange);
        toast('Pagamento rimosso', 'ok');
      } catch (e) { toast('Errore: ' + e.message, 'err'); }
    });
    list.appendChild(row);
  }
  if (!(rec.pagamenti || []).length) list.appendChild(el('<div class="muted" style="font-size:13px">Nessun pagamento registrato.</div>'));

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
      try {
        await pagamenti.add(rec.id, { importo, data_pagamento, metodo: f.querySelector('#p-metodo').value || null });
        const fresh = await fatture.get(rec.id);
        onChange(fresh);
        renderPagamenti(node, fresh, ctx, onChange);
        toast('Pagamento registrato', 'ok');
      } catch (e) { toast('Errore: ' + e.message, 'err'); }
    });
  });
  node.appendChild(wrap);
}

// ============================================================
//  Caricamento multiplo (dashboard → "Carica PDF/XML")
// ============================================================
export function apriUpload(ctx, onSaved) {
  const body = el(`<div>
    <div class="dropzone" id="dz">
      <div class="big">📎</div>
      <div><b>Trascina qui i file</b> oppure clicca per selezionarli</div>
      <div class="hint">PDF/immagini (letti con AI Gemini) o XML di fattura elettronica, anche firmati .p7m (letti gratis, senza AI). Puoi selezionarne più di uno.</div>
      <input type="file" id="dz-input" multiple accept=".pdf,.xml,.p7m,image/*" style="display:none">
    </div>
    <div class="upload-list" id="up-list"></div>
  </div>`);
  const footer = el(`<div style="display:flex;justify-content:flex-end;width:100%"><button class="btn" id="chiudi">Chiudi</button></div>`);
  // Le fatture qui si salvano una alla volta: la dashboard va ricaricata a
  // prescindere da come si chiude la finestra (pulsante Chiudi, ✕, Esc, sfondo).
  let salvateAlmenoUna = false;
  const { close } = openModal({
    title: 'Carica fatture (PDF / XML)', body, footer, wide: true,
    onClose: () => { if (salvateAlmenoUna) onSaved(); },
  });
  footer.querySelector('#chiudi').addEventListener('click', () => close());

  const dz = body.querySelector('#dz');
  const input = body.querySelector('#dz-input');
  dz.addEventListener('click', () => input.click());
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
  dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('drag'); handleFiles(e.dataTransfer.files); });
  input.addEventListener('change', () => handleFiles(input.files));

  function handleFiles(fileList) {
    for (const file of fileList) addUploadItem(file);
  }

  function addUploadItem(file) {
    const list = body.querySelector('#up-list');
    const item = el(`<div class="upload-item">
      <div class="u-head"><span>📄 ${esc(file.name)}</span><span class="u-status">Lettura in corso…</span></div>
      <div class="fields-zone"></div>
    </div>`);
    list.appendChild(item);
    const status = item.querySelector('.u-status');

    estraiCampiDaFile(file).then(estratti => {
      status.textContent = estratti._viaAI ? 'Letto con AI — verifica prima di salvare' : 'Letto da XML — verifica prima di salvare';
      renderCampiModificabili(item, file, estratti);
    }).catch(err => {
      status.textContent = '⚠️ ' + err.message;
      renderCampiModificabili(item, file, {});
    });
  }

  function renderCampiModificabili(item, file, estratti) {
    const zone = item.querySelector('.fields-zone');
    clear(zone);
    const f = el(`<div>
      <div class="u-fields">
        <div class="field"><label>Fornitore</label><input type="text" class="i-fornitore" value="${esc(estratti.fornitore || '')}"></div>
        <div class="field"><label>N. fattura</label><input type="text" class="i-numero" value="${esc(estratti.numero_fattura || '')}"></div>
        <div class="field"><label>Data</label><input type="date" class="i-data" value="${esc(estratti.data_fattura || '')}"></div>
        <div class="field"><label>Importo €</label><input type="number" step="0.01" class="i-importo" value="${esc(estratti.importo ?? '')}"></div>
      </div>
      <div class="u-fields" style="margin-top:8px">
        <div class="field"><label>Scadenza</label><input type="date" class="i-scadenza" value="${esc(estratti.scadenza || '')}"></div>
        <div class="field"><label>Metodo</label><select class="i-metodo">${METODI.map(m => `<option value="${esc(m)}" ${metodoAmmesso(estratti.metodo_pagamento) === m ? 'selected' : ''}>${m || '—'}</option>`).join('')}</select></div>
        <div class="field" style="grid-column:span 2"><label>Note</label><input type="text" class="i-note" value="${esc(estratti.note || '')}"></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn primary sm i-save">💾 Salva fattura</button>
        <button class="btn ghost sm i-skip">Scarta</button>
      </div>
    </div>`);
    zone.appendChild(f);
    f.querySelector('.i-skip').addEventListener('click', () => item.remove());
    f.querySelector('.i-save').addEventListener('click', async () => {
      const payload = {
        fornitore: f.querySelector('.i-fornitore').value.trim(),
        numero_fattura: f.querySelector('.i-numero').value.trim() || null,
        data_fattura: f.querySelector('.i-data').value || null,
        importo: parseEuro(f.querySelector('.i-importo').value),
        scadenza: f.querySelector('.i-scadenza').value || null,
        metodo_pagamento: f.querySelector('.i-metodo').value || null,
        note: f.querySelector('.i-note').value.trim() || null,
      };
      if (!payload.fornitore || !payload.importo || payload.importo <= 0) { toast('Compila almeno fornitore e importo', 'err'); return; }
      if (!await confermaSeDuplicato(payload, null)) return;
      const btn = f.querySelector('.i-save'); btn.disabled = true; btn.innerHTML = '<span class="spinner sm"></span> Salvataggio…';
      try {
        const { erroreAllegato } = await salvaFattura(payload, { file, viaAI: estratti._viaAI });
        if (erroreAllegato) toast('Fattura salvata, ma il file allegato non è stato caricato: ' + erroreAllegato, 'err');
        salvateAlmenoUna = true;
        item.querySelector('.u-status').textContent = '✅ Salvata';
        clear(zone);
        toast('Fattura salvata', 'ok');
      } catch (e) {
        toast('Errore: ' + e.message, 'err');
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
//  Salvataggio di una fattura (con eventuale allegato)
// ------------------------------------------------------------
//  Per una fattura NUOVA l'id viene generato qui e l'allegato viene caricato
//  PRIMA dell'insert: così la creazione è una singola operazione sul database.
//  Il flusso precedente (insert, poi update per scrivere pdf_path) produceva
//  due righe nel registro modifiche per ogni fattura caricata da file:
//  'creazione' seguita da una 'modifica' che di fatto non era una modifica.
// ============================================================
async function salvaFattura(payload, allegato) {
  if (payload.id) return { saved: await fatture.save(payload), erroreAllegato: null };

  const id = nuovoIdFattura();
  let erroreAllegato = null;
  let pathCaricato = null;
  if (allegato && allegato.file) {
    try {
      pathCaricato = await fatture.caricaPdf(allegato.file, id);
      payload.pdf_path = pathCaricato;
      payload.estratta_da_ai = !!allegato.viaAI;
    } catch (e) { erroreAllegato = e.message; }
  }
  try {
    const saved = await fatture.save({ ...payload, id }, { nuovo: true });
    return { saved, erroreAllegato };
  } catch (e) {
    // Insert fallito dopo un upload riuscito: rimuovo il file, altrimenti
    // resterebbe nello storage senza nessuna fattura che lo referenzia.
    if (pathCaricato) await fatture.rimuoviPdf(pathCaricato).catch(() => {});
    throw e;
  }
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
