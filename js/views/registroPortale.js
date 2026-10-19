import { el, clear, esc, fmtDateTime, debounce } from '../lib/ui.js';

// ============================================================
//  REGISTRO MODIFICHE DEL PORTALE — pagina del super admin.
//  Ogni inserimento, modifica o cancellazione in qualunque sezione, scritto
//  dal database (trigger trg_registro, patch-2026-10-18-registro.sql): chi,
//  quando, su quale riga, e per le modifiche i campi cambiati con il valore
//  di prima e di dopo. Si legge a pagine di 100, dalla più recente.
// ============================================================

const PAGINA = 100;

// tabella → [sezione, cosa è una riga]. L'ordine delle sezioni è quello del filtro.
const TABELLE = {
  profili: ['Portale', 'Utente'],
  autorizzazioni: ['Portale', 'Autorizzazione'],
  fatture: ['Scadenziario', 'Fattura passiva'],
  pagamenti: ['Scadenziario', 'Pagamento'],
  note_credito: ['Scadenziario', 'Nota di credito (passive)'],
  note_credito_righe: ['Scadenziario', 'Storno su fattura passiva'],
  impostazioni: ['Scadenziario', 'Impostazioni'],
  proposte_pagamento: ['Scadenziario', 'Proposta di pagamento'],
  fatture_attive: ['Scadenziario', 'Fattura attiva'],
  incassi: ['Scadenziario', 'Incasso'],
  note_credito_attive: ['Scadenziario', 'Nota di credito (attive)'],
  note_credito_attive_righe: ['Scadenziario', 'Storno su fattura attiva'],
  preventivi: ['Trasporti', 'Preventivo'],
  impostazioni_trasferte: ['Trasporti', 'Impostazioni'],
  preventivi_assistenze: ['Assistenze', 'Preventivo'],
  clienti_assistenze: ['Assistenze', 'Cliente'],
  impostazioni_assistenze: ['Assistenze', 'Impostazioni'],
  preventivi_formazione: ['Formazione', 'Preventivo'],
  clienti_formazione: ['Formazione', 'Cliente'],
  impostazioni_formazione: ['Formazione', 'Impostazioni'],
  dipendenti_straordinari: ['Straordinari', 'Dipendente'],
  straordinari: ['Straordinari', 'Registrazione'],
  impostazioni_straordinari: ['Straordinari', 'Impostazioni'],
  impegni_direttore: ['Direttore', 'Impegno'],
  centri_costo: ['Analisi', 'Centro di costo'],
  imputazioni: ['Analisi', 'Imputazione'],
  idee_direttore: ['Direttore', 'Idea'],
  scadenze: ['Scadenze', 'Scadenza'],
};
const SEZIONI = [...new Set(Object.values(TABELLE).map(([s]) => s))];

const AZIONI = {
  inserimento: { t: 'Inserimento', ic: '➕', cls: 'ok' },
  modifica: { t: 'Modifica', ic: '✏️', cls: 'warn' },
  cancellazione: { t: 'Cancellazione', ic: '🗑️', cls: 'danger' },
};

// Il nome con cui una persona riconosce la riga: il primo campo "parlante"
// che la riga ha.
const CAMPI_NOME = ['titolo', 'fornitore', 'cliente', 'nominativo', 'nome', 'email', 'numero_fattura', 'numero', 'sezione'];
function descrivi(riga) {
  if (!riga) return '';
  for (const c of CAMPI_NOME) if (riga[c]) return String(riga[c]);
  return '';
}

function valore(v) {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

async function sb() { const { getSupabase } = await import('../lib/supabase.js'); return getSupabase(); }

async function carica({ sezione, azione, testo, prima }) {
  const client = await sb();
  let q = client.from('registro').select('*').order('id', { ascending: false }).limit(PAGINA);
  if (sezione) q = q.in('tabella', Object.keys(TABELLE).filter(t => TABELLE[t][0] === sezione));
  if (azione) q = q.eq('azione', azione);
  if (testo) {
    const t = testo.replace(/[%_,()]/g, ' ').trim();
    if (t) q = q.or(`utente_email.ilike.%${t}%,utente_nome.ilike.%${t}%,riga_id.ilike.%${t}%`);
  }
  if (prima) q = q.lt('id', prima);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function renderRegistroPortale(view, ctx) {
  if (ctx.user.ruoloPortale !== 'super_admin') {
    view.appendChild(el(`<div class="empty-state"><div class="big">🔒</div>
      <p>Solo un amministratore del portale può consultare il registro delle modifiche.</p></div>`));
    return;
  }

  const wrap = el(`<div>
    <div class="page-head"><div>
      <h1>Registro modifiche</h1>
      <p>Chi ha cambiato cosa, in tutte le sezioni del portale. Si conservano tre anni.</p>
    </div></div>
    <div class="card"><div class="card-b">
      <div class="form-row three" style="align-items:end">
        <div class="field"><label for="rg-sezione">Sezione</label>
          <select id="rg-sezione"><option value="">Tutte</option>${SEZIONI.map(s => `<option>${esc(s)}</option>`).join('')}</select></div>
        <div class="field"><label for="rg-azione">Operazione</label>
          <select id="rg-azione"><option value="">Tutte</option>${Object.entries(AZIONI).map(([k, a]) => `<option value="${k}">${esc(a.t)}</option>`).join('')}</select></div>
        <div class="field"><label for="rg-testo">Persona o id della riga</label>
          <input type="search" id="rg-testo" placeholder="nome, email o id…"></div>
      </div>
    </div></div>
    <div id="rg-righe" style="margin-top:14px"><div class="spinner"></div></div>
    <div style="text-align:center;margin:14px 0"><button class="btn" id="rg-altri" hidden>Carica le precedenti</button></div>
  </div>`);
  view.appendChild(wrap);

  const zona = wrap.querySelector('#rg-righe');
  const btnAltri = wrap.querySelector('#rg-altri');
  const filtri = () => ({
    sezione: wrap.querySelector('#rg-sezione').value,
    azione: wrap.querySelector('#rg-azione').value,
    testo: wrap.querySelector('#rg-testo').value.trim(),
  });
  // id dell'ultima riga mostrata: da lì riparte "Carica le precedenti". Per id e
  // non per orario: le righe scritte nella stessa operazione hanno lo stesso
  // created_at, e il confine di pagina ne avrebbe saltata qualcuna.
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
        <p class="hint">Se la tabella non esiste ancora, va eseguita supabase/patch-2026-10-18-registro.sql.</p></div>`));
      return;
    }
    if (mio !== seq) return;
    if (!continua) clear(zona);
    if (!righe.length && !continua) {
      zona.appendChild(el('<div class="empty-state"><div class="big">📭</div><p>Nessuna modifica con questi filtri.</p></div>'));
      return;
    }
    for (const r of righe) zona.appendChild(riga(r));
    ultima = righe.length ? righe[righe.length - 1].id : ultima;
    btnAltri.hidden = righe.length < PAGINA;
  }

  wrap.querySelector('#rg-sezione').addEventListener('change', () => aggiorna(false));
  wrap.querySelector('#rg-azione').addEventListener('change', () => aggiorna(false));
  wrap.querySelector('#rg-testo').addEventListener('input', debounce(() => aggiorna(false), 350));
  btnAltri.addEventListener('click', () => aggiorna(true));
  await aggiorna(false);
}

function riga(r) {
  const [sezione, cosa] = TABELLE[r.tabella] || ['—', r.tabella];
  const a = AZIONI[r.azione] || { t: r.azione, ic: '•', cls: '' };
  const nome = descrivi(r.dopo) || descrivi(r.prima);
  const dettaglio = r.azione === 'modifica' && r.campi?.length
    ? `<table class="tbl-diff"><thead><tr><th>Campo</th><th>Prima</th><th>Dopo</th></tr></thead><tbody>${
        r.campi.map(c => `<tr><td>${esc(c)}</td><td>${esc(valore(r.prima?.[c]))}</td><td>${esc(valore(r.dopo?.[c]))}</td></tr>`).join('')
      }</tbody></table>`
    : `<pre>${esc(JSON.stringify(r.dopo || r.prima, null, 2))}</pre>`;
  return el(`<div class="log-row">
    <div class="l-head">
      <span class="chip ${a.cls}">${a.ic} ${esc(a.t)}</span>
      <span class="chip">${esc(sezione)}</span>
      <span><b>${esc(cosa)}</b>${nome ? ' · ' + esc(nome) : ''}</span>
      <span class="muted">${esc(r.utente_nome || r.utente_email || 'operazione di sistema')}</span>
      <span class="l-when">${fmtDateTime(r.created_at)}</span>
    </div>
    <details><summary class="muted" style="cursor:pointer">${r.azione === 'modifica' && r.campi?.length ? 'Campi cambiati: ' + esc(r.campi.join(', ')) : 'Contenuto della riga'}</summary>${dettaglio}</details>
  </div>`);
}
