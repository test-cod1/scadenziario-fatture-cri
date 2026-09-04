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
//  ANAGRAFICA DEI CLIENTI
//  Non è una tabella: sono i destinatari dei preventivi già fatti. Le
//  manifestazioni si ripetono e i clienti sono quasi sempre gli stessi, così
//  il secondo preventivo per lo stesso ente non si ricompila a mano — e non
//  c'è un'anagrafica in più da tenere aggiornata, che è il modo tipico in cui
//  questi elenchi invecchiano.
// ------------------------------------------------------------------
export const clienti = {
  async elenco() {
    const sb = await sbClient();
    // Si scorre a blocchi come le altre letture del portale: il vecchio
    // .limit(1000) tagliava fuori i clienti più datati appena l'archivio
    // superava quella soglia, e il completamento smetteva di proporli senza
    // che si potesse capire perché.
    const BLOCCO = 1000;
    const righe = [];
    for (let da = 0; ; da += BLOCCO) {
      const { data, error } = await sb.from('preventivi_assistenze')
        .select('cliente,cliente_cf,cliente_indirizzo,referente,referente_email,referente_telefono,data_documento')
        .not('cliente', 'is', null)
        .order('data_documento', { ascending: false, nullsFirst: false })
        .order('id', { ascending: true })   // ordine stabile: senza, i blocchi possono sovrapporsi
        .range(da, da + BLOCCO - 1);
      if (error) throw error;
      righe.push(...data);
      if (data.length < BLOCCO) break;
    }

    // Un cliente per nome, con i dati del preventivo più recente: se
    // l'indirizzo è cambiato, quello vecchio non deve tornare a galla.
    const visti = new Map();
    for (const r of righe) {
      const nome = (r.cliente || '').trim();
      if (!nome) continue;
      const chiave = nome.toLowerCase();
      if (visti.has(chiave)) continue;
      visti.set(chiave, {
        cliente: nome,
        cliente_cf: r.cliente_cf || '',
        cliente_indirizzo: r.cliente_indirizzo || '',
        referente: r.referente || '',
        referente_email: r.referente_email || '',
        referente_telefono: r.referente_telefono || '',
      });
    }
    return [...visti.values()];
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
