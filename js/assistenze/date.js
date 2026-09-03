// ============================================================
//  LIMITE SULLE DATE DELLA SEZIONE
//  Le assistenze si preventivano per l'anno in corso: una data dell'anno
//  prima è quasi sempre un errore di battitura, o un anno vecchio rimasto
//  dentro un preventivo duplicato. Il limite vale per la data del documento e
//  per le giornate del calendario.
//
//  I preventivi già in archivio restano leggibili e modificabili: il
//  controllo scatta solo quando una data viene cambiata, non su quelle che
//  erano state salvate quando l'anno era un altro.
// ============================================================

export const ANNO = new Date().getFullYear();
export const INIZIO_ANNO = ANNO + '-01-01';

export function dataAmmessa(v) {
  return !v || v >= INIZIO_ANNO;
}

export const MSG_DATA = `Le date non possono essere precedenti al 1° gennaio ${ANNO}`;
