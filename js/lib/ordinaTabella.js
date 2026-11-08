// Ordinamento al clic sulle intestazioni delle tabelle degli scadenziari.
//
// `colonne` descrive come leggere ogni colonna ordinabile:
//   { campo: { get: riga => valore, tipo: 'testo' | 'numero' | 'data' } }
// Le date sono stringhe ISO (aaaa-mm-gg), quindi si confrontano come testo.
// Le celle vuote vanno sempre in fondo, in entrambe le direzioni: altrimenti
// in ordine decrescente le fatture senza scadenza finivano in cima e
// nascondevano proprio quelle che si cercavano.
import { esc } from './ui.js';

const confrontoTesto = new Intl.Collator('it', { sensitivity: 'base', numeric: true }).compare;

function vuoto(v) {
  return v === null || v === undefined || v === '' || (typeof v === 'number' && !Number.isFinite(v));
}

// Restituisce una copia ordinata; con `sort` nullo lascia l'ordine di arrivo.
export function ordinaRighe(righe, sort, colonne) {
  const col = sort && colonne[sort.campo];
  if (!col) return righe;
  const segno = sort.dir === 'desc' ? -1 : 1;
  return [...righe].sort((a, b) => {
    const va = col.get(a), vb = col.get(b);
    const aVuoto = vuoto(va), bVuoto = vuoto(vb);
    if (aVuoto || bVuoto) return aVuoto === bVuoto ? 0 : (aVuoto ? 1 : -1);
    const c = col.tipo === 'numero' ? Number(va) - Number(vb) : confrontoTesto(String(va), String(vb));
    return c * segno;
  });
}

// Primo clic su una colonna: crescente. Clic sulla stessa colonna: inverte.
export function prossimoOrdinamento(sort, campo) {
  if (sort && sort.campo === campo) return { campo, dir: sort.dir === 'asc' ? 'desc' : 'asc' };
  return { campo, dir: 'asc' };
}

// Intestazione cliccabile. Il clic è su un <button> dentro il <th> e non sul
// <th> stesso: così si raggiunge da tastiera e il <th> resta un'intestazione
// di colonna, che è l'unico elemento su cui aria-sort ha significato.
export function thOrdinabile(label, campo, sort, extraClass = '') {
  const attiva = sort && sort.campo === campo;
  const ariaSort = attiva ? (sort.dir === 'desc' ? 'descending' : 'ascending') : 'none';
  const freccia = attiva ? (sort.dir === 'desc' ? '▼' : '▲') : '↕';
  const prossima = attiva && sort.dir === 'asc' ? 'decrescente' : 'crescente';
  return `<th${extraClass ? ` class="${extraClass}"` : ''} aria-sort="${ariaSort}">`
    + `<button type="button" class="th-sort${attiva ? ' attiva' : ''}" data-sort="${esc(campo)}" title="Ordina in modo ${prossima}">`
    + `${esc(label)}<span class="th-sort-freccia" aria-hidden="true">${freccia}</span></button></th>`;
}

export function collegaOrdinamento(table, onSort) {
  table.querySelectorAll('button[data-sort]').forEach(btn =>
    btn.addEventListener('click', (e) => { e.stopPropagation(); onSort(btn.dataset.sort); }));
}
