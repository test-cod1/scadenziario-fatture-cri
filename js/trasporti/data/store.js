// ============================================================
//  DATA LAYER della sezione TRASPORTI — preventivi + impostazioni
//  Rispetto al vecchio gestionale autonomo è sparito il doppio backend
//  ('local' su IndexedDB / 'supabase'): nel portale si entra sempre
//  autenticati e i dati stanno sul Supabase del portale, quindi resta il solo
//  percorso cloud.
// ============================================================
import { DEFAULT_IMPOSTAZIONI } from '../calc.js';

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2));
const nowISO = () => new Date().toISOString();

async function sbClient() { const { getSupabase } = await import('../../lib/supabase.js'); return getSupabase(); }

// ---------------------------------------------------------------
//  PREVENTIVI
// ---------------------------------------------------------------
export const preventivi = {
  // Vedi il commento gemello in js/data/store.js: PostgREST tronca ogni
  // risposta a 1000 righe. Senza paginazione, superato quel numero l'elenco
  // mostrava in silenzio solo i primi 1000 preventivi e le statistiche in
  // testata (valore totale, margine stimato) risultavano più basse del vero
  // senza alcun errore visibile.
  async list() {
    const sb = await sbClient();
    const BLOCCO = 1000;
    const tutti = [];
    for (let da = 0; ; da += BLOCCO) {
      const { data, error } = await sb.from('preventivi').select('*')
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })   // ordine stabile: senza, i blocchi possono sovrapporsi
        .range(da, da + BLOCCO - 1);
      if (error) throw error;
      tutti.push(...data);
      if (data.length < BLOCCO) break;
    }
    return tutti;
  },
  async get(id) {
    const sb = await sbClient();
    const { data, error } = await sb.from('preventivi').select('*').eq('id', id).single();
    if (error) throw error; return data;
  },
  async save(rec) {
    const isNew = !rec.id;
    rec = { id: rec.id || uid(), created_at: rec.created_at || nowISO(), ...rec, updated_at: nowISO() };
    const sb = await sbClient();
    if (isNew) {
      const { data: u } = await sb.auth.getUser();
      if (u?.user) rec.created_by = rec.created_by || u.user.id;
    }
    const { data, error } = await sb.from('preventivi').upsert(rec).select().single();
    if (error) throw error; return data;
  },
  async remove(id) {
    const sb = await sbClient();
    const { error } = await sb.from('preventivi').delete().eq('id', id);
    if (error) throw error;
  },
};

// ---------------------------------------------------------------
//  IMPOSTAZIONI (singleton "default")
// ---------------------------------------------------------------
export const impostazioni = {
  async get() {
    const sb = await sbClient();
    const { data } = await sb.from('impostazioni_trasferte').select('*').eq('id', 'default').maybeSingle();
    // merge coi default per tollerare nuove chiavi
    return mergeImpostazioni(data?.dati || null);
  },
  async save(dati) {
    const clean = mergeImpostazioni(dati);
    const sb = await sbClient();
    const { error } = await sb.from('impostazioni_trasferte').upsert({ id: 'default', dati: clean, updated_at: nowISO() });
    if (error) throw error; return clean;
  },
};

function mergeImpostazioni(dati) {
  if (!dati) return structuredClone(DEFAULT_IMPOSTAZIONI);
  return {
    ...structuredClone(DEFAULT_IMPOSTAZIONI),
    ...dati,
    mezzi: Array.isArray(dati.mezzi) && dati.mezzi.length ? dati.mezzi : DEFAULT_IMPOSTAZIONI.mezzi,
    // la tabella prezzi carburante personalizzata è opzionale
    prezziCustom: dati.prezziCustom || null,
  };
}
