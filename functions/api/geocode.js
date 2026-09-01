// ============================================================
//  Cloudflare Pages Function — Geocoding (indirizzo -> coordinate)
//  Endpoint: GET /api/geocode?text=...&size=6
//
//  Proxy verso OpenRouteService (Pelias) tenendo la chiave lato server.
//  Configura la variabile d'ambiente ORS_KEY nel progetto Pages:
//    Dashboard Cloudflare > Pages > (progetto) > Settings >
//    Environment variables > add > Name: ORS_KEY  Value: <la tua chiave>
// ============================================================

import { requireUser, ruoloSezione } from '../_lib/auth.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const user = await requireUser(request, env);
  if (!user) return json({ error: 'Accesso non autorizzato: effettua il login.' }, 401);

  // Non basta essere autenticati: la chiave OpenRouteService (e la quota
  // giornaliera che ci sta dietro) e' di questa sezione, quindi la puo'
  // consumare solo chi e' autorizzato ai trasporti.
  if (!await ruoloSezione(request, env, 'trasporti')) {
    return json({ error: 'Non sei autorizzato ad accedere ai trasporti lunghi: chiedi a un amministratore del portale.' }, 403);
  }

  const url = new URL(request.url);
  const text = url.searchParams.get('text') || '';
  const size = url.searchParams.get('size') || '6';
  if (!text || text.length < 2) return json({ features: [] });
  if (!env.ORS_KEY) return json({ error: 'Chiave OpenRouteService non configurata (ORS_KEY).' }, 500);

  const api = new URL('https://api.openrouteservice.org/geocode/search');
  api.searchParams.set('api_key', env.ORS_KEY);
  api.searchParams.set('text', text);
  api.searchParams.set('size', size);
  // privilegia risultati europei ma senza escludere gli altri
  api.searchParams.set('boundary.country', 'IT,FR,DE,AT,CH,SI,ES,PT,BE,NL,LU,HR,HU,CZ,SK,PL,DK,SE,NO,FI,GR,RO,BG,IE,GB,EE,LV,LT,SM,AD,MC,RS,BA,ME,MK,AL');

  let res;
  try { res = await fetch(api.toString(), { headers: { 'Accept': 'application/json' } }); }
  catch (e) { return json({ error: 'OpenRouteService non raggiungibile.' }, 502); }
  if (!res.ok) return json({ error: `Geocoding non riuscito (${res.status}).` }, res.status);
  const data = await res.json();
  return json(data);
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
