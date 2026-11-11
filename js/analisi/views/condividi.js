// ============================================================
//  IL LINK DI SOLA LETTURA DI UN CENTRO DI COSTO — finestra.
//  Crea, mostra da copiare, rinnova o disattiva il link che apre
//  centro-condiviso.html per chi non ha il portale. Lo gestisce l'admin
//  di Analisi (policy centri_costo_write); gli altri lo vedono soltanto.
//
//  Si risolve con il centro aggiornato, o null se non è cambiato niente.
// ============================================================
import { centri } from '../data/store.js';
import { el, esc, toast, openModal, confirmDialog, fmtDateTime } from '../../lib/ui.js';

export const urlCondiviso = token => `${location.origin}/centro-condiviso.html#${token}`;

export function apriCondividi(centro, { admin }) {
  return new Promise(res => {
    let esito = null;
    const body = el('<div></div>');
    const foot = el('<div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap"></div>');
    const { close } = openModal({ title: `Condividi «${centro.nome}»`, body, footer: foot, onClose: () => res(esito) });

    function disegna() {
      const link = centro.link_token ? urlCondiviso(centro.link_token) : '';
      body.innerHTML = `
        <p style="margin:0 0 12px">Un link che apre il conto di questa attività <b>in sola lettura</b>, anche a chi
        non ha accesso al portale: entrate, uscite, grafici e l'elenco dei movimenti. <b>Le note dei movimenti
        non si vedono.</b> Chiunque abbia il link vede questi numeri: mandalo solo a chi deve vederli.</p>
        ${link ? `
          <div class="field" style="margin:0">
            <label for="cd-link">Link</label>
            <input type="text" id="cd-link" readonly value="${esc(link)}">
            <div class="hint">Attivo dal ${esc(fmtDateTime(centro.link_creato_il))}. Mostra sempre i dati aggiornati.</div>
          </div>`
        : `<p class="hint" style="margin:0">${admin ? 'Nessun link attivo.' : 'Nessun link attivo: può crearlo un amministratore della sezione.'}</p>`}`;
      foot.innerHTML = `
        ${link && admin ? '<button class="btn" data-togli>Disattiva</button><button class="btn" data-rinnova>Cambia link</button>' : ''}
        ${link ? '<button class="btn primary" data-copia>Copia il link</button>' : ''}
        ${!link && admin ? '<button class="btn primary" data-crea>Crea il link</button>' : ''}
        ${!link && !admin ? '<button class="btn" data-chiudi>Chiudi</button>' : ''}`;
      body.querySelector('#cd-link')?.addEventListener('focus', e => e.target.select());
      foot.querySelector('[data-chiudi]')?.addEventListener('click', () => close());
      foot.querySelector('[data-copia]')?.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(link); toast('Link copiato', 'ok'); }
        catch { body.querySelector('#cd-link').select(); toast('Copia non riuscita: selezionalo e copialo a mano', 'err'); }
      });
      foot.querySelector('[data-crea]')?.addEventListener('click', () => imposta(true, 'Link creato'));
      foot.querySelector('[data-rinnova]')?.addEventListener('click', async () => {
        if (!await confirmDialog('Creare un link nuovo? Quello di adesso smette subito di funzionare per chi lo ha già ricevuto.', { okLabel: 'Cambia link' })) return;
        imposta(true, 'Link cambiato: quello vecchio non funziona più');
      });
      foot.querySelector('[data-togli]')?.addEventListener('click', async () => {
        if (!await confirmDialog('Disattivare il link? Chi lo ha ricevuto non potrà più vedere il conto.', { danger: true, okLabel: 'Disattiva' })) return;
        imposta(false, 'Link disattivato');
      });
    }

    async function imposta(attivo, messaggio) {
      foot.querySelectorAll('button').forEach(b => { b.disabled = true; });
      try {
        Object.assign(centro, await centri.impostaLink(centro.id, attivo));
        esito = centro;
        toast(messaggio, 'ok');
      } catch (e) { toast(e.message, 'err'); }
      disegna();
    }

    disegna();
  });
}
