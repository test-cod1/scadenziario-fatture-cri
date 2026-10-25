// ============================================================
//  LA SCHEDA DI UNA SCADENZA — nuova o già esistente.
//  Obbligatori solo il titolo e la data. La categoria è un testo libero
//  con i suggerimenti di quelle già usate (e di qualche classica), così
//  si può segnare una scadenza di qualunque tipo senza chiedere prima a
//  qualcuno di aggiungere una voce a un elenco.
// ============================================================
import { scadenze as store } from '../data/store.js';
import { RICORRENZE, CATEGORIE_SUGGERITE, etichetta, prossimaData } from '../calc.js';
import { el, esc, toast, confirmDialog, fmtDate, fmtDateTime, parseEuro } from '../../lib/ui.js';
import { CAMPO_DECIMALE, testoDecimaleOVuoto } from '../../lib/importi.js';
import { sorvegliaUscita, armaGuardiaIndietro } from '../../lib/uscita.js';

const BOZZA = {
  titolo: '', categoria: '', data_scadenza: '', ricorrenza: 'nessuna', preavviso_giorni: 30,
  riferimento: '', responsabile: '', importo: null, note: '', fatta: false,
};

export async function renderScheda(view, id, ctx, dataIniziale) {
  const nuova = !id;
  let rec = nuova ? { ...BOZZA } : await store.get(id);
  // Arrivando da un giorno del calendario, la data è già scritta.
  if (nuova && /^\d{4}-\d{2}-\d{2}$/.test(String(dataIniziale || ''))) rec.data_scadenza = dataIniziale;
  // I suggerimenti di categoria: quelle già usate prima, poi le classiche.
  let usate = [];
  try { usate = [...new Set((await store.list()).map(s => s.categoria).filter(Boolean))]; } catch { /* solo suggerimenti */ }
  const categorie = [...new Set([...usate, ...CATEGORIE_SUGGERITE])];
  let sporco = false;
  const admin = ctx.ruolo === 'admin';

  const editor = el(`<div class="dir-editor">
    <div class="page-head">
      <div><h1>${nuova ? 'Nuova scadenza' : 'Scadenza'}</h1>
        <p>${nuova ? 'Che cosa scade e quando: il resto è facoltativo.' : esc(rec.titolo)}</p></div>
      <div class="actions">
        <a class="btn" href="#/scadenze/elenco">← Elenco</a>
        ${nuova ? '<button class="btn" data-salva-nuova title="Salva e prepara subito un\'altra scadenza">💾 Salva e nuova</button>' : ''}
        <button class="btn primary" data-salva>💾 Salva</button>
      </div>
    </div>

    <div class="card"><div class="card-b">
      <div class="field"><label for="f-titolo">Che cosa scade *</label>
        <input type="text" id="f-titolo" placeholder="es. Assicurazione ambulanza CRI 123 AB" autocomplete="off"></div>
      <div class="form-row">
        <div class="field"><label for="f-data">Data di scadenza *</label>
          <input type="date" id="f-data"><div class="hint" data-quando></div></div>
        <div class="field"><label for="f-categoria">Categoria</label>
          <input type="text" id="f-categoria" list="f-categorie" placeholder="es. Assicurazioni" autocomplete="off">
          <datalist id="f-categorie">${categorie.map(c => `<option value="${esc(c)}">`).join('')}</datalist></div>
      </div>
      <div class="form-row">
        <div class="field"><label for="f-ricorrenza">Si ripete</label>
          <select id="f-ricorrenza">${RICORRENZE.map(r => `<option value="${r.id}">${esc(r.label)}</option>`).join('')}</select>
          <div class="hint" data-prossima></div></div>
        <div class="field"><label for="f-preavviso">Preavviso (giorni)</label>
          <input type="number" id="f-preavviso" min="0" max="365" step="1">
          <div class="hint">Da quanti giorni prima va tenuta d'occhio.</div></div>
      </div>
      <div class="form-row three">
        <div class="field"><label for="f-riferimento">Riferimento</label>
          <input type="text" id="f-riferimento" placeholder="targa, n. polizza, contratto, fornitore…"></div>
        <div class="field"><label for="f-responsabile">Chi se ne occupa</label>
          <input type="text" id="f-responsabile"></div>
        <div class="field"><label for="f-importo">Importo €</label>
          <input ${CAMPO_DECIMALE} id="f-importo" placeholder="facoltativo"></div>
      </div>
      <div class="field"><label for="f-note">Note</label>
        <textarea id="f-note" rows="3" placeholder="Cosa serve per rinnovarla, chi contattare, dove sono i documenti…"></textarea></div>
      ${nuova ? '' : `<div class="switch-row"><label class="switch">
        <input type="checkbox" id="f-fatta"><span class="slider"></span><span data-stato></span></label></div>`}
    </div></div>

    ${nuova ? '' : `<div class="str-elimina">
      ${admin ? '<button class="btn danger ghost" data-elimina>🗑️ Elimina questa scadenza</button>' : ''}
      <span class="muted small" data-meta></span></div>`}
  </div>`);
  view.appendChild(editor);

  const $ = (s) => editor.querySelector(s);
  const campi = {
    titolo: $('#f-titolo'), data: $('#f-data'), categoria: $('#f-categoria'), ricorrenza: $('#f-ricorrenza'),
    preavviso: $('#f-preavviso'), riferimento: $('#f-riferimento'), responsabile: $('#f-responsabile'),
    importo: $('#f-importo'), note: $('#f-note'), fatta: $('#f-fatta'),
  };
  const modificato = () => { sporco = true; armaGuardiaIndietro(); };

  function aggiornaSuggerimenti() {
    const d = campi.data.value;
    const prova = { data_scadenza: d, preavviso_giorni: Number(campi.preavviso.value) || 0 };
    $('[data-quando]').textContent = d ? etichetta(prova).testo : '';
    const p = d ? prossimaData(d, campi.ricorrenza.value) : null;
    $('[data-prossima]').textContent = p ? `Segnandola fatta, nasce la successiva: ${fmtDate(p)}.` : '';
    if (campi.fatta) $('[data-stato]').textContent = campi.fatta.checked ? 'Fatta' : 'Da fare — spunta quando è sistemata';
  }

  function riempi() {
    campi.titolo.value = rec.titolo || '';
    campi.data.value = rec.data_scadenza || '';
    campi.categoria.value = rec.categoria && !(nuova && rec.categoria === 'Altro') ? rec.categoria : '';
    campi.ricorrenza.value = rec.ricorrenza || 'nessuna';
    campi.preavviso.value = rec.preavviso_giorni ?? 30;
    campi.riferimento.value = rec.riferimento || '';
    campi.responsabile.value = rec.responsabile || '';
    campi.importo.value = testoDecimaleOVuoto(rec.importo);
    campi.note.value = rec.note || '';
    if (campi.fatta) campi.fatta.checked = !!rec.fatta;
    if (!nuova) $('[data-meta]').textContent = `Creata il ${fmtDateTime(rec.created_at)}` + (rec.fatta_il ? ` · fatta il ${fmtDateTime(rec.fatta_il)}` : '');
    aggiornaSuggerimenti();
    sporco = false;
  }

  for (const c of Object.values(campi)) {
    if (!c) continue;
    c.addEventListener(c.tagName === 'SELECT' || c.type === 'checkbox' || c.type === 'date' ? 'change' : 'input', () => { modificato(); aggiornaSuggerimenti(); });
  }

  function raccogli() {
    const importo = campi.importo.value.trim() ? parseEuro(campi.importo.value) : null;
    return {
      ...rec,
      titolo: campi.titolo.value.trim(), data_scadenza: campi.data.value || null,
      categoria: campi.categoria.value.trim(), ricorrenza: campi.ricorrenza.value,
      preavviso_giorni: campi.preavviso.value, riferimento: campi.riferimento.value,
      responsabile: campi.responsabile.value, importo, note: campi.note.value,
      fatta: campi.fatta ? campi.fatta.checked : !!rec.fatta,
    };
  }

  let salvando = false;
  async function salva(poiNuova) {
    if (salvando) return;          // doppio clic: una scadenza sola
    const da = raccogli();
    if (!da.titolo) { toast('Scrivi che cosa scade', 'err'); campi.titolo.focus(); return; }
    if (!da.data_scadenza) { toast('Indica la data di scadenza', 'err'); campi.data.focus(); return; }
    if (campi.importo.value.trim() && (da.importo == null || da.importo < 0)) { toast('Importo non valido', 'err'); campi.importo.focus(); return; }
    salvando = true;
    try {
      // Spuntata dalla scheda una ricorrente aperta: si passa da segna(), che
      // fa nascere la successiva come dall'elenco.
      if (!nuova && da.fatta && !rec.fatta && da.ricorrenza !== 'nessuna') {
        const salvata = await store.save({ ...da, fatta: false });
        const { nuova: prossima } = await store.segna(salvata, true);
        toast(prossima ? `Salvata e fatta. La prossima: ${fmtDate(prossima.data_scadenza)}` : 'Salvata', 'ok');
      } else {
        await store.save(da);
        toast(nuova ? 'Scadenza aggiunta' : 'Modifiche salvate', 'ok');
      }
    } catch (e) { toast('Salvataggio non riuscito: ' + e.message, 'err'); return; }
    finally { salvando = false; }
    sporco = false;
    if (poiNuova) { rec = { ...BOZZA, categoria: da.categoria }; riempi(); campi.titolo.focus(); return; }
    ctx.go('#/scadenze/elenco');
  }

  $('[data-salva]').addEventListener('click', () => salva(false));
  $('[data-salva-nuova]')?.addEventListener('click', () => salva(true));
  $('[data-elimina]')?.addEventListener('click', async () => {
    if (!await confirmDialog(`Eliminare «${rec.titolo}»?`, { danger: true, okLabel: 'Elimina' })) return;
    try { await store.remove(rec.id); }
    catch (e) { toast(e.message, 'err'); return; }
    sporco = false;
    toast('Scadenza eliminata', 'ok');
    ctx.go('#/scadenze/elenco');
  });

  riempi();
  if (nuova) campi.titolo.focus();
  sorvegliaUscita(editor, () => sporco);
}
