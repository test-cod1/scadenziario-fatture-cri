// ============================================================
//  LA SCHEDA DI UN MOVIMENTO — finestra, non pagina.
//  Un'entrata o un'uscita di un centro di costo: data, controparte,
//  documento, che cosa è, quanto. Si apre dal conto dell'attività e si
//  chiude tornando lì, con la riga già al suo posto.
//
//  Si risolve con il record salvato, oppure con null se si chiude senza
//  salvare.
// ============================================================
import { movimenti } from '../data/store.js';
import { el, esc, toast, openModal } from '../../lib/ui.js';
import { CAMPO_DECIMALE, testoDecimale, leggiDecimale } from '../../lib/importi.js';

export function apriSchedaMovimento(centro, rec, tipoIniziale = 'uscita') {
  const nuovo = !rec?.id;
  const tipo = rec?.tipo || tipoIniziale;
  return new Promise(res => {
    let esito = null;

    const body = el(`<div>
      <div class="form-row">
        <div class="field"><label for="mv-tipo">Tipo *</label>
          <select id="mv-tipo">
            <option value="uscita"${tipo === 'uscita' ? ' selected' : ''}>Uscita (costo)</option>
            <option value="entrata"${tipo === 'entrata' ? ' selected' : ''}>Entrata (ricavo)</option>
          </select></div>
        <div class="field"><label for="mv-data">Data</label>
          <input type="date" id="mv-data" value="${esc(rec?.data || '')}"></div>
      </div>
      <div class="field"><label for="mv-desc">Descrizione</label>
        <input type="text" id="mv-desc" value="${esc(rec?.descrizione || '')}"
          placeholder="es. Rifornimento, tagliando, quota convenzione" autocomplete="off"></div>
      <div class="form-row">
        <div class="field"><label for="mv-contro">Fornitore o cliente</label>
          <input type="text" id="mv-contro" value="${esc(rec?.controparte || '')}" autocomplete="off"></div>
        <div class="field"><label for="mv-doc">Documento</label>
          <input type="text" id="mv-doc" value="${esc(rec?.documento || '')}"
            placeholder="es. Fatt. 1250" autocomplete="off"></div>
      </div>
      <div class="field"><label for="mv-importo">Importo (€) *</label>
        <input ${CAMPO_DECIMALE} id="mv-importo" value="${rec?.importo ? testoDecimale(rec.importo) : ''}">
        <div class="hint">Sempre positivo: se è un costo o un ricavo lo dice il tipo qui sopra.</div></div>
      <div class="field"><label for="mv-note">Note</label>
        <textarea id="mv-note" rows="2">${esc(rec?.note || '')}</textarea></div>
    </div>`);

    const foot = el(`<div style="display:flex;gap:10px;justify-content:flex-end">
      <button class="btn" data-annulla>Annulla</button>
      <button class="btn primary" data-ok>${nuovo ? 'Aggiungi' : 'Salva'}</button>
    </div>`);

    const { close } = openModal({
      title: `${nuovo ? 'Nuovo movimento' : 'Movimento'} — ${centro.nome}`,
      body, footer: foot, onClose: () => res(esito),
    });

    foot.querySelector('[data-annulla]').addEventListener('click', () => close());
    foot.querySelector('[data-ok]').addEventListener('click', async () => {
      const v = s => body.querySelector(s).value;
      const btn = foot.querySelector('[data-ok]');
      btn.disabled = true;
      try {
        esito = await movimenti.save({
          id: rec?.id,
          centro_id: centro.id,
          tipo: v('#mv-tipo'),
          data: v('#mv-data'),
          descrizione: v('#mv-desc'),
          controparte: v('#mv-contro'),
          documento: v('#mv-doc'),
          importo: leggiDecimale(v('#mv-importo')),
          note: v('#mv-note'),
        });
      } catch (e) {
        toast(e.message, 'err');
        btn.disabled = false;
        return;
      }
      toast(nuovo ? 'Movimento aggiunto' : 'Movimento salvato', 'ok');
      close();
    });
  });
}
