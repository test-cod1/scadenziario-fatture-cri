// ============================================================
//  Cloudflare Pages Function — Estrazione campi da fattura PDF/immagine
//  Endpoint: POST /api/estrai-fattura
//  Body: { filename, mimeType, dataBase64 }  (file codificato in base64)
//
//  Proxy verso Google Gemini (livello gratuito) tenendo la chiave lato
//  server. Configura la variabile d'ambiente GEMINI_API_KEY nel progetto
//  Pages: Dashboard Cloudflare > Pages > (progetto) > Settings >
//  Environment variables > add > Name: GEMINI_API_KEY > Value: <la tua chiave>
//  (chiave gratuita da https://aistudio.google.com/apikey)
// ============================================================

import { requireUser } from '../_lib/auth.js';

const MODEL = 'gemini-3.6-flash';

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    fornitore: { type: 'STRING', description: 'Nome del fornitore/emittente della fattura' },
    numero_fattura: { type: 'STRING', description: 'Numero della fattura' },
    data_fattura: { type: 'STRING', description: 'Data di emissione della fattura, formato YYYY-MM-DD' },
    importo: { type: 'NUMBER', description: 'Importo totale della fattura (numero, punto decimale, senza simbolo di valuta)' },
    scadenza: { type: 'STRING', description: 'Data di scadenza del pagamento, formato YYYY-MM-DD. Se non indicata usa la data fattura.' },
    metodo_pagamento: { type: 'STRING', description: 'Modalità di pagamento se indicata: bonifico, RIBA, RID, contanti, altro' },
    note: { type: 'STRING', description: 'Eventuali dettagli utili non altrimenti catalogabili (es. rate/acconti indicati nel documento)' },
  },
  required: ['fornitore', 'importo'],
};

const PROMPT = `Sei un assistente contabile. Analizza il documento allegato (fattura fornitore) ed estrai i campi richiesti secondo lo schema JSON fornito. Usa il formato data YYYY-MM-DD. Se un campo non è presente nel documento, omettilo o lascialo vuoto: non inventare valori. Per l'importo usa sempre il totale finale del documento (IVA inclusa). Per metodo_pagamento restituisci SOLO una di queste parole, senza codici né altro testo: bonifico, RIBA, RID, contanti, altro.`;

export async function onRequestPost(context) {
  const { request, env } = context;
  const user = await requireUser(request, env);
  if (!user) return json({ error: 'Accesso non autorizzato: effettua il login.' }, 401);

  if (!env.GEMINI_API_KEY) return json({ error: 'Chiave Gemini non configurata (GEMINI_API_KEY).' }, 500);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Body non valido.' }, 400); }
  const { mimeType, dataBase64 } = body || {};
  if (!dataBase64 || !mimeType) return json({ error: 'File mancante.' }, 400);
  if (!/^application\/pdf$|^image\//.test(mimeType)) return json({ error: 'Formato file non supportato (usa PDF o immagine).' }, 400);
  // ~15MB in base64 è un limite prudente: la request API di Gemini per file inline è comunque
  // pensata per allegati di pochi MB (fatture singole), non per archivi.
  if (dataBase64.length > 20_000_000) return json({ error: 'File troppo grande.' }, 413);

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${env.GEMINI_API_KEY}`;
  const payload = {
    contents: [{
      parts: [
        { text: PROMPT },
        { inline_data: { mime_type: mimeType, data: dataBase64 } },
      ],
    }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: SCHEMA,
      temperature: 0,
    },
  };

  let res;
  try {
    res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    return json({ error: 'Gemini non raggiungibile.' }, 502);
  }
  if (!res.ok) {
    let msg = `Estrazione non riuscita (${res.status}).`;
    if (res.status === 429) msg = 'Quota gratuita Gemini esaurita per oggi: riprova più tardi o inserisci la fattura a mano.';
    try { const e = await res.json(); msg = e?.error?.message || msg; } catch {}
    return json({ error: msg }, res.status);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return json({ error: 'Risposta AI vuota: il documento potrebbe non essere leggibile.' }, 502);

  let estratti;
  try { estratti = JSON.parse(text); } catch { return json({ error: 'Risposta AI non interpretabile.' }, 502); }

  return json({ estratti });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
