// ============================================================
//  ROUTING & GEOCODING (lato client)
//  Chiama le Cloudflare Pages Functions /api/geocode e /api/route,
//  che a loro volta interrogano OpenRouteService con la chiave segreta.
// ============================================================
import { CONFIG } from '../config.js';
import { getAccessToken } from '../../lib/supabase.js';

export class RoutingError extends Error {}

// Allega il token della sessione Supabase: le Function /api/geocode e
// /api/route lo richiedono per evitare che chiunque le interroghi da fuori
// dall'app esaurendo la quota della chiave OpenRouteService.
async function authHeaders() {
  const token = await getAccessToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// ---- Geocoding: testo -> lista di candidati ----------------------------
// Ritorna [{ label, lon, lat, iso2, iso3, paese, regione }]
export async function geocode(text, { size = 6 } = {}) {
  if (!text || text.trim().length < 2) return [];
  const url = `${CONFIG.api.geocode}?text=${encodeURIComponent(text)}&size=${size}`;
  let res;
  try {
    res = await fetch(url, { headers: await authHeaders() });
  } catch (e) {
    throw new RoutingError('Servizio mappe non raggiungibile.');
  }
  if (!res.ok) {
    const msg = await safeErr(res);
    throw new RoutingError(msg || `Geocoding non riuscito (${res.status}).`);
  }
  const data = await res.json();
  const feats = data.features || [];
  return feats.map(f => {
    const p = f.properties || {};
    const c = (f.geometry && f.geometry.coordinates) || [];
    return {
      label: p.label || p.name || text,
      lon: c[0], lat: c[1],
      iso3: p.country_a || null,
      iso2: p.country_code ? String(p.country_code).toUpperCase() : null,
      paese: p.country || null,
      regione: p.region || p.macroregion || null,
    };
  }).filter(x => Number.isFinite(x.lon) && Number.isFinite(x.lat));
}

// Primo candidato (comodo per la sede fissa o autoselezione).
export async function geocodeFirst(text, opts) {
  const list = await geocode(text, { ...opts, size: 1 });
  return list[0] || null;
}

// ---- Routing: array di coordinate [[lon,lat],...] ----------------------
// Ritorna { distanceKm, durationMin, geometry }
export async function route(coordinates, { avoidTolls = false } = {}) {
  if (!coordinates || coordinates.length < 2) {
    throw new RoutingError('Servono almeno due punti (partenza e destinazione).');
  }
  let res;
  try {
    res = await fetch(CONFIG.api.route, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ coordinates, avoidTolls }),
    });
  } catch (e) {
    throw new RoutingError('Servizio mappe non raggiungibile.');
  }
  if (!res.ok) {
    const msg = await safeErr(res);
    throw new RoutingError(msg || `Calcolo percorso non riuscito (${res.status}).`);
  }
  const data = await res.json();
  const summary =
    data.routes?.[0]?.summary ||
    data.features?.[0]?.properties?.summary || null;
  if (!summary) throw new RoutingError('Percorso non trovato tra i punti indicati.');
  return {
    distanceKm: summary.distance / 1000,
    durationMin: summary.duration / 60,
    geometry: data.features?.[0]?.geometry || data.routes?.[0]?.geometry || null,
  };
}

async function safeErr(res) {
  try {
    const j = await res.json();
    return j.error || j.message || null;
  } catch { return null; }
}
