import { impostazioni } from '../data/store.js';
import { el, esc, toast } from '../lib/ui.js';

export async function renderImpostazioni(view, ctx) {
  if (ctx.user.ruolo !== 'admin') {
    view.appendChild(el(`<div class="empty-state"><div class="big">🔒</div><p>Solo gli amministratori possono modificare le impostazioni.</p></div>`));
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
  </div>`);
  view.appendChild(wrap);
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
