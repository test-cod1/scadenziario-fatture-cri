// ============================================================
//  Intestazioni di sicurezza condivise fra il Worker di produzione
//  (worker.js) e il server di sviluppo locale (server.js): un'unica fonte,
//  invece di due copie che rischiavano di disallinearsi (es. aggiungendo un
//  nuovo host a connect-src in una sola delle due).
// ------------------------------------------------------------
//  Estensione .mjs deliberata: il progetto non ha "type": "module" in
//  package.json (server.js è CommonJS, richiede questo file con un import()
//  dinamico), quindi un .js con sintassi ESM verrebbe rifiutato da Node —
//  .mjs forza il trattamento come modulo ES indipendentemente da quello.
// ------------------------------------------------------------
//  La CSP è volutamente stretta e va tenuta allineata a ciò che carica
//  davvero la pagina:
//   - script-src: SOLO file nostri. Fino al 6/9/2026 comprendeva anche
//     esm.sh, da cui si scaricava il client Supabase a ogni avvio: adesso
//     quella libreria sta in js/vendor/ e nessun host esterno può più
//     eseguire codice nella pagina che maneggia le credenziali;
//   - connect-src: le chiamate REST/Storage/Auth vanno a *.supabase.co, più
//     le nostre /api/*;
//   - style-src consente gli stili inline perché le viste usano attributi
//     style="..." su molti elementi;
//   - niente script inline: la stampa PDF è avviata dal codice del sito.
// ============================================================
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

export const HEADER_SICUREZZA = {
  "Content-Security-Policy": CSP,
  // Un anno di HTTPS obbligatorio, sottodomini compresi: dopo la prima
  // visita il browser non prova nemmeno a chiamare la versione in chiaro,
  // quindi non c'è una richiesta HTTP da intercettare e dirottare. Su
  // workers.dev cambia poco (accetta solo HTTPS), ma è l'intestazione che
  // serve il giorno in cui il portale passa su un dominio del Comitato,
  // ed è meglio averla già attiva che ricordarsene allora.
  // In locale è inerte: i browser ignorano HSTS sulle risposte in chiaro.
  // Niente "preload": iscriversi alla lista è irreversibile in pratica, e
  // vincolerebbe anche i sottodomini futuri prima di sapere quali saranno.
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Cross-Origin-Opener-Policy": "same-origin",
};
