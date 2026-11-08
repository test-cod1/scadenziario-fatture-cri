// ============================================================
//  IL LINK DEI DATI DI FATTURAZIONE, DAL LATO DEL PORTALE
//  Il riquadro che sta negli editor dei preventivi (formazione, assistenze):
//  crea il link da mandare al cliente, lo mostra da copiare, dice se il
//  cliente ha risposto e riporta i dati ricevuti nel destinatario del
//  preventivo. Il modulo che il cliente vede è dati-fatturazione.html, le
//  regole dei campi stanno in datiFatturazione.mjs.
//
//  Il link compare anche nel documento (PDF e Word), in fondo prima dei
//  saluti, così il cliente lo trova nel preventivo che riceve senza bisogno
//  di una mail a parte: l'editor lo passa al documento in prev._linkFatturazione.
// ============================================================
import { el, esc, toast, confirmDialog, fmtDateTime } from './ui.js';
import { nuovoToken, riassunto, TIPI } from './datiFatturazione.mjs';

async function sb() { const { getSupabase } = await import('./supabase.js'); return getSupabase(); }

const SCADENZA_GIORNI = 120;
const scadenza = () => new Date(Date.now() + SCADENZA_GIORNI * 86400000).toISOString();

export function urlDi(token) {
  return `${location.origin}/dati-fatturazione.html#${token}`;
}

// La tabella non c'è finché non si esegue la patch: lo si dice con parole
// che spiegano cosa fare, come per il registro dei corsi.
function spiega(error) {
  if (error?.code === '42P01' || error?.code === 'PGRST205') {
    const e = new Error('Il link per i dati di fatturazione non è ancora attivo: va eseguita supabase/patch-2026-11-02-dati-fatturazione.sql nel database.');
    e.tabellaMancante = true;
    return e;
  }
  return error;
}

export const linkFatturazione = {
  async perPreventivo(sezione, preventivoId) {
    const c = await sb();
    const { data, error } = await c.from('dati_fatturazione').select('*')
      .eq('sezione', sezione).eq('preventivo_id', preventivoId).maybeSingle();
    if (error) throw spiega(error);
    return data;
  },
  // Tutti i link di una sezione, senza i dati: all'elenco dei preventivi
  // servono solo per sapere chi ha risposto e per stampare il link.
  async elenco(sezione) {
    const c = await sb();
    const { data, error } = await c.from('dati_fatturazione')
      .select('preventivo_id,token,inviato_il,acquisiti_il,revocato,scade_il').eq('sezione', sezione);
    if (error) throw spiega(error);
    return data;
  },
  async crea(sezione, preventivoId) {
    const c = await sb();
    const { data: u } = await c.auth.getUser();
    const { data, error } = await c.from('dati_fatturazione').insert({
      sezione, preventivo_id: preventivoId, token: nuovoToken(), scade_il: scadenza(), created_by: u?.user?.id || null,
    }).select().single();
    if (error) throw spiega(error);
    return data;
  },
  // Un codice nuovo: il link vecchio smette di funzionare. Serve se il link
  // è finito alla persona sbagliata, o se è scaduto. I dati già ricevuti
  // restano.
  async rigenera(riga) {
    const c = await sb();
    const { data, error } = await c.from('dati_fatturazione')
      .update({ token: nuovoToken(), scade_il: scadenza(), revocato: false, invii: 0, updated_at: new Date().toISOString() })
      .eq('id', riga.id).select().single();
    if (error) throw spiega(error);
    return data;
  },
  async segnaAcquisiti(riga) {
    const c = await sb();
    const { data, error } = await c.from('dati_fatturazione')
      .update({ acquisiti_il: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', riga.id).select().single();
    if (error) throw spiega(error);
    return data;
  },
};

// Il valido-adesso di un link: non revocato e non scaduto.
export const linkValido = (r) => !!r && !r.revocato && new Date(r.scade_il) > new Date();

// I dati del cliente nella forma del destinatario del preventivo: tre campi
// (nome, «C.F. / P.IVA», indirizzo su una riga).
export function perDestinatario(d) {
  return {
    cliente: d.ragione_sociale || '',
    cliente_cf: d.partita_iva || d.codice_fiscale || '',
    cliente_indirizzo: [d.indirizzo, [d.cap, d.comune, d.provincia ? `(${d.provincia})` : ''].filter(Boolean).join(' ')].filter(Boolean).join(', '),
  };
}

// ------------------------------------------------------------------
//  IL RIQUADRO NELL'EDITOR
//  `prev` è il preventivo che l'editor sta modificando; `onLink(url)` dice
//  all'editor quale link mettere nel documento (null = nessuno);
//  `onUsa(dati)` riporta i dati ricevuti nel destinatario.
// ------------------------------------------------------------------
export function cardDatiFatturazione({ sezione, prev, numero, onLink, onUsa }) {
  const card = el(`<div class="card">
    <div class="card-h"><span>${numero ? `<span class="passo-num">${numero}</span>` : ''}Dati di fatturazione del cliente</span></div>
    <div class="card-b"><div class="df-corpo"><span class="spinner sm"></span></div></div></div>`);
  const corpo = card.querySelector('.df-corpo');
  let riga = null;

  async function carica() {
    if (!prev.id) {
      corpo.innerHTML = `<p class="hint" style="margin:0">Salva il preventivo: poi potrai creare il link da mandare al cliente, dove compila da sé i dati per la fattura (ragione sociale, P.IVA, codice destinatario o PEC).</p>`;
      onLink(null);
      return;
    }
    try { riga = await linkFatturazione.perPreventivo(sezione, prev.id); }
    catch (e) {
      corpo.innerHTML = `<div class="banner ${e.tabellaMancante ? 'warn' : 'danger'}" style="margin:0"><div class="bi">⚠️</div><div class="small">${esc(e.message)}</div></div>`;
      onLink(null);
      return;
    }
    disegna();
  }

  function disegna() {
    if (!riga) {
      onLink(null);
      corpo.innerHTML = `<p class="hint" style="margin:0 0 12px">Crea un link da mandare al cliente: apre un modulo dove scrive da sé i dati per la fattura elettronica. Il link compare anche nel preventivo (PDF e Word), prima dei saluti.</p>
        <button class="btn" type="button" data-crea>🔗 Crea il link per il cliente</button>`;
      corpo.querySelector('[data-crea]').addEventListener('click', async (e) => {
        e.target.disabled = true;
        try { riga = await linkFatturazione.crea(sezione, prev.id); toast('Link creato: ora compare anche nel documento', 'ok'); }
        catch (err) { toast('Link non creato: ' + err.message, 'err'); e.target.disabled = false; return; }
        disegna();
      });
      return;
    }

    const valido = linkValido(riga);
    const url = urlDi(riga.token);
    onLink(valido ? url : null);
    const ricevuti = !!riga.inviato_il;
    const daGuardare = ricevuti && (!riga.acquisiti_il || riga.inviato_il > riga.acquisiti_il);
    const d = riga.dati;
    corpo.innerHTML = `
      <div class="df-link">
        <input type="text" readonly value="${esc(url)}" aria-label="Link per il cliente">
        <button class="btn sm" type="button" data-copia>📋 Copia</button>
        <a class="btn sm" href="${esc(url)}" target="_blank" rel="noopener">Apri</a>
        <button class="btn ghost sm" type="button" data-rigenera title="Crea un codice nuovo: il link attuale smette di funzionare">↻ Nuovo link</button>
      </div>
      <div class="mini" style="margin-top:6px">${valido
        ? `Valido fino al ${esc(fmtDateTime(riga.scade_il).split(' ')[0])}.`
        : '<span class="avviso-zero">Link scaduto o revocato: creane uno nuovo prima di mandarlo.</span>'}</div>
      ${ricevuti ? `
        <div class="banner ${daGuardare ? 'warn' : 'ok'}" style="margin:14px 0 0"><div class="bi">${daGuardare ? '📩' : '✓'}</div><div>
          <b>${daGuardare ? (riga.acquisiti_il ? 'Il cliente ha corretto i dati' : 'Il cliente ha mandato i dati') : 'Dati riportati nel preventivo'}</b>
          <div class="small">Ricevuti il ${esc(fmtDateTime(riga.inviato_il))}${riga.acquisiti_il ? ` · riportati il ${esc(fmtDateTime(riga.acquisiti_il))}` : ''}</div>
        </div></div>
        <dl class="df-dati">
          <dt>Tipo</dt><dd>${esc((TIPI.find(([t]) => t === d.tipo) || [])[1] || '—')}</dd>
          <dt>Intestatario</dt><dd>${esc(riassunto(d))}</dd>
          ${d.email_amministrazione || d.referente || d.telefono ? `<dt>Contatti</dt><dd>${esc([d.referente, d.email_amministrazione, d.telefono].filter(Boolean).join(' · '))}</dd>` : ''}
          ${d.tipo === 'ente_pubblico' ? `<dt>PA</dt><dd>${esc([d.cig ? `CIG ${d.cig}` : '', d.cup ? `CUP ${d.cup}` : '', d.split_payment ? 'split payment' : '', d.riferimento_ordine].filter(Boolean).join(' · ') || '—')}</dd>` : ''}
          ${d.note ? `<dt>Note</dt><dd>${esc(d.note)}</dd>` : ''}
        </dl>
        <div style="margin-top:10px"><button class="btn sm ${daGuardare ? 'primary' : ''}" type="button" data-usa>⬆ Riporta nel destinatario</button></div>`
        : '<p class="mini" style="margin:12px 0 0">⏳ Il cliente non ha ancora mandato i dati.</p>'}`;

    corpo.querySelector('[data-copia]').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(url); toast('Link copiato', 'ok'); }
      catch { corpo.querySelector('input').select(); toast('Seleziona il link e copialo con Ctrl+C', 'warn'); }
    });
    corpo.querySelector('[data-rigenera]').addEventListener('click', async () => {
      if (!await confirmDialog('Creare un link nuovo? Quello attuale smetterà di funzionare: se l\'hai già mandato al cliente, dovrai mandargli quello nuovo.', { okLabel: 'Crea link nuovo' })) return;
      try { riga = await linkFatturazione.rigenera(riga); toast('Link nuovo creato', 'ok'); }
      catch (e) { toast('Non riuscito: ' + e.message, 'err'); return; }
      disegna();
    });
    corpo.querySelector('[data-usa]')?.addEventListener('click', async () => {
      onUsa(d);
      try { riga = await linkFatturazione.segnaAcquisiti(riga); } catch { /* resta da segnare: nessun danno */ }
      disegna();
    });
  }

  carica();
  return { card, ricarica: carica };
}
