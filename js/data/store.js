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
    return { id: data.user.id, email: data.user.email, nome: prof?.nome || data.user.email, ruolo: prof?.ruolo || 'in_attesa' };
  },
  async signIn(email, password) {
    const sb = await sbClient();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const prof = await sbProfile(sb, data.user.id);
    return { id: data.user.id, email: data.user.email, nome: prof?.nome || data.user.email, ruolo: prof?.ruolo || 'in_attesa' };
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
    // Il percorso dell'allegato va letto PRIMA della cancellazione: dopo, la
    // riga non esiste più e il file resterebbe nel bucket senza che nulla lo
    // referenzi, occupando spazio e restando leggibile agli utenti abilitati.
    let pdfPath = null;
    try {
      const { data } = await sb.from("fatture").select("pdf_path").eq("id", id).single();
      pdfPath = (data && data.pdf_path) || null;
    } catch { /* se non riusciamo a leggerlo, si prosegue comunque con la cancellazione */ }

    const { error } = await sb.from("fatture").delete().eq("id", id);
    if (error) throw error;

    // Solo a cancellazione avvenuta: se la delete fallisse (permessi), il file
    // deve restare al suo posto. Un errore qui non annulla la cancellazione.
    if (pdfPath) { try { await fatture.rimuoviPdf(pdfPath); } catch { /* allegato non rimosso */ } }
  },
  async caricaPdf(file, fatturaId) {
    const sb = await sbClient();
    // Il nome originale finisce nella chiave dello storage: caratteri come
    // #, ? o gli accenti possono renderla problematica, quindi si ripulisce
    // tenendo solo caratteri sicuri (il nome resta comunque riconoscibile).
    const nome = String(file.name || "documento")
      .normalize("NFKD")
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(-80) || "documento";
    const path = fatturaId + "/" + Date.now() + "-" + nome;
    const { error } = await sb.storage.from('fatture-pdf').upload(path, file, { contentType: file.type || 'application/pdf' });
    if (error) throw error;
    return path;
  },
  // Rimuove un file dallo storage (usata sia dopo un insert fallito, sia
  // quando si elimina una fattura, per non lasciare allegati orfani).
  async rimuoviPdf(path) {
    if (!path) return;
    const sb = await sbClient();
    const { error } = await sb.storage.from('fatture-pdf').remove([path]);
    if (error) throw error;
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
