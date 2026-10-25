// ============================================================
//  Chiavi di sessionStorage con cui i Report passano un filtro all'elenco
//  fatture (clic su un fornitore/cliente → elenco già filtrato).
//  Stanno qui e non nei report perché le dashboard le leggono all'apertura:
//  importarle da views/report.js obbligava a scaricare tutto il report solo
//  per due stringhe.
// ============================================================
export const FILTRO_FORNITORE_KEY = 'report:filtroFornitore';
export const FILTRO_CLIENTE_KEY = 'reportAttive:filtroCliente';
