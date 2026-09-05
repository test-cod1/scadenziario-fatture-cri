import { clienti } from '../data/store.js';
import { el, clear, esc, toast, confirmDialog, openModal } from '../../lib/ui.js';

// ============================================================
//  RUBRICA DEI CLIENTI
//  L'elenco di chi ci commissiona le assistenze. Si riempie soprattutto da
//  solo — dal preventivo, con "Salva in rubrica" — e qui si sistemano le
//  schede: correggere un indirizzo, aggiungere il telefono del referente,
//  togliere un cliente che non c'è più.
//
//  Correggere una scheda NON cambia i preventivi già fatti: quelli portano
//  con sé la copia dei dati con cui sono stati scritti.
// ============================================================

export async function renderRubrica(view, ctx) {
  const elenco = await clienti.list();

  view.appendChild(el(`<div class="page-head">
    <div><h1>Rubrica clienti</h1><p>Enti e società per cui prepariamo le assistenze</p></div>
    <button class="btn primary" id="nuovo">➕ Nuovo cliente</button>
  </div>`));

  const toolbar = el(`<div class="toolbar">
    <div class="search"><span class="search-icon" aria-hidden="true">🔍</span>
      <input type="text" id="q" placeholder="Cerca per nome, codice fiscale o referente…"></div>
  </div>`);
  view.appendChild(toolbar);

  const card = el(`<div class="card"><div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Cliente</th><th>Codice fiscale / P.IVA</th><th>Indirizzo</th><th>Referente</th><th></th></tr></thead>
    <tbody></tbody></table></div></div>`);
  view.appendChild(card);
  const tbody = card.querySelector('tbody');

  function disegna() {
    const q = toolbar.querySelector('#q').value.toLowerCase().trim();
    clear(tbody);
    const righe = elenco.filter(c => !q ||
      [c.nome, c.cf, c.referente, c.indirizzo].filter(Boolean).join(' ').toLowerCase().includes(q));

    if (!righe.length) {
      tbody.appendChild(el(`<tr><td colspan="5" class="muted" style="text-align:center;padding:26px">
        ${elenco.length ? 'Nessun risultato' : 'Rubrica vuota: i clienti si aggiungono da qui o dal preventivo, con «Salva in rubrica».'}</td></tr>`));
      return;
    }

    for (const c of righe) {
      const tr = el(`<tr>
        <td><b>${esc(c.nome)}</b>${c.note ? `<div class="mini">${esc(c.note)}</div>` : ''}</td>
        <td>${esc(c.cf || '—')}</td>
        <td>${esc(c.indirizzo || '—')}</td>
        <td>${esc(c.referente || '—')}${c.referente_telefono ? `<div class="mini">${esc(c.referente_telefono)}</div>` : ''}</td>
        <td style="white-space:nowrap;text-align:right">
          <button class="btn ghost sm" data-mod title="Modifica">✎</button>
          <button class="btn ghost sm" data-del title="Elimina">🗑️</button>
        </td>
      </tr>`);
      tr.addEventListener('click', (e) => { if (!e.target.closest('button')) apriScheda(c); });
      tr.querySelector('[data-mod]').addEventListener('click', () => apriScheda(c));
      tr.querySelector('[data-del]').addEventListener('click', async () => {
        if (!await confirmDialog(`Togliere "${c.nome}" dalla rubrica? I preventivi già fatti non cambiano.`,
          { danger: true, okLabel: 'Elimina' })) return;
        try {
          await clienti.remove(c.id);
          elenco.splice(elenco.indexOf(c), 1);
          toast('Cliente eliminato', 'ok');
          disegna();
        } catch (e) { toast('Errore: ' + e.message, 'err'); }
      });
      tbody.appendChild(tr);
    }
  }

  toolbar.querySelector('#q').addEventListener('input', disegna);
  view.querySelector('#nuovo').addEventListener('click', () => apriScheda(null));
  disegna();

  // La scheda si apre in un riquadro sopra l'elenco: si aggiunge un cliente
  // senza perdere di vista quelli che ci sono già (utile per accorgersi che
  // c'è di già, scritto in un altro modo).
  function apriScheda(cliente) {
    schedaCliente(cliente, (salvato) => {
      const i = elenco.findIndex(c => c.id === salvato.id);
      if (i >= 0) elenco[i] = salvato; else elenco.push(salvato);
      elenco.sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
      disegna();
    });
  }
}

// ------------------------------------------------------------------
//  SCHEDA DI UN CLIENTE
//  Usata sia dalla rubrica sia dall'editor del preventivo (dove arriva già
//  compilata con quello che si è scritto lì).
// ------------------------------------------------------------------
export function schedaCliente(cliente, onSalvato) {
  const c = cliente || {};
  const corpo = el(`<div>
    <div class="field"><label>Nome del cliente / ente *</label>
      <input type="text" id="r-nome" value="${esc(c.nome || '')}" placeholder="es. Comune di Genova"></div>
    <div class="form-row">
      <div class="field"><label>Codice fiscale / P.IVA</label><input type="text" id="r-cf" value="${esc(c.cf || '')}"></div>
      <div class="field"><label>Indirizzo</label><input type="text" id="r-indirizzo" value="${esc(c.indirizzo || '')}"></div>
    </div>
    <div class="form-row three">
      <div class="field"><label>Referente</label><input type="text" id="r-referente" value="${esc(c.referente || '')}"></div>
      <div class="field"><label>Email</label><input type="text" id="r-email" value="${esc(c.referente_email || '')}"></div>
      <div class="field"><label>Telefono</label><input type="text" id="r-telefono" value="${esc(c.referente_telefono || '')}"></div>
    </div>
    <div class="field"><label>Note</label>
      <textarea id="r-note" rows="2" placeholder="Promemoria per noi: non compaiono nel preventivo">${esc(c.note || '')}</textarea></div>
  </div>`);

  const piede = el(`<div style="display:flex;gap:10px">
    <button class="btn" data-no>Annulla</button>
    <button class="btn primary" data-ok>💾 Salva</button>
  </div>`);

  // Dall'editor del preventivo arriva una scheda già compilata ma senza id:
  // è un cliente nuovo, non una modifica. A dirlo è l'id, non il fatto che i
  // campi siano pieni.
  const esistente = !!c.id;
  const { close } = openModal({ title: esistente ? 'Modifica cliente' : 'Nuovo cliente', body: corpo, footer: piede });
  corpo.querySelector('#r-nome').focus();

  piede.querySelector('[data-no]').addEventListener('click', () => close());
  piede.querySelector('[data-ok]').addEventListener('click', async () => {
    const btn = piede.querySelector('[data-ok]'); const testoPrima = btn.innerHTML;
    const dati = {
      id: c.id,
      nome: corpo.querySelector('#r-nome').value.trim(),
      cf: corpo.querySelector('#r-cf').value.trim(),
      indirizzo: corpo.querySelector('#r-indirizzo').value.trim(),
      referente: corpo.querySelector('#r-referente').value.trim(),
      referente_email: corpo.querySelector('#r-email').value.trim(),
      referente_telefono: corpo.querySelector('#r-telefono').value.trim(),
      note: corpo.querySelector('#r-note').value.trim(),
    };
    if (!dati.nome) { toast('Manca il nome del cliente', 'err'); corpo.querySelector('#r-nome').focus(); return; }
    btn.disabled = true; btn.innerHTML = '<span class="spinner sm"></span> Salvo…';
    try {
      const salvato = await clienti.save(dati);
      toast(esistente ? 'Cliente aggiornato' : 'Cliente aggiunto in rubrica', 'ok');
      close();
      onSalvato?.(salvato);
    } catch (e) {
      toast(e.message, 'err');
      btn.disabled = false; btn.innerHTML = testoPrima;
    }
  });
}
