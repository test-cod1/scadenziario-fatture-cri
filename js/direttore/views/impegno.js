// ============================================================
//  LA SCHEDA DI UN IMPEGNO — nuovo o già esistente.
//  Corta di proposito: il titolo è l'unica cosa obbligatoria, perché un
//  impegno che non si riesce a scrivere in dieci secondi non viene
//  scritto affatto. Urgenza e importanza partono da "media" e si
//  correggono con un clic; la scadenza può restare vuota, ed è una
//  risposta legittima («va fatto, non entro una data»).
// ============================================================
import { impegni as store } from '../data/store.js';
import { LIVELLI, livelloDi, etichettaScadenza, punteggio } from '../calc.js';
import { el, esc, toast, confirmDialog, fmtDate, fmtDateTime } from '../../lib/ui.js';
import { sorvegliaUscita } from '../../lib/uscita.js';

const BOZZA = {
  titolo: '', dettagli: '', urgenza: 'media', importanza: 'media',
  scadenza: '', fatto: false,
};

export async function renderImpegno(view, id, ctx) {
  const nuovo = !id;
  let rec = nuovo ? { ...BOZZA } : await store.get(id);
  let sporco = false;

  const editor = el(`<div class="dir-editor">
    <div class="page-head">
      <div>
        <h1>${nuovo ? 'Nuovo impegno' : 'Impegno'}</h1>
        <p>${nuovo ? 'Basta scrivere che cosa c’è da fare: il resto si può lasciare com’è.'
                   : esc(rec.titolo)}</p>
      </div>
      <div class="actions">
        <a class="btn" href="#/direttore/impegni">← Elenco</a>
        ${nuovo ? '<button class="btn" data-salva-nuovo title="Salva e prepara subito un altro impegno">💾 Salva e nuovo</button>' : ''}
        <button class="btn primary" data-salva>💾 Salva</button>
      </div>
    </div>

    <div class="card"><div class="card-b">
      <div class="field">
        <label for="f-titolo">Che cosa c’è da fare *</label>
        <input type="text" id="f-titolo" placeholder="es. Preparare la relazione per il Consiglio" autocomplete="off">
      </div>

      <div class="form-row">
        <div class="field">
          <label>Importanza</label>
          <div class="dir-livelli" role="radiogroup" aria-label="Importanza" data-campo="importanza">
            ${LIVELLI.map(l => `<button type="button" class="dir-liv liv-${l.id}" data-liv="${l.id}"
              role="radio" aria-checked="false">${esc(l.label)}</button>`).join('')}
          </div>
          <div class="hint">Quanto pesa il risultato, indipendentemente da quando va fatto.</div>
        </div>
        <div class="field">
          <label>Urgenza</label>
          <div class="dir-livelli" role="radiogroup" aria-label="Urgenza" data-campo="urgenza">
            ${LIVELLI.map(l => `<button type="button" class="dir-liv liv-${l.id}" data-liv="${l.id}"
              role="radio" aria-checked="false">${esc(l.label)}</button>`).join('')}
          </div>
          <div class="hint">Quanto preme il tempo. È un’altra cosa dall’importanza.</div>
        </div>
      </div>

      <div class="form-row">
        <div class="field">
          <label for="f-scadenza">Entro quando</label>
          <input type="date" id="f-scadenza">
          <div class="hint" data-scadenza>Può restare vuota: «va fatto, ma non entro una data».</div>
        </div>
      </div>

      <div class="field">
        <label for="f-dettagli">Dettagli</label>
        <textarea id="f-dettagli" rows="4" placeholder="Quello che serve per farlo senza doverlo ricostruire: con chi, dove, a che punto è…"></textarea>
      </div>

      <div class="dir-peso" data-peso></div>

      ${nuovo ? '' : `<div class="switch-row"><label class="switch">
        <input type="checkbox" id="f-fatto"><span class="slider"></span>
        <span data-stato>Da fare</span></label></div>`}
    </div></div>

    ${nuovo ? '' : `<div class="str-elimina">
      <button class="btn danger ghost" data-elimina>🗑️ Elimina questo impegno</button>
      <span class="muted small" data-meta></span>
    </div>`}
  </div>`);
  view.appendChild(editor);

  const campi = {
    titolo: editor.querySelector('#f-titolo'),
    scadenza: editor.querySelector('#f-scadenza'),
    dettagli: editor.querySelector('#f-dettagli'),
    fatto: editor.querySelector('#f-fatto'),
  };
  let urgenza = rec.urgenza || 'media';
  let importanza = rec.importanza || 'media';

  function segnaModificato() { sporco = true; }

  function scegliLivello(campo, valore, segna = true) {
    if (campo === 'urgenza') urgenza = valore; else importanza = valore;
    const gruppo = editor.querySelector(`[data-campo="${campo}"]`);
    gruppo.querySelectorAll('[data-liv]').forEach(b => {
      const attivo = b.dataset.liv === valore;
      b.classList.toggle('scelto', attivo);
      b.setAttribute('aria-checked', attivo ? 'true' : 'false');
    });
    if (segna) segnaModificato();
    aggiornaPeso();
  }

  for (const campo of ['urgenza', 'importanza']) {
    editor.querySelector(`[data-campo="${campo}"]`).addEventListener('click', (e) => {
      const b = e.target.closest('[data-liv]');
      if (b) scegliLivello(campo, b.dataset.liv);
    });
  }

  // Il punteggio non è un voto da mostrare come tale: qui si spiega a
  // parole dove finirà l'impegno nell'elenco, che è l'unica cosa che
  // interessa a chi lo sta scrivendo.
  function aggiornaPeso() {
    const finto = { urgenza, importanza, scadenza: campi.scadenza.value || null };
    const p = punteggio(finto);
    const dove = p >= 26 ? 'in cima all’elenco'
      : p >= 20 ? 'fra i primi'
      : p >= 14 ? 'a metà elenco'
      : 'in fondo, fra le cose che possono aspettare';
    const sca = etichettaScadenza(finto.scadenza);
    editor.querySelector('[data-peso]').innerHTML =
      `Importanza <b>${esc(livelloDi(importanza).label.toLowerCase())}</b>, `
      + `urgenza <b>${esc(livelloDi(urgenza).label.toLowerCase())}</b>, `
      + `${esc(sca.testo)}: comparirà <b>${esc(dove)}</b>.`;
  }

  function aggiornaScadenza() {
    const hint = editor.querySelector('[data-scadenza]');
    if (!campi.scadenza.value) {
      hint.textContent = 'Può restare vuota: «va fatto, ma non entro una data».';
      hint.classList.remove('avviso');
      return;
    }
    const sca = etichettaScadenza(campi.scadenza.value);
    hint.textContent = `${fmtDate(campi.scadenza.value)} — ${sca.testo}.`;
    hint.classList.toggle('avviso', sca.stato === 'scaduto');
  }

  // Lo switch c'è solo quando si modifica un impegno esistente: uno nuovo
  // nasce da fare, e chiederlo sarebbe una domanda con una risposta sola.
  function aggiornaStato() {
    if (!campi.fatto) return;
    editor.querySelector('[data-stato]').textContent =
      campi.fatto.checked ? 'Fatto' : 'Da fare — spunta quando è chiuso';
  }

  function riempi() {
    campi.titolo.value = rec.titolo || '';
    campi.scadenza.value = rec.scadenza || '';
    campi.dettagli.value = rec.dettagli || '';
    if (campi.fatto) campi.fatto.checked = !!rec.fatto;
    scegliLivello('urgenza', rec.urgenza || 'media', false);
    scegliLivello('importanza', rec.importanza || 'media', false);
    aggiornaScadenza();
    aggiornaStato();
    if (!nuovo) {
      editor.querySelector('[data-meta]').textContent =
        `Creato il ${fmtDateTime(rec.created_at)}`
        + (rec.fatto_il ? ` · segnato fatto il ${fmtDateTime(rec.fatto_il)}` : '');
    }
    sporco = false;
  }

  campi.titolo.addEventListener('input', segnaModificato);
  campi.dettagli.addEventListener('input', segnaModificato);
  campi.scadenza.addEventListener('change', () => { aggiornaScadenza(); aggiornaPeso(); segnaModificato(); });
  campi.fatto?.addEventListener('change', () => { aggiornaStato(); segnaModificato(); });

  function raccogli() {
    return {
      ...rec,
      titolo: campi.titolo.value.trim(),
      dettagli: campi.dettagli.value,
      urgenza, importanza,
      scadenza: campi.scadenza.value || null,
      fatto: campi.fatto ? campi.fatto.checked : !!rec.fatto,
    };
  }

  async function salva(poiNuovo) {
    const da = raccogli();
    if (!da.titolo) { toast('Scrivi che cosa c’è da fare', 'err'); campi.titolo.focus(); return; }
    let salvato;
    try { salvato = await store.save(da); }
    catch (e) { toast('Salvataggio non riuscito: ' + e.message, 'err'); return; }
    sporco = false;
    toast(nuovo ? 'Impegno aggiunto' : 'Modifiche salvate', 'ok');
    if (poiNuovo) {
      rec = { ...BOZZA };
      riempi();
      campi.titolo.focus();
      return;
    }
    ctx.go('#/direttore/impegni');
  }

  editor.querySelector('[data-salva]').addEventListener('click', () => salva(false));
  editor.querySelector('[data-salva-nuovo]')?.addEventListener('click', () => salva(true));
  editor.querySelector('[data-elimina]')?.addEventListener('click', async () => {
    if (!await confirmDialog(`Eliminare «${rec.titolo}»? Non resta traccia.`,
      { danger: true, okLabel: 'Elimina' })) return;
    try { await store.remove(rec.id); }
    catch (e) { toast('Eliminazione non riuscita: ' + e.message, 'err'); return; }
    sporco = false;
    toast('Impegno eliminato', 'ok');
    ctx.go('#/direttore/impegni');
  });

  riempi();
  if (nuovo) {
    // Un impegno nuovo nasce con la data di oggi solo se lo si vuole: non
    // si precompila, perché una scadenza sbagliata è peggio di nessuna
    // scadenza — sposterebbe l'impegno in cima all'elenco senza motivo.
    campi.titolo.focus();
  }
  sorvegliaUscita(editor, () => sporco);
}
