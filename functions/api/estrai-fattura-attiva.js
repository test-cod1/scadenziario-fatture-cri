// ============================================================
//  Cloudflare Worker Function — Estrazione campi da fattura ATTIVA (PDF/immagine)
//  Endpoint: POST /api/estrai-fattura-attiva
//  Body: { filename, mimeType, dataBase64 }  (file codificato in base64)
//
//  Stesso proxy verso Gemini di estrai-fattura.js, ma il prompt istruisce il
//  modello a leggere il CLIENTE destinatario (fattura emessa da noi), non
//  l'emittente: è l'unica differenza che conta per una fattura attiva.
// ============================================================

import { requireUser, ruoloUtente, RUOLI_ABILITATI } from '../_lib/auth.js';
import { MODELLO_GEMINI } from '../_lib/gemini.mjs';

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    cliente: { type: 'STRING', description: 'Nome del cliente destinatario della fattura (il soggetto a cui viene fatturato, NON chi emette il documento)' },
    numero_fattura: { type: 'STRING', description: 'Numero della fattura' },
    data_fattura: { type: 'STRING', description: 'Data di emissione della fattura, formato YYYY-MM-DD' },
    importo: { type: 'NUMBER', description: 'Importo totale della fattura (numero, punto decimale, senza simbolo di valuta)' },
    metodo_pagamento: { type: 'STRING', description: 'Modalità di incasso se indicata: bonifico, RIBA, RID, contanti, altro' },
    note: { type: 'STRING', description: 'Eventuali dettagli utili non altrimenti catalogabili (es. rate/acconti indicati nel documento)' },
  },
  required: ['cliente', 'importo'],
};

const PROMPT = `Sei un assistente contabile. Analizza il documento allegato (una fattura di vendita EMESSA da noi verso un cliente) ed estrai i campi richiesti secondo lo schema JSON fornito. Il campo "cliente" deve riportare il destinatario/acquirente del documento (chi deve pagare), MAI la ragione sociale di chi ha emesso la fattura. Usa il formato data YYYY-MM-DD. Se un campo non è presente nel documento, omettilo o lascialo vuoto: non inventare valori. Per l'importo usa sempre il totale finale del documento (IVA inclusa). Per metodo_pagamento restituisci SOLO una di queste parole, senza codici né altro testo: bonifico, RIBA, RID, contanti, altro.`;

export async function onRequestPost(context) {
  const { request, env } = context;
  const user = await requireUser(request, env);
  if (!user) return json({ error: 'Accesso non autorizzato: effettua il login.' }, 401);

  // Vedi il commento gemello in estrai-fattura.js: un account non ancora
  // abilitato ha un token valido e poteva esaurire la quota Gemini di tutti.
  const ruolo = await ruoloUtente(request, env, user.id);
  if (!RUOLI_ABILITATI.includes(ruolo)) {
    return json({ error: 'Il tuo account non è ancora abilitato: chiedi a un amministratore.' }, 403);
  }

  if (!env.GEMINI_API_KEY) return json({ error: 'Chiave Gemini non configurata (GEMINI_API_KEY).' }, 500);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Body non valido.' }, 400); }
  const { mimeType, dataBase64 } = body || {};
  if (!dataBase64 || !mimeType) return json({ error: 'File mancante.' }, 400);
  if (!/^application\/pdf$|^image\//.test(mimeType)) return json({ error: 'Formato file non supportato (usa PDF o immagine).' }, 400);
  if (dataBase64.length > 20_000_000) return json({ error: 'File troppo grande.' }, 413);

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODELLO_GEMINI}:generateContent?key=${env.GEMINI_API_KEY}`;
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
    if (res.status === 429) return json({ error: 'Quota gratuita giornaliera di Gemini esaurita: riprova più tardi.' }, 429);
    let msg = `Estrazione non riuscita (${res.status}).`;
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
