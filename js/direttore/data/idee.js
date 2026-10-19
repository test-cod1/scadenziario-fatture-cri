// ============================================================
//  DATA LAYER delle IDEE del Direttore, e del collegamento Telegram.
//  Permessi e autore li decide il database (patch-2026-10-19-idee-
//  telegram.sql): qui non si ripete nessun controllo.
// ============================================================
import { impegni } from './store.js';

const nowISO = () => new Date().toISOString();
async function sbClient() { const { getSupabase } = await import('../../lib/supabase.js'); return getSupabase(); }

export const STATI_IDEA = [
  { id: 'nuova', label: 'Nuova', classe: 'liv-media' },
  { id: 'in_valutazione', label: 'In valutazione', classe: 'sca-vicino' },
  { id: 'approvata', label: 'Approvata', classe: 'ok' },
  { id: 'realizzata', label: 'Realizzata', classe: 'ok' },
  { id: 'scartata', label: 'Scartata', classe: 'liv-bassa' },
];
export const statoIdea = (id) => STATI_IDEA.find(s => s.id === id) || STATI_IDEA[0];

export const idee = {
  async list() {
    const sb = await sbClient();
    const tutti = [];
    for (let da = 0; ; da += 1000) {
      const { data, error } = await sb.from('idee_direttore').select('*')
        .order('created_at', { ascending: false }).order('id').range(da, da + 999);
      if (error) throw error;
      tutti.push(...data);
      if (data.length < 1000) return tutti;
    }
  },

  async add(testo) {
    const sb = await sbClient();
    const t = String(testo || '').trim();
    if (!t) throw new Error('Scrivi l’idea.');
    const { data, error } = await sb.from('idee_direttore').insert({ testo: t.slice(0, 4000) }).select().single();
    if (error) throw error;
    return data;
  },

  async update(id, campi) {
    const sb = await sbClient();
    const consentiti = {};
    if ('testo' in campi) consentiti.testo = String(campi.testo || '').trim().slice(0, 4000);
    if ('stato' in campi) consentiti.stato = campi.stato;
    if ('impegno_id' in campi) consentiti.impegno_id = campi.impegno_id;
    const { data, error } = await sb.from('idee_direttore').update({ ...consentiti, updated_at: nowISO() })
      .eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async remove(id) {
    const sb = await sbClient();
    const { error } = await sb.from('idee_direttore').delete().eq('id', id);
    if (error) throw error;
  },

  // L'idea diventa un impegno: titolo dalla prima riga, il testo intero nei
  // dettagli, e l'idea passa ad "approvata" con il collegamento all'impegno.
  async inImpegno(idea) {
    const prima = idea.testo.split('\n')[0].trim();
    const titolo = prima.length > 120 ? prima.slice(0, 119).trimEnd() + '…' : prima;
    const impegno = await impegni.save({
      titolo,
      dettagli: idea.testo + `\n\n— dall'idea di ${idea.autore_nome || 'un collega'} del ${new Date(idea.created_at).toLocaleDateString('it-IT')}`,
      urgenza: 'media', importanza: 'media', scadenza: null, fatto: false,
    });
    const aggiornata = await idee.update(idea.id, { stato: 'approvata', impegno_id: impegno.id });
    return { impegno, idea: aggiornata };
  },
};

export const telegram = {
  // Il proprio collegamento ({ chat_id, telegram_nome, collegato_il } o null).
  async mio() {
    const sb = await sbClient();
    const { data, error } = await sb.from('telegram_collegamenti').select('chat_id, telegram_nome, collegato_il').maybeSingle();
    if (error) throw error;
    return data?.chat_id ? data : null;
  },
  async generaCodice() {
    const sb = await sbClient();
    const { data, error } = await sb.rpc('genera_codice_telegram');
    if (error) throw error;
    return data;
  },
  async scollega(utenteId) {
    const sb = await sbClient();
    const { error } = await sb.from('telegram_collegamenti').delete().eq('utente_id', utenteId);
    if (error) throw error;
  },
  // Stato del bot sul server: { configurato, bot } (il nome utente del bot).
  async stato() {
    const { getAccessToken } = await import('../../lib/supabase.js');
    const token = await getAccessToken();
    const res = await fetch('/api/telegram-stato', { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Stato del bot non disponibile (${res.status}).`);
    return data;
  },
  // Solo il super admin: registra il webhook presso Telegram.
  async configura() {
    const { getAccessToken } = await import('../../lib/supabase.js');
    const token = await getAccessToken();
    const res = await fetch('/api/telegram-configura', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Configurazione non riuscita (${res.status}).`);
    return data;
  },
};
