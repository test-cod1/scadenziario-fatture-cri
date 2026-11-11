// ============================================================
//  DATA LAYER della sezione ANALISI
//  I centri di costo e i loro movimenti su Supabase. Come nelle altre
//  sezioni i permessi li fanno rispettare le RLS: qui non si ripete
//  nessun controllo, sarebbe una cortesia all'utente e non una sicurezza.
//
//  Analisi è staccata dallo scadenziario (patch-2026-11-11-analisi-
//  autonoma.sql): non legge le fatture e non scrive niente che le
//  riguardi. Entrate e uscite di un'attività stanno in
//  `movimenti_analisi`, scritte qui.
// ============================================================

async function sbClient() { const { getSupabase } = await import('../../lib/supabase.js'); return getSupabase(); }

const nowISO = () => new Date().toISOString();

// PostgREST tronca ogni risposta a 1000 righe: senza paginazione, dopo
// qualche anno di movimenti i totali sarebbero silenziosamente più bassi
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

  // Chiudere un'attività non cancella niente: i suoi conti restano
  // leggibili, e nell'elenco scende in fondo con il segno «conclusa».
  async chiudi(id, chiuso) {
    const sb = await sbClient();
    const { data, error } = await sb.from('centri_costo')
      .update({ chiuso, updated_at: nowISO() }).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  // Eliminare un centro porta via con sé i suoi movimenti (on delete
  // cascade). Chi chiama deve dirlo all'utente PRIMA, con il numero.
  async remove(id) {
    const sb = await sbClient();
    const { error } = await sb.from('centri_costo').delete().eq('id', id);
    if (error) throw error;
  },
};

// Da quello che arriva dal modulo alla riga da salvare. Esportata perché
// la provano i test: è qui che si decide che cosa è un movimento valido.
export function rigaMovimento(rec) {
  const testo = v => (v == null ? '' : String(v)).trim() || null;
  const riga = {
    centro_id: rec.centro_id,
    tipo: rec.tipo,
    data: rec.data || null,
    controparte: testo(rec.controparte),
    documento: testo(rec.documento),
    descrizione: testo(rec.descrizione),
    importo: Math.round(Number(rec.importo) * 100) / 100,
    note: testo(rec.note),
  };
  if (!riga.centro_id) throw new Error('Manca l’attività a cui appartiene il movimento.');
  if (riga.tipo !== 'entrata' && riga.tipo !== 'uscita') throw new Error('Scegli se è un’entrata o un’uscita.');
  if (!Number.isFinite(riga.importo) || riga.importo <= 0) throw new Error('Scrivi un importo maggiore di zero.');
  if (!riga.descrizione && !riga.controparte && !riga.documento) {
    throw new Error('Scrivi almeno una descrizione, una controparte o un documento: un importo da solo, fra un anno, non dice più niente.');
  }
  return riga;
}

export const movimenti = {
  async list() {
    const sb = await sbClient();
    return tutteLeRighe((da, a) => sb.from('movimenti_analisi').select('*')
      .order('id', { ascending: true })
      .range(da, a));
  },

  async save(rec) {
    const sb = await sbClient();
    const riga = rigaMovimento(rec);
    if (!rec.id) {
      const { data: u } = await sb.auth.getUser();
      if (u?.user) riga.created_by = u.user.id;
      const { data, error } = await sb.from('movimenti_analisi').insert(riga).select().single();
      if (error) throw error;
      return data;
    }
    riga.updated_at = nowISO();
    const { data, error } = await sb.from('movimenti_analisi').update(riga).eq('id', rec.id).select().single();
    if (error) throw error;
    return data;
  },

  async remove(id) {
    const sb = await sbClient();
    const { error } = await sb.from('movimenti_analisi').delete().eq('id', id);
    if (error) throw error;
  },
};

// Tutto quello che serve a una pagina di Analisi, in un colpo solo: le
// due letture sono indipendenti e partono insieme.
export async function caricaTutto() {
  const [elencoCentri, elencoMovimenti] = await Promise.all([centri.list(), movimenti.list()]);
  return { centri: elencoCentri, movimenti: elencoMovimenti };
}
