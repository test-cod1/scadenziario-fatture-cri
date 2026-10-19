// ============================================================
//  DATA LAYER della sezione SCADENZE
//  I permessi li fanno rispettare le RLS (supabase/patch-2026-10-19-
//  scadenze.sql): qui non si ripete nessun controllo. L'autore lo scrive
//  il database, non questo file.
// ============================================================
import { successiva } from '../calc.js';

const nowISO = () => new Date().toISOString();
async function sbClient() { const { getSupabase } = await import('../../lib/supabase.js'); return getSupabase(); }

// PostgREST tronca ogni risposta a 1000 righe: si legge a blocchi.
async function tutteLeRighe(query) {
  const tutti = [];
  for (let da = 0; ; da += 1000) {
    const { data, error } = await query(da, da + 999);
    if (error) throw error;
    tutti.push(...data);
    if (data.length < 1000) return tutti;
  }
}

// Solo le colonne che la pagina può scrivere: id, autore e date di
// sistema non partono mai dal browser.
function riga(rec) {
  const importo = rec.importo === '' || rec.importo == null ? null : Number(rec.importo);
  return {
    titolo: String(rec.titolo || '').trim(),
    categoria: String(rec.categoria || '').trim() || 'Altro',
    data_scadenza: rec.data_scadenza,
    ricorrenza: rec.ricorrenza || 'nessuna',
    preavviso_giorni: Math.min(365, Math.max(0, Math.round(Number(rec.preavviso_giorni) || 0))),
    riferimento: String(rec.riferimento || '').trim() || null,
    responsabile: String(rec.responsabile || '').trim() || null,
    importo: Number.isFinite(importo) ? importo : null,
    note: String(rec.note || '').trim() || null,
    fatta: !!rec.fatta,
    fatta_il: rec.fatta ? (rec.fatta_il || nowISO()) : null,
    precedente_id: rec.precedente_id || null,
  };
}

export const scadenze = {
  async list() {
    const sb = await sbClient();
    return tutteLeRighe((da, a) => sb.from('scadenze').select('*')
      .order('data_scadenza', { ascending: true }).order('id', { ascending: true }).range(da, a));
  },

  async get(id) {
    const sb = await sbClient();
    const { data, error } = await sb.from('scadenze').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  },

  // `updated_at` della riga aperta: se nel frattempo l'ha cambiata un
  // collega, l'aggiornamento non trova nulla e si avvisa invece di
  // sovrascrivere (come negli impegni e nelle fatture).
  async save(rec) {
    const sb = await sbClient();
    const r = riga(rec);
    if (!r.titolo) throw new Error('Scrivi che cosa scade.');
    if (!r.data_scadenza) throw new Error('Indica la data di scadenza.');
    if (!rec.id) {
      const { data, error } = await sb.from('scadenze').insert(r).select().single();
      if (error) throw error;
      return data;
    }
    let q = sb.from('scadenze').update({ ...r, updated_at: nowISO() }).eq('id', rec.id);
    if (rec.updated_at) q = q.eq('updated_at', rec.updated_at);
    const { data, error } = await q.select().maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('La scadenza è stata modificata o eliminata da un altro utente: ricarica la pagina.');
    return data;
  },

  // Segna fatta (o da fare). Per una ricorrente segnata fatta nasce anche
  // la successiva; ritorna { aggiornata, nuova } così l'elenco si aggiorna
  // e il pulsante "Annulla" sa cosa togliere.
  async segna(s, fatta) {
    const sb = await sbClient();
    const { data: aggiornata, error } = await sb.from('scadenze')
      .update({ fatta, fatta_il: fatta ? nowISO() : null, updated_at: nowISO() })
      .eq('id', s.id).select().single();
    if (error) throw error;
    let nuova = null;
    if (fatta) {
      const prossima = successiva(aggiornata);
      if (prossima) {
        // Una successiva già nata (fatta → annullata → rifatta) non si duplica.
        const { data: gia } = await sb.from('scadenze').select('*').eq('precedente_id', s.id).limit(1);
        if (gia?.length) nuova = gia[0];
        else {
          const { data, error: e2 } = await sb.from('scadenze').insert(riga(prossima)).select().single();
          if (e2) throw e2;
          nuova = data;
        }
      }
    }
    return { aggiornata, nuova };
  },

  async remove(id) {
    const sb = await sbClient();
    const { data, error } = await sb.from('scadenze').delete().eq('id', id).select('id');
    if (error) throw error;
    if (!data?.length) throw new Error('Eliminazione non consentita: solo un admin della sezione può eliminare una scadenza.');
  },
};
