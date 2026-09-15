// ============================================================
//  IL FILTRO DI PERIODO, uguale in tutte le pagine della sezione.
//  Un conto senza un periodo non vuol dire niente: «quell'attività è
//  costata 4.000 €» ha senso solo insieme a «nel 2026». Sta in un file a
//  parte perché il quadro generale e il dettaglio del singolo centro
//  devono filtrare allo stesso modo — se divergessero, due pagine
//  direbbero due numeri diversi sulla stessa cosa.
//
//  Gli anni proposti sono quelli in cui c'è davvero almeno un documento:
//  offrire un anno vuoto vuol dire offrire una pagina vuota.
// ============================================================
import { el, esc } from '../../lib/ui.js';

export function barraPeriodo(anniDisponibili, stato, onChange) {
  const barra = el(`<div class="an-periodo">
    <label for="f-anno">Periodo</label>
    <select id="f-anno">
      <option value="">Tutti gli anni</option>
      ${anniDisponibili.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join('')}
    </select>
    <span class="an-periodo-nota" data-nota></span>
  </div>`);
  const sel = barra.querySelector('#f-anno');
  sel.value = stato.anno || '';
  sel.addEventListener('change', () => {
    stato.anno = sel.value;
    Object.assign(stato, intervallo(stato.anno));
    onChange();
  });
  return barra;
}

// Da anno a intervallo di date, nella forma che vuole `nelPeriodo`.
export function intervallo(anno) {
  return anno ? { da: `${anno}-01-01`, a: `${anno}-12-31` } : { da: '', a: '' };
}

export function nomePeriodo(anno) {
  return anno ? `nel ${anno}` : 'dall’inizio';
}
