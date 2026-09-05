// ============================================================
//  DATA LAYER — Supabase: auth, fatture, pagamenti, log, storage PDF
// ============================================================
async function sbClient() { const { getSupabase } = await import('../lib/supabase.js'); return getSupabase(); }
async function sbProfile(sb, userId) {
  const { data } = await sb.from('profili').select('*').eq('id', userId).single();
  return data;
}

// Permessi di sezione dell'utente, nella forma { scadenziario: 'admin', … }.
// La policy autor_self lascia leggere a ciascuno le proprie righe, quindi
// questa lettura funziona per chiunque abbia fatto il login.
async function sbAutorizzazioni(sb, userId) {
  const { data } = await sb.from('autorizzazioni').select('sezione, ruolo').eq('utente_id', userId);
  const out = {};
  for (const r of data || []) out[r.sezione] = r.ruolo;
  return out;
}

// ---------------------------------------------------------------
//  AUTH
// ---------------------------------------------------------------
// `ruoloPortale` è il ruolo sull'intero portale ('super_admin' | 'utente' |
// 'in_attesa'); il ruolo dentro una singola sezione sta in `sezioni` e si
// legge con ruoloIn() di js/sezioni.js. Attenzione: le viste dello
// scadenziario ricevono un ctx.user in cui `ruolo` è già il ruolo NELLA
// SEZIONE (vedi app.js), non quello di portale.
function utenteDaProfilo(authUser, prof, sezioni) {
  return {
    id: authUser.id, email: authUser.email,
    nome: prof?.nome || authUser.email,
    ruoloPortale: prof?.ruolo || 'in_attesa',
    sezioni: sezioni || {},
    deveCambiarePassword: !!prof?.deve_cambiare_password,
  };
}

export const auth = {
  async current() {
    const sb = await sbClient();
    const { data } = await sb.auth.getUser();
    if (!data.user) return null;
    const [prof, sezioni] = await Promise.all([
      sbProfile(sb, data.user.id),
      sbAutorizzazioni(sb, data.user.id),
    ]);
    return utenteDaProfilo(data.user, prof, sezioni);
  },
  async signIn(email, password) {
    const sb = await sbClient();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const [prof, sezioni] = await Promise.all([
      sbProfile(sb, data.user.id),
      sbAutorizzazioni(sb, data.user.id),
    ]);
    return utenteDaProfilo(data.user, prof, sezioni);
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
  // Il flag "password provvisoria" lo spegne un trigger del database quando
  // l'hash della password cambia davvero (on_auth_password_changed): lasciarlo
  // scrivere al client permetteva di saltare l'obbligo con una PATCH, senza
  // mai cambiare password — vedi schema.sql.
  //
  // Questo tentativo resta però come rete di sicurezza per un database su cui
  // il patch non è ancora stato eseguito: lì il trigger non c'è, e senza
  // qualcuno che spenga il flag l'app richiederebbe di impostare la password
  // ad ogni accesso, all'infinito. Dove il patch c'è, la policy rifiuta questa
  // scrittura e l'errore si ignora: il lavoro l'ha già fatto il trigger.
  async confermaPasswordImpostata() {
    try {
      const sb = await sbClient();
      const { data: u } = await sb.auth.getUser();
      if (!u?.user) return;
      await sb.from('profili').update({ deve_cambiare_password: false }).eq('id', u.user.id);
    } catch { /* database aggiornato: ci ha già pensato il trigger */ }
  },
};

// ---------------------------------------------------------------
//  AMMINISTRAZIONE (solo super admin): utenti e autorizzazioni di sezione
// ---------------------------------------------------------------
export const amministrazione = {
  async creaUtente({ email, nome, autorizzazioni: perm }) {
    const { getAccessToken } = await import('../lib/supabase.js');
    const { CONFIG } = await import('../config.js');
    const token = await getAccessToken();
    if (!token) throw new Error('Sessione non valida: ricarica la pagina e riaccedi.');
    const res = await fetch(CONFIG.api.creaUtente, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email, nome, autorizzazioni: perm || {} }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok && !data.passwordProvvisoria) throw new Error(data.error || `Creazione utente non riuscita (${res.status}).`);
    return data; // { email, passwordProvvisoria, error? } — error solo se il profilo non è stato completato
  },

  // Elimina l'account per sempre: sparisce da Supabase Auth, e con lui
  // profilo e autorizzazioni. Le righe che aveva inserito restano, senza più
  // l'indicazione dell'autore. Passa dal server perché serve la service key,
  // che il client non ha (e non deve avere).
  async eliminaUtente(id) {
    const { getAccessToken } = await import('../lib/supabase.js');
    const { CONFIG } = await import('../config.js');
    const token = await getAccessToken();
    if (!token) throw new Error('Sessione non valida: ricarica la pagina e riaccedi.');
    const res = await fetch(CONFIG.api.eliminaUtente, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Eliminazione non riuscita (${res.status}).`);
    return data; // { ok: true, email }
  },

  // Elenco dei profili con i rispettivi permessi di sezione: le RLS lo
  // restituiscono per intero solo al super admin (policy prof_admin_read e
  // autor_sa_read), a chiunque altro solo il proprio.
  async listaUtenti() {
    const sb = await sbClient();
    const [profili, perm] = await Promise.all([
      sb.from('profili')
        .select('id, email, nome, ruolo, deve_cambiare_password, created_at')
        .order('ruolo', { ascending: true }).order('email', { ascending: true }),
      sb.from('autorizzazioni').select('utente_id, sezione, ruolo'),
    ]);
    if (profili.error) throw profili.error;
    if (perm.error) throw perm.error;
    const perUtente = {};
    for (const r of perm.data || []) (perUtente[r.utente_id] ||= {})[r.sezione] = r.ruolo;
    return (profili.data || []).map(p => ({ ...p, sezioni: perUtente[p.id] || {} }));
  },

  // Cambia nome e/o ruolo di portale di un altro utente. Scrive con il token
  // del super admin, non con la service key: è la policy prof_admin_update a
  // consentirlo (e a impedirgli di togliersi da solo il proprio ruolo).
  async aggiornaUtente(id, campi) {
    const sb = await sbClient();
    const { data, error } = await sb.from('profili').update(campi).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  // Concede (o cambia di ruolo) l'accesso di un utente a una sezione.
  async impostaAutorizzazione(utenteId, sezione, ruolo) {
    const sb = await sbClient();
    const { data: me } = await sb.auth.getUser();
    const { error } = await sb.from('autorizzazioni')
      .upsert({ utente_id: utenteId, sezione, ruolo, assegnata_da: me?.user?.id || null },
              { onConflict: 'utente_id,sezione' });
    if (error) throw error;
  },

  // Revoca l'accesso: la riga sparisce, non esiste un ruolo "nessuno".
  async revocaAutorizzazione(utenteId, sezione) {
    const sb = await sbClient();
    const { error } = await sb.from('autorizzazioni').delete()
      .eq('utente_id', utenteId).eq('sezione', sezione);
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
  // Sottoinsieme "attivo" per la dashboard: fatture dell'anno corrente
  // (qualunque stato) più le fatture ancora aperte di anni precedenti — cioè
  // tutto ciò che è recente o richiede ancora un'azione. Le fatture chiuse
  // (pagata/stornata) di anni precedenti restano fuori: si caricano solo
  // aprendo l'archivio (vedi listArchivio), invece di scaricare anni di
  // storico ormai concluso ad ogni apertura della dashboard. Una fattura
  // senza data_fattura resta comunque qui (non in archivio): a differenza di
  // una data nota, non si può escludere che sia "di un anno precedente".
  async listAperte() {
    const sb = await sbClient();
    const inizioAnno = `${new Date().getFullYear()}-01-01`;
    const BLOCCO = 1000;
    const tutte = [];
    for (let da = 0; ; da += BLOCCO) {
      const { data, error } = await sb.from("fatture")
        .select("*, pagamenti(*), note_credito_righe(*, note_credito(numero, data, note))")
        .or(`data_fattura.gte.${inizioAnno},data_fattura.is.null,stato.in.(da_pagare,pagata_parziale)`)
        .order("scadenza", { ascending: true, nullsFirst: false })
        .order("id", { ascending: true })
        .range(da, da + BLOCCO - 1);
      if (error) throw error;
      tutte.push(...data);
      if (data.length < BLOCCO) break;
    }
    return tutte.map(withResiduo);
  },
  // Il complementare di listAperte(): fatture chiuse di anni precedenti,
  // caricate solo quando l'utente apre l'archivio nella dashboard.
  async listArchivio() {
    const sb = await sbClient();
    const inizioAnno = `${new Date().getFullYear()}-01-01`;
    const BLOCCO = 1000;
    const tutte = [];
    for (let da = 0; ; da += BLOCCO) {
      const { data, error } = await sb.from("fatture")
        .select("*, pagamenti(*), note_credito_righe(*, note_credito(numero, data, note))")
        .lt("data_fattura", inizioAnno)
        .in("stato", ["pagata", "stornata"])
        .order("data_fattura", { ascending: false })
        .range(da, da + BLOCCO - 1);
      if (error) throw error;
      tutte.push(...data);
      if (data.length < BLOCCO) break;
    }
    return tutte.map(withResiduo);
  },
  // Quante fatture ci sono in archivio: una query leggera (solo conteggio,
  // nessuna riga scaricata) per mostrare un numero accanto al menu a
  // scomparsa anche prima di aprirlo.
  async contaArchivio() {
    const sb = await sbClient();
    const inizioAnno = `${new Date().getFullYear()}-01-01`;
    const { count, error } = await sb.from('fatture').select('id', { count: 'exact', head: true })
      .lt('data_fattura', inizioAnno).in('stato', ['pagata', 'stornata']);
    if (error) throw error;
    return count || 0;
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
  // Il confronto sul numero fattura avviene anch'esso qui in JavaScript
  // (normalizzato come il fornitore, non con .eq esatto lato Postgres): un
  // confronto SQL sarebbe case-sensitive e "FT-001"/"ft-001" o un numero con
  // spazi iniziali/finali sfuggirebbero al controllo. Serve comunque un
  // filtro grezzo lato query (ilike, jolly disabilitati) per non scaricare
  // l'intera tabella fatture ad ogni salvataggio.
  async trovaDuplicato({ fornitore, numero_fattura }, escludiId) {
    if (!numero_fattura || !fornitore) return null;   // senza numero non si può parlare di duplicato
    const norm = (v) => String(v || "").trim().toLowerCase().split(" ").filter(Boolean).join(" ");
    const sb = await sbClient();
    const { data, error } = await sb.from("fatture")
      .select("id, fornitore, numero_fattura, data_fattura, importo")
      .ilike("numero_fattura", numero_fattura.trim().replace(/[%_]/g, m => '\\' + m))
      // Il limite era 20, e su una numerazione ordinaria non bastava: i
      // fornitori piccoli numerano le fatture 1, 2, 3…, quindi le righe con
      // lo stesso numero sono facilmente decine e il duplicato vero poteva
      // restare fuori dalle prime 20 (che oltretutto non erano ordinate).
      // L'avviso non compariva proprio nei casi in cui serve di più.
      .order("id", { ascending: true })
      .limit(1000);
    if (error) throw error;
    const cercato = norm(fornitore);
    return (data || []).find(f => f.id !== escludiId && norm(f.numero_fattura) === norm(numero_fattura) && norm(f.fornitore) === cercato) || null;
  },
  async remove(id) {
    const sb = await sbClient();
    const { error } = await sb.from("fatture").delete().eq("id", id);
    if (error) throw error;
  },
  // Elenco dei fornitori già usati, per l'autocompletamento nell'editor.
  // Il fornitore è un campo di testo libero (non c'è una tabella anagrafica):
  // senza un suggerimento, "Enel SpA" e "ENEL S.p.A." finiscono per essere due
  // soggetti distinti nel Report, e il totale per fornitore si spezza in due.
  // Qui si scarica la sola colonna fornitore e si raggruppa in JavaScript
  // ignorando maiuscole e spazi doppi, tenendo come etichetta la grafia più
  // usata: è quella che l'utente si ritrova proposta la volta dopo.
  async fornitoriNoti() { return nomiNoti('fatture', 'fornitore'); },
};

// Condivisa fra fatture (fornitore) e fatture attive (cliente): stessa query,
// stessa normalizzazione. Il risultato resta in cache per tutta la sessione,
// così aprire dieci editor di fila non fa dieci giri sul database.
const _cacheNomi = new Map();
export function svuotaCacheNomi() { _cacheNomi.clear(); }
export async function nomiNoti(tabella, colonna) {
  const chiave = `${tabella}.${colonna}`;
  if (_cacheNomi.has(chiave)) return _cacheNomi.get(chiave);
  const sb = await sbClient();
  const BLOCCO = 1000;
  const conteggi = new Map();   // chiave normalizzata -> Map(grafia -> quante volte)
  for (let da = 0; ; da += BLOCCO) {
    const { data, error } = await sb.from(tabella).select(`id, ${colonna}`)
      .order('id', { ascending: true }).range(da, da + BLOCCO - 1);
    if (error) throw error;
    for (const riga of data) {
      const grezzo = String(riga[colonna] || '').trim().replace(/\s+/g, ' ');
      if (!grezzo) continue;
      const norm = grezzo.toLowerCase();
      if (!conteggi.has(norm)) conteggi.set(norm, new Map());
      const grafie = conteggi.get(norm);
      grafie.set(grezzo, (grafie.get(grezzo) || 0) + 1);
    }
    if (data.length < BLOCCO) break;
  }
  const nomi = [...conteggi.values()]
    .map(grafie => [...grafie.entries()].sort((a, b) => b[1] - a[1])[0][0])   // la grafia più ricorrente
    .sort((a, b) => a.localeCompare(b, 'it'));
  _cacheNomi.set(chiave, nomi);
  return nomi;
}

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
    // proposta", es. dal pagamento rapido) chiude la proposta ancora in attesa
    // per quella fattura: senza, resterebbe bloccata e riconfermabile in
    // seguito, con un secondo pagamento duplicato come conseguenza.
    //
    // Ma solo se ce n'è UNA. L'app permette di proposito più proposte
    // pendenti sulla stessa fattura (due acconti proposti separatamente: vedi
    // contaInAttesaPerFattura, che avvisa senza bloccare), e chiuderle tutte
    // insieme faceva sparire il secondo acconto come se fosse stato pagato.
    // Con più proposte aperte non si può indovinare quale sia stata pagata:
    // restano dove sono, e l'admin decide dalla pagina "Proposte".
    const { data: pendenti } = await sb.from('proposte_pagamento')
      .select('id').eq('fattura_id', fatturaId).eq('stato', 'proposta');
    if (pendenti?.length === 1) {
      await sb.from('proposte_pagamento')
        .update({ stato: 'confermata', pagamento_id: data.id, decisa_da: u?.user?.id, decisa_da_nome: decisore?.nome || null, decisa_il: new Date().toISOString() })
        .eq('id', pendenti[0].id)
        .eq('stato', 'proposta');
    }
    return data;
  },
  async remove(id) {
    const sb = await sbClient();
    const { error } = await sb.from('pagamenti').delete().eq('id', id);
    if (error) throw error;
  },
  // Somma dei pagamenti in un intervallo di date, di QUALUNQUE fattura anche
  // se ormai archiviata (vedi fatture.listAperte/listArchivio): le statistiche
  // "Pagato questo mese/anno" della dashboard devono contare anche un
  // pagamento appena registrato su una fattura vecchia già chiusa, che non fa
  // più parte del sottoinsieme caricato di default.
  //
  //  Come list(), scorre a blocchi: PostgREST limita ogni risposta a 1000
  //  righe, quindi superati i 1000 pagamenti nel periodo la somma risultava
  //  più bassa del vero — in silenzio, senza alcun errore visibile. È lo
  //  stesso difetto già corretto per l'elenco fatture.
  async sommaPeriodo(da, a) {
    const sb = await sbClient();
    const BLOCCO = 1000;
    let totale = 0;
    for (let inizio = 0; ; inizio += BLOCCO) {
      const { data, error } = await sb.from('pagamenti').select('importo')
        .gte('data_pagamento', da).lte('data_pagamento', a)
        .order('id', { ascending: true })   // ordine stabile: senza, i blocchi possono sovrapporsi
        .range(inizio, inizio + BLOCCO - 1);
      if (error) throw error;
      totale = data.reduce((s, p) => s + Number(p.importo || 0), totale);
      if (data.length < BLOCCO) break;
    }
    return totale;
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
  // Include i pagamenti/note di credito della fattura collegata per poterne
  // calcolare il residuo (vedi withResiduo): senza, l'admin confermava una
  // proposta senza sapere se la fattura risultava già saldata da un altro
  // pagamento nel frattempo.
  async list() {
    const sb = await sbClient();
    const BLOCCO = 1000;
    const tutte = [];
    for (let da = 0; ; da += BLOCCO) {
      const { data, error } = await sb.from('proposte_pagamento')
        .select('*, fatture(fornitore, numero_fattura, importo, scadenza, stato, pagamenti(*), note_credito_righe(*))')
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })   // ordine stabile: senza, i blocchi possono sovrapporsi
        .range(da, da + BLOCCO - 1);
      if (error) throw error;
      tutte.push(...data);
      if (data.length < BLOCCO) break;
    }
    return tutte.map(r => ({ ...r, fatture: r.fatture ? withResiduo(r.fatture) : r.fatture }));
  },
  async create(fatturaId, rec, proponente) {
    const sb = await sbClient();
    const { data: u } = await sb.auth.getUser();
    const payload = { ...rec, fattura_id: fatturaId, proposta_da: u?.user?.id, proposta_da_nome: proponente?.nome || null, proposta_da_email: proponente?.email || null };
    const { data, error } = await sb.from('proposte_pagamento').insert(payload).select().single();
    if (error) throw error; return data;
  },
  // Mappa fattura_id -> n. proposte ancora in attesa, per i badge 📨 della
  // dashboard. Volutamente NON usa list(): quella porta con sé l'embed di
  // fatture(…, pagamenti(*), note_credito_righe(*)) ed era la query più
  // pesante dell'app, rieseguita ad ogni caricamento e ad ogni ricarica solo
  // per contare dei badge. Qui si scaricano due sole colonne delle sole
  // proposte ancora aperte (e si pagina, perché anche questa risposta è
  // soggetta al limite di 1000 righe di PostgREST).
  async conteggioInAttesa() {
    const sb = await sbClient();
    const BLOCCO = 1000;
    const mappa = new Map();
    for (let inizio = 0; ; inizio += BLOCCO) {
      const { data, error } = await sb.from('proposte_pagamento')
        .select('id, fattura_id').eq('stato', 'proposta')
        .order('id', { ascending: true })
        .range(inizio, inizio + BLOCCO - 1);
      if (error) throw error;
      for (const r of data) mappa.set(r.fattura_id, (mappa.get(r.fattura_id) || 0) + 1);
      if (data.length < BLOCCO) break;
    }
    return mappa;
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
