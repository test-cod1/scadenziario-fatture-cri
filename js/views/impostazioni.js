import { impostazioni } from '../data/store.js';
import { el, esc, toast } from '../lib/ui.js';
import { renderRegistroModifiche } from './registroModifiche.js';

// Impostazioni DELLA SEZIONE scadenziario (scadenza di default e registro
// modifiche): le riservano agli admin dello scadenziario. Utenti e permessi
// del portale stanno invece in js/views/portaleUtenti.js, e li gestisce solo
// il super admin.
export async function renderImpostazioni(view, ctx) {
  if (ctx.user.ruolo !== 'admin') {
    view.appendChild(el(`<div class="empty-state"><div class="big">🔒</div><p>Solo gli amministratori dello scadenziario possono modificarne le impostazioni.</p></div>`));
    return;
  }
  let rec;
  try { rec = await impostazioni.get(); }
  catch (e) { view.appendChild(el(`<div class="empty-state"><div class="big">⚠️</div><p>Errore: ${esc(e.message)}</p></div>`)); return; }

  const wrap = el(`<div>
    <div class="page-head"><div><h1>Impostazioni</h1><p>Configurazione generale dello scadenziario.</p></div></div>
    <div class="card"><div class="card-b">
      <div class="field" style="max-width:260px">
        <label>Scadenza di default (giorni)</label>
        <input type="number" min="0" step="1" id="giorni">
        <div class="hint">Se una fattura non riporta una data di scadenza (lettura AI, XML o inserimento manuale), viene calcolata automaticamente come data fattura + questo numero di giorni.</div>
      </div>
      <button class="btn primary" id="save" style="margin-top:14px">Salva</button>
    </div></div>

    <details class="card" id="log-panel" style="margin-top:22px">
      <summary class="card-h">
        <span>📋 Registro modifiche</span>
        <span class="archivio-freccia">▸</span>
      </summary>
      <div class="card-b">
        <div style="display:flex;justify-content:flex-end;margin-bottom:14px">
          <select id="log-tipo">
            <option value="">Tutte le fatture</option>
            <option value="passiva">Solo fatture passive (fornitori)</option>
            <option value="attiva">Solo fatture attive (clienti)</option>
          </select>
        </div>
        <div id="log-zone"><div class="muted" style="padding:6px 0">Si carica aprendo questo pannello.</div></div>
      </div>
    </details>
  </div>`);
  view.appendChild(wrap);
  // Non appesantisce il caricamento della pagina Impostazioni: il registro
  // (due tabelle, fino a 300 righe ciascuna) si scarica dal server solo alla
  // prima apertura del pannello, non ad ogni volta che si apre questa pagina.
  let logCaricato = false;
  wrap.querySelector('#log-panel').addEventListener('toggle', (e) => {
    if (!e.target.open || logCaricato) return;
    logCaricato = true;
    const zona = wrap.querySelector('#log-zone');
    zona.innerHTML = '<div class="spinner" style="margin:20px auto"></div>';
    renderRegistroModifiche(zona, wrap.querySelector('#log-tipo'), ctx);
  });
  wrap.querySelector('#giorni').value = rec.giorni_scadenza_default;

  wrap.querySelector('#save').addEventListener('click', async () => {
    const input = wrap.querySelector('#giorni');
    const giorni = parseInt(input.value, 10);
    if (!Number.isFinite(giorni) || giorni < 0) { toast('Inserisci un numero di giorni valido (0 o superiore)', 'err'); return; }
    const btn = wrap.querySelector('#save'); const old = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<span class="spinner sm"></span> Salvataggio…';
    try {
      await impostazioni.save({ giorni_scadenza_default: giorni });
      toast('Impostazioni salvate', 'ok');
    } catch (e) {
      toast('Errore: ' + e.message, 'err');
    } finally {
      btn.disabled = false; btn.innerHTML = old;
    }
  });
}
