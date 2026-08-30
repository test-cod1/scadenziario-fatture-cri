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
        .select("*, pagamenti(*), note_credito_righe(*, note_credito(numero, data, note))")
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
    const { data, error } = await sb.from('fatture').select('*, pagamenti(*), note_credito_righe(*, note_credito(numero, data, note))').eq('id', id).single();
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
    delete payload.pagamenti; delete payload.note_credito_righe; delete payload._residuo; delete payload._pagato; delete payload._stornato;
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
  const stornato = (f.note_credito_righe || []).reduce((s, n) => s + Number(n.importo || 0), 0);
  return { ...f, _pagato: pagato, _stornato: stornato, _residuo: Math.max(0, Number(f.importo || 0) - pagato - stornato) };
}

// ---------------------------------------------------------------
//  NOTE DI CREDITO — un documento (testata) che può stornare più fatture
//  insieme, ciascuna per una quota diversa (note_credito_righe). Solo
//  l'admin le scrive (stessa scelta fatta per i pagamenti veri e propri).
// ---------------------------------------------------------------
export const noteCredito = {
  // righe: [{ fattura_id, importo }, ...] — una per ciascuna fattura
  // stornata da questo stesso documento.
  async create({ numero, data, note }, righe) {
    const sb = await sbClient();
    const { data: u } = await sb.auth.getUser();
    const { data: testata, error: errTestata } = await sb.from('note_credito')
      .insert({ numero: numero || null, data, note: note || null, created_by: u?.user?.id })
      .select().single();
    if (errTestata) throw errTestata;
    const payloadRighe = righe.map(r => ({ nota_credito_id: testata.id, fattura_id: r.fattura_id, importo: r.importo }));
    const { error: errRighe } = await sb.from('note_credito_righe').insert(payloadRighe);
    if (errRighe) {
      // Le righe non sono state scritte: senza questa pulizia la testata
      // resterebbe orfana nel database, invisibile a qualunque vista
      // dell'app (tutte leggono le note di credito tramite le righe).
      await sb.from('note_credito').delete().eq('id', testata.id);
      throw errRighe;
    }
    return testata;
  },
  // Rimuove solo il legame con UNA fattura (una riga), non l'intero documento
  // — ma se era l'ultima riga rimasta, elimina anche la testata: altrimenti
  // resterebbe un documento "vuoto" per sempre, senza alcuna schermata per
  // trovarlo o cancellarlo.
  async removeRiga(rigaId) {
    const sb = await sbClient();
    const { data: riga, error: errGet } = await sb.from('note_credito_righe').select('nota_credito_id').eq('id', rigaId).single();
    if (errGet) throw errGet;
    const { error } = await sb.from('note_credito_righe').delete().eq('id', rigaId);
    if (error) throw error;
    const { count, error: errCount } = await sb.from('note_credito_righe')
      .select('id', { count: 'exact', head: true }).eq('nota_credito_id', riga.nota_credito_id);
    if (!errCount && count === 0) {
      await sb.from('note_credito').delete().eq('id', riga.nota_credito_id);
    }
  },
};

// ---------------------------------------------------------------
//  PAGAMENTI (acconti / rate)
// ---------------------------------------------------------------
export const pagamenti = {
  // `decisore` è opzionale: serve solo per etichettare le eventuali proposte
  // di pagamento che questo pagamento chiude (vedi sotto), non per il
  // pagamento in sé.
  async add(fatturaId, rec, decisore) {
    const sb = await sbClient();
    const { data: u } = await sb.auth.getUser();
    const payload = { ...rec, fattura_id: fatturaId, created_by: u?.user?.id };
    const { data, error } = await sb.from('pagamenti').insert(payload).select().single();
    if (error) throw error;
    // Un pagamento registrato direttamente (fuori dal flusso "conferma
    // proposta", es. dal pagamento rapido) chiude comunque ogni proposta
    // ancora in attesa per la stessa fattura: senza questo, resterebbero
    // bloccate e riconfermabili in seguito, con un secondo pagamento
    // duplicato come conseguenza.
    await sb.from('proposte_pagamento')
      .update({ stato: 'confermata', pagamento_id: data.id, decisa_da: u?.user?.id, decisa_da_nome: decisore?.nome || null, decisa_il: new Date().toISOString() })
      .eq('fattura_id', fatturaId)
      .eq('stato', 'proposta');
    return data;
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
  // Quante proposte sono già in attesa per questa fattura: usato solo per
  // avvisare prima di inviarne una seconda (es. doppio click), non per
  // impedirlo — può essere voluto (due acconti proposti separatamente).
  async contaInAttesaPerFattura(fatturaId) {
    const sb = await sbClient();
    const { count, error } = await sb.from('proposte_pagamento')
      .select('id', { count: 'exact', head: true }).eq('fattura_id', fatturaId).eq('stato', 'proposta');
    if (error) throw error;
    return count || 0;
  },
  // Ritira una propria proposta ancora in attesa (le RLS impediscono di
  // cancellare quelle altrui o già decise dall'admin).
  async remove(id) {
    const sb = await sbClient();
    const { error } = await sb.from('proposte_pagamento').delete().eq('id', id);
    if (error) throw error;
  },
  // Registra il pagamento vero e proprio e marca la proposta come confermata.
  // Si "prenota" la proposta PRIMA di scrivere il pagamento, passandola a
  // 'confermata' solo se in quel momento è ancora 'proposta' (condizione
  // nella .eq qui sotto): se due admin la confermano quasi insieme, il
  // secondo update tocca zero righe e la funzione si ferma subito, invece
  // di creare comunque un secondo pagamento duplicato.
  async confermare(proposta, { importo, data_pagamento, metodo }, decisore) {
    const sb = await sbClient();
    const { data: u } = await sb.auth.getUser();
    const { data: prenotate, error: errPrenota } = await sb.from('proposte_pagamento')
      .update({ stato: 'confermata', decisa_da: u?.user?.id, decisa_da_nome: decisore?.nome || null, decisa_il: new Date().toISOString() })
      .eq('id', proposta.id).eq('stato', 'proposta')
      .select('id');
    if (errPrenota) throw errPrenota;
    if (!prenotate || !prenotate.length) throw new Error('Questa proposta è già stata gestita nel frattempo (da un altro admin, o in un\'altra scheda).');
    const { data: pag, error: errPag } = await sb.from('pagamenti')
      .insert({ fattura_id: proposta.fattura_id, importo, data_pagamento, metodo: metodo || null, created_by: u?.user?.id })
      .select().single();
    if (errPag) {
      // Il pagamento non è stato registrato: si riporta la proposta in
      // attesa invece di lasciarla "confermata" senza alcun pagamento
      // collegato, cosa che la nasconderebbe per sempre senza che sia
      // stato davvero pagato nulla.
      await sb.from('proposte_pagamento').update({ stato: 'proposta', decisa_da: null, decisa_da_nome: null, decisa_il: null }).eq('id', proposta.id);
      throw errPag;
    }
    const { error: errLink } = await sb.from('proposte_pagamento').update({ pagamento_id: pag.id }).eq('id', proposta.id);
    if (errLink) throw errLink;
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
