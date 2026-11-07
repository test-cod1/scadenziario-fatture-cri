// ============================================================
//  DATA LAYER della sezione PATENTI
//  Le richieste le crea solo il server (/api/patenti, dal modulo pubblico):
//  da qui si leggono, si cambiano stato e note, e l'admin le elimina. I
//  permessi li fanno rispettare le RLS (supabase/patch-2026-11-06-
//  patenti.sql), che non lasciano toccare i dati del volontario.
// ============================================================
const nowISO = () => new Date().toISOString();
async function sbClient() { const { getSupabase } = await import('../../lib/supabase.js'); return getSupabase(); }

const COLONNE = 'id,nome,cognome,tipo,patente,percorso,documenti_gaia,stato,note,created_at,updated_at';

// Che cosa dire quando la lettura fallisce. Ogni caso ha la sua patch: la
// tabella che manca è la 06, la colonna `tipo` che manca è la 07. Gli
// altri errori (permessi, rete) passano così come sono, invece di finire
// tutti sotto «va eseguita la patch».
export function erroreLettura(error) {
  const msg = error?.message || '';
  if (error?.code === '42P01' || error?.code === 'PGRST205') {
    return new Error('La sezione Patenti non è ancora attiva sul database: va eseguita supabase/patch-2026-11-06-patenti.sql.');
  }
  if (error?.code === '42703' && /\btipo\b/.test(msg)) {
    return new Error('Al database manca la colonna «tipo» delle richieste: va eseguita supabase/patch-2026-11-07-patenti-tipo.sql.');
  }
  return error;
}

export const richieste = {
  async list() {
    const sb = await sbClient();
    const tutti = [];
    for (let da = 0; ; da += 1000) {
      const { data, error } = await sb.from('richieste_patenti').select(COLONNE)
        .order('created_at', { ascending: false }).order('id').range(da, da + 999);
      if (error) throw erroreLettura(error);
      tutti.push(...data);
      if (data.length < 1000) return tutti;
    }
  },

  // Solo stato e note. `updated_at` della riga mostrata: se nel frattempo
  // l'ha cambiata un collega, non si sovrascrive e si avvisa.
  async aggiorna(r, modifiche) {
    const sb = await sbClient();
    const { data: { user } } = await sb.auth.getUser();
    const campi = { updated_at: nowISO(), updated_by: user?.id || null };
    if ('stato' in modifiche) campi.stato = modifiche.stato;
    if ('note' in modifiche) campi.note = String(modifiche.note || '').trim().slice(0, 2000) || null;
    const { data, error } = await sb.from('richieste_patenti').update(campi)
      .eq('id', r.id).eq('updated_at', r.updated_at).select(COLONNE).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('La richiesta è stata modificata da un collega: ricarica la pagina.');
    return data;
  },

  async remove(id) {
    const sb = await sbClient();
    const { data, error } = await sb.from('richieste_patenti').delete().eq('id', id).select('id');
    if (error) throw error;
    if (!data?.length) throw new Error('Eliminazione non consentita: solo un admin della sezione può eliminare una richiesta.');
  },
};
