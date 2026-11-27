// ============================================================
//  SOLA VISUALIZZAZIONE (ruolo di sezione «lettore»)
//  Chi ha la formazione in sola visualizzazione vede tutto quello che vede
//  un operatore ma non scrive nulla. I pulsanti che scrivono li nasconde il
//  CSS (attributo data-scrive, vedi js/app.js); qui restano le due cose che
//  il CSS da solo non può fare: spegnere i campi di un preventivo o di un
//  corso aperto in consultazione, e dire perché una pagina di creazione non
//  mostra il suo modulo.
// ============================================================
import { el, esc } from '../lib/ui.js';

// I campi restano leggibili ma non si possono cambiare: senza, si potrebbe
// scrivere in un preventivo che poi non si salva, e sembrerebbe un errore.
export function bloccaCampi(radice) {
  radice.querySelectorAll('input, select, textarea').forEach(c => { c.disabled = true; });
}

// Al posto del modulo di creazione, raggiunto da un link o dall'indirizzo.
export function avvisoSolaLettura(testo, href, etichetta) {
  return el(`<div class="empty-state"><div class="big">👁</div>
    <p>${esc(testo)}<br>Hai accesso alla Formazione Esterna in sola visualizzazione.</p>
    ${href ? `<p><a class="btn" href="${esc(href)}">${esc(etichetta)}</a></p>` : ''}</div>`);
}
