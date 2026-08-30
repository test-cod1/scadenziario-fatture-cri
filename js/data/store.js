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
function utenteDaProfilo(authUser, prof) {
  return {
    id: authUser.id, email: authUser.email,
    nome: prof?.nome || authUser.email, ruolo: prof?.ruolo || 'in_attesa',
    deveCambiarePassword: !!prof?.deve_cambiare_password,
  };
}

export const auth = {
  async current() {
    const sb = await sbClient();
    const { data } = await sb.auth.getUser();
    if (!data.user) return null;
    const prof = await sbProfile(sb, data.user.id);
    return utenteDaProfilo(data.user, prof);
  },
  async signIn(email, password) {
    const sb = await sbClient();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const prof = await sbProfile(sb, data.user.id);
    return utenteDaProfilo(data.user, prof);
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
  // Azzera il flag "password provvisoria" sul proprio profilo: la policy
  // prof_update_self lo consente perché non tocca il ruolo.
  async confermaPasswordImpostata() {
    const sb = await sbClient();
    const { data: u } = await sb.auth.getUser();
    if (!u?.user) return;
    const { error } = await sb.from('profili').update({ deve_cambiare_password: false }).eq('id', u.user.id);
    if (error) throw error;
  },
};

// ---------------------------------------------------------------
//  AMMINISTRAZIONE (solo admin): creazione utenti con password provvisoria
// ---------------------------------------------------------------
export const amministrazione = {
  async creaUtente({ email, nome, ruolo }) {
    const { getAccessToken } = await import('../lib/supabase.js');
    const { CONFIG } = await import('../config.js');
    const token = await getAccessToken();
    if (!token) throw new Error('Sessione non valida: ricarica la pagina e riaccedi.');
    const res = await fetch(CONFIG.api.creaUtente, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email, nome, ruolo }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok && !data.passwordProvvisoria) throw new Error(data.error || `Creazione utente non riuscita (${res.status}).`);
    return data; // { email, passwordProvvisoria, error? } — error solo se il profilo non è stato completato
  },
};

// ---------------------------------------------------------------
//  FATTURE
// ---------------------------------------------------------------
export const fatture = {
  // PostgREST limita ogni risposta a 1000 righe: senza paginazione, superata
  // quella soglia la dashboard avrebbe mostrato in silenzio solo le prime 1000
  // e tutti i totali (dovuto, scaduto, pagato nel mese) sarebbero stati
  // sbagliati senza alcun errore visibile. Qui si scorre a blocchi finché il
  // database non restituisce meno righe di quante richieste.
  async list() {
    const sb = await sbClient();
    const BLOCCO = 1000;
    const tutte = [];
    for (let da = 0; ; da += BLOCCO) {
      const { data, error } = await sb.from("fatture")
        .select("*, pagamenti(*)")
        .order("scadenza", { ascending: true, nullsFirst: false })
        .order("id", { ascending: true })   // ordine stabile: senza, i blocchi possono sovrapporsi
        .range(da, da + BLOCCO - 1);
      if (error) throw error;
      tutte.push(...data);
      if (data.length < BLOCCO) break;
    }
    return tutte.map(withResiduo);
  },
  async get(id) {
    const sb = await sbClient();
    const { data, error } = await sb.from('fatture').select('*, pagamenti(*)').eq('id', id).single();
    if (error) throw error;
    return withResiduo(data);
  },
  // `nuovo: true` forza l'INSERT anche se rec.id è valorizzato: serve per
  // creare la fattura con un id generato lato client, così l'eventuale
  // allegato può essere caricato PRIMA dell'insert e la creazione risulta
  // una sola operazione (una sola riga nel registro modifiche).
  async save(rec, { nuovo = false } = {}) {
    const isNew = nuovo || !rec.id;
    const sb = await sbClient();
    const payload = { ...rec };
    delete payload.pagamenti; delete payload._residuo; delete payload._pagato;
    if (isNew) {
      const { data: u } = await sb.auth.getUser();
      if (u?.user) payload.created_by = u.user.id;
      if (!payload.id) delete payload.id;
      const { data, error } = await sb.from('fatture').insert(payload).select().single();
      if (error) throw error; return data;
    }
    const { data, error } = await sb.from('fatture').update(payload).eq('id', payload.id).select().single();
    if (error) throw error; return data;
  },
  // Cerca una fattura già registrata con lo stesso numero e lo stesso fornitore.
  // Il confronto sul fornitore avviene qui in JavaScript (normalizzando spazi e
  // maiuscole) invece che con ilike, per non trattare come jolly gli eventuali
  // caratteri % o _ presenti nella ragione sociale.
  async trovaDuplicato({ fornitore, numero_fattura }, escludiId) {
    if (!numero_fattura || !fornitore) return null;   // senza numero non si può parlare di duplicato
    const sb = await sbClient();
    const { data, error } = await sb.from("fatture")
      .select("id, fornitore, numero_fattura, data_fattura, importo")
      .eq("numero_fattura", numero_fattura)
      .limit(20);
    if (error) throw error;
    const norm = (v) => String(v || "").toLowerCase().split(" ").filter(Boolean).join(" ");
    const cercato = norm(fornitore);
    return (data || []).find(f => f.id !== escludiId && norm(f.fornitore) === cercato) || null;
  },
  async remove(id) {
    const sb = await sbClient();
    const { error } = await sb.from("fatture").delete().eq("id", id);
    if (error) throw error;
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
//  PROPOSTE DI PAGAMENTO
// ------------------------------------------------------------
//  L'operatore propone (importo, data prevista, metodo); solo l'admin può
//  confermarle (scrive il pagamento vero e proprio, che a sua volta fa
//  scattare il ricalcolo automatico dello stato della fattura) o rifiutarle.
//  Le RLS filtrano già cosa list() restituisce: l'operatore vede solo le
//  proprie proposte, l'admin le vede tutte.
// ---------------------------------------------------------------
export const proposte = {
  async list() {
    const sb = await sbClient();
    const { data, error } = await sb.from('proposte_pagamento')
      .select('*, fatture(fornitore, numero_fattura, importo, scadenza, stato)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },
  async create(fatturaId, rec, proponente) {
    const sb = await sbClient();
    const { data: u } = await sb.auth.getUser();
    const payload = { ...rec, fattura_id: fatturaId, proposta_da: u?.user?.id, proposta_da_nome: proponente?.nome || null, proposta_da_email: proponente?.email || null };
    const { data, error } = await sb.from('proposte_pagamento').insert(payload).select().single();
    if (error) throw error; return data;
  },
  // Ritira una propria proposta ancora in attesa (le RLS impediscono di
  // cancellare quelle altrui o già decise dall'admin).
  async remove(id) {
    const sb = await sbClient();
    const { error } = await sb.from('proposte_pagamento').delete().eq('id', id);
    if (error) throw error;
  },
  // Registra il pagamento vero e proprio e marca la proposta come confermata,
  // collegandola al pagamento creato. Due scritture separate (niente
  // transazioni lato client con Supabase): in caso di errore sulla seconda,
  // il pagamento resta comunque registrato correttamente sulla fattura.
  async confermare(proposta, { importo, data_pagamento, metodo }, decisore) {
    const sb = await sbClient();
    const { data: u } = await sb.auth.getUser();
    const { data: pag, error: errPag } = await sb.from('pagamenti')
      .insert({ fattura_id: proposta.fattura_id, importo, data_pagamento, metodo: metodo || null, created_by: u?.user?.id })
      .select().single();
    if (errPag) throw errPag;
    const { error: errProp } = await sb.from('proposte_pagamento')
      .update({ stato: 'confermata', decisa_da: u?.user?.id, decisa_da_nome: decisore?.nome || null, decisa_il: new Date().toISOString(), pagamento_id: pag.id })
      .eq('id', proposta.id);
    if (errProp) throw errProp;
    return pag;
  },
  async rifiutare(id, motivo, decisore) {
    const sb = await sbClient();
    const { data: u } = await sb.auth.getUser();
    const { error } = await sb.from('proposte_pagamento')
      .update({ stato: 'rifiutata', decisa_da: u?.user?.id, decisa_da_nome: decisore?.nome || null, decisa_il: new Date().toISOString(), motivo_rifiuto: motivo || null })
      .eq('id', id);
    if (error) throw error;
  },
};

// ---------------------------------------------------------------
//  IMPOSTAZIONI (riga singola, configurazione globale)
// ---------------------------------------------------------------
export const impostazioni = {
  async get() {
    const sb = await sbClient();
    const { data, error } = await sb.from('impostazioni').select('*').eq('id', 1).single();
    if (error) throw error;
    return data;
  },
  async save(rec) {
    const sb = await sbClient();
    const { data, error } = await sb.from('impostazioni').update(rec).eq('id', 1).select().single();
    if (error) throw error;
    return data;
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
