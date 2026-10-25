// ============================================================
//  DATA LAYER — Fatture ATTIVE (emesse ai clienti): tabelle indipendenti
//  da quelle delle fatture fornitori (vedi store.js). Stessa forma di
//  quel file, adattata al lessico "cliente/incasso" invece di
//  "fornitore/pagamento".
// ============================================================
import { residuoFattura } from '../lib/numeri.js';

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
  // Vedi il commento gemello in store.js: sottoinsieme "attivo" per la
  // dashboard (anno corrente + fatture ancora aperte di anni precedenti),
  // per non scaricare ad ogni apertura anni di fatture ormai incassate.
  async listAperte() {
    const sb = await sbClient();
    const inizioAnno = `${new Date().getFullYear()}-01-01`;
    const BLOCCO = 1000;
    const tutte = [];
    for (let da = 0; ; da += BLOCCO) {
      const { data, error } = await sb.from("fatture_attive")
        .select("*, incassi(*), note_credito_attive_righe(*, note_credito_attive(numero, data, note))")
        .or(`data_fattura.gte.${inizioAnno},data_fattura.is.null,stato.in.(da_incassare,incassata_parziale)`)
        .order("data_fattura", { ascending: true, nullsFirst: false })
        .order("id", { ascending: true })
        .range(da, da + BLOCCO - 1);
      if (error) throw error;
      tutte.push(...data);
      if (data.length < BLOCCO) break;
    }
    return tutte.map(withResiduo);
  },
  // Il complementare di listAperte(): fatture chiuse (incassata/stornata) di
  // anni precedenti, caricate solo quando si apre l'archivio in dashboard.
  async listArchivio() {
    const sb = await sbClient();
    const inizioAnno = `${new Date().getFullYear()}-01-01`;
    const BLOCCO = 1000;
    const tutte = [];
    for (let da = 0; ; da += BLOCCO) {
      const { data, error } = await sb.from("fatture_attive")
        .select("*, incassi(*), note_credito_attive_righe(*, note_credito_attive(numero, data, note))")
        .lt("data_fattura", inizioAnno)
        .in("stato", ["incassata", "stornata"])
        .order("data_fattura", { ascending: false })
        .order("id", { ascending: true })   // ordine stabile: senza, i blocchi possono sovrapporsi
        .range(da, da + BLOCCO - 1);
      if (error) throw error;
      tutte.push(...data);
      if (data.length < BLOCCO) break;
    }
    return tutte.map(withResiduo);
  },
  // Conteggio leggero (nessuna riga scaricata) da mostrare accanto al menu a
  // scomparsa anche prima di aprirlo.
  async contaArchivio() {
    const sb = await sbClient();
    const inizioAnno = `${new Date().getFullYear()}-01-01`;
    const { count, error } = await sb.from('fatture_attive').select('id', { count: 'exact', head: true })
      .lt('data_fattura', inizioAnno).in('stato', ['incassata', 'stornata']);
    if (error) throw error;
    return count || 0;
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
  // Il soggetto si riconosce dalla partita IVA quando c'è su entrambe le
  // fatture, altrimenti dal nome (come in store.js).
  async trovaDuplicato({ cliente, numero_fattura, partita_iva }, escludiId) {
    if (!numero_fattura || !cliente) return null;
    const norm = (v) => String(v || "").trim().toLowerCase().split(" ").filter(Boolean).join(" ");
    const sb = await sbClient();
    const { data, error } = await sb.from("fatture_attive")
      .select("id, cliente, partita_iva, numero_fattura, data_fattura, importo")
      .ilike("numero_fattura", numero_fattura.trim().replace(/[%_]/g, m => '\\' + m))
      // Vedi il commento gemello in store.js: con .limit(20) il duplicato vero
      // poteva restare fuori dalle righe scaricate e l'avviso non compariva.
      .order("id", { ascending: true })
      .limit(1000);
    if (error) throw error;
    const cercato = norm(cliente);
    const stessoSoggetto = (f) => (partita_iva && f.partita_iva) ? f.partita_iva === partita_iva : norm(f.cliente) === cercato;
    return (data || []).find(f => f.id !== escludiId && norm(f.numero_fattura) === norm(numero_fattura) && stessoSoggetto(f)) || null;
  },
  async remove(id) {
    const sb = await sbClient();
    const { error } = await sb.from("fatture_attive").delete().eq("id", id);
    if (error) throw error;
  },
  // Elenco dei clienti già usati, per l'autocompletamento nell'editor: vedi
  // il commento gemello su fatture.fornitoriNoti() in store.js.
  async clientiNoti() {
    const { nomiNoti } = await import('./store.js');
    return nomiNoti('fatture_attive', 'cliente');
  },
  // Riscrive il nome del cliente su TUTTE le fatture che portano una certa
  // grafia: è il gesto della pagina «Clienti», che unifica le grafie doppie
  // dello stesso ente.
  //
  // Il confronto è esatto (.eq) e non normalizzato: chi chiama passa le
  // grafie una per una, così quello che si sta per cambiare è esattamente
  // quello che l'utente ha visto in elenco. Una .ilike o un confronto
  // "a meno di maiuscole" lato database avrebbe potuto prendere anche righe
  // che in quell'elenco non c'erano.
  //
  // Non serve nessuna cautela per l'audit: il trigger on_fatture_attive_log
  // scrive una riga per ogni fattura toccata, con il prima e il dopo. È
  // quello che rende l'operazione rimediabile, ed è anche il motivo per cui
  // si rinomina una grafia alla volta e non tutte insieme.
  async rinominaCliente(vecchio, nuovo) {
    const nome = String(nuovo || '').trim();
    if (!nome) throw new Error('Il nome del cliente non può restare vuoto.');
    if (nome === vecchio) return [];
    const sb = await sbClient();
    const q = sb.from('fatture_attive')
      .update({ cliente: nome, updated_at: new Date().toISOString() });
    // Il cliente mai scritto è NULL, e `cliente = NULL` in SQL non è vero
    // per nessuna riga: quelle fatture si prendono solo con IS NULL.
    const { data, error } = await (vecchio === null || vecchio === undefined
      ? q.is('cliente', null)
      : q.eq('cliente', vecchio))
      .select('id');
    if (error) throw error;
    return data || [];
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
  // In centesimi interi: vedi residuoFattura in js/lib/numeri.js.
  const { versato, stornato, residuo } = residuoFattura(f.importo, f.incassi || [], f.note_credito_attive_righe || []);
  return { ...f, _incassato: versato, _stornato: stornato, _residuo: residuo };
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
  // Vedi il commento gemello in store.js: somma degli incassi in un
  // intervallo di date, di qualunque fattura anche se ormai archiviata.
  //  Scorre a blocchi come list(): senza, PostgREST tronca a 1000 righe e la
  //  somma risultava più bassa del vero senza alcun errore visibile.
  // Somma fatta dal database quando c'è somma_incassi, altrimenti qui:
  // vedi il commento gemello in store.js (pagamenti.sommaPeriodo).
  async sommaPeriodo(da, a) {
    const sb = await sbClient();
    const { data: somma, error: errRpc } = await sb.rpc('somma_incassi', { p_da: da, p_a: a });
    if (!errRpc) return Number(somma) || 0;
    if (errRpc.code !== 'PGRST202') throw errRpc;
    const BLOCCO = 1000;
    let centesimi = 0;
    for (let inizio = 0; ; inizio += BLOCCO) {
      const { data, error } = await sb.from('incassi').select('importo')
        .gte('data_incasso', da).lte('data_incasso', a)
        .order('id', { ascending: true })   // ordine stabile: senza, i blocchi possono sovrapporsi
        .range(inizio, inizio + BLOCCO - 1);
      if (error) throw error;
      centesimi = data.reduce((s, p) => s + Math.round(Number(p.importo || 0) * 100), centesimi);
      if (data.length < BLOCCO) break;
    }
    return centesimi / 100;
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
