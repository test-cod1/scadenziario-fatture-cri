// ============================================================
//  CAMPO CON SUGGERIMENTI
//  Un input di testo che, mentre si scrive, propone un elenco di voci sotto
//  di sé: si scelgono col mouse o con le frecce, e chi le sceglie decide cosa
//  farne. Il componente non sa nulla di clienti o di enti — riceve una
//  funzione di ricerca e restituisce la voce scelta.
//
//  Non si usa <datalist> nativo perché lì ogni voce è una riga di testo sola:
//  qui serve mostrare anche il dettaglio che fa riconoscere la voce giusta
//  (il codice fiscale, il comune) e righe che invece di un dato eseguono
//  un'azione, come "cerca in tutta Italia".
// ============================================================
import { el, clear, esc } from './ui.js';

const ATTESA = 180;   // ms di pausa nella digitazione prima di cercare

// voce = { titolo, dettaglio?, gruppo?, dati?, azione? }
//   dati   → viene passata a onScelta
//   azione → funzione eseguita al posto della scelta (il menu resta aperto e
//            la ricerca viene rifatta: serve per "cerca altrove")
export function collegaCompletamento(input, { cerca, onScelta, minimo = 3, aiuto } = {}) {
  const contenitore = input.parentElement;
  contenitore.classList.add('con-suggerimenti');

  const menu = el('<div class="suggerimenti" role="listbox" hidden></div>');
  contenitore.appendChild(menu);

  let voci = [];
  let scelta = -1;
  let timer = null;
  let ultimaRicerca = 0;

  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('autocomplete', 'off');

  function chiudi() {
    menu.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    scelta = -1;
  }

  function disegna() {
    clear(menu);
    if (!voci.length) { chiudi(); return; }
    let gruppoCorrente = null;
    voci.forEach((v, i) => {
      if (v.gruppo && v.gruppo !== gruppoCorrente) {
        gruppoCorrente = v.gruppo;
        menu.appendChild(el(`<div class="sg-gruppo">${esc(v.gruppo)}</div>`));
      }
      const riga = el(`<div class="sg-voce${v.azione ? ' azione' : ''}" role="option" data-i="${i}">
        <span class="sg-titolo">${esc(v.titolo)}</span>
        ${v.dettaglio ? `<span class="sg-dettaglio">${esc(v.dettaglio)}</span>` : ''}
      </div>`);
      // mousedown e non click: il click arriverebbe dopo il blur dell'input,
      // che chiude il menu, e la voce non verrebbe mai scelta.
      riga.addEventListener('mousedown', (e) => { e.preventDefault(); usa(i); });
      menu.appendChild(riga);
    });
    if (aiuto) menu.appendChild(el(`<div class="sg-piede">${esc(aiuto)}</div>`));
    menu.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    evidenzia();
  }

  function evidenzia() {
    menu.querySelectorAll('.sg-voce').forEach(r => {
      const attiva = Number(r.dataset.i) === scelta;
      r.classList.toggle('sel', attiva);
      r.setAttribute('aria-selected', attiva ? 'true' : 'false');
      if (attiva) r.scrollIntoView({ block: 'nearest' });
    });
  }

  async function usa(i) {
    const v = voci[i];
    if (!v) return;
    if (v.azione) { await v.azione(); avvia(true); return; }
    chiudi();
    onScelta(v.dati, v);
  }

  async function avvia(immediata = false) {
    const testo = input.value.trim();
    if (testo.length < minimo) { voci = []; chiudi(); return; }
    const mio = ++ultimaRicerca;
    try {
      const risultati = await cerca(testo);
      // Risposta di una ricerca vecchia: se nel frattempo si è continuato a
      // scrivere, i suoi risultati non c'entrano più con quello che si vede.
      if (mio !== ultimaRicerca) return;
      voci = risultati || [];
      scelta = voci.length && !voci[0].azione ? 0 : -1;
      disegna();
    } catch {
      voci = []; chiudi();   // la ricerca è un aiuto: se non funziona, si scrive a mano
    }
    if (immediata) input.focus();
  }

  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => avvia(), ATTESA);
  });

  input.addEventListener('keydown', (e) => {
    if (menu.hidden) {
      if (e.key === 'ArrowDown') { e.preventDefault(); avvia(); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); scelta = Math.min(scelta + 1, voci.length - 1); evidenzia(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); scelta = Math.max(scelta - 1, 0); evidenzia(); }
    else if (e.key === 'Enter' && scelta >= 0) { e.preventDefault(); usa(scelta); }
    else if (e.key === 'Escape') { e.preventDefault(); chiudi(); }
    else if (e.key === 'Tab') chiudi();
  });

  input.addEventListener('blur', () => setTimeout(chiudi, 120));

  return { chiudi, aggiorna: () => avvia() };
}
