// ============================================================
//  CONFIGURAZIONE — Scadenziario Fatture CRI Genova
// ============================================================
// Progetto Supabase dedicato (regione UE). Tabelle: profili, fatture,
// pagamenti, log_modifiche. Bucket storage: fatture-pdf.
//
// IMPORTANTE: dopo aver creato il progetto Supabase (vedi README.md),
// sostituisci url/anonKey qui sotto con quelli del tuo progetto.
// ============================================================

export const CONFIG = {
  supabase: {
    url: 'https://TUO-PROGETTO.supabase.co',
    anonKey: 'TUA-ANON-KEY',
  },

  // Endpoint serverless (Cloudflare Pages Functions) per l'estrazione AI
  // dei campi dalle fatture PDF: la chiave Gemini resta lato server.
  api: {
    estraiFattura: '/api/estrai-fattura',
  },

  // Soglie (giorni) per gli alert di scadenza in dashboard
  scadenzeAlert: [7, 15, 30],
};
