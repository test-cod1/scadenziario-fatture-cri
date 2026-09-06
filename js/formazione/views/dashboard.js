import { preventivi } from '../data/store.js';
import { fmtData } from '../lib/documento.js';
import { el, clear, esc, toast, confirmDialog, fmtEuro, todayISO } from '../../lib/ui.js';

// ============================================================
//  ELENCO DEI PREVENTIVI DI FORMAZIONE
//  Si cerca per azienda o per corso, si cambia stato senza aprire il
//  preventivo e si duplica: le aziende richiamano ogni tre anni per lo stesso
//  aggiornamento, e ricopiare tutto a mano non ha senso.
// ============================================================

const STATI = ['bozza', 'inviato', 'confermato', 'annullato'];

export async function renderDashboard(view, ctx) {
  const list = await preventivi.list();
  // Eliminare un preventivo è irreversibile e tocca il lavoro di tutti:
  // resta agli admin della sezione, come la policy di cancellazione lato
  // database. All'operatore restano duplica, Word e stampa.
  const admin = ctx.user?.ruolo === 'admin';

  view.appendChild(el(`<div class="page-head">
    <div><h1>Preventivi</h1><p>Corsi di formazione erogati ad aziende ed enti</p></div>
    <a class="btn primary" href="#/formazione/nuovo">➕ Nuovo preventivo</a>
  </div>`));

  // Statistiche e stato "nessun preventivo" si ridisegnano sul posto, senza
  // svuotare la pagina: il router mette in cima la riga "← Tutte le sezioni",
  // e un clear(view) se la porterebbe via lasciando la pagina senza uscita.
  const stats = el('<div class="grid stats" style="margin-bottom:22px"></div>');
  view.appendChild(stats);
  function disegnaStats() {
    const confermati = list.filter(p => p.stato === 'confermato');
    const bozze = list.filter(p => p.stato === 'bozza');
    const discenti = confermati.reduce((s, p) => s + contaDiscenti(p), 0);
    clear(stats);
    stats.append(
      el(`<div class="stat accent"><div class="k">Preventivi</div><div class="v">${list.length}</div>
        <div class="s">${bozze.length} ${bozze.length === 1 ? 'bozza' : 'bozze'}</div></div>`),
      el(`<div class="stat"><div class="k">Confermati</div><div class="v">${confermati.length}</div>
        <div class="s">${fmtEuro(confermati.reduce((s, p) => s + Number(p.totale || 0), 0))}</div></div>`),
      el(`<div class="stat"><div class="k">Discenti confermati</div><div class="v">${discenti}</div>
        <div class="s">persone da formare</div></div>`),
    );
  }

  const vuoto = el(`<div class="empty-state" hidden><div class="big">🎓</div>
    <p>Nessun preventivo ancora.<br>Creane uno con "Nuovo preventivo".</p></div>`);
  view.appendChild(vuoto);

  const toolbar = el(`<div class="toolbar">
    <div class="search"><span class="search-icon" aria-hidden="true">🔍</span>
      <input type="text" id="q" placeholder="Cerca per azienda, oggetto, corso o protocollo…"></div>
    <select id="f-stato">
      <option value="">Tutti gli stati</option>
      ${STATI.map(s => `<option value="${s}">${s[0].toUpperCase() + s.slice(1)}</option>`).join('')}
    </select>
  </div>`);
  view.appendChild(toolbar);

  const card = el(`<div class="card"><div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Committente</th><th>Oggetto</th><th>Data</th><th>Corsi</th><th>Discenti</th><th>Totale</th><th>Stato</th><th></th></tr></thead>
    <tbody></tbody></table></div></div>`);
  view.appendChild(card);
  const tbody = card.querySelector('tbody');

  function draw() {
    disegnaStats();
    // Archivio vuoto (o svuotato eliminando l'ultimo preventivo): al posto di
    // filtri e tabella si mostra l'invito a crearne uno.
    vuoto.hidden = list.length > 0;
    toolbar.hidden = card.hidden = list.length === 0;
    if (!list.length) return;

    const q = toolbar.querySelector('#q').value.toLowerCase().trim();
    const stato = toolbar.querySelector('#f-stato').value;
    clear(tbody);
    const filtrati = list.filter(p =>
      (!q || testoCercabile(p).includes(q)) &&
      (!stato || p.stato === stato));
    if (!filtrati.length) {
      tbody.appendChild(el('<tr><td colspan="8" class="muted" style="text-align:center;padding:26px">Nessun risultato</td></tr>'));
      return;
    }
    for (const p of filtrati) {
      const corsi = (p.righe || []).length;
      const tr = el(`<tr>
        <td><b>${esc(p.cliente || '—')}</b></td>
        <td>${esc(p.oggetto || '—')}${p.protocollo ? `<div class="mini">Prot. n. ${esc(p.protocollo)}</div>` : ''}</td>
        <td>${p.data_documento ? fmtData(p.data_documento) : '<span class="muted">—</span>'}</td>
        <td>${corsi}</td>
        <td>${contaDiscenti(p) || '<span class="muted">—</span>'}</td>
        <td class="money">${fmtEuro(p.totale)}</td>
        <td><select data-stato style="min-width:118px">${STATI.map(s =>
          `<option value="${s}" ${p.stato === s ? 'selected' : ''}>${s[0].toUpperCase() + s.slice(1)}</option>`).join('')}</select></td>
        <td style="white-space:nowrap;text-align:right">
          <button class="btn ghost sm" data-copia title="Duplica">⧉</button>
          <button class="btn ghost sm" data-word title="Scarica in Word">📄</button>
          <button class="btn ghost sm" data-pdf title="Stampa / PDF">🖨️</button>
          ${admin ? '<button class="btn ghost sm" data-del title="Elimina">🗑️</button>' : ''}
        </td>
      </tr>`);
      tr.addEventListener('click', (e) => {
        if (e.target.closest('button') || e.target.closest('select')) return;
        ctx.go(`#/formazione/preventivo/${p.id}`);
      });

      // Stato modificabile dall'elenco: cambiarlo è la modifica più frequente
      // dopo aver mandato il preventivo, e non vale la pena aprirlo per questo.
      const selStato = tr.querySelector('[data-stato]');
      selStato.addEventListener('click', (e) => e.stopPropagation());
      selStato.addEventListener('change', async () => {
        const precedente = p.stato;
        try {
          const salvato = await preventivi.save({ ...p, stato: selStato.value });
          p.stato = selStato.value;
          // Senza aggiornare la versione, un secondo cambio di stato sulla
          // stessa riga verrebbe scambiato per una modifica altrui.
          p.updated_at = salvato.updated_at;
          disegnaStats();
          toast('Stato aggiornato', 'ok');
        } catch (e) {
          selStato.value = precedente;
          toast(e.conflitto
            ? 'Preventivo modificato da un altro utente: ricarica la pagina.'
            : 'Errore: ' + e.message, 'err');
        }
      });

      tr.querySelector('[data-copia]').addEventListener('click', async () => {
        const btn = tr.querySelector('[data-copia]');
        btn.disabled = true;
        try {
          // Il duplicato nasce come bozza, con la data di oggi e l'oggetto
          // marcato. Il protocollo NON si copia: è il numero di quel
          // documento, e ritrovarselo identico su due lettere diverse sarebbe
          // un errore difficile da accorgersi.
          const { id, created_at, updated_at, created_by, ...resto } = p;
          const copia = await preventivi.save({
            ...resto,
            protocollo: null,
            oggetto: (p.oggetto || '') + ' (copia)',
            stato: 'bozza',
            data_documento: todayISO(),
          });
          toast('Preventivo duplicato', 'ok');
          ctx.go(`#/formazione/preventivo/${copia.id}`);
        } catch (e) {
          toast('Duplicazione non riuscita: ' + e.message, 'err');
          btn.disabled = false;
        }
      });

      tr.querySelector('[data-pdf]').addEventListener('click', async () => {
        try {
          const { stampaPreventivo } = await import('../lib/stampa.js');
          await stampaPreventivo(p, ctx.imp);
        } catch (e) { toast('Stampa non riuscita: ' + e.message, 'err'); }
      });
      tr.querySelector('[data-word]').addEventListener('click', async () => {
        try {
          const { scaricaDocx } = await import('../lib/docx.js');
          await scaricaDocx(p, ctx.imp);
        } catch (e) { toast('Generazione Word non riuscita: ' + e.message, 'err'); }
      });
      tr.querySelector('[data-del]')?.addEventListener('click', async () => {
        if (!await confirmDialog(`Eliminare il preventivo per "${p.cliente || 'senza committente'}"?`,
          { danger: true, okLabel: 'Elimina' })) return;
        try {
          await preventivi.remove(p.id);
        } catch (e) { toast('Eliminazione non riuscita: ' + e.message, 'err'); return; }
        const i = list.indexOf(p);
        if (i >= 0) list.splice(i, 1);
        toast('Preventivo eliminato', 'ok');
        draw();
      });
      tbody.appendChild(tr);
    }
  }
  toolbar.querySelector('#q').addEventListener('input', draw);
  toolbar.querySelector('#f-stato').addEventListener('change', draw);
  draw();
}

function contaDiscenti(p) {
  return (p.righe || []).reduce((s, r) => s + (Number(r.discenti) || 0), 0);
}

// Anche i nomi dei corsi entrano nella ricerca: "chi ci ha chiesto il BLSD?"
// è la domanda che si fa più spesso, e l'oggetto non sempre lo dice.
function testoCercabile(p) {
  return [p.cliente, p.oggetto, p.protocollo, ...(p.righe || []).map(r => r.nome)]
    .filter(Boolean).join(' ').toLowerCase();
}
