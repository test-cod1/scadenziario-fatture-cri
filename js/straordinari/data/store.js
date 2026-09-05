// ============================================================
//  DATA LAYER della sezione STRAORDINARI
//  Autisti, righe di straordinario e impostazioni sul Supabase del portale.
//  Come nelle altre sezioni, i permessi li fanno rispettare le RLS: qui non
//  si ripete nessun controllo, sarebbe una cortesia all'utente e non una
//  sicurezza.
// ============================================================
import { mergeImpostazioni, nominativo } from '../calc.js';

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

// PostgREST tronca ogni risposta a 1000 righe: senza paginazione, dopo il
// primo anno di registro i totali del riepilogo sarebbero silenziosamente
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

// ------------------------------------------------------------------
//  AUTISTI
// ------------------------------------------------------------------
export const autisti = {
  async list() {
    const sb = await sbClient();
    return tutteLeRighe((da, a) => sb.from('autisti_straordinari').select('*')
      .order('cognome', { ascending: true })
      .order('nome', { ascending: true, nullsFirst: true })
      .order('id', { ascending: true })   // ordine stabile fra un blocco e l'altro
      .range(da, a));
  },

  async save(rec) {
    const sb = await sbClient();
    const cognome = (rec.cognome || '').trim();
    if (!cognome) throw new Error('Il cognome è obbligatorio.');
    const riga = {
      id: rec.id || uid(),
      cognome,
      nome: (rec.nome || '').trim() || null,
      matricola: (rec.matricola || '').trim() || null,
      telefono: (rec.telefono || '').trim() || null,
      ore_contratto: rec.ore_contratto === '' || rec.ore_contratto === null || rec.ore_contratto === undefined
        ? null : Number(rec.ore_contratto),
      attivo: rec.attivo !== false,
      note: (rec.note || '').trim() || null,
      updated_at: nowISO(),
    };
    if (!rec.id) {
      const { data: u } = await sb.auth.getUser();
      if (u?.user) riga.created_by = u.user.id;
    }
    const { data, error } = await sb.from('autisti_straordinari').upsert(riga).select().single();
    if (error) {
      // L'indice unico su cognome+nome è la difesa vera contro i doppioni (due
      // schede della stessa persona = totali mensili spezzati in due), ma il
      // messaggio di Postgres non direbbe nulla a chi sta compilando.
      if (error.code === '23505') throw new Error(`"${nominativo(riga)}" è già in elenco.`);
      throw error;
    }
    return data;
  },

  async remove(id) {
    const sb = await sbClient();
    const { error } = await sb.from('autisti_straordinari').delete().eq('id', id);
    if (error) {
      // on delete restrict: l'autista ha straordinari registrati. Cancellarlo
      // svuoterebbe il registro dei mesi passati, quindi si disattiva.
      if (error.code === '23503') {
        throw new Error('Questo autista ha straordinari registrati e non può essere eliminato: disattivalo, così sparisce dagli elenchi ma lo storico resta.');
      }
      throw error;
    }
  },
};

// ------------------------------------------------------------------
//  RIGHE DI STRAORDINARIO
// ------------------------------------------------------------------
export const straordinari = {
  // Il registro si legge un mese alla volta: è come lo si guarda (e come lo
  // si consegnava, un foglio per mese), e tiene la risposta piccola anche
  // dopo anni di righe.
  async listMese(mese) {
    const sb = await sbClient();
    const da = `${mese}-01`;
    const [y, m] = mese.split('-').map(Number);
    const al = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    return tutteLeRighe((d0, d1) => sb.from('straordinari').select('*')
      .gte('data', da).lte('data', al)
      .order('data', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(d0, d1));
  },

  // Storico di un singolo autista, per la scheda che si apre dal riepilogo.
  async listAutista(autistaId, { da, al } = {}) {
    const sb = await sbClient();
    return tutteLeRighe((d0, d1) => {
      let q = sb.from('straordinari').select('*').eq('autista_id', autistaId);
      if (da) q = q.gte('data', da);
      if (al) q = q.lte('data', al);
      return q.order('data', { ascending: false }).order('id', { ascending: true }).range(d0, d1);
    });
  },

  async get(id) {
    const sb = await sbClient();
    const { data, error } = await sb.from('straordinari').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  },

  // `rec.updated_at` è la versione da cui si è partiti, non quella da
  // scrivere: in centrale operativa il registro lo apre più di una persona,
  // e senza questo controllo vinceva l'ultimo che premeva Salva, cancellando
  // la correzione dell'altro senza che nessuno dei due lo sapesse.
  async save(rec) {
    const sb = await sbClient();
    const isNew = !rec.id;
    const atteso = rec.updated_at;
    const riga = {
      id: rec.id || uid(),
      autista_id: rec.autista_id,
      autista_nome: rec.autista_nome,
      data: rec.data,
      dalle: rec.dalle || null,
      alle: rec.alle || null,
      ore: Number(rec.ore),
      tipo: rec.tipo || 'straordinario',
      causale: (rec.causale || '').trim() || null,
      servizio: (rec.servizio || '').trim() || null,
      stato: rec.stato || 'richiesto',
      richiesto_da: rec.richiesto_da || null,
      richiesto_da_nome: rec.richiesto_da_nome || null,
      note: (rec.note || '').trim() || null,
      updated_at: nowISO(),
    };
    if (!riga.autista_id) throw new Error('Scegli l’autista.');
    if (!riga.data) throw new Error('Indica la data dello straordinario.');
    if (!Number.isFinite(riga.ore) || riga.ore <= 0) throw new Error('Le ore devono essere un numero maggiore di zero.');

    if (isNew) {
      const { data: u } = await sb.auth.getUser();
      if (u?.user) riga.created_by = u.user.id;
      const { data, error } = await sb.from('straordinari').insert(riga).select().single();
      if (error) throw error;
      return data;
    }

    let q = sb.from('straordinari').update(riga).eq('id', riga.id);
    if (atteso) q = q.eq('updated_at', atteso);
    const { data, error } = await q.select().maybeSingle();
    if (error) throw error;
    if (!data) {
      const e = new Error('La riga è stata modificata o eliminata da un altro utente: ricarica il registro.');
      e.conflitto = true;
      throw e;
    }
    return data;
  },

  // Cambio di stato: è l'operazione più frequente del registro (si conferma
  // a fine turno, si liquida a fine mese) e non passa per l'editor.
  async setStato(id, stato) {
    const sb = await sbClient();
    const { data, error } = await sb.from('straordinari')
      .update({ stato, updated_at: nowISO() }).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  // Chiusura del mese: porta a "liquidato" tutte le righe confermate del
  // periodo, che è esattamente il gesto che si fa quando il riepilogo è
  // stato mandato all'ufficio personale. Le righe ancora "richiesto" NON si
  // toccano: sono quelle da verificare, e liquidarle in blocco vorrebbe dire
  // pagare ore che nessuno ha confermato.
  async liquidaMese(mese) {
    const sb = await sbClient();
    const [y, m] = mese.split('-').map(Number);
    const al = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    const { data, error } = await sb.from('straordinari')
      .update({ stato: 'liquidato', updated_at: nowISO() })
      .eq('stato', 'confermato').gte('data', `${mese}-01`).lte('data', al)
      .select('id');
    if (error) throw error;
    return data?.length || 0;
  },

  async remove(id) {
    const sb = await sbClient();
    const { error } = await sb.from('straordinari').delete().eq('id', id);
    if (error) throw error;
  },
};

// ------------------------------------------------------------------
//  IMPOSTAZIONI (causali e soglie)
// ------------------------------------------------------------------
export const impostazioni = {
  async get() {
    const sb = await sbClient();
    // L'errore va propagato, non ingoiato: restituire le impostazioni di
    // default dopo un problema di rete significherebbe mostrare le causali
    // standard al posto di quelle configurate, senza dirlo a nessuno.
    const { data, error } = await sb.from('impostazioni_straordinari').select('*').eq('id', 'default').maybeSingle();
    if (error) throw error;
    return mergeImpostazioni(data?.dati || null);
  },
  async save(dati) {
    const pulite = mergeImpostazioni(dati);
    const sb = await sbClient();
    const { error } = await sb.from('impostazioni_straordinari')
      .upsert({ id: 'default', dati: pulite, updated_at: nowISO() });
    if (error) throw error;
    return pulite;
  },
};
