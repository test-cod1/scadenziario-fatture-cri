// ============================================================
//  DATA LAYER della sezione ASSISTENZE SANITARIE
//  Preventivi + impostazioni (tariffario e testi del documento), sul
//  Supabase del portale. Le RLS lasciano leggere e scrivere solo a chi è
//  autorizzato alla sezione: qui non c'è nessun controllo di permessi da
//  ripetere, sarebbe una cortesia all'utente, non una sicurezza.
// ============================================================
import { mergeImpostazioni } from '../calc.js';

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2));
const nowISO = () => new Date().toISOString();

async function sbClient() { const { getSupabase } = await import('../../lib/supabase.js'); return getSupabase(); }

export const preventivi = {
  async list() {
    const sb = await sbClient();
    const { data, error } = await sb.from('preventivi_assistenze').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },
  async get(id) {
    const sb = await sbClient();
    const { data, error } = await sb.from('preventivi_assistenze').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  },
  async save(rec) {
    const isNew = !rec.id;
    rec = { ...rec, id: rec.id || uid(), updated_at: nowISO() };
    const sb = await sbClient();
    if (isNew) {
      const { data: u } = await sb.auth.getUser();
      if (u?.user) rec.created_by = rec.created_by || u.user.id;
    }
    const { data, error } = await sb.from('preventivi_assistenze').upsert(rec).select().single();
    if (error) throw error;
    return data;
  },
  async remove(id) {
    const sb = await sbClient();
    const { error } = await sb.from('preventivi_assistenze').delete().eq('id', id);
    if (error) throw error;
  },
};

export const impostazioni = {
  async get() {
    const sb = await sbClient();
    const { data } = await sb.from('impostazioni_assistenze').select('*').eq('id', 'default').maybeSingle();
    return mergeImpostazioni(data?.dati || null);
  },
  async save(dati) {
    const pulite = mergeImpostazioni(dati);
    const sb = await sbClient();
    const { error } = await sb.from('impostazioni_assistenze').upsert({ id: 'default', dati: pulite, updated_at: nowISO() });
    if (error) throw error;
    return pulite;
  },
};
