// ============================================================
//  Modello Gemini usato per l'estrazione dei campi dalle fatture.
// ------------------------------------------------------------
//  Unica fonte condivisa fra i tre punti che lo usano: le due function
//  (functions/api/estrai-fattura*.js, in produzione sul Worker) e il server
//  di sviluppo locale (server.js). Prima era ripetuto in tutti e tre e un
//  aggiornamento rischiava di dimenticarne uno, lasciando in produzione un
//  modello diverso da quello provato in locale.
// ------------------------------------------------------------
//  Estensione .mjs deliberata, come per js/lib/securityHeaders.mjs: il
//  progetto non ha "type": "module" in package.json (server.js è CommonJS e
//  carica questo file con un import() dinamico), quindi un .js con sintassi
//  ESM farebbe emettere a Node un warning ad ogni avvio.
// ============================================================
export const MODELLO_GEMINI = 'gemini-3.6-flash';
