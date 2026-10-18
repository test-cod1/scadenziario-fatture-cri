import { el, esc, toast } from '../lib/ui.js';

// ============================================================
//  PROMEMORIA EMAIL — le scelte della persona collegata.
//  Spenti finché non li accende lei: nessuno riceve email dal portale
//  senza averlo chiesto. Si sceglie quanto spesso (ogni mattina, o il
//  lunedì), con quanto anticipo, e su cosa — fra le sole sezioni che la
//  persona vede. L'invio lo fa il server (functions/api/promemoria.js),
//  e se non c'è niente da segnalare l'email non parte.
// ============================================================

const PREDEFINITE = { attive: false, frequenza: 'settimanale', giorni_anticipo: 7, fatture_passive: true, crediti_attive: true, impegni: true };

async function sb() { const { getSupabase } = await import('../lib/supabase.js'); return getSupabase(); }

export async function renderPromemoria(view, ctx) {
  const client = await sb();
  let pref = { ...PREDEFINITE };
  let caricaErrore = null;
  try {
    const { data, error } = await client.from('notifiche_preferenze').select('*').eq('utente_id', ctx.user.id).maybeSingle();
    if (error) throw error;
    if (data) pref = { ...pref, ...data };
  } catch (e) { caricaErrore = e; }

  const casella = (id, testo, aiuto, visibile) => visibile ? `<label class="check-riga" style="display:flex;gap:10px;align-items:flex-start;margin:10px 0">
      <input type="checkbox" id="${id}" ${pref[id] ? 'checked' : ''} style="margin-top:3px">
      <span><b>${esc(testo)}</b><br><span class="hint">${esc(aiuto)}</span></span></label>` : '';

  const wrap = el(`<div>
    <div class="page-head"><div>
      <h1>Promemoria email</h1>
      <p>Un riepilogo di quello che scade, nella tua casella (${esc(ctx.user.email)}). Sono spenti finché non li accendi tu.</p>
    </div></div>
    ${caricaErrore ? `<div class="banner danger" style="margin-bottom:14px"><div class="bi">⚠️</div><div><b>Preferenze non disponibili</b><div class="small">${esc(caricaErrore.message)} — se la tabella non esiste ancora va eseguita supabase/patch-2026-10-18-promemoria.sql.</div></div></div>` : ''}
    <div class="card"><div class="card-b">
      <label style="display:flex;gap:10px;align-items:center;font-size:15px">
        <input type="checkbox" id="attive" ${pref.attive ? 'checked' : ''}>
        <b>Ricevi i promemoria via email</b>
      </label>
      <div id="dettagli" style="margin-top:14px">
        <div class="form-row">
          <div class="field"><label for="frequenza">Quando</label>
            <select id="frequenza">
              <option value="settimanale" ${pref.frequenza === 'settimanale' ? 'selected' : ''}>Il lunedì mattina</option>
              <option value="giornaliera" ${pref.frequenza === 'giornaliera' ? 'selected' : ''}>Ogni mattina</option>
            </select></div>
          <div class="field"><label for="giorni">Con quanti giorni di anticipo</label>
            <input type="number" id="giorni" min="1" max="60" step="1" value="${Number(pref.giorni_anticipo) || 7}"></div>
        </div>
        <p class="hint" style="margin:4px 0 6px">Cosa includere:</p>
        ${casella('fatture_passive', 'Fatture passive da pagare', 'Scadute o in scadenza entro i giorni di anticipo.', ctx.puoScadenziario)}
        ${casella('crediti_attive', 'Crediti da sollecitare', 'Fatture attive non ancora incassate a più di 90 giorni dall\'emissione.', ctx.puoScadenziario)}
        ${casella('impegni', 'Impegni del Direttore', 'Non ancora fatti, scaduti o in scadenza entro i giorni di anticipo.', ctx.puoDirettore)}
        <p class="hint" style="margin-top:10px">Se un giorno non c'è niente da segnalare, l'email non arriva.</p>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px">
        <button class="btn primary" id="salva">Salva</button>
        <button class="btn ghost" id="prova">✉️ Mandami una prova adesso</button>
      </div>
      <div id="esito" style="font-size:13px;margin-top:10px"></div>
    </div></div>
  </div>`);
  view.appendChild(wrap);

  const $ = (id) => wrap.querySelector('#' + id);
  const aggiornaDettagli = () => { $('dettagli').style.opacity = $('attive').checked ? '1' : '.55'; };
  $('attive').addEventListener('change', aggiornaDettagli);
  aggiornaDettagli();

  const scelte = () => ({
    attive: $('attive').checked,
    frequenza: $('frequenza').value,
    giorni_anticipo: Math.min(60, Math.max(1, Math.round(Number($('giorni').value) || 7))),
    // Una sezione che la persona non vede resta com'era: la casella non c'è.
    fatture_passive: $('fatture_passive') ? $('fatture_passive').checked : pref.fatture_passive,
    crediti_attive: $('crediti_attive') ? $('crediti_attive').checked : pref.crediti_attive,
    impegni: $('impegni') ? $('impegni').checked : pref.impegni,
  });

  $('salva').addEventListener('click', async () => {
    const btn = $('salva'); btn.disabled = true;
    const esito = $('esito'); esito.textContent = '';
    try {
      const riga = { utente_id: ctx.user.id, ...scelte(), updated_at: new Date().toISOString() };
      const { error } = await client.from('notifiche_preferenze').upsert(riga, { onConflict: 'utente_id' });
      if (error) throw error;
      pref = { ...pref, ...riga };
      toast(riga.attive ? 'Promemoria attivati' : 'Promemoria spenti', 'ok');
    } catch (e) {
      esito.style.color = 'var(--danger)';
      esito.textContent = 'Salvataggio non riuscito: ' + e.message;
    } finally { btn.disabled = false; }
  });

  $('prova').addEventListener('click', async () => {
    const btn = $('prova'); btn.disabled = true;
    const esito = $('esito'); esito.style.color = ''; esito.textContent = 'Invio in corso…';
    try {
      const { getAccessToken } = await import('../lib/supabase.js');
      const token = await getAccessToken();
      if (!token) throw new Error('Sessione non valida: ricarica la pagina e riaccedi.');
      const res = await fetch('/api/promemoria-prova', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(scelte()),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Invio non riuscito (${res.status}).`);
      esito.textContent = `Inviata a ${data.email}${data.vuoto ? ' (oggi non c\'è niente in scadenza: l\'email di prova lo dice)' : ''}.`;
    } catch (e) {
      esito.style.color = 'var(--danger)';
      esito.textContent = e.message;
    } finally { btn.disabled = false; }
  });
}
