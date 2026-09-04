// ============================================================
//  PREZZI CARBURANTE PAESI UE — valori di riferimento (default)
// ------------------------------------------------------------
//  Solo i ~27 Paesi UE: fonte "Weekly Oil Bulletin" della Commissione
//  Europea, rilevate il 3 agosto 2026. Prezzi in EUR/litro. Sono valori
//  DI DEFAULT: nel gestionale puoi sempre correggere il prezzo manualmente
//  prima di salvare; nelle Impostazioni puoi ripristinarli o aggiornarli
//  in blocco col tasto "Aggiorna prezzi UE".
//
//  Un Paese extra-UE (Svizzera, Regno Unito, Balcani, ecc.) resta comunque
//  selezionabile come destinazione: semplicemente non ha un prezzo di
//  riferimento precompilato, va inserito a mano.
//
//  Chiavi: ISO alpha-2 del Paese.
//  Campi:  nome (it), iso3, diesel (gasolio), benzina.
// ============================================================

import { CONFIG } from '../config.js';

export const FUEL_DATA_DATE = '2026-08-03';

// Solo i ~27 Paesi UE: sono gli unici coperti da un aggiornamento
// automatico/su richiesta (MISE per l'Italia, Weekly Oil Bulletin per gli
// altri). Un Paese extra-UE non presente qui resta comunque selezionabile
// come destinazione: il prezzo va semplicemente inserito a mano.
export const FUEL_PRICES = {
  IT: { nome: 'Italia',                iso3: 'ITA', diesel: 2.101, benzina: 2.005 },
  AT: { nome: 'Austria',               iso3: 'AUT', diesel: 2.050, benzina: 1.839 },
  BE: { nome: 'Belgio',                iso3: 'BEL', diesel: 2.135, benzina: 1.791 },
  BG: { nome: 'Bulgaria',              iso3: 'BGR', diesel: 1.710, benzina: 1.515 },
  HR: { nome: 'Croazia',               iso3: 'HRV', diesel: 1.771, benzina: 1.617 },
  CY: { nome: 'Cipro',                 iso3: 'CYP', diesel: 1.721, benzina: 1.571 },
  CZ: { nome: 'Repubblica Ceca',       iso3: 'CZE', diesel: 1.814, benzina: 1.745 },
  DK: { nome: 'Danimarca',             iso3: 'DNK', diesel: 2.456, benzina: 2.323 },
  EE: { nome: 'Estonia',               iso3: 'EST', diesel: 1.732, benzina: 1.723 },
  FI: { nome: 'Finlandia',             iso3: 'FIN', diesel: 2.224, benzina: 2.166 },
  FR: { nome: 'Francia',               iso3: 'FRA', diesel: 2.216, benzina: 2.024 },
  DE: { nome: 'Germania',              iso3: 'DEU', diesel: 2.185, benzina: 2.109 },
  GR: { nome: 'Grecia',                iso3: 'GRC', diesel: 2.064, benzina: 2.021 },
  HU: { nome: 'Ungheria',              iso3: 'HUN', diesel: 1.714, benzina: 1.650 },
  IE: { nome: 'Irlanda',               iso3: 'IRL', diesel: 1.752, benzina: 1.758 },
  LV: { nome: 'Lettonia',              iso3: 'LVA', diesel: 1.969, benzina: 1.861 },
  LT: { nome: 'Lituania',              iso3: 'LTU', diesel: 1.940, benzina: 1.690 },
  LU: { nome: 'Lussemburgo',           iso3: 'LUX', diesel: 1.854, benzina: 1.709 },
  MT: { nome: 'Malta',                 iso3: 'MLT', diesel: 1.210, benzina: 1.340 },
  NL: { nome: 'Paesi Bassi',           iso3: 'NLD', diesel: 2.376, benzina: 2.376 },
  PL: { nome: 'Polonia',               iso3: 'POL', diesel: 1.829, benzina: 1.730 },
  PT: { nome: 'Portogallo',            iso3: 'PRT', diesel: 2.050, benzina: 1.982 },
  RO: { nome: 'Romania',               iso3: 'ROU', diesel: 2.067, benzina: 1.818 },
  SK: { nome: 'Slovacchia',            iso3: 'SVK', diesel: 1.737, benzina: 1.765 },
  SI: { nome: 'Slovenia',              iso3: 'SVN', diesel: 1.882, benzina: 1.584 },
  ES: { nome: 'Spagna',                iso3: 'ESP', diesel: 1.833, benzina: 1.714 },
  SE: { nome: 'Svezia',                iso3: 'SWE', diesel: 1.802, benzina: 1.378 },
};

// alpha-3 -> alpha-2 (per mappare la risposta del geocoder ORS)
const ISO3_TO_ISO2 = Object.fromEntries(
  Object.entries(FUEL_PRICES).map(([k, v]) => [v.iso3, k])
);

// Ritorna il prezzo di riferimento per un Paese e tipo carburante.
// paese: ISO alpha-2 o alpha-3 (case-insensitive). tipo: 'diesel'|'benzina'.
export function prezzoRiferimento(paese, tipo = 'diesel', tabella = FUEL_PRICES) {
  if (!paese) return null;
  const p = String(paese).toUpperCase();
  const iso2 = p.length === 3 ? ISO3_TO_ISO2[p] : p;
  const row = tabella[iso2];
  if (!row) return null;
  return tipo === 'benzina' ? row.benzina : row.diesel;
}

export function paeseDaIso(paese, tabella = FUEL_PRICES) {
  if (!paese) return null;
  const p = String(paese).toUpperCase();
  const iso2 = p.length === 3 ? ISO3_TO_ISO2[p] : p;
  return tabella[iso2] ? { iso2, ...tabella[iso2] } : null;
}

// ---- Prezzo Italia in tempo reale (dati ufficiali MISE) -----------------
// Chiamata a ogni apertura dell'app: aggiorna solo la riga IT con la media
// nazionale del giorno, senza toccare gli altri Paesi né richiedere un
// salvataggio manuale. Se la fonte non è raggiungibile, fallisce in
// silenzio e restano i valori di riferimento correnti.
export async function fetchPrezzoItaliaLive() {
  try {
    // L'endpoint ora chiede di essere autenticati e autorizzati ai trasporti,
    // come gli altri /api/* della sezione: senza il token risponderebbe 401 e
    // resterebbero i prezzi di riferimento salvati.
    const { getAccessToken } = await import('../../lib/supabase.js');
    const token = await getAccessToken();
    const res = await fetch(CONFIG.api.prezzoItalia, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Number.isFinite(data.diesel) || !Number.isFinite(data.benzina)) return null;
    return { diesel: data.diesel, benzina: data.benzina, aggiornatoAl: data.aggiornatoAl };
  } catch {
    return null;
  }
}

// Applica il prezzo live alla riga IT dell'oggetto impostazioni (mutandolo),
// creando prezziCustom come copia della tabella di default se non esiste
// ancora. Ritorna true se il prezzo è stato aggiornato. Non è persistito su
// Supabase: resta valido per la sessione corrente, e viene ri-richiesto a
// ogni apertura dell'app (se poi l'operatore salva le Impostazioni mentre è
// attivo, il valore live di quel momento viene comunque salvato, ma la
// prossima apertura lo aggiorna di nuovo).
export function applicaPrezzoItaliaLive(imp, live) {
  if (!live) return false;
  if (!imp.prezziCustom) imp.prezziCustom = structuredClone(FUEL_PRICES);
  const row = imp.prezziCustom.IT;
  if (!row) return false;
  row.diesel = live.diesel;
  row.benzina = live.benzina;
  return true;
}
