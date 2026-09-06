// ============================================================
//  STAMPA / PDF del preventivo dei corsi.
//  L'impaginazione sulla carta intestata sta in js/lib/stampaBlocchi.js,
//  condivisa con le assistenze sanitarie: i due preventivi escono sullo
//  stesso foglio. Qui resta solo il preventivo di formazione, cioè i suoi
//  blocchi e il titolo della finestra.
// ============================================================
import { htmlDocumento, anteprimaDocumento, stampaDocumento } from '../../lib/stampaBlocchi.js';
import { costruisciBlocchi, nomeFile } from './documento.js';

const titolo = (prev) => nomeFile(prev, 'pdf').replace(/\.pdf$/, '');

export async function htmlPreventivo(prev, imp) {
  const { blocchi } = costruisciBlocchi(prev, imp);
  return htmlDocumento(blocchi, titolo(prev));
}

export async function anteprimaPreventivo(prev, imp) {
  const { blocchi } = costruisciBlocchi(prev, imp);
  await anteprimaDocumento(blocchi, titolo(prev));
}

export async function stampaPreventivo(prev, imp) {
  const { blocchi } = costruisciBlocchi(prev, imp);
  await stampaDocumento(blocchi, titolo(prev));
}
