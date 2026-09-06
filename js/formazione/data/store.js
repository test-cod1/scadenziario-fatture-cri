// ============================================================
//  DATA LAYER della sezione FORMAZIONE ESTERNA
//  Preventivi, rubrica dei committenti e impostazioni (catalogo corsi e testi
//  del documento), sul Supabase del portale. Le RLS lasciano leggere e
//  scrivere solo a chi è autorizzato alla sezione: qui non c'è nessun
//  controllo di permessi da ripetere, sarebbe una cortesia all'utente, non
//  una sicurezza.
// ============================================================
import { mergeImpostazioni } from '../calc.js';

// La colonna id è un uuid: il ripiego deve produrne uno valido, altrimenti il
// salvataggio viene rifiutato dal database. crypto.randomUUID esiste solo nei
// contesti sicuri (https o localhost), getRandomValues anche altrove.
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

export const preventivi = {
  // PostgREST tronca ogni risposta a 1000 righe: senza paginazione l'elenco
  // mostrerebbe in silenzio solo i primi mille preventivi, con le statistiche
  // in testata più basse del vero e nessun errore a segnalarlo.
  async list() {
    const sb = await sbClient();
    const BLOCCO = 1000;
    const tutti = [];
    for (let da = 0; ; da += BLOCCO) {
      const { data, error } = await sb.from('preventivi_formazione').select('*')
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })   // ordine stabile: senza, i blocchi possono sovrapporsi
        .range(da, da + BLOCCO - 1);
      if (error) throw error;
      tutti.push(...data);
      if (data.length < BLOCCO) break;
    }
    return tutti;
  },
  async get(id) {
    const sb = await sbClient();
    const { data, error } = await sb.from('preventivi_formazione').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  },
  // `rec.updated_at` è la versione da cui si è partiti, non quella da
  // scrivere: se nel frattempo qualcun altro ha salvato lo stesso preventivo,
  // l'aggiornamento non trova più quella versione e si ferma, invece di
  // cancellargli il lavoro.
  async save(rec) {
    const isNew = !rec.id;
    const atteso = rec.updated_at;
    rec = { ...rec, id: rec.id || uid(), updated_at: nowISO() };
    const sb = await sbClient();

    if (isNew) {
      const { data: u } = await sb.auth.getUser();
      if (u?.user) rec.created_by = rec.created_by || u.user.id;
      const { data, error } = await sb.from('preventivi_formazione').insert(rec).select().single();
      if (error) throw error;
      return data;
    }

    let q = sb.from('preventivi_formazione').update(rec).eq('id', rec.id);
    if (atteso) q = q.eq('updated_at', atteso);
    const { data, error } = await q.select().maybeSingle();
    if (error) throw error;
    if (!data) {
      // Nessuna riga aggiornata: o il preventivo è stato cancellato, o è la
      // versione a non corrispondere più.
      const e = new Error('Il preventivo è stato modificato o eliminato da un altro utente.');
      e.conflitto = true;
      throw e;
    }
    return data;
  },
  async remove(id) {
    const sb = await sbClient();
    const { error } = await sb.from('preventivi_formazione').delete().eq('id', id);
    if (error) throw error;
  },
};

// ------------------------------------------------------------------
//  RUBRICA DEI COMMITTENTI
//  Le aziende tornano: gli aggiornamenti scadono ogni tre anni e chi ha fatto
//  il corso nel 2023 lo rifà nel 2026. La rubrica tiene i loro dati scritti
//  una volta sola.
//
//  I dati restano comunque COPIATI dentro ogni preventivo — come i prezzi dei
//  corsi: correggere un indirizzo in rubrica non deve cambiare un documento
//  già mandato.
// ------------------------------------------------------------------
export const clienti = {
  async list() {
    const sb = await sbClient();
    const BLOCCO = 1000;
    const tutti = [];
    for (let da = 0; ; da += BLOCCO) {
      const { data, error } = await sb.from('clienti_formazione').select('*')
        .order('nome', { ascending: true })
        .order('id', { ascending: true })   // ordine stabile fra un blocco e l'altro
        .range(da, da + BLOCCO - 1);
      if (error) throw error;
      tutti.push(...data);
      if (data.length < BLOCCO) break;
    }
    return tutti;
  },

  async save(rec) {
    const sb = await sbClient();
    const nome = (rec.nome || '').trim();
    if (!nome) throw new Error('Il nome del committente è obbligatorio.');
    const riga = {
      id: rec.id || uid(),
      nome,
      cf: rec.cf || null,
      indirizzo: rec.indirizzo || null,
      referente: rec.referente || null,
      referente_email: rec.referente_email || null,
      referente_telefono: rec.referente_telefono || null,
      note: rec.note || null,
      updated_at: nowISO(),
    };
    if (!rec.id) {
      const { data: u } = await sb.auth.getUser();
      if (u?.user) riga.created_by = u.user.id;
    }
    const { data, error } = await sb.from('clienti_formazione').upsert(riga).select().single();
    // L'indice unico sul nome fa fallire il secondo inserimento dello stesso
    // committente: è la difesa vera contro i doppioni, ma il messaggio di
    // Postgres non direbbe nulla a chi sta compilando.
    if (error) {
      if (error.code === '23505') throw new Error(`"${nome}" è già in rubrica.`);
      throw error;
    }
    return data;
  },

  async remove(id) {
    const sb = await sbClient();
    const { error } = await sb.from('clienti_formazione').delete().eq('id', id);
    if (error) throw error;
  },
};

export const impostazioni = {
  async get() {
    const sb = await sbClient();
    // L'errore va propagato, non ingoiato: senza questo controllo un problema
    // di rete o di permessi restituirebbe il catalogo di default — quello con
    // tutti i prezzi a zero — come se fosse la configurazione vera, e il
    // preventivo scritto in quel momento uscirebbe con gli importi a zero.
    const { data, error } = await sb.from('impostazioni_formazione').select('*').eq('id', 'default').maybeSingle();
    if (error) throw error;
    return mergeImpostazioni(data?.dati || null);
  },
  async save(dati) {
    const pulite = mergeImpostazioni(dati);
    const sb = await sbClient();
    const { error } = await sb.from('impostazioni_formazione').upsert({ id: 'default', dati: pulite, updated_at: nowISO() });
    if (error) throw error;
    return pulite;
  },
};
