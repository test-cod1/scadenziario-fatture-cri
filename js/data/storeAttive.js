// ============================================================
//  DATA LAYER — Fatture ATTIVE (emesse ai clienti): tabelle indipendenti
//  da quelle delle fatture fornitori (vedi store.js). Stessa forma di
//  quel file, adattata al lessico "cliente/incasso" invece di
//  "fornitore/pagamento".
// ============================================================
async function sbClient() { const { getSupabase } = await import('../lib/supabase.js'); return getSupabase(); }

// ---------------------------------------------------------------
//  FATTURE ATTIVE
// ---------------------------------------------------------------
export const fattureAttive = {
  // Vedi il commento gemello in store.js: PostgREST limita ogni risposta a
  // 1000 righe, quindi si scorre a blocchi finché il database non restituisce
  // meno righe di quante richieste.
  async list() {
    const sb = await sbClient();
    const BLOCCO = 1000;
    const tutte = [];
    for (let da = 0; ; da += BLOCCO) {
      const { data, error } = await sb.from("fatture_attive")
        .select("*, incassi(*), note_credito_attive_righe(*, note_credito_attive(numero, data, note))")
        .order("data_fattura", { ascending: true, nullsFirst: false })
        .order("id", { ascending: true })
        .range(da, da + BLOCCO - 1);
      if (error) throw error;
      tutte.push(...data);
      if (data.length < BLOCCO) break;
    }
    return tutte.map(withResiduo);
  },
  async get(id) {
    const sb = await sbClient();
    const { data, error } = await sb.from('fatture_attive').select('*, incassi(*), note_credito_attive_righe(*, note_credito_attive(numero, data, note))').eq('id', id).single();
    if (error) throw error;
    return withResiduo(data);
  },
  // `nuovo: true` forza l'INSERT anche se rec.id è valorizzato: serve per
  // creare la fattura con un id generato lato client, così l'eventuale
  // allegato può essere caricato PRIMA dell'insert (vedi fatturaAttiva.js).
  async save(rec, { nuovo = false } = {}) {
    const isNew = nuovo || !rec.id;
    const sb = await sbClient();
    const payload = { ...rec };
    delete payload.incassi; delete payload.note_credito_attive_righe; delete payload._residuo; delete payload._incassato; delete payload._stornato;
    if (isNew) {
      const { data: u } = await sb.auth.getUser();
      if (u?.user) payload.created_by = u.user.id;
      if (!payload.id) delete payload.id;
      const { data, error } = await sb.from('fatture_attive').insert(payload).select().single();
      if (error) throw error; return data;
    }
    const { data, error } = await sb.from('fatture_attive').update(payload).eq('id', payload.id).select().single();
    if (error) throw error; return data;
  },
  // Cerca una fattura attiva già registrata con lo stesso numero e lo stesso
  // cliente (stesso criterio delle passive, confronto normalizzato in JS).
  // Vedi il commento gemello in store.js: il confronto sul numero fattura è
  // normalizzato in JavaScript (non un .eq esatto lato Postgres, che sarebbe
  // case-sensitive), con un ilike come filtro grezzo lato query.
  async trovaDuplicato({ cliente, numero_fattura }, escludiId) {
    if (!numero_fattura || !cliente) return null;
    const norm = (v) => String(v || "").trim().toLowerCase().split(" ").filter(Boolean).join(" ");
    const sb = await sbClient();
    const { data, error } = await sb.from("fatture_attive")
      .select("id, cliente, numero_fattura, data_fattura, importo")
      .ilike("numero_fattura", numero_fattura.trim().replace(/[%_]/g, m => '\\' + m))
      .limit(20);
    if (error) throw error;
    const cercato = norm(cliente);
    return (data || []).find(f => f.id !== escludiId && norm(f.numero_fattura) === norm(numero_fattura) && norm(f.cliente) === cercato) || null;
  },
  async remove(id) {
    const sb = await sbClient();
    const { error } = await sb.from("fatture_attive").delete().eq("id", id);
    if (error) throw error;
  },
  // Aggiorna solo la data dell'ultimo sollecito inviato al cliente: azione
  // rapida dalla dashboard, non passa per il resto dell'editor.
  async segnaSollecito(id, data_sollecito) {
    const sb = await sbClient();
    const { data, error } = await sb.from('fatture_attive').update({ data_sollecito }).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
};

function withResiduo(f) {
  const incassato = (f.incassi || []).reduce((s, p) => s + Number(p.importo || 0), 0);
  const stornato = (f.note_credito_attive_righe || []).reduce((s, n) => s + Number(n.importo || 0), 0);
  return { ...f, _incassato: incassato, _stornato: stornato, _residuo: Math.max(0, Number(f.importo || 0) - incassato - stornato) };
}

// ---------------------------------------------------------------
//  NOTE DI CREDITO EMESSE — un documento (testata) che può stornare più
//  fatture attive insieme, ciascuna per una quota diversa.
// ---------------------------------------------------------------
export const noteCreditoAttive = {
  async create({ numero, data, note }, righe) {
    const sb = await sbClient();
    const { data: u } = await sb.auth.getUser();
    const { data: testata, error: errTestata } = await sb.from('note_credito_attive')
      .insert({ numero: numero || null, data, note: note || null, created_by: u?.user?.id })
      .select().single();
    if (errTestata) throw errTestata;
    const payloadRighe = righe.map(r => ({ nota_credito_attiva_id: testata.id, fattura_attiva_id: r.fattura_attiva_id, importo: r.importo }));
    const { error: errRighe } = await sb.from('note_credito_attive_righe').insert(payloadRighe);
    if (errRighe) {
      await sb.from('note_credito_attive').delete().eq('id', testata.id);
      throw errRighe;
    }
    return testata;
  },
  // Rimuove solo il legame con UNA fattura; se era l'ultima riga rimasta,
  // elimina anche la testata (stessa logica delle passive).
  async removeRiga(rigaId) {
    const sb = await sbClient();
    const { data: riga, error: errGet } = await sb.from('note_credito_attive_righe').select('nota_credito_attiva_id').eq('id', rigaId).single();
    if (errGet) throw errGet;
    const { error } = await sb.from('note_credito_attive_righe').delete().eq('id', rigaId);
    if (error) throw error;
    const { count, error: errCount } = await sb.from('note_credito_attive_righe')
      .select('id', { count: 'exact', head: true }).eq('nota_credito_attiva_id', riga.nota_credito_attiva_id);
    if (!errCount && count === 0) {
      await sb.from('note_credito_attive').delete().eq('id', riga.nota_credito_attiva_id);
    }
  },
};

// ---------------------------------------------------------------
//  INCASSI (acconti / rate ricevute dal cliente) — a differenza dei
//  pagamenti delle fatture passive, li registra direttamente anche
//  l'operatore: non è previsto un flusso di proposte separato.
// ---------------------------------------------------------------
export const incassi = {
  async add(fatturaId, rec) {
    const sb = await sbClient();
    const { data: u } = await sb.auth.getUser();
    const payload = { ...rec, fattura_attiva_id: fatturaId, created_by: u?.user?.id };
    const { data, error } = await sb.from('incassi').insert(payload).select().single();
    if (error) throw error;
    return data;
  },
  async remove(id) {
    const sb = await sbClient();
    const { error } = await sb.from('incassi').delete().eq('id', id);
    if (error) throw error;
  },
};

// ---------------------------------------------------------------
//  LOG MODIFICHE (solo admin)
// ---------------------------------------------------------------
export const logModificheAttive = {
  async list({ limit = 300 } = {}) {
    const sb = await sbClient();
    const { data, error } = await sb.from('log_modifiche_attive').select('*').order('created_at', { ascending: false }).limit(limit);
    if (error) throw error; return data;
  },
};
