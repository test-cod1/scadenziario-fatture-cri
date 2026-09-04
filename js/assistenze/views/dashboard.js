import { preventivi } from '../data/store.js';
import { fmtData } from '../lib/documento.js';
import { el, clear, esc, toast, confirmDialog, fmtEuro } from '../../lib/ui.js';
import { dataAmmessa } from '../date.js';

// ============================================================
//  ELENCO DEI PREVENTIVI DI ASSISTENZA
//  Mostra la data dell'assistenza, non quella del documento: quando si cerca
//  un preventivo si ha in mente "quello di sabato", non il giorno in cui è
//  stato scritto. Da qui si duplica un preventivo e si cambia stato senza
//  aprirlo.
// ============================================================

const STATI = ['bozza', 'inviato', 'confermato', 'annullato'];

// Prima giornata dell'assistenza: è la data che identifica il servizio.
function primaData(p) {
  const date = (p.calendario || []).map(r => r.data).filter(Boolean).sort();
  return date[0] || null;
}

export async function renderDashboard(view, ctx) {
  const list = await preventivi.list();
  // Eliminare un preventivo è irreversibile e tocca il lavoro di tutti:
  // resta agli admin della sezione, come la policy di cancellazione lato
  // database. All'operatore restano duplica, Word e stampa.
  const admin = ctx.user?.ruolo === 'admin';

  view.appendChild(el(`<div class="page-head">
    <div><h1>Preventivi</h1><p>Assistenze sanitarie a manifestazioni ed eventi</p></div>
    <a class="btn primary" href="#/assistenze/nuovo">➕ Nuovo preventivo</a>
  </div>`));

  // Statistiche e stato "nessun preventivo" si ridisegnano sul posto. Prima
  // il pulsante 🗑️ faceva clear(view) e richiamava renderDashboard(): quel
  // clear portava via anche la riga "← Tutte le sezioni" messa dal router, e
  // dopo un'eliminazione la pagina restava senza via d'uscita verso la home.
  const stats = el('<div class="grid stats" style="margin-bottom:22px"></div>');
  view.appendChild(stats);
  function disegnaStats() {
    const confermati = list.filter(p => p.stato === 'confermato');
    const bozze = list.filter(p => p.stato === 'bozza');
    clear(stats);
    stats.append(
      el(`<div class="stat accent"><div class="k">Preventivi</div><div class="v">${list.length}</div>
        <div class="s">${bozze.length} ${bozze.length === 1 ? 'bozza' : 'bozze'}</div></div>`),
      el(`<div class="stat"><div class="k">Confermati</div><div class="v">${confermati.length}</div>
        <div class="s">${fmtEuro(confermati.reduce((s, p) => s + Number(p.totale || 0), 0))}</div></div>`),
      el(`<div class="stat"><div class="k">Valore totale</div><div class="v">${fmtEuro(list.reduce((s, p) => s + Number(p.totale || 0), 0))}</div></div>`),
    );
  }

  const vuoto = el(`<div class="empty-state" hidden><div class="big">⛑️</div>
    <p>Nessun preventivo ancora.<br>Creane uno con "Nuovo preventivo".</p></div>`);
  view.appendChild(vuoto);

  const toolbar = el(`<div class="toolbar">
    <div class="search"><span class="search-icon" aria-hidden="true">🔍</span>
      <input type="text" id="q" placeholder="Cerca per cliente, evento o luogo…"></div>
    <select id="f-stato">
      <option value="">Tutti gli stati</option>
      ${STATI.map(s => `<option value="${s}">${s[0].toUpperCase() + s.slice(1)}</option>`).join('')}
    </select>
  </div>`);
  view.appendChild(toolbar);

  const card = el(`<div class="card"><div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Cliente</th><th>Evento</th><th>Assistenza</th><th>Turni</th><th>Totale</th><th>Stato</th><th></th></tr></thead>
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
      (!q || [p.cliente, p.oggetto, p.luogo].join(' ').toLowerCase().includes(q)) &&
      (!stato || p.stato === stato));
    if (!filtrati.length) {
      tbody.appendChild(el('<tr><td colspan="7" class="muted" style="text-align:center;padding:26px">Nessun risultato</td></tr>'));
      return;
    }
    for (const p of filtrati) {
      const giorno = primaData(p);
      const tr = el(`<tr>
        <td><b>${esc(p.cliente || '—')}</b></td>
        <td>${esc(p.oggetto || '—')}</td>
        <td>${giorno ? fmtData(giorno) : '<span class="muted">da definire</span>'}</td>
        <td>${(p.calendario || []).length}</td>
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
        ctx.go(`#/assistenze/preventivo/${p.id}`);
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
          // Le card in testata contano bozze e confermati: senza ridisegnarle
          // restavano ferme ai numeri di prima del cambio di stato.
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
          // marcato: le assistenze si ripetono (stessa manifestazione l'anno
          // dopo), e ricopiare venti campi a mano non ha senso.
          const { id, created_at, updated_at, created_by, ...resto } = p;
          // Le giornate di un'assistenza dell'anno scorso non valgono per il
          // servizio nuovo: le date scadute si svuotano (orari e quantità
          // restano, sono la parte che si riusa davvero), perché nella
          // sezione una data precedente all'anno in corso non è ammessa.
          const calendario = (p.calendario || []).map(r =>
            dataAmmessa(r.data) ? { ...r } : { ...r, data: '' });
          const dateScadute = calendario.filter(r => !r.data).length !== (p.calendario || []).filter(r => !r.data).length;
          const copia = await preventivi.save({
            ...resto,
            calendario,
            oggetto: (p.oggetto || '') + ' (copia)',
            stato: 'bozza',
            data_documento: new Date().toISOString().slice(0, 10),
          });
          toast(dateScadute ? 'Preventivo duplicato: indica le nuove giornate' : 'Preventivo duplicato', 'ok');
          ctx.go(`#/assistenze/preventivo/${copia.id}`);
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
        if (!await confirmDialog(`Eliminare il preventivo per "${p.cliente || 'senza cliente'}"?`,
          { danger: true, okLabel: 'Elimina' })) return;
        try {
          await preventivi.remove(p.id);
        } catch (e) { toast('Eliminazione non riuscita: ' + e.message, 'err'); return; }
        // Si toglie la riga dall'elenco già in memoria e si ridisegna, invece
        // di svuotare la pagina e rifarla (vedi disegnaStats).
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
