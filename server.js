// ============================================================
//  Server statico per lo sviluppo locale + proxy /api/estrai-fattura
//  Avvio:  node server.js      (poi apri http://localhost:4323)
//
//  Per testare la lettura AI dei PDF anche in locale, imposta la chiave:
//    Windows PowerShell:  $env:GEMINI_API_KEY="la-tua-chiave"; node server.js
//    macOS/Linux:         GEMINI_API_KEY=la-tua-chiave node server.js
//  Puoi anche creare un file .dev.vars con:  GEMINI_API_KEY=la-tua-chiave
//  Senza chiave l'app funziona lo stesso: inserisci i campi a mano o usa XML.
// ============================================================
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = process.env.PORT || 4323;

if (!process.env.GEMINI_API_KEY) {
  try {
    const dv = fs.readFileSync(path.join(ROOT, '.dev.vars'), 'utf8');
    const m = dv.match(/GEMINI_API_KEY\s*=\s*(.+)/);
    if (m) process.env.GEMINI_API_KEY = m[1].trim();
  } catch {}
}

// Le stesse intestazioni di sicurezza servite in produzione dal Worker: se in
// locale non ci fossero, una violazione della CSP verrebbe scoperta solo dopo
// il deploy.
// ============================================================
//  Intestazioni di sicurezza applicate a ogni risposta
// ------------------------------------------------------------
//  La CSP è volutamente stretta e va tenuta
//  allineata a ciò che carica davvero la pagina:
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

const HEADER_SICUREZZA = {
  "Content-Security-Policy": CSP,
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Cross-Origin-Opener-Policy": "same-origin",
};

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://${req.headers.host}`);

  if (u.pathname === '/api/estrai-fattura' && req.method === 'POST') return apiEstrai(req, res);

  let p = decodeURIComponent(u.pathname);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    res.writeHead(200, Object.assign({
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    }, HEADER_SICUREZZA));
    res.end(data);
  });
});
server.listen(PORT, () => console.log(`Server attivo su http://localhost:${PORT}  (GEMINI_API_KEY ${process.env.GEMINI_API_KEY ? 'presente' : 'ASSENTE — solo XML/manuale'})`));

function sendJson(res, obj, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

// NOTA: in locale non verifichiamo il token Supabase (a differenza della
// Cloudflare Pages Function in produzione) per semplicità di sviluppo.
const MODEL = 'gemini-3.6-flash';
const SCHEMA = {
  type: 'OBJECT',
  properties: {
    fornitore: { type: 'STRING' }, numero_fattura: { type: 'STRING' },
    data_fattura: { type: 'STRING' }, importo: { type: 'NUMBER' },
    scadenza: { type: 'STRING' }, metodo_pagamento: { type: 'STRING' }, note: { type: 'STRING' },
  },
  required: ['fornitore', 'importo'],
};
const PROMPT = `Sei un assistente contabile. Analizza il documento allegato (fattura fornitore) ed estrai i campi richiesti secondo lo schema JSON fornito. Usa il formato data YYYY-MM-DD. Se un campo non è presente, omettilo: non inventare valori. Per l'importo usa il totale finale (IVA inclusa). Per metodo_pagamento restituisci SOLO una di queste parole, senza codici né altro testo: bonifico, RIBA, RID, contanti, altro.`;

function apiEstrai(req, res) {
  let raw = '';
  req.on('data', c => raw += c);
  req.on('end', async () => {
    if (!process.env.GEMINI_API_KEY) return sendJson(res, { error: 'Chiave Gemini non configurata (GEMINI_API_KEY).' }, 500);
    let body; try { body = JSON.parse(raw); } catch { return sendJson(res, { error: 'Body non valido.' }, 400); }
    const { mimeType, dataBase64 } = body || {};
    if (!dataBase64 || !mimeType) return sendJson(res, { error: 'File mancante.' }, 400);
    try {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;
      const r = await fetch(apiUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: mimeType, data: dataBase64 } }] }],
          generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0 },
        }),
      });
      if (!r.ok) { let m = `Estrazione non riuscita (${r.status}).`; try { const e = await r.json(); m = e?.error?.message || m; } catch {} return sendJson(res, { error: m }, r.status); }
      const data = await r.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return sendJson(res, { error: 'Risposta AI vuota.' }, 502);
      return sendJson(res, { estratti: JSON.parse(text) });
    } catch (e) { return sendJson(res, { error: 'Gemini non raggiungibile: ' + e.message }, 502); }
  });
}
