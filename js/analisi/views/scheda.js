// ============================================================
//  LA SCHEDA DI UN CENTRO DI COSTO — finestra, non pagina.
//  Sono quattro campi di cui uno solo obbligatorio: aprirli in una pagina
//  a sé avrebbe voluto dire perdere di vista l'elenco da cui si è partiti
//  per cambiare un nome.
//
//  Si risolve con il record salvato, oppure con null se si chiude senza
//  salvare — così chi chiama aggiorna la propria pagina solo quando c'è
//  davvero qualcosa di nuovo da mostrare.
// ============================================================
import { centri } from '../data/store.js';
import { el, esc, toast, openModal } from '../../lib/ui.js';

export function apriSchedaCentro(rec) {
  const nuovo = !rec;
  return new Promise(res => {
    let esito = null;

    const body = el(`<div>
      <div class="field">
        <label for="cc-nome">Nome dell’attività *</label>
        <input type="text" id="cc-nome" value="${esc(rec?.nome || '')}"
          placeholder="es. Corso BLSD aziende – primavera 2026" autocomplete="off">
        <div class="hint">Un nome che distingua questa attività da un’altra simile: se ne farai
        un’altra edizione, ti servirà riconoscerle a colpo d’occhio.</div>
      </div>
      <div class="field">
        <label for="cc-desc">Descrizione (opzionale)</label>
        <textarea id="cc-desc" rows="2" placeholder="A che cosa serve seguire questa attività">${esc(rec?.descrizione || '')}</textarea>
      </div>
      <div class="form-row">
        <div class="field"><label for="cc-inizio">Inizio (opzionale)</label>
          <input type="date" id="cc-inizio" value="${esc(rec?.inizio || '')}"></div>
        <div class="field"><label for="cc-fine">Fine (opzionale)</label>
          <input type="date" id="cc-fine" value="${esc(rec?.fine || '')}"></div>
      </div>
      <div class="hint" style="margin-top:-4px">Il periodo serve a leggere il conto e a distinguere
      due edizioni della stessa attività. <b>Non filtra le fatture</b>: una fattura che arriva mesi
      dopo la fine resta di questa attività, ed è giusto così.</div>
      ${nuovo ? '' : `<label class="cc-chiusa">
        <input type="checkbox" id="cc-chiuso" ${rec.chiuso ? 'checked' : ''}>
        <span>Attività conclusa — resta leggibile nei conti, ma sparisce dalle tendine di chi registra una fattura nuova</span>
      </label>`}
    </div>`);

    const foot = el(`<div style="display:flex;gap:10px;justify-content:flex-end">
      <button class="btn" data-annulla>Annulla</button>
      <button class="btn primary" data-ok>${nuovo ? 'Crea attività' : 'Salva'}</button>
    </div>`);

    const { close } = openModal({
      title: nuovo ? 'Nuova attività' : 'Attività',
      body, footer: foot, onClose: () => res(esito),
    });

    foot.querySelector('[data-annulla]').addEventListener('click', () => close());
    foot.querySelector('[data-ok]').addEventListener('click', async () => {
      const da = {
        id: rec?.id,
        nome: body.querySelector('#cc-nome').value,
        descrizione: body.querySelector('#cc-desc').value,
        inizio: body.querySelector('#cc-inizio').value,
        fine: body.querySelector('#cc-fine').value,
        chiuso: body.querySelector('#cc-chiuso')?.checked ?? false,
      };
      const btn = foot.querySelector('[data-ok]');
      btn.disabled = true;
      try {
        esito = await centri.save(da);
      } catch (e) {
        // Il nome doppio è l'errore che capita davvero, e detto dal
        // database parla di indici: qui si dice che cosa è successo.
        const msg = e?.code === '23505' || /ux_centri_costo_nome/.test(String(e?.message))
          ? 'Esiste già un’attività con questo nome: aprila invece di crearne una seconda.'
          : e.message;
        toast(msg, 'err');
        btn.disabled = false;
        return;
      }
      toast(nuovo ? 'Attività creata' : 'Modifiche salvate', 'ok');
      close();
    });
  });
}
