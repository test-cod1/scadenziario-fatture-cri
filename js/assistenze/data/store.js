// ============================================================
//  DATA LAYER della sezione ASSISTENZE SANITARIE
//  Preventivi + impostazioni (tariffario e testi del documento), sul
//  Supabase del portale. Le RLS lasciano leggere e scrivere solo a chi è
//  autorizzato alla sezione: qui non c'è nessun controllo di permessi da
//  ripetere, sarebbe una cortesia all'utente, non una sicurezza.
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
  // Vedi il commento gemello in js/data/store.js: PostgREST tronca ogni
  // risposta a 1000 righe, e senza paginazione l'elenco mostrava in silenzio
  // solo i primi 1000 preventivi, con le statistiche in testata (confermati,
  // valore totale) più basse del vero e nessun errore a segnalarlo.
  async list() {
    const sb = await sbClient();
    const BLOCCO = 1000;
    const tutti = [];
    for (let da = 0; ; da += BLOCCO) {
      const { data, error } = await sb.from('preventivi_assistenze').select('*')
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
    const { data, error } = await sb.from('preventivi_assistenze').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  },
  // `rec.updated_at` è la versione da cui si è partiti, non quella da
  // scrivere: se nel frattempo qualcun altro ha salvato lo stesso preventivo,
  // l'aggiornamento non trova più quella versione e si ferma. Prima vinceva
  // l'ultimo che premeva "Salva", e il lavoro dell'altro spariva senza che
  // nessuno dei due se ne accorgesse.
  async save(rec) {
    const isNew = !rec.id;
    const atteso = rec.updated_at;
    rec = { ...rec, id: rec.id || uid(), updated_at: nowISO() };
    const sb = await sbClient();

    if (isNew) {
      const { data: u } = await sb.auth.getUser();
      if (u?.user) rec.created_by = rec.created_by || u.user.id;
      const { data, error } = await sb.from('preventivi_assistenze').insert(rec).select().single();
      if (error) throw error;
      return data;
    }

    let q = sb.from('preventivi_assistenze').update(rec).eq('id', rec.id);
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
    const { error } = await sb.from('preventivi_assistenze').delete().eq('id', id);
    if (error) throw error;
  },
};

// ------------------------------------------------------------------
//  RUBRICA DEI CLIENTI
//  Una scheda per cliente, scritta quando si fa il preventivo e riusata da
//  quello dopo. I dati del cliente restano comunque COPIATI dentro ogni
//  preventivo — come i prezzi delle voci: correggere un indirizzo in rubrica
//  non deve cambiare un documento già mandato.
// ------------------------------------------------------------------
export const clienti = {
  async list() {
    const sb = await sbClient();
    const BLOCCO = 1000;
    const tutti = [];
    for (let da = 0; ; da += BLOCCO) {
      const { data, error } = await sb.from('clienti_assistenze').select('*')
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
    if (!nome) throw new Error('Il nome del cliente è obbligatorio.');
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
    const { data, error } = await sb.from('clienti_assistenze').upsert(riga).select().single();
    // L'indice unico sul nome fa fallire il secondo inserimento dello stesso
    // cliente: è la difesa vera contro i doppioni, ma il messaggio di
    // Postgres non direbbe nulla a chi sta compilando.
    if (error) {
      if (error.code === '23505') throw new Error(`"${nome}" è già in rubrica.`);
      throw error;
    }
    return data;
  },

  async remove(id) {
    const sb = await sbClient();
    const { error } = await sb.from('clienti_assistenze').delete().eq('id', id);
    if (error) throw error;
  },
};

export const impostazioni = {
  async get() {
    const sb = await sbClient();
    // L'errore va propagato, non ingoiato: senza questo controllo un problema
    // di rete o di permessi restituiva il tariffario di default — quello con
    // tutti i prezzi a zero — come se fosse la configurazione vera, e il
    // preventivo scritto in quel momento usciva con gli importi a zero.
    const { data, error } = await sb.from('impostazioni_assistenze').select('*').eq('id', 'default').maybeSingle();
    if (error) throw error;
    return mergeImpostazioni(data?.dati || null);
  },
  async save(dati) {
    const pulite = mergeImpostazioni(dati);
    const sb = await sbClient();
    const { error } = await sb.from('impostazioni_assistenze').upsert({ id: 'default', dati: pulite, updated_at: nowISO() });
    if (error) throw error;
    return pulite;
  },
};
