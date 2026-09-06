// ============================================================
//  IL PREVENTIVO DI TRASPORTO IN WORD
//  Il lavoro vero — partire dal modello assets/carta-intestata.dotx e
//  sostituirne solo il corpo — sta in js/lib/docxBlocchi.js, condiviso con le
//  altre sezioni. Qui resta la sola parte che riguarda i trasporti:
//  costruire i blocchi del preventivo e dare un nome al file.
// ============================================================
import { generaDocx as generaDaBlocchi, scaricaDocx as scaricaDaBlocchi } from '../../lib/docxBlocchi.js';
import { costruisciBlocchi, nomeFile } from './documento.js';

export async function generaDocx(prev, imp) {
  const { blocchi } = costruisciBlocchi(prev, imp);
  return generaDaBlocchi(blocchi, nomeFile(prev, 'docx'));
}

// Scarica il documento generato.
export async function scaricaDocx(prev, imp) {
  const { blocchi } = costruisciBlocchi(prev, imp);
  await scaricaDaBlocchi(blocchi, nomeFile(prev, 'docx'));
}
