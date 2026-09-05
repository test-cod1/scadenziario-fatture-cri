// ============================================================
//  CONFIGURAZIONE — Scadenziario Fatture CRI Genova
// ============================================================
// Progetto Supabase dedicato (regione UE). Tabelle: profili, fatture,
// pagamenti, log_modifiche.
//
// IMPORTANTE: dopo aver creato il progetto Supabase (vedi README.md),
// sostituisci url/anonKey qui sotto con quelli del tuo progetto.
// ============================================================

export const CONFIG = {
  supabase: {
    url: 'https://xmfqozojjplccnnttwxu.supabase.co',
    anonKey: 'sb_publishable_Cm8yAHlD3TZSjW0fW53_fw_OmfeWJT3',
  },

  // Endpoint serverless (Cloudflare Pages Functions) per l'estrazione AI
  // dei campi dalle fatture PDF: la chiave Gemini resta lato server.
  api: {
    estraiFattura: '/api/estrai-fattura',
    estraiFatturaAttiva: '/api/estrai-fattura-attiva',
    creaUtente: '/api/crea-utente',
    eliminaUtente: '/api/elimina-utente',
  },

  // Soglie (giorni) per gli alert di scadenza in dashboard
  scadenzeAlert: [7, 15, 30],
};
