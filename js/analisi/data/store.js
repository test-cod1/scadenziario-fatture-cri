// ============================================================
//  DATA LAYER della sezione ANALISI
//  I centri di costo e le imputazioni su Supabase. Come nelle altre
//  sezioni i permessi li fanno rispettare le RLS: qui non si ripete
//  nessun controllo, sarebbe una cortesia all'utente e non una sicurezza.
//
//  Le fatture NON si rileggono da qui: si usano `fatture.list()` e
//  `fattureAttive.list()` dello scadenziario, che sanno già paginare e
//  calcolare lo stornato. Duplicarle avrebbe voluto dire mantenere due
//  volte lo stesso conto e vederlo divergere alla prima nota di credito.
// ============================================================
import { fatture } from '../../data/store.js';
import { fattureAttive } from '../../data/storeAttive.js';

async function sbClient() { const { getSupabase } = await import('../../lib/supabase.js'); return getSupabase(); }

const nowISO = () => new Date().toISOString();

// PostgREST tronca ogni risposta a 1000 righe: senza paginazione, dopo
// qualche anno di imputazioni i totali sarebbero silenziosamente più bassi
// del vero (vedi il commento gemello in js/data/store.js).
async function tutteLeRighe(query) {
  const BLOCCO = 1000;
  const tutti = [];
  for (let da = 0; ; da += BLOCCO) {
    const { data, error } = await query(da, da + BLOCCO - 1);
    if (error) throw error;
    tutti.push(...data);
    if (data.length < BLOCCO) break;
  }
  return tutti;
}

export const centri = {
  async list() {
    const sb = await sbClient();
    return tutteLeRighe((da, a) => sb.from('centri_costo').select('*')
      .order('chiuso', { ascending: true })
      .order('nome', { ascending: true })
      .range(da, a));
  },

  async save(rec) {
    const sb = await sbClient();
    const riga = {
      nome: (rec.nome || '').trim(),
      descrizione: (rec.descrizione || '').trim() || null,
      inizio: rec.inizio || null,
      fine: rec.fine || null,
      chiuso: !!rec.chiuso,
      updated_at: nowISO(),
    };
    if (!riga.nome) throw new Error('Dai un nome all’attività.');
    if (riga.inizio && riga.fine && riga.fine < riga.inizio) {
      throw new Error('La fine dell’attività viene prima del suo inizio.');
    }

    if (!rec.id) {
      const { data: u } = await sb.auth.getUser();
      if (u?.user) riga.created_by = u.user.id;
      const { data, error } = await sb.from('centri_costo').insert(riga).select().single();
      if (error) throw error;
      return data;
    }
    const { data, error } = await sb.from('centri_costo').update(riga).eq('id', rec.id).select().single();
    if (error) throw error;
    return data;
  },

  // Chiudere un'attività non cancella niente: la toglie dalle tendine di
  // chi registra una fattura nuova, e i suoi conti restano leggibili.
  async chiudi(id, chiuso) {
    const sb = await sbClient();
    const { data, error } = await sb.from('centri_costo')
      .update({ chiuso, updated_at: nowISO() }).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  // Eliminare un centro porta via con sé le sue imputazioni (on delete
  // cascade): le fatture restano tutte, tornano solo a non essere
  // attribuite. Chi chiama deve dirlo all'utente PRIMA, con il numero.
  async remove(id) {
    const sb = await sbClient();
    const { error } = await sb.from('centri_costo').delete().eq('id', id);
    if (error) throw error;
  },
};

export const imputazioni = {
  async list() {
    const sb = await sbClient();
    return tutteLeRighe((da, a) => sb.from('imputazioni')
      .select('id, centro_id, fattura_id, fattura_attiva_id, importo, note')
      .order('id', { ascending: true })
      .range(da, a));
  },

  // Le quote di una singola fattura: è quello che serve al blocco dentro
  // la scheda della fattura, che non ha nessun motivo di scaricare tutto.
  async perFattura(fatturaId, attiva) {
    const sb = await sbClient();
    const { data, error } = await sb.from('imputazioni')
      .select('id, centro_id, fattura_id, fattura_attiva_id, importo, note')
      .eq(attiva ? 'fattura_attiva_id' : 'fattura_id', fatturaId);
    if (error) throw error;
    return data;
  },

  async add({ centroId, fatturaId, attiva, importo, note }) {
    const sb = await sbClient();
    const { data: u } = await sb.auth.getUser();
    const riga = {
      centro_id: centroId,
      fattura_id: attiva ? null : fatturaId,
      fattura_attiva_id: attiva ? fatturaId : null,
      importo,
      note: (note || '').trim() || null,
      created_by: u?.user?.id || null,
    };
    const { data, error } = await sb.from('imputazioni').insert(riga).select().single();
    if (error) throw vestiErrore(error);
    return data;
  },

  async setImporto(id, importo) {
    const sb = await sbClient();
    const { data, error } = await sb.from('imputazioni').update({ importo }).eq('id', id).select().single();
    if (error) throw vestiErrore(error);
    return data;
  },

  async remove(id) {
    const sb = await sbClient();
    const { error } = await sb.from('imputazioni').delete().eq('id', id);
    if (error) throw error;
  },
};

// Gli errori del database parlano la loro lingua. Due qui capitano
// davvero, e detti così com'escono non si capiscono:
//  - il trigger che impedisce di sforare l'importo della fattura manda già
//    un messaggio scritto per essere letto: si passa quello e basta;
//  - l'indice unico scatta quando si attribuisce due volte la stessa
//    fattura allo stesso centro, cioè quando due schede aperte insieme
//    fanno lo stesso lavoro.
function vestiErrore(error) {
  const m = String(error?.message || '');
  // Il messaggio del trigger arriva già scritto per essere letto e si passa
  // intero. Prima se ne tagliava la parte fino al primo «:» per togliere un
  // prefisso tecnico che non c'è mai stato: siccome nel messaggio i due
  // punti cadono dopo «…e la fattura è di 1000,00 €», all'utente restava
  // solo la coda della frase, senza le due cifre che servivano a capirla.
  if (/quote attribuite/i.test(m)) return new Error(m);
  if (error?.code === '23505') {
    return new Error('Questa fattura è già attribuita a questo centro: correggi la quota che c’è invece di aggiungerne una seconda.');
  }
  return error;
}

// Tutto quello che serve a una pagina di Analisi, in un colpo solo. Le
// quattro letture partono insieme: sono indipendenti, e in fila avrebbero
// sommato quattro attese di rete per mostrare una pagina sola.
export async function caricaTutto() {
  const [elencoCentri, elencoImputazioni, passive, attive] = await Promise.all([
    centri.list(), imputazioni.list(), fatture.list(), fattureAttive.list(),
  ]);
  return { centri: elencoCentri, imputazioni: elencoImputazioni, passive, attive };
}
