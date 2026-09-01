// ============================================================
//  Cloudflare Pages Function — Calcolo percorso (km e durata)
//  Endpoint: POST /api/route   body: { coordinates:[[lon,lat],...], avoidTolls }
//
//  Proxy verso OpenRouteService Directions. Richiede env.ORS_KEY
//  (vedi istruzioni in functions/api/geocode.js).
// ============================================================

import { requireUser, ruoloSezione } from '../_lib/auth.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const user = await requireUser(request, env);
  if (!user) return json({ error: 'Accesso non autorizzato: effettua il login.' }, 401);

  // Non basta essere autenticati: la chiave OpenRouteService (e la quota
  // giornaliera che ci sta dietro) e' di questa sezione, quindi la puo'
  // consumare solo chi e' autorizzato ai trasporti.
  if (!await ruoloSezione(request, env, 'trasporti')) {
    return json({ error: 'Non sei autorizzato ad accedere ai trasporti lunghi: chiedi a un amministratore del portale.' }, 403);
  }
  if (!env.ORS_KEY) return json({ error: 'Chiave OpenRouteService non configurata (ORS_KEY).' }, 500);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Body non valido.' }, 400); }
  const coordinates = body.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2 || coordinates.length > 25) {
    return json({ error: 'Servono tra 2 e 25 coordinate.' }, 400);
  }
  const valid = coordinates.every(c =>
    Array.isArray(c) && c.length === 2 &&
    Number.isFinite(c[0]) && c[0] >= -180 && c[0] <= 180 &&
    Number.isFinite(c[1]) && c[1] >= -90 && c[1] <= 90);
  if (!valid) return json({ error: 'Coordinate non valide.' }, 400);

  const payload = { coordinates };
  if (body.avoidTolls) payload.options = { avoid_features: ['tollways'] };

  let res;
  try {
    res = await fetch('https://api.openrouteservice.org/v2/directions/driving-car/geojson', {
      method: 'POST',
      headers: {
        'Authorization': env.ORS_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/geo+json',
      },
      body: JSON.stringify(payload),
    });
  } catch (e) { return json({ error: 'OpenRouteService non raggiungibile.' }, 502); }

  if (!res.ok) {
    let msg = `Calcolo percorso non riuscito (${res.status}).`;
    try { const e = await res.json(); msg = e?.error?.message || e?.error || msg; } catch {}
    return json({ error: msg }, res.status);
  }
  const data = await res.json();
  return json(data);
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
