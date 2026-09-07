// ============================================================
//  ANAGRAFICA DEI DIPENDENTI
//  L'elenco da cui si sceglie chi ha fatto lo straordinario. Nient'altro:
//  cognome, nome e un promemoria, perché il registro serve a contare ore e
//  non a tenere una copia del personale dell'ente. Matricola, telefono e
//  ore di contratto c'erano e sono stati tolti il 05/09/2026: nessuno
//  li leggeva, e l'anagrafe del personale sta altrove.
// ============================================================
import { dipendenti as store, straordinari } from '../data/store.js';
import { nominativo, fmtOre, meseCorrente, oreConSegno } from '../calc.js';
import { el, clear, esc, toast, confirmDialog, openModal } from '../lib/ui.js';

export async function renderDipendenti(view, ctx) {
  // Ore del mese in corso accanto a ogni nome: l'anagrafica è anche il posto
  // in cui ci si chiede "a chi posso chiedere di fermarsi stasera?", e la
  // risposta dipende da quanto ha già fatto.
  const righeMese = await straordinari.listMese(meseCorrente()).catch(() => []);
  const oreMese = new Map();
  for (const r of righeMese) oreMese.set(r.dipendente_id, (oreMese.get(r.dipendente_id) || 0) + oreConSegno(r));

  const head = el(`<div class="page-head">
    <div><h1>Dipendenti</h1><p>Chi può fare straordinari</p></div>
    <div class="actions"><button class="btn primary" data-nuovo>➕ Nuovo dipendente</button></div>
  </div>`);
  view.appendChild(head);

  const card = el(`<div class="card"><div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Dipendente</th><th class="money">Saldo mese in corso</th>
      <th>Stato</th><th></th></tr></thead><tbody></tbody>
  </table></div></div>`);
  view.appendChild(card);
  const tbody = card.querySelector('tbody');

  const vuoto = el(`<div class="empty-state" hidden><div class="big">👤</div>
    <p><b>Nessun dipendente in elenco</b></p>
    <p>Aggiungi i dipendenti a cui la centrale può chiedere straordinari.<br>
    Basta il cognome; il nome e le note sono facoltativi.</p></div>`);
  view.appendChild(vuoto);

  function disegna() {
    clear(tbody);
    const elenco = ctx.dipendenti;
    vuoto.hidden = elenco.length > 0;
    card.hidden = elenco.length === 0;
    for (const a of elenco) {
      const saldo = oreMese.get(a.id) || 0;
      const tr = el(`<tr class="${a.attivo ? '' : 'str-inattivo'}">
        <td><b>${esc(nominativo(a))}</b>${a.note ? `<div class="small muted">${esc(a.note)}</div>` : ''}</td>
        <td class="money">${saldo ? esc(fmtOre(saldo, { segno: true })) : '—'}</td>
        <td>${a.attivo ? '<span class="chip ok">Attivo</span>' : '<span class="chip">Non attivo</span>'}</td>
        <td style="white-space:nowrap;text-align:right">
          <button class="btn ghost sm" data-mod title="Modifica">✏️</button>
          <button class="btn ghost sm" data-attiva title="${a.attivo ? 'Disattiva' : 'Riattiva'}">${a.attivo ? '🚫' : '↩️'}</button>
          <button class="btn ghost sm" data-del title="Elimina">🗑️</button>
        </td>
      </tr>`);
      tr.querySelector('[data-mod]').addEventListener('click', () => scheda(a));
      tr.querySelector('[data-attiva]').addEventListener('click', async () => {
        await salva({ ...a, attivo: !a.attivo }, a.attivo ? 'Dipendente disattivato' : 'Dipendente riattivato');
      });
      tr.querySelector('[data-del]').addEventListener('click', async () => {
        if (!await confirmDialog(`Eliminare ${nominativo(a)} dall'elenco?`, { danger: true, okLabel: 'Elimina' })) return;
        try { await store.remove(a.id); }
        catch (e) { toast(e.message, 'err'); return; }
        await ctx.ricarica();
        toast('Dipendente eliminato', 'ok');
        disegna();
      });
      tbody.appendChild(tr);
    }
  }

  async function salva(rec, messaggio) {
    try { await store.save(rec); }
    catch (e) { toast(e.message, 'err'); return false; }
    await ctx.ricarica();
    toast(messaggio, 'ok');
    disegna();
    return true;
  }

  function scheda(a) {
    const nuovo = !a;
    const d = a || { cognome: '', nome: '', attivo: true, note: '' };
    const body = el(`<div>
      <div class="form-row">
        <div class="field"><label for="a-cognome">Cognome *</label>
          <input type="text" id="a-cognome" value="${esc(d.cognome)}"></div>
        <div class="field"><label for="a-nome">Nome</label>
          <input type="text" id="a-nome" value="${esc(d.nome || '')}"></div>
      </div>
      <div class="field"><label for="a-note">Note</label>
        <textarea id="a-note" rows="2" placeholder="es. disponibile solo nei feriali">${esc(d.note || '')}</textarea></div>
      <div class="switch-row"><label class="switch">
        <input type="checkbox" id="a-attivo" ${d.attivo !== false ? 'checked' : ''}><span class="slider"></span>
        <span>Attivo — compare negli elenchi di scelta</span></label></div>
    </div>`);
    const foot = el(`<div style="display:flex;gap:10px;justify-content:flex-end">
      <button class="btn" data-annulla>Annulla</button>
      <button class="btn primary" data-ok>${nuovo ? 'Aggiungi' : 'Salva'}</button></div>`);
    const { close } = openModal({ title: nuovo ? 'Nuovo dipendente' : nominativo(d), body, footer: foot });
    foot.querySelector('[data-annulla]').addEventListener('click', () => close());
    foot.querySelector('[data-ok]').addEventListener('click', async () => {
      const rec = {
        ...d,
        cognome: body.querySelector('#a-cognome').value,
        nome: body.querySelector('#a-nome').value,
        note: body.querySelector('#a-note').value,
        attivo: body.querySelector('#a-attivo').checked,
      };
      if (await salva(rec, nuovo ? 'Dipendente aggiunto' : 'Scheda salvata')) close();
    });
  }

  head.querySelector('[data-nuovo]').addEventListener('click', () => scheda(null));
  disegna();
}
