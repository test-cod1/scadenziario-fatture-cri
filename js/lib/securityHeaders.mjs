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
//   - script-src: solo file nostri + esm.sh, da cui arriva il client Supabase
//     (import dinamico in js/lib/supabase.js);
//   - connect-src: le chiamate REST/Storage/Auth vanno a *.supabase.co, più
//     le nostre /api/*;
//   - style-src consente gli stili inline perché le viste usano attributi
//     style="..." su molti elementi;
//   - niente script inline: la stampa PDF ora è avviata dal codice del sito.
// ============================================================
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://esm.sh",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co https://esm.sh",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

export const HEADER_SICUREZZA = {
  "Content-Security-Policy": CSP,
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Cross-Origin-Opener-Policy": "same-origin",
};
