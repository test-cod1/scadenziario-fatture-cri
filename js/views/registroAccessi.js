import { el, clear, esc, fmtDateTime, debounce } from '../lib/ui.js';
import { descriviDispositivo, durata } from '../lib/dispositivo.mjs';

// ============================================================
//  REGISTRO ACCESSI — pagina del super admin.
//  Una riga per sessione: chi è entrato, quando, da quale dispositivo, fino
//  a quando ha usato il portale e quando la sessione si è chiusa. Lo scrive
//  il database (trigger su auth.sessions, patch-2026-11-27-registro-accessi.sql),
//  per gli accessi con email e per quelli con nome e cognome.
//  Si legge a pagine di 100, dalla più recente.
// ============================================================

const PAGINA = 100;
// Il token si rinnova circa ogni ora mentre una scheda è aperta: una
// sessione con attività più vecchia di così non la sta usando nessuno.
const IN_USO_MS = 75 * 60 * 1000;

const STATI = {
  aperte: 'Ancora aperte',
  chiuse: 'Chiuse',
};

async function sb() { const { getSupabase } = await import('../lib/supabase.js'); return getSupabase(); }

async function carica({ stato, testo, prima }) {
  const client = await sb();
  let q = client.from('registro_accessi').select('*').order('id', { ascending: false }).limit(PAGINA);
  if (stato === 'aperte') q = q.is('fine', null);
  if (stato === 'chiuse') q = q.not('fine', 'is', null);
  if (testo) {
    const t = testo.replace(/[%_,()]/g, ' ').trim();
    if (t) q = q.or(`utente_email.ilike.%${t}%,utente_nome.ilike.%${t}%`);
  }
  if (prima) q = q.lt('id', prima);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function renderRegistroAccessi(view, ctx) {
  if (ctx.user.ruoloPortale !== 'super_admin') {
    view.appendChild(el(`<div class="empty-state"><div class="big">🔒</div>
      <p>Solo un amministratore del portale può consultare il registro degli accessi.</p></div>`));
    return;
  }

  const wrap = el(`<div>
    <div class="page-head"><div>
      <h1>Registro accessi</h1>
      <p>Chi è entrato nel portale, quando e da quale dispositivo. Si conserva un anno.</p>
    </div></div>
    <div class="card"><div class="card-b">
      <div class="form-row" style="align-items:end">
        <div class="field"><label for="ra-stato">Sessioni</label>
          <select id="ra-stato"><option value="">Tutte</option>${Object.entries(STATI).map(([k, t]) => `<option value="${k}">${esc(t)}</option>`).join('')}</select></div>
        <div class="field"><label for="ra-testo">Persona</label>
          <div class="search"><span class="search-icon" aria-hidden="true">🔍</span>
            <input type="search" id="ra-testo" placeholder="nome o email…"></div></div>
      </div>
    </div></div>
    <div id="ra-righe" style="margin-top:14px"><div class="spinner"></div></div>
    <div style="text-align:center;margin:14px 0"><button class="btn" id="ra-altri" hidden>Carica i precedenti</button></div>
  </div>`);
  view.appendChild(wrap);

  const zona = wrap.querySelector('#ra-righe');
  const btnAltri = wrap.querySelector('#ra-altri');
  const filtri = () => ({
    stato: wrap.querySelector('#ra-stato').value,
    testo: wrap.querySelector('#ra-testo').value.trim(),
  });
  let ultima = null;
  let seq = 0;

  async function aggiorna(continua) {
    const mio = ++seq;
    if (!continua) { clear(zona); zona.appendChild(el('<div class="spinner"></div>')); ultima = null; }
    btnAltri.hidden = true;
    let righe;
    try {
      righe = await carica({ ...filtri(), prima: continua ? ultima : null });
    } catch (e) {
      if (mio !== seq) return;
      clear(zona);
      zona.appendChild(el(`<div class="empty-state"><div class="big">⚠️</div><p>Registro non disponibile: ${esc(e.message)}</p>
        <p class="hint">Se la tabella non esiste ancora, va eseguita supabase/patch-2026-11-27-registro-accessi.sql.</p></div>`));
      return;
    }
    if (mio !== seq) return;
    if (!continua) clear(zona);
    if (!righe.length && !continua) {
      zona.appendChild(el('<div class="empty-state"><div class="big">📭</div><p>Nessun accesso con questi filtri.</p></div>'));
      return;
    }
    const adesso = Date.now();
    for (const r of righe) zona.appendChild(riga(r, adesso, r.utente_id === ctx.user.id));
    ultima = righe.length ? righe[righe.length - 1].id : ultima;
    btnAltri.hidden = righe.length < PAGINA;
  }

  wrap.querySelector('#ra-stato').addEventListener('change', () => aggiorna(false));
  wrap.querySelector('#ra-testo').addEventListener('input', debounce(() => aggiorna(false), 350));
  btnAltri.addEventListener('click', () => aggiorna(true));
  await aggiorna(false);
}

function riga(r, adesso, sonoIo) {
  const attivita = r.attivita || r.inizio;
  let stato;
  if (r.fine) stato = `<span class="chip">🚪 Chiusa</span>`;
  else if (adesso - new Date(attivita) < IN_USO_MS) stato = `<span class="chip ok">🟢 In uso</span>`;
  else stato = `<span class="chip warn">💤 Aperta, non usata</span>`;

  const fineTxt = r.fine
    ? `chiusa ${fmtDateTime(r.fine)} · durata ${durata(r.inizio, r.fine)}`
    : `ultima attività ${fmtDateTime(attivita)}`;
  const chi = r.utente_nome || r.utente_email || 'utente eliminato';
  const email = r.utente_nome && r.utente_email ? ` <span class="muted">${esc(r.utente_email)}</span>` : '';

  return el(`<div class="log-row">
    <div class="l-head">
      ${stato}
      <span><b>${esc(chi)}</b>${email}${sonoIo ? ' <span class="chip info">tu</span>' : ''}</span>
      <span class="muted">${esc(descriviDispositivo(r.dispositivo))}</span>
      <span class="l-when">${fmtDateTime(r.inizio)}</span>
    </div>
    <div class="muted" style="font-size:12.5px;margin-top:4px">${esc(fineTxt)}</div>
  </div>`);
}
