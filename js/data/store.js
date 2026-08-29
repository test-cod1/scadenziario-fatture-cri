// ============================================================
//  DATA LAYER — Supabase: auth, fatture, pagamenti, log, storage PDF
// ============================================================
async function sbClient() { const { getSupabase } = await import('../lib/supabase.js'); return getSupabase(); }
async function sbProfile(sb, userId) {
  const { data } = await sb.from('profili').select('*').eq('id', userId).single();
  return data;
}

// ---------------------------------------------------------------
//  AUTH
// ---------------------------------------------------------------
export const auth = {
  async current() {
    const sb = await sbClient();
    const { data } = await sb.auth.getUser();
    if (!data.user) return null;
    const prof = await sbProfile(sb, data.user.id);
    return { id: data.user.id, email: data.user.email, nome: prof?.nome || data.user.email, ruolo: prof?.ruolo || 'operatore' };
  },
  async signIn(email, password) {
    const sb = await sbClient();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const prof = await sbProfile(sb, data.user.id);
    return { id: data.user.id, email: data.user.email, nome: prof?.nome || data.user.email, ruolo: prof?.ruolo || 'operatore' };
  },
  async signOut() {
    const sb = await sbClient(); await sb.auth.signOut();
  },
  async resetPassword(email) {
    const sb = await sbClient();
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    if (error) throw error;
  },
  async updatePassword(nuovaPassword) {
    const sb = await sbClient();
    const { error } = await sb.auth.updateUser({ password: nuovaPassword });
    if (error) throw error;
  },
};

// ---------------------------------------------------------------
//  FATTURE
// ---------------------------------------------------------------
export const fatture = {
  async list() {
    const sb = await sbClient();
    const { data, error } = await sb.from('fatture').select('*, pagamenti(*)').order('scadenza', { ascending: true, nullsFirst: false });
    if (error) throw error;
    return data.map(withResiduo);
  },
  async get(id) {
    const sb = await sbClient();
    const { data, error } = await sb.from('fatture').select('*, pagamenti(*)').eq('id', id).single();
    if (error) throw error;
    return withResiduo(data);
  },
  async save(rec) {
    const isNew = !rec.id;
    const sb = await sbClient();
    const payload = { ...rec };
    delete payload.pagamenti; delete payload._residuo;
    if (isNew) {
      const { data: u } = await sb.auth.getUser();
      if (u?.user) payload.created_by = u.user.id;
      delete payload.id;
      const { data, error } = await sb.from('fatture').insert(payload).select().single();
      if (error) throw error; return data;
    }
    const { data, error } = await sb.from('fatture').update(payload).eq('id', payload.id).select().single();
    if (error) throw error; return data;
  },
  async remove(id) {
    const sb = await sbClient();
    const { error } = await sb.from('fatture').delete().eq('id', id);
    if (error) throw error;
  },
  async caricaPdf(file, fatturaId) {
    const sb = await sbClient();
    const path = `${fatturaId}/${Date.now()}-${file.name}`;
    const { error } = await sb.storage.from('fatture-pdf').upload(path, file, { contentType: file.type || 'application/pdf' });
    if (error) throw error;
    return path;
  },
  async urlPdf(path) {
    const sb = await sbClient();
    const { data, error } = await sb.storage.from('fatture-pdf').createSignedUrl(path, 300);
    if (error) throw error;
    return data.signedUrl;
  },
};

function withResiduo(f) {
  const pagato = (f.pagamenti || []).reduce((s, p) => s + Number(p.importo || 0), 0);
  return { ...f, _pagato: pagato, _residuo: Math.max(0, Number(f.importo || 0) - pagato) };
}

// ---------------------------------------------------------------
//  PAGAMENTI (acconti / rate)
// ---------------------------------------------------------------
export const pagamenti = {
  async add(fatturaId, rec) {
    const sb = await sbClient();
    const { data: u } = await sb.auth.getUser();
    const payload = { ...rec, fattura_id: fatturaId, created_by: u?.user?.id };
    const { data, error } = await sb.from('pagamenti').insert(payload).select().single();
    if (error) throw error; return data;
  },
  async remove(id) {
    const sb = await sbClient();
    const { error } = await sb.from('pagamenti').delete().eq('id', id);
    if (error) throw error;
  },
};

// ---------------------------------------------------------------
//  LOG MODIFICHE (solo admin)
// ---------------------------------------------------------------
export const logModifiche = {
  async list({ limit = 300 } = {}) {
    const sb = await sbClient();
    const { data, error } = await sb.from('log_modifiche').select('*').order('created_at', { ascending: false }).limit(limit);
    if (error) throw error; return data;
  },
};
