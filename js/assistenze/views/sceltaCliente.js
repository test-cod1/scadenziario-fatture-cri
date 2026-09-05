import { clienti } from '../data/store.js';
import { el, clear, esc, toast, openModal } from '../../lib/ui.js';

// ============================================================
//  SCEGLI UN CLIENTE DALLA RUBRICA
//  Un riquadro con l'elenco e un filtro: si apre quando lo si chiede, non
//  mentre si scrive. Restituisce la scheda scelta, o null se si chiude senza
//  scegliere.
// ============================================================

export async function scegliCliente() {
  let elenco;
  try {
    elenco = await clienti.list();
  } catch (e) {
    toast('Rubrica non disponibile: ' + e.message, 'err');
    return null;
  }

  return new Promise((risolvi) => {
    let scelto = null;

    const corpo = el(`<div>
      <div class="search" style="margin-bottom:12px">
        <span class="search-icon" aria-hidden="true">🔍</span>
        <input type="text" id="cerca" placeholder="Filtra per nome, codice fiscale o referente…">
      </div>
      <div class="rubrica-elenco"></div>
    </div>`);
    const zona = corpo.querySelector('.rubrica-elenco');

    function disegna() {
      const q = corpo.querySelector('#cerca').value.toLowerCase().trim();
      clear(zona);
      const righe = elenco.filter(c => !q ||
        [c.nome, c.cf, c.referente, c.indirizzo].filter(Boolean).join(' ').toLowerCase().includes(q));

      if (!righe.length) {
        zona.appendChild(el(`<p class="muted" style="text-align:center;padding:18px">
          ${elenco.length ? 'Nessun cliente con questo nome.' : 'La rubrica è vuota: compila il destinatario e usa «Salva in rubrica».'}</p>`));
        return;
      }
      for (const c of righe) {
        const riga = el(`<button class="rb-voce" type="button">
          <span class="rb-nome">${esc(c.nome)}</span>
          <span class="rb-dati">${esc([c.cf, c.indirizzo].filter(Boolean).join(' · ') || 'nessun altro dato')}</span>
        </button>`);
        riga.addEventListener('click', () => { scelto = c; chiudi(); });
        zona.appendChild(riga);
      }
    }

    corpo.querySelector('#cerca').addEventListener('input', disegna);
    disegna();

    const { close } = openModal({
      title: 'Scegli dalla rubrica',
      body: corpo,
      onClose: () => risolvi(scelto),
    });
    const chiudi = close;
    corpo.querySelector('#cerca').focus();
  });
}
