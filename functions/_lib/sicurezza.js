// ============================================================
//  Intestazioni applicate a ogni risposta del portale, condivise fra
//  worker.js (deploy come Worker) e functions/_middleware.js (deploy su
//  Pages): le due strade devono uscire identiche.
// ============================================================

import { HEADER_SICUREZZA } from '../../js/lib/securityHeaders.mjs';

// `cache` dice come regolare la memorizzazione della risposta:
//   'asset' → si impone "no-cache" (vedi sotto)
//   'api'   → si lascia quello che la function ha già deciso
export function conSicurezza(res, cache = 'asset') {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(HEADER_SICUREZZA)) out.headers.set(k, v);
  // Niente cache "silenziosa" su HTML/CSS/JS: senza questo, chi aveva già
  // aperto il sito prima di un deploy poteva restare con la versione vecchia
  // (specie su mobile) finché non svuotava la cache a mano. "no-cache" non
  // è "no-store": il browser continua a poter riusare il file, ma solo dopo
  // aver controllato con una richiesta condizionale (ETag) se è ancora quello
  // giusto — quindi un deploy nuovo si vede subito, senza perdere la velocità
  // della cache quando il file non è cambiato.
  //
  // Le risposte delle /api/* sono l'eccezione, e prima non lo erano: le
  // function dichiarano "no-store" apposta, e sovrascriverlo qui rendeva
  // memorizzabile su disco anche la risposta di /api/crea-utente, che contiene
  // la password provvisoria in chiaro. Chi invece vuole essere messo in cache
  // (i prezzi carburante, col loro max-age) continua a dirlo da sé.
  if (cache === 'asset') out.headers.set('Cache-Control', 'no-cache');
  return out;
}
