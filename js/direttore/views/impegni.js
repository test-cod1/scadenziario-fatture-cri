// ============================================================
//  ELENCO DEGLI IMPEGNI — la pagina principale della sezione.
//  Una riga per impegno, ordinate per quanto pesano davvero: l'ordine lo
//  decide il punteggio in js/direttore/calc.js, che mette insieme
//  importanza, urgenza e giorni che mancano alla scadenza.
//
//  La spunta si dà da qui, senza aprire nulla: è il gesto che si fa venti
//  volte al giorno, e farlo passare da una scheda sarebbe il modo per non
//  tenere mai l'elenco aggiornato.
// ============================================================
import { impegni as store } from '../data/store.js';
import { LIVELLI, livelloDi, ordina, totali, etichettaScadenza, giorniAllaScadenza } from '../calc.js';
import { el, clear, esc, toast, confirmDialog, rendiCliccabile, fmtDate } from '../../lib/ui.js';

export async function renderImpegni(view, ctx) {
  let elenco = await store.list();

  const head = el(`<div class="page-head">
    <div>
      <h1>Impegni</h1>
      <p>Le cose da fare della direzione, in ordine di peso</p>
    </div>
    <div class="actions">
      <a class="btn primary" href="#/direttore/nuovo">➕ Nuovo impegno</a>
    </div>
  </div>`);
  view.appendChild(head);

  const stats = el('<div class="grid stats" style="margin:18px 0 20px"></div>');
  view.appendChild(stats);

  const toolbar = el(`<div class="toolbar">
    <div class="search"><span class="search-icon" aria-hidden="true">🔍</span>
      <input type="text" id="q" placeholder="Cerca nel titolo o nei dettagli…"></div>
    <select id="f-vista" aria-label="Cosa mostrare">
      <option value="aperti">Da fare</option>
      <option value="tutti">Tutti</option>
      <option value="fatti">Fatti</option>
    </select>
    <select id="f-urgenza" aria-label="Filtra per urgenza"><option value="">Ogni urgenza</option>
      ${LIVELLI.map(l => `<option value="${l.id}">Urgenza ${esc(l.label.toLowerCase())}</option>`).join('')}</select>
    <select id="f-importanza" aria-label="Filtra per importanza"><option value="">Ogni importanza</option>
      ${LIVELLI.map(l => `<option value="${l.id}">Importanza ${esc(l.label.toLowerCase())}</option>`).join('')}</select>
    <button class="btn ghost sm" data-azzera hidden>Azzera filtri</button>
  </div>`);
  view.appendChild(toolbar);

  const lista = el('<div class="dir-lista"></div>');
  view.appendChild(lista);

  const vuoto = el(`<div class="empty-state" hidden><div class="big">🗒️</div>
    <p><b>Nessun impegno</b></p>
    <p>Segna qui quello che c'è da fare: quanto preme, quanto conta e — se ce l'ha — entro quando.<br>
    L'elenco si ordina da sé, e cambia da solo con l'avvicinarsi delle scadenze.</p></div>`);
  view.appendChild(vuoto);

  function filtrati() {
    const q = toolbar.querySelector('#q').value.toLowerCase().trim();
    const vista = toolbar.querySelector('#f-vista').value;
    const fu = toolbar.querySelector('#f-urgenza').value;
    const fi = toolbar.querySelector('#f-importanza').value;
    return elenco.filter(i => {
      if (vista === 'aperti' && i.fatto) return false;
      if (vista === 'fatti' && !i.fatto) return false;
      if (fu && i.urgenza !== fu) return false;
      if (fi && i.importanza !== fi) return false;
      if (!q) return true;
      return [i.titolo, i.dettagli].filter(Boolean).join(' ').toLowerCase().includes(q);
    });
  }

  function disegnaStats() {
    const t = totali(elenco);
    clear(stats);
    const card = (classe, k, v, s, alFiltro) => {
      const c = el(`<div class="stat ${classe}"><div class="k">${esc(k)}</div>
        <div class="v">${v}</div><div class="s">${esc(s)}</div></div>`);
      if (alFiltro) {
        c.classList.add('stat-clickable');
        rendiCliccabile(c, alFiltro);
      }
      return c;
    };
    stats.append(
      card('', 'Da fare', t.aperti, t.aperti ? 'impegni aperti' : 'niente in sospeso'),
      card(t.scaduti ? 'warn' : 'ok', 'Scaduti', t.scaduti,
        t.scaduti ? 'clicca per vederli' : 'nessuno in ritardo',
        t.scaduti ? () => { mostraSolo(i => !i.fatto && giorniAllaScadenza(i.scadenza) < 0); } : null),
      card('accent', 'Questa settimana', t.settimana, 'scadono entro 7 giorni',
        t.settimana ? () => { mostraSolo(i => { const g = giorniAllaScadenza(i.scadenza); return !i.fatto && g !== null && g >= 0 && g <= 7; }); } : null),
      card('', 'Senza scadenza', t.senzaScadenza, 'da datare, se serve'),
    );
  }

  // I filtri rapidi delle card non sono un quarto menu a tendina: agiscono
  // una volta sola e si spengono al primo tocco sugli altri filtri, così
  // non resta un filtro invisibile che fa sembrare l'elenco vuoto.
  let filtroRapido = null;
  function mostraSolo(fn) {
    filtroRapido = fn;
    toolbar.querySelector('#f-vista').value = 'aperti';
    disegna();
  }

  function disegna() {
    const base = filtrati();
    const righe = ordina(filtroRapido ? base.filter(filtroRapido) : base);
    clear(lista);
    vuoto.hidden = elenco.length > 0;
    toolbar.hidden = elenco.length === 0;
    const conFiltri = toolbar.querySelector('#q').value || toolbar.querySelector('#f-urgenza').value
      || toolbar.querySelector('#f-importanza').value || toolbar.querySelector('#f-vista').value !== 'aperti'
      || filtroRapido;
    toolbar.querySelector('[data-azzera]').hidden = !conFiltri;
    if (!righe.length && elenco.length) {
      lista.appendChild(el('<div class="empty-state"><div class="big">🔎</div><p>Nessun impegno con questi filtri.</p></div>'));
      return;
    }
    for (const i of righe) lista.appendChild(riga(i));
  }

  function riga(i) {
    const sca = etichettaScadenza(i.scadenza);
    const u = livelloDi(i.urgenza), imp = livelloDi(i.importanza);
    const r = el(`<div class="dir-riga ${i.fatto ? 'fatta' : ''}">
      <button class="dir-spunta" type="button" role="checkbox" aria-checked="${i.fatto ? 'true' : 'false'}"
        title="${i.fatto ? 'Segna come da fare' : 'Segna come fatto'}">${i.fatto ? '✔' : ''}</button>
      <div class="dir-corpo">
        <div class="dir-titolo">${esc(i.titolo)}</div>
        ${i.dettagli ? `<div class="dir-dettagli">${esc(i.dettagli)}</div>` : ''}
        <div class="dir-chip">
          <span class="chip liv-${esc(i.importanza)}" title="Quanto pesa il risultato">Importanza ${esc(imp.label.toLowerCase())}</span>
          <span class="chip liv-${esc(i.urgenza)}" title="Quanto preme il tempo">Urgenza ${esc(u.label.toLowerCase())}</span>
          <span class="chip sca-${esc(sca.stato)}" title="${i.scadenza ? esc(fmtDate(i.scadenza)) : 'Nessuna scadenza indicata'}">${esc(sca.testo)}</span>
          ${i.fatto && i.fatto_il ? `<span class="chip ok">fatto il ${esc(fmtDate(i.fatto_il.slice(0, 10)))}</span>` : ''}
        </div>
      </div>
      <div class="dir-azioni">
        <button class="btn ghost sm" data-mod title="Apri">✏️</button>
        <button class="btn ghost sm" data-del title="Elimina">🗑️</button>
      </div>
    </div>`);

    r.querySelector('.dir-spunta').addEventListener('click', async () => {
      try {
        const agg = await store.segna(i.id, !i.fatto);
        Object.assign(i, agg);
      } catch (e) { toast('Non è riuscito: ' + e.message, 'err'); return; }
      toast(i.fatto ? 'Fatto' : 'Rimesso fra le cose da fare', 'ok');
      disegnaStats();
      disegna();
    });
    r.querySelector('[data-mod]').addEventListener('click', () => ctx.go(`#/direttore/impegno/${i.id}`));
    rendiCliccabile(r.querySelector('.dir-corpo'), () => ctx.go(`#/direttore/impegno/${i.id}`));
    r.querySelector('[data-del]').addEventListener('click', async () => {
      if (!await confirmDialog(`Eliminare «${i.titolo}»? Non resta traccia.`,
        { danger: true, okLabel: 'Elimina' })) return;
      try { await store.remove(i.id); }
      catch (e) { toast('Eliminazione non riuscita: ' + e.message, 'err'); return; }
      elenco = elenco.filter(x => x.id !== i.id);
      toast('Impegno eliminato', 'ok');
      disegnaStats();
      disegna();
    });
    return r;
  }

  for (const s of ['#q', '#f-vista', '#f-urgenza', '#f-importanza']) {
    const c = toolbar.querySelector(s);
    c.addEventListener(s === '#q' ? 'input' : 'change', () => { filtroRapido = null; disegna(); });
  }
  toolbar.querySelector('[data-azzera]').addEventListener('click', () => {
    toolbar.querySelector('#q').value = '';
    toolbar.querySelector('#f-vista').value = 'aperti';
    toolbar.querySelector('#f-urgenza').value = '';
    toolbar.querySelector('#f-importanza').value = '';
    filtroRapido = null;
    disegna();
  });

  disegnaStats();
  disegna();
}
