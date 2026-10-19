// ============================================================
//  IDEE — la sottosezione del Direttore per annotare al volo.
//  Un'idea si scrive in una riga, qui o mandando un messaggio al bot
//  Telegram del portale (quando si è in giro, che è quando le idee
//  vengono). Poi si valuta: ogni idea ha uno stato, e quelle buone
//  diventano un impegno con un clic.
// ============================================================
import { idee as store, telegram, STATI_IDEA, statoIdea } from '../data/idee.js';
import { el, clear, esc, toast, confirmDialog, fmtDateTime } from '../../lib/ui.js';

export async function renderIdee(view, ctx) {
  let elenco = await store.list();
  const superAdmin = ctx.user?.ruoloPortale === 'super_admin';

  view.appendChild(el(`<div class="page-head">
    <div><h1>Idee</h1><p>Annotate al volo, dal portale o da Telegram; quelle buone diventano impegni</p></div>
  </div>`));

  const nuova = el(`<div class="card" style="margin:18px 0"><div class="card-b">
    <div class="field" style="margin:0"><label for="idea-testo">Un'idea nuova</label>
      <textarea id="idea-testo" rows="3" maxlength="4000" placeholder="Scrivila come viene: la si sistema dopo."></textarea></div>
    <div style="display:flex;gap:10px;align-items:center;margin-top:8px;flex-wrap:wrap">
      <button class="btn primary" data-aggiungi>💡 Aggiungi</button>
      <span class="hint">Ctrl+Invio per aggiungere</span>
    </div>
  </div></div>`);
  view.appendChild(nuova);

  const pannelloTg = el('<div class="card" style="margin:0 0 18px"><div class="card-b" data-tg><div class="spinner sm"></div></div></div>');
  view.appendChild(pannelloTg);

  const toolbar = el(`<div class="toolbar">
    <div class="search"><span class="search-icon" aria-hidden="true">🔍</span><input type="text" id="q" placeholder="Cerca nelle idee…"></div>
    <select id="f-stato" aria-label="Stato">
      <option value="aperte">Da valutare (nuove e in valutazione)</option>
      <option value="">Tutte</option>
      ${STATI_IDEA.map(s => `<option value="${s.id}">${esc(s.label)}</option>`).join('')}
    </select>
  </div>`);
  view.appendChild(toolbar);
  const lista = el('<div class="dir-lista"></div>');
  view.appendChild(lista);

  // ---------- nuova idea ----------
  const area = nuova.querySelector('#idea-testo');
  const btn = nuova.querySelector('[data-aggiungi]');
  async function aggiungi() {
    if (btn.disabled || !area.value.trim()) return;
    btn.disabled = true;
    try {
      elenco.unshift(await store.add(area.value));
      area.value = '';
      toast('Idea aggiunta', 'ok');
      disegna();
    } catch (e) { toast('Non è riuscito: ' + e.message, 'err'); }
    finally { btn.disabled = false; area.focus(); }
  }
  btn.addEventListener('click', aggiungi);
  area.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); aggiungi(); } });

  // ---------- elenco ----------
  function disegna() {
    const q = toolbar.querySelector('#q').value.toLowerCase().trim();
    const f = toolbar.querySelector('#f-stato').value;
    const righe = elenco.filter(i => {
      if (f === 'aperte' && !['nuova', 'in_valutazione'].includes(i.stato)) return false;
      if (f && f !== 'aperte' && i.stato !== f) return false;
      return !q || i.testo.toLowerCase().includes(q) || (i.autore_nome || '').toLowerCase().includes(q);
    });
    clear(lista);
    if (!righe.length) {
      lista.appendChild(el(`<div class="empty-state"><div class="big">💡</div><p>${elenco.length ? 'Nessuna idea con questi filtri.' : 'Ancora nessuna idea. Scrivine una qui sopra, o mandala al bot Telegram.'}</p></div>`));
      return;
    }
    for (const i of righe) lista.appendChild(riga(i));
  }

  function riga(i) {
    const st = statoIdea(i.stato);
    const r = el(`<div class="dir-riga" style="grid-template-columns:1fr auto">
      <div class="dir-corpo" style="cursor:default">
        <div class="dir-titolo" style="white-space:pre-wrap;font-weight:500">${esc(i.testo)}</div>
        <div class="dir-chip">
          <span class="chip ${st.classe}">${esc(st.label)}</span>
          <span class="chip" title="${esc(fmtDateTime(i.created_at))}">${i.origine === 'telegram' ? '📱 Telegram · ' : ''}${esc(i.autore_nome || '—')} · ${esc(new Date(i.created_at).toLocaleDateString('it-IT'))}</span>
          ${i.impegno_id ? `<a class="chip ok" href="#/direttore/impegno/${esc(i.impegno_id)}">→ impegno</a>` : ''}
        </div>
      </div>
      <div class="dir-azioni" style="flex-wrap:wrap;justify-content:flex-end">
        <select data-stato aria-label="Stato dell'idea">${STATI_IDEA.map(s => `<option value="${s.id}" ${s.id === i.stato ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}</select>
        ${i.impegno_id ? '' : '<button class="btn ghost sm" data-impegno title="Crea un impegno da questa idea">→ Impegno</button>'}
        <button class="btn ghost sm" data-del title="Elimina">🗑️</button>
      </div>
    </div>`);
    r.querySelector('[data-stato]').addEventListener('change', async (e) => {
      try { Object.assign(i, await store.update(i.id, { stato: e.target.value })); toast('Stato aggiornato', 'ok'); }
      catch (err) { toast('Non è riuscito: ' + err.message, 'err'); e.target.value = i.stato; return; }
      disegna();
    });
    r.querySelector('[data-impegno]')?.addEventListener('click', async (e) => {
      e.target.disabled = true;
      try {
        const { impegno, idea } = await store.inImpegno(i);
        Object.assign(i, idea);
        toast('Impegno creato', 'ok', { label: 'Apri', secondi: 6, onAzione: () => ctx.go(`#/direttore/impegno/${impegno.id}`) });
        disegna();
      } catch (err) { e.target.disabled = false; toast('Non è riuscito: ' + err.message, 'err'); }
    });
    r.querySelector('[data-del]').addEventListener('click', async () => {
      const breve = i.testo.length > 60 ? i.testo.slice(0, 59) + '…' : i.testo;
      if (!await confirmDialog(`Eliminare l'idea «${breve}»?`, { danger: true, okLabel: 'Elimina' })) return;
      try { await store.remove(i.id); } catch (err) { toast('Non è riuscito: ' + err.message, 'err'); return; }
      elenco = elenco.filter(x => x.id !== i.id);
      disegna();
    });
    return r;
  }
  toolbar.querySelector('#q').addEventListener('input', disegna);
  toolbar.querySelector('#f-stato').addEventListener('change', disegna);
  disegna();

  // ---------- Telegram ----------
  const tg = pannelloTg.querySelector('[data-tg]');
  async function disegnaTelegram() {
    let stato, mio;
    try { [stato, mio] = await Promise.all([telegram.stato(), telegram.mio()]); }
    catch (e) {
      tg.innerHTML = `<b>📱 Telegram</b><div class="hint">Non disponibile: ${esc(e.message)}</div>`;
      return;
    }
    if (!stato.configurato) {
      tg.innerHTML = `<b>📱 Idee da Telegram</b>
        <div class="hint" style="margin-top:4px">Il bot non è ancora configurato sul server (servono i secret TELEGRAM_BOT_TOKEN e TELEGRAM_WEBHOOK_SECRET: vedi il README).</div>`;
      return;
    }
    const linkBot = stato.bot ? `<a href="https://t.me/${esc(stato.bot)}" target="_blank" rel="noopener">@${esc(stato.bot)}</a>` : 'il bot';
    clear(tg);
    if (mio) {
      tg.appendChild(el(`<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <div style="flex:1;min-width:220px"><b>📱 Telegram collegato</b>
          <div class="hint">Scrivi a ${linkBot}${mio.telegram_nome ? ` (dal tuo account ${esc(mio.telegram_nome)})` : ''}: ogni messaggio diventa un'idea qui. <code>/idee</code> mostra le ultime.</div></div>
        <button class="btn ghost sm" data-scollega>Scollega</button>
        ${superAdmin ? '<button class="btn ghost sm" data-configura title="Registra di nuovo il webhook presso Telegram">⚙️ Webhook</button>' : ''}
      </div>`));
    } else {
      tg.appendChild(el(`<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <div style="flex:1;min-width:220px"><b>📱 Manda le idee da Telegram</b>
          <div class="hint">Collega il tuo account Telegram a ${linkBot}: da quel momento ogni messaggio che gli scrivi diventa un'idea qui.</div>
          <div data-codice></div></div>
        <button class="btn primary sm" data-collega>Collega Telegram</button>
        ${superAdmin ? '<button class="btn ghost sm" data-configura title="Registra il webhook presso Telegram">⚙️ Webhook</button>' : ''}
      </div>`));
    }
    tg.querySelector('[data-collega]')?.addEventListener('click', async (e) => {
      e.target.disabled = true;
      try {
        const codice = await telegram.generaCodice();
        const deep = stato.bot ? `https://t.me/${encodeURIComponent(stato.bot)}?start=${encodeURIComponent(codice)}` : null;
        tg.querySelector('[data-codice]').innerHTML = `<div class="banner info" style="margin-top:10px"><div class="bi">🔑</div><div class="small">
          ${deep ? `Apri <a href="${esc(deep)}" target="_blank" rel="noopener" style="font-weight:700">questo link</a> dal telefono e premi «Avvia», oppure` : ''}
          scrivi al bot <code>/collega ${esc(codice)}</code>. Il codice vale 15 minuti; poi ricarica questa pagina.</div></div>`;
      } catch (err) { toast('Non è riuscito: ' + err.message, 'err'); }
      finally { e.target.disabled = false; }
    });
    tg.querySelector('[data-scollega]')?.addEventListener('click', async () => {
      if (!await confirmDialog('Scollegare il tuo Telegram? I messaggi al bot non diventeranno più idee.', { okLabel: 'Scollega' })) return;
      try { await telegram.scollega(ctx.user.id); toast('Telegram scollegato', 'ok'); disegnaTelegram(); }
      catch (err) { toast('Non è riuscito: ' + err.message, 'err'); }
    });
    tg.querySelector('[data-configura]')?.addEventListener('click', async (e) => {
      e.target.disabled = true;
      try { const r = await telegram.configura(); toast(`Webhook registrato per @${r.bot}`, 'ok'); disegnaTelegram(); }
      catch (err) { toast(err.message, 'err'); e.target.disabled = false; }
    });
  }
  disegnaTelegram();
}
