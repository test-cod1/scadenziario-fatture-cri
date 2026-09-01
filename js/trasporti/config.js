// ============================================================
//  CONFIGURAZIONE della sezione TRASPORTI (preventivi)
//  Arriva dal gestionale preventivo-trasporti, che era un sito a sé: le
//  credenziali Supabase sono sparite (ora sono quelle del portale, in
//  js/config.js) e con loro la vecchia "modalità locale" su IndexedDB, che
//  serviva a provare l'app senza account — nel portale si entra sempre
//  autenticati.
// ============================================================

export const CONFIG = {
  // ---- Punto di partenza FISSO (sede CRI) --------------------------------
  // Ogni preventivo parte sempre da qui. Le coordinate sono un fallback:
  // il geocoder OpenRouteService le riconferma comunque.
  partenza: {
    label: 'Sede CRI — Corso Aldo Gastaldi 11, Genova',
    indirizzo: 'Corso Aldo Gastaldi 11, 16145 Genova, Italia',
    lon: 8.96999,
    lat: 44.40560,
  },

  // ---- Endpoint serverless (Worker Cloudflare) ---------------------------
  // Fanno da proxy verso OpenRouteService tenendo la chiave lato server.
  api: {
    geocode: '/api/geocode',
    route: '/api/route',
    prezzoItalia: '/api/prezzo-italia',
  },
};
