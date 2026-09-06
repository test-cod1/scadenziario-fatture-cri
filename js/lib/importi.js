// ============================================================
//  CAMPI CON I DECIMALI (importi, tariffe, km, ore)
//
//  Perché non `<input type="number">`. In un campo numerico il browser
//  accetta solo la notazione che si aspetta lui, e quello che non riconosce
//  non lo tiene: scrivendo o — soprattutto — INCOLLANDO «55,50» o
//  «1.234,56», il campo resta VUOTO. Il codice leggeva `Number(value) || 0`
//  e archiviava zero, senza un errore e senza che si vedesse niente: un
//  preventivo con una voce a 0 €, o una tariffa azzerata nelle impostazioni.
//  Succede anche su Chrome in italiano — provato — e incollare un importo
//  preso da una mail o da un listino è esattamente quello che si fa.
//
//  Qui i campi diventano di testo con `inputmode="decimal"` (sul telefono la
//  tastiera resta numerica) e si leggono con parseEuro, che capisce sia la
//  virgola sia il punto, sia «1.234,56» sia «1234.56». È la stessa strada
//  già presa dallo scadenziario, dove gli importi si sono sempre scritti a
//  mano.
//
//  Restano `type="number"` i campi che contengono solo numeri interi
//  (persone, notti, camere, discenti): lì la virgola non c'entra, e le
//  frecce su/giù del browser fanno comodo.
// ============================================================
import { parseEuro } from './ui.js';

// Attributi da mettere nel tag: `<input ${CAMPO_DECIMALE} id="…">`.
export const CAMPO_DECIMALE = 'type="text" inputmode="decimal" autocomplete="off"';

// Numero → testo da mettere nel campo. Si usa la virgola, come si scrive in
// italiano, e nessun separatore di migliaia: dentro un campo che si sta
// modificando i punti sono d'impiccio.
export function testoDecimale(n) {
  if (n === null || n === undefined || n === '') return '';
  const x = Number(n);
  if (!Number.isFinite(x)) return '';
  return String(x).replace('.', ',');
}

// Come testoDecimale, ma lo zero diventa campo vuoto. Serve dove zero
// significa "non compilato" — i km ancora da calcolare, le ore del medico che
// non c'è, i pedaggi in un viaggio in Italia: uno «0» scritto dal codice
// sembra un valore inserito apposta, e invita a cancellarlo prima di
// scrivere il proprio.
export function testoDecimaleOVuoto(n) {
  return Number(n) ? testoDecimale(n) : '';
}

// Testo del campo → numero, oppure null se il campo è vuoto. Restituire null
// invece di 0 permette a chi chiama di distinguere «non l'ho compilato» da
// «vale zero» — differenza che conta per gli sconti e per il numero di
// discenti.
export function leggiDecimale(v) {
  const n = parseEuro(v);
  return n === null || !Number.isFinite(n) ? null : n;
}

// Come sopra, ma per chi un numero lo vuole comunque (i campi dove vuoto
// significa zero).
export function leggiDecimaleO0(v) {
  return leggiDecimale(v) ?? 0;
}
