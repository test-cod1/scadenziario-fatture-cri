// ============================================================
//  MOTORE DEL TOUR GUIDATO
//  Si avvia solo cliccando il pulsante flottante (mai in automatico) e mostra
//  le funzioni principali navigando davvero fra le pagine, evidenziando ogni
//  volta l'elemento di cui si sta parlando.
//
//  Qui non c'è nulla di specifico di una sezione: il copione (dove andare,
//  cosa evidenziare, cosa dire) arriva da fuori, da js/tour/<sezione>.js. Un
//  passo il cui elemento non compare — perché la pagina è vuota o il ruolo
//  dell'utente non lo prevede — viene semplicemente saltato.
// ============================================================
import { el } from './ui.js';

function elementoVisibile(elx) {
  return !!elx && !!(elx.offsetWidth || elx.offsetHeight || elx.getClientRects().length);
}

// L'app carica i dati da Supabase in modo asincrono dopo un cambio di hash
// (spinner intermedio): si interroga il DOM a intervalli finché l'elemento
// non compare invece di affidarsi a un singolo controllo subito dopo la
// navigazione, che lo troverebbe quasi sempre assente.
function attendiElemento(selettore, timeoutMs = 6000) {
  return new Promise(resolve => {
    const scadenza = Date.now() + timeoutMs;
    (function tenta() {
      const trovato = document.querySelector(selettore);
      if (elementoVisibile(trovato)) return resolve(trovato);
      if (Date.now() > scadenza) return resolve(null);
      setTimeout(tenta, 80);
    })();
  });
}

function elementiFocalizzabili(node) {
  return [...node.querySelectorAll('button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')]
    .filter(e => e.offsetParent !== null);
}

let tourAttivo = false;

// Un solo tour alla volta: se il pulsante viene ricliccato mentre è già
// aperto (es. doppio clic accidentale) si ignora, invece di sovrapporre due
// istanze con i propri listener e finire per non poterle chiudere entrambe.
export function startTour(passi) {
  if (tourAttivo) return;
  // Il controllo sta PRIMA di alzare la bandiera: uscire dopo averla alzata
  // lascerebbe "tourAttivo" acceso per sempre, impedendo di aprire qualunque
  // altro tour per il resto della sessione.
  if (!passi || !passi.length) return;
  tourAttivo = true;

  const elementoAttivoPrima = document.activeElement;
  let idx = -1;
  let target = null;

  const scrim = el('<div class="tour-scrim"></div>');
  const ring = el('<div class="tour-ring"></div>');
  const tip = el(`<div class="tour-tip" role="dialog" aria-label="Tour guidato" tabindex="-1">
    <div class="tt-h"><div><b class="tt-title"></b><div class="tt-step"></div></div><button class="tt-x" type="button" aria-label="Chiudi tour">✕</button></div>
    <div class="tt-b"></div>
    <div class="tt-f">
      <button class="btn ghost sm tt-salta" type="button">Salta tour</button>
      <div style="display:flex;gap:8px">
        <button class="btn sm tt-indietro" type="button">‹ Indietro</button>
        <button class="btn primary sm tt-avanti" type="button">Avanti ›</button>
      </div>
    </div>
  </div>`);
  document.body.append(scrim, ring, tip);

  function chiudi() {
    if (!tourAttivo) return;
    tourAttivo = false;
    document.removeEventListener('keydown', onKeydown, true);
    window.removeEventListener('resize', riposiziona);
    window.removeEventListener('scroll', riposiziona, true);
    scrim.remove(); ring.remove(); tip.remove();
    if (elementoAttivoPrima && document.contains(elementoAttivoPrima)) elementoAttivoPrima.focus();
  }

  function posizionaRing(rect) {
    if (!rect) { ring.style.display = 'none'; return; }
    const pad = 8;
    ring.style.display = 'block';
    ring.style.top = (rect.top - pad) + 'px';
    ring.style.left = (rect.left - pad) + 'px';
    ring.style.width = (rect.width + pad * 2) + 'px';
    ring.style.height = (rect.height + pad * 2) + 'px';
  }

  function posizionaTip(rect) {
    const margin = 14;
    tip.style.visibility = 'hidden';
    tip.style.top = '0px'; tip.style.left = '0px';
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let top, left;
    if (!rect) {
      top = (window.innerHeight - th) / 2;
      left = (window.innerWidth - tw) / 2;
    } else {
      const spazioSotto = window.innerHeight - rect.bottom;
      const spazioSopra = rect.top;
      top = (spazioSotto >= th + margin || spazioSotto >= spazioSopra)
        ? rect.bottom + margin
        : rect.top - th - margin;
      left = rect.left + rect.width / 2 - tw / 2;
    }
    top = Math.max(margin, Math.min(top, window.innerHeight - th - margin));
    left = Math.max(margin, Math.min(left, window.innerWidth - tw - margin));
    tip.style.top = top + 'px';
    tip.style.left = left + 'px';
    tip.style.visibility = 'visible';
  }

  function riposiziona() {
    const rect = (target && target.isConnected) ? target.getBoundingClientRect() : null;
    posizionaRing(rect);
    posizionaTip(rect);
  }

  async function goToStep(i) {
    if (i < 0) return;
    if (i >= passi.length) return chiudi();
    idx = i;
    const passo = passi[i];
    if (passo.hash && location.hash !== passo.hash) {
      location.hash = passo.hash;
      await new Promise(r => setTimeout(r, 30));
    }
    target = null;
    if (passo.selettore) {
      target = await attendiElemento(passo.selettore);
      if (!tourAttivo) return; // chiuso mentre si attendeva l'elemento
      if (!target) return goToStep(i + 1); // pagina/ruolo senza quell'elemento: salta al passo dopo
      target.scrollIntoView({ block: 'center', behavior: 'auto' });
      await new Promise(r => setTimeout(r, 200)); // lascia assestare lo scroll prima di misurare
      if (!tourAttivo) return;
    }
    disegna(passo);
  }

  function disegna(passo) {
    tip.querySelector('.tt-title').textContent = passo.titolo;
    tip.querySelector('.tt-step').textContent = `Passo ${idx + 1} di ${passi.length}`;
    tip.querySelector('.tt-b').textContent = passo.testo;
    tip.querySelector('.tt-indietro').style.visibility = idx === 0 ? 'hidden' : 'visible';
    tip.querySelector('.tt-avanti').textContent = idx === passi.length - 1 ? 'Fine ✓' : 'Avanti ›';
    riposiziona();
    tip.querySelector('.tt-avanti').focus();
  }

  function onKeydown(e) {
    if (e.key === 'Escape') { e.preventDefault(); chiudi(); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); goToStep(idx + 1); return; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); goToStep(idx - 1); return; }
    if (e.key !== 'Tab') return;
    const focalizzabili = elementiFocalizzabili(tip);
    if (!focalizzabili.length) return;
    const primo = focalizzabili[0], ultimo = focalizzabili[focalizzabili.length - 1];
    if (!tip.contains(document.activeElement)) { e.preventDefault(); primo.focus(); return; }
    if (e.shiftKey && document.activeElement === primo) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primo.focus(); }
  }

  tip.querySelector('.tt-x').addEventListener('click', chiudi);
  tip.querySelector('.tt-salta').addEventListener('click', chiudi);
  tip.querySelector('.tt-indietro').addEventListener('click', () => goToStep(idx - 1));
  tip.querySelector('.tt-avanti').addEventListener('click', () => { if (idx === passi.length - 1) chiudi(); else goToStep(idx + 1); });
  document.addEventListener('keydown', onKeydown, true);
  window.addEventListener('resize', riposiziona);
  window.addEventListener('scroll', riposiziona, true);

  goToStep(0);
}
