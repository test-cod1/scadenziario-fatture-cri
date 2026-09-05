// ============================================================
//  Helper di interfaccia della sezione STRAORDINARI.
//  Il grosso arriva da js/lib/ui.js del portale; qui c'è solo ciò che serve
//  in più a questa sezione, che ragiona per mesi.
// ============================================================
export * from '../../lib/ui.js';
import { el, esc } from '../../lib/ui.js';
import { etichettaMese, meseSpostato, meseCorrente, statoDi, tipoDi } from '../calc.js';

// Barra di scelta del mese: frecce avanti/indietro, il nome del mese scritto
// per esteso e il salto a "questo mese". Registro e riepilogo la usano
// entrambi, sullo stesso mese condiviso (vedi sezione.js): il mese è il modo
// in cui questo registro si guarda, e cambiarlo deve costare un clic — nel
// foglio di carta era il nome del file.
export function selettoreMese(mese, onCambio) {
  const barra = el(`<div class="mese-nav">
    <button class="btn ghost sm" data-prec title="Mese precedente" aria-label="Mese precedente">‹</button>
    <div class="mese-nome" aria-live="polite">${esc(etichettaMese(mese))}</div>
    <button class="btn ghost sm" data-succ title="Mese successivo" aria-label="Mese successivo">›</button>
    <label class="mese-scelta">
      <span class="sr-solo">Mese</span>
      <input type="month" value="${esc(mese)}">
    </label>
    <button class="btn ghost sm" data-oggi>Questo mese</button>
  </div>`);
  const vai = (m) => { if (m && m !== mese) onCambio(m); };
  barra.querySelector('[data-prec]').addEventListener('click', () => vai(meseSpostato(mese, -1)));
  barra.querySelector('[data-succ]').addEventListener('click', () => vai(meseSpostato(mese, +1)));
  barra.querySelector('[data-oggi]').addEventListener('click', () => vai(meseCorrente()));
  barra.querySelector('input[type=month]').addEventListener('change', (e) => vai(e.target.value));
  return barra;
}

export function chipStato(stato) {
  const s = statoDi(stato);
  return `<span class="chip ${s.chip}">${esc(s.label)}</span>`;
}

export function etichettaTipo(tipo) {
  const t = tipoDi(tipo);
  return `${t.emoji} ${t.label}`;
}

// Giorno + giorno della settimana ("mer 12/08"), come sull'intestazione del
// foglio mensile: in centrale i turni si ragionano per giorno della
// settimana, non per numero.
export function fmtGiorno(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d)) return iso;
  const g = d.toLocaleDateString('it-IT', { weekday: 'short' });
  return `${g} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function fmtOrario(dalle, alle) {
  const p = (t) => String(t || '').slice(0, 5);
  if (!dalle && !alle) return '—';
  if (dalle && alle) return `${p(dalle)} – ${p(alle)}`;
  return p(dalle || alle);
}
