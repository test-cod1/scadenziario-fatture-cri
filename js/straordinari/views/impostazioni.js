// ============================================================
//  IMPOSTAZIONI DELLA SEZIONE STRAORDINARI
//  Due cose sole: l'elenco delle causali (perché un campo libero, dopo tre
//  mesi, diventa venti modi diversi di scrivere "copertura turno") e le due
//  soglie di avviso. Le può cambiare l'admin di sezione: sono le regole con
//  cui si legge tutto il registro, non un dato di giornata.
// ============================================================
import { impostazioni } from '../data/store.js';
import { IMPOSTAZIONI_DEFAULT } from '../calc.js';
import { el, clear, esc, toast, confirmDialog } from '../lib/ui.js';

export async function renderImpostazioni(view, ctx) {
  const soloLettura = ctx.ruolo !== 'admin';
  let causali = [...ctx.imp.causali];

  const wrap = el(`<div class="str-editor">
    <div class="page-head">
      <div><h1>Impostazioni straordinari</h1>
        <p>Causali proposte in fase di registrazione e soglie di attenzione</p></div>
      ${soloLettura ? '' : '<div class="actions"><button class="btn primary" data-salva>💾 Salva</button></div>'}
    </div>

    ${soloLettura ? `<div class="banner info"><div class="bi">ℹ️</div><div>
      <b>Sola lettura</b><div class="small">Queste impostazioni le modifica un amministratore
      della sezione Straordinari.</div></div></div>` : ''}

    <div class="card"><div class="card-h">Causali</div><div class="card-b">
      <p class="muted small" style="margin:0 0 12px">Compaiono come suggerimenti nel campo "Causale":
      restano scrivibili a mano, ma avere le solite pronte è ciò che rende poi leggibile il registro.</p>
      <div class="str-causali"></div>
      ${soloLettura ? '' : `<div class="inline" style="margin-top:12px">
        <input type="text" data-nuova placeholder="Aggiungi una causale…">
        <button class="btn" data-aggiungi>➕ Aggiungi</button>
        <button class="btn ghost sm" data-default>Ripristina quelle di partenza</button>
      </div>`}
    </div></div>

    <div class="card" style="margin-top:18px"><div class="card-h">Soglie di attenzione</div><div class="card-b">
      <p class="muted small" style="margin:0 0 14px">Non impediscono niente: servono a far comparire
      un avviso dove prima non c'era nulla, cioè le due situazioni che sul foglio di carta si scoprivano
      troppo tardi — le ore concentrate sempre sulle stesse persone, e lo zero di troppo battuto di fretta.</p>
      <div class="form-row">
        <div class="field">
          <label for="s-mensile">Ore al mese per dipendente</label>
          <input type="number" id="s-mensile" min="1" step="1" value="${esc(ctx.imp.sogliaMensile)}" ${soloLettura ? 'disabled' : ''}>
          <div class="hint">Oltre questo saldo mensile, nel riepilogo il dipendente viene evidenziato.</div>
        </div>
        <div class="field">
          <label for="s-singola">Ore in una singola richiesta</label>
          <input type="number" id="s-singola" min="1" step="0.5" value="${esc(ctx.imp.sogliaSingola)}" ${soloLettura ? 'disabled' : ''}>
          <div class="hint">Oltre queste ore, il salvataggio chiede una conferma.</div>
        </div>
      </div>
    </div></div>
  </div>`);
  view.appendChild(wrap);

  const elenco = wrap.querySelector('.str-causali');
  function disegnaCausali() {
    clear(elenco);
    if (!causali.length) {
      elenco.appendChild(el('<p class="muted small">Nessuna causale: il campo resterà libero.</p>'));
      return;
    }
    causali.forEach((c, i) => {
      const riga = el(`<div class="str-causale">
        <span>${esc(c)}</span>
        ${soloLettura ? '' : '<button class="btn ghost sm" data-x aria-label="Togli questa causale">✕</button>'}
      </div>`);
      riga.querySelector('[data-x]')?.addEventListener('click', () => { causali.splice(i, 1); disegnaCausali(); });
      elenco.appendChild(riga);
    });
  }
  disegnaCausali();

  if (!soloLettura) {
    const campoNuova = wrap.querySelector('[data-nuova]');
    const aggiungi = () => {
      const v = campoNuova.value.trim();
      if (!v) return;
      if (causali.some(c => c.toLowerCase() === v.toLowerCase())) { toast('Causale già presente', 'err'); return; }
      causali.push(v);
      campoNuova.value = '';
      disegnaCausali();
    };
    wrap.querySelector('[data-aggiungi]').addEventListener('click', aggiungi);
    campoNuova.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); aggiungi(); } });

    wrap.querySelector('[data-default]').addEventListener('click', async () => {
      if (!await confirmDialog('Ripristinare l’elenco di causali di partenza? Quelle aggiunte a mano andranno perse.',
        { okLabel: 'Ripristina' })) return;
      causali = [...IMPOSTAZIONI_DEFAULT.causali];
      disegnaCausali();
    });

    wrap.querySelector('[data-salva]').addEventListener('click', async () => {
      const dati = {
        causali,
        sogliaMensile: Number(wrap.querySelector('#s-mensile').value),
        sogliaSingola: Number(wrap.querySelector('#s-singola').value),
      };
      try { await impostazioni.save(dati); }
      catch (e) { toast('Salvataggio non riuscito: ' + e.message, 'err'); return; }
      await ctx.ricarica();
      toast('Impostazioni salvate', 'ok');
    });
  }
}
