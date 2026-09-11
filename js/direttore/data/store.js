// ============================================================
//  DATA LAYER della sezione DIRETTORE
//  Gli impegni sul Supabase del portale. Come nelle altre sezioni i
//  permessi li fanno rispettare le RLS: qui non si ripete nessun
//  controllo, sarebbe una cortesia all'utente e non una sicurezza.
// ============================================================

function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;   // versione 4
  b[8] = (b[8] & 0x3f) | 0x80;   // variante
  const hex = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
const nowISO = () => new Date().toISOString();

async function sbClient() { const { getSupabase } = await import('../../lib/supabase.js'); return getSupabase(); }

// PostgREST tronca ogni risposta a 1000 righe: senza paginazione, dopo
// qualche anno di archivio i conteggi in testata sarebbero silenziosamente
// più bassi del vero (vedi il commento gemello in js/data/store.js).
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

export const impegni = {
  // Si legge tutto e si ordina nel browser: l'ordine dipende da un
  // punteggio che mescola urgenza, importanza e giorni mancanti alla
  // scadenza (js/direttore/calc.js), e quel conto cambia ogni giorno da
  // solo. Farlo fare al database vorrebbe dire scriverlo due volte, in due
  // linguaggi, e vederli divergere alla prima modifica.
  async list() {
    const sb = await sbClient();
    return tutteLeRighe((da, a) => sb.from('impegni_direttore').select('*')
      .order('created_at', { ascending: false })
      .range(da, a));
  },

  async get(id) {
    const sb = await sbClient();
    const { data, error } = await sb.from('impegni_direttore').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  },

  // `atteso` è l'updated_at che aveva la riga quando è stata aperta: se nel
  // frattempo l'ha toccata qualcun altro l'aggiornamento non trova nulla da
  // aggiornare e si avvisa, invece di sovrascrivere in silenzio il lavoro
  // del collega. Stessa guardia delle fatture e degli straordinari.
  async save(rec) {
    const sb = await sbClient();
    const isNew = !rec.id;
    const atteso = rec.updated_at;
    const riga = {
      id: rec.id || uid(),
      titolo: (rec.titolo || '').trim(),
      dettagli: (rec.dettagli || '').trim() || null,
      urgenza: rec.urgenza || 'media',
      importanza: rec.importanza || 'media',
      scadenza: rec.scadenza || null,
      fatto: !!rec.fatto,
      fatto_il: rec.fatto ? (rec.fatto_il || nowISO()) : null,
      updated_at: nowISO(),
    };
    if (!riga.titolo) throw new Error('Scrivi che cosa c’è da fare.');

    if (isNew) {
      const { data: u } = await sb.auth.getUser();
      if (u?.user) riga.created_by = u.user.id;
      const { data, error } = await sb.from('impegni_direttore').insert(riga).select().single();
      if (error) throw error;
      return data;
    }

    let q = sb.from('impegni_direttore').update(riga).eq('id', riga.id);
    if (atteso) q = q.eq('updated_at', atteso);
    const { data, error } = await q.select().maybeSingle();
    if (error) throw error;
    if (!data) {
      const e = new Error('L’impegno è stato modificato o eliminato da un altro utente: ricarica l’elenco.');
      e.conflitto = true;
      throw e;
    }
    return data;
  },

  // Spuntare o togliere la spunta è l'operazione più frequente e non deve
  // passare dalla scheda: si fa dall'elenco, con un clic.
  async segna(id, fatto) {
    const sb = await sbClient();
    const { data, error } = await sb.from('impegni_direttore')
      .update({ fatto, fatto_il: fatto ? nowISO() : null, updated_at: nowISO() })
      .eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async remove(id) {
    const sb = await sbClient();
    const { error } = await sb.from('impegni_direttore').delete().eq('id', id);
    if (error) throw error;
  },
};
