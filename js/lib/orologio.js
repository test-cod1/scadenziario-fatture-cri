// ============================================================
//  SELETTORE DI ORARIO A OROLOGIO
//  Si scelgono prima le ore e poi i minuti, toccando i numeri su un quadrante.
//  I minuti sono a passi di dieci: negli orari di servizio non serve di più, e
//  con sei sole posizioni il quadrante resta leggibile e comodo anche col dito.
//
//  Sostituisce <input type="time">, che su desktop obbliga a scrivere quattro
//  cifre con la tastiera e su telefono apre selettori diversi da un sistema
//  all'altro. Il campo resta un normale input con valore "HH:MM", così chi lo
//  legge non deve sapere come è stato compilato.
// ============================================================
import { el } from './ui.js';

const PASSO_MINUTI = 10;

// Trasforma un input in campo orario: sola lettura, si apre il quadrante al
// clic (o con Invio/Spazio da tastiera).
export function collegaOrologio(input, { onCambio } = {}) {
  input.readOnly = true;
  input.classList.add('campo-ora');
  input.setAttribute('inputmode', 'none');
  if (!input.placeholder) input.placeholder = '--:--';

  const apri = async () => {
    if (input.disabled) return;
    const scelto = await apriOrologio(input.value, input);
    if (scelto === null) return;
    input.value = scelto;
    onCambio?.(scelto);
  };
  input.addEventListener('click', apri);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); apri(); }
    // Cancellare l'orario deve restare possibile senza aprire il quadrante.
    if (e.key === 'Backspace' || e.key === 'Delete') { input.value = ''; onCambio?.(''); }
  });
}

// Apre il quadrante e restituisce "HH:MM", oppure null se si annulla.
export function apriOrologio(valoreIniziale = '', ancora = null) {
  return new Promise((risolvi) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(valoreIniziale || '').trim());
    let ore = m ? Math.min(23, Number(m[1])) : null;
    let minuti = m ? Math.round(Number(m[2]) / PASSO_MINUTI) * PASSO_MINUTI % 60 : null;
    let passo = 'ore';

    const sfondo = el('<div class="orologio-sfondo"></div>');
    const pop = el(`<div class="orologio" role="dialog" aria-modal="true" aria-label="Scegli l'orario">
      <div class="oro-testa">
        <button type="button" class="oro-parte" data-parte="ore">--</button>
        <span class="oro-sep">:</span>
        <button type="button" class="oro-parte" data-parte="minuti">--</button>
        <span class="oro-passo"></span>
      </div>
      <div class="oro-quadrante">
        <div class="oro-centro"></div>
        <div class="oro-lancetta"></div>
      </div>
      <div class="oro-piede">
        <button type="button" class="btn ghost sm" data-annulla>Annulla</button>
        <button type="button" class="btn ghost sm" data-svuota>Svuota</button>
      </div>
    </div>`);
    sfondo.appendChild(pop);
    document.body.appendChild(sfondo);

    // Il quadrante si apre accanto al campo, ma rientra nella finestra se non
    // ci sta: su una riga di tabella vicina al bordo, altrimenti finirebbe
    // mezzo fuori schermo.
    if (ancora) {
      const r = ancora.getBoundingClientRect();
      const larghezza = 268, altezza = 358;
      // Il massimo si prende sempre per ultimo: se la finestra è più stretta
      // del quadrante (o non è ancora stata dimensionata) il limite destro
      // diventa negativo, e senza questo accorgimento il quadrante finiva
      // fuori dallo schermo a sinistra.
      const sinistra = Math.max(8, Math.min(r.left, window.innerWidth - larghezza - 8));
      const sopra = r.bottom + altezza + 8 > window.innerHeight && r.top > altezza + 8;
      pop.style.left = sinistra + 'px';
      pop.style.top = Math.max(8, sopra ? r.top - altezza - 6 : r.bottom + 6) + 'px';
    }

    const quadrante = pop.querySelector('.oro-quadrante');
    const lancetta = pop.querySelector('.oro-lancetta');
    const DIM = 232, CENTRO = DIM / 2;

    function chiudi(valore) {
      document.removeEventListener('keydown', onKey, true);
      sfondo.remove();
      risolvi(valore);
    }

    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); chiudi(null); }
    }
    document.addEventListener('keydown', onKey, true);
    sfondo.addEventListener('mousedown', (e) => { if (e.target === sfondo) chiudi(null); });
    pop.querySelector('[data-annulla]').addEventListener('click', () => chiudi(null));
    pop.querySelector('[data-svuota]').addEventListener('click', () => chiudi(''));
    pop.querySelectorAll('[data-parte]').forEach(b =>
      b.addEventListener('click', () => { passo = b.dataset.parte; disegna(); }));

    // dimensione = lato del pulsante, serve per centrarlo sul punto calcolato.
    function numero(valore, etichetta, indice, totale, raggio, selezionato, dimensione = 34) {
      const ang = (indice / totale) * 2 * Math.PI - Math.PI / 2;
      const n = el(`<button type="button" class="oro-num${selezionato ? ' sel' : ''}">${etichetta}</button>`);
      n.style.left = (CENTRO + raggio * Math.cos(ang) - dimensione / 2) + 'px';
      n.style.top = (CENTRO + raggio * Math.sin(ang) - dimensione / 2) + 'px';
      n.addEventListener('click', () => scegli(valore));
      return n;
    }

    function scegli(valore) {
      if (passo === 'ore') {
        ore = valore;
        if (minuti === null) minuti = 0;
        passo = 'minuti';
        disegna();
      } else {
        minuti = valore;
        chiudi(`${String(ore ?? 0).padStart(2, '0')}:${String(minuti).padStart(2, '0')}`);
      }
    }

    function disegna() {
      pop.querySelectorAll('.oro-num').forEach(n => n.remove());
      pop.querySelector('[data-parte="ore"]').textContent = ore === null ? '--' : String(ore).padStart(2, '0');
      pop.querySelector('[data-parte="minuti"]').textContent = minuti === null ? '--' : String(minuti).padStart(2, '0');
      pop.querySelectorAll('[data-parte]').forEach(b => b.classList.toggle('attiva', b.dataset.parte === passo));
      pop.querySelector('.oro-passo').textContent = passo === 'ore' ? 'scegli l\'ora' : 'scegli i minuti';

      if (passo === 'ore') {
        // Anello esterno 1-12, anello interno 13-23 e 00: tutte le ore del
        // giorno restano raggiungibili con un tocco solo.
        for (let i = 1; i <= 12; i++) {
          quadrante.appendChild(numero(i, String(i), i, 12, 99, ore === i));
        }
        for (let i = 1; i <= 12; i++) {
          const v = i === 12 ? 0 : i + 12;
          const n = numero(v, String(v).padStart(2, '0'), i, 12, 57, ore === v, 30);
          n.classList.add('interno');
          quadrante.appendChild(n);
        }
        ruotaLancetta(ore === null ? null : (ore % 12 === 0 ? 12 : ore % 12) / 12, ore !== null && (ore === 0 || ore > 12));
      } else {
        for (let i = 0; i < 60 / PASSO_MINUTI; i++) {
          const v = i * PASSO_MINUTI;
          quadrante.appendChild(numero(v, String(v).padStart(2, '0'), i, 60 / PASSO_MINUTI, 99, minuti === v));
        }
        ruotaLancetta(minuti === null ? null : minuti / 60, false);
      }
    }

    function ruotaLancetta(frazione, corta) {
      if (frazione === null) { lancetta.style.display = 'none'; return; }
      lancetta.style.display = 'block';
      lancetta.style.height = (corta ? 57 : 99) + 'px';
      lancetta.style.transform = `translateX(-1px) rotate(${frazione * 360}deg)`;
    }

    disegna();
    pop.querySelector('.oro-quadrante').focus?.();
  });
}
