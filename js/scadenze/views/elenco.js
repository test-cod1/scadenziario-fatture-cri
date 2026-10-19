// ============================================================
//  ELENCO DELLE SCADENZE — la pagina principale della sezione.
//  In ordine di data: in cima quelle già scadute, poi quelle che entrano
//  nel loro preavviso. La spunta si dà da qui; per una scadenza che si
//  ripete, la spunta fa nascere da sola la successiva, e l'avviso in basso
//  dice quando cade (con cinque secondi per annullare).
// ============================================================
import { scadenze as store } from '../data/store.js';
import { stato, etichetta, ordina, totali, ricorrenzaDi } from '../calc.js';
import { el, clear, esc, toast, confirmDialog, rendiCliccabile, fmtDate, fmtEuro } from '../../lib/ui.js';

export async function renderElenco(view, ctx) {
  document.querySelectorAll('.toast .toast-azione').forEach(b => b.closest('.toast').remove());
  let elenco = await store.list();
  const admin = ctx.ruolo === 'admin';

  view.appendChild(el(`<div class="page-head">
    <div><h1>Scadenze</h1><p>Assicurazioni, bolli, revisioni, contratti, certificazioni… tutto quello che scade, in ordine di data</p></div>
    <div class="actions"><a class="btn primary" href="#/scadenze/nuova">➕ Nuova scadenza</a></div>
  </div>`));

  const stats = el('<div class="grid stats" style="margin:18px 0 20px"></div>');
  view.appendChild(stats);

  const toolbar = el(`<div class="toolbar">
    <div class="search"><span class="search-icon" aria-hidden="true">🔍</span>
      <input type="text" id="q" placeholder="Cerca in titolo, riferimento, responsabile, note…"></div>
    <select id="f-vista" aria-label="Cosa mostrare">
      <option value="aperte">Da fare</option>
      <option value="tutte">Tutte</option>
      <option value="fatte">Fatte</option>
    </select>
    <select id="f-categoria" aria-label="Filtra per categoria"></select>
    <button class="btn ghost sm" data-azzera hidden>Azzera filtri</button>
  </div>`);
  view.appendChild(toolbar);

  const lista = el('<div class="dir-lista"></div>');
  view.appendChild(lista);
  const vuoto = el(`<div class="empty-state" hidden><div class="big">⏰</div>
    <p><b>Nessuna scadenza</b></p>
    <p>Segna qui tutto quello che scade: la polizza di un mezzo, un contratto da rinnovare, una certificazione.<br>
    Con il preavviso giusto, la pagina — e se li accendi i promemoria email — te lo ricordano per tempo.</p></div>`);
  view.appendChild(vuoto);

  const $ = (s) => toolbar.querySelector(s);
  let filtroRapido = null;

  function aggiornaCategorie() {
    const scelta = $('#f-categoria').value;
    const categorie = [...new Set(elenco.map(s => s.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'it'));
    $('#f-categoria').innerHTML = `<option value="">Ogni categoria</option>` +
      categorie.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
    if (categorie.includes(scelta)) $('#f-categoria').value = scelta;
  }

  function filtrate() {
    const q = $('#q').value.toLowerCase().trim();
    const vista = $('#f-vista').value;
    const cat = $('#f-categoria').value;
    return elenco.filter(s => {
      if (vista === 'aperte' && s.fatta) return false;
      if (vista === 'fatte' && !s.fatta) return false;
      if (cat && s.categoria !== cat) return false;
      if (filtroRapido && !filtroRapido(s)) return false;
      if (!q) return true;
      return [s.titolo, s.categoria, s.riferimento, s.responsabile, s.note].filter(Boolean).join(' ').toLowerCase().includes(q);
    });
  }

  function disegnaStats() {
    const t = totali(elenco);
    clear(stats);
    const card = (classe, k, v, s, filtro) => {
      const c = el(`<div class="stat ${classe}"><div class="k">${esc(k)}</div><div class="v">${v}</div><div class="s">${esc(s)}</div></div>`);
      if (filtro) {
        c.classList.add('stat-clickable');
        rendiCliccabile(c, () => { filtroRapido = filtro; $('#f-vista').value = 'aperte'; disegna(); });
      }
      return c;
    };
    stats.append(
      card('', 'Da fare', t.aperte, t.aperte ? 'scadenze aperte' : 'niente in sospeso'),
      card(t.scadute ? 'warn' : 'ok', 'Scadute', t.scadute, t.scadute ? 'clicca per vederle' : 'nessuna in ritardo',
        t.scadute ? (s => stato(s) === 'scaduta') : null),
      card('accent', 'In preavviso', t.preavviso, 'da preparare adesso',
        t.preavviso ? (s => ['oggi', 'preavviso'].includes(stato(s))) : null),
      card('', 'Entro 30 giorni', t.mese, 'nel prossimo mese'),
    );
  }

  function disegna() {
    const righe = ordina(filtrate());
    clear(lista);
    vuoto.hidden = elenco.length > 0;
    toolbar.hidden = elenco.length === 0;
    $('[data-azzera]').hidden = !($('#q').value || $('#f-categoria').value || $('#f-vista').value !== 'aperte' || filtroRapido);
    if (!righe.length && elenco.length) {
      lista.appendChild(el('<div class="empty-state"><div class="big">🔎</div><p>Nessuna scadenza con questi filtri.</p></div>'));
      return;
    }
    for (const s of righe) lista.appendChild(riga(s));
  }

  function ricarica(nuove) {
    for (const n of nuove) {
      const i = elenco.findIndex(x => x.id === n.id);
      if (i >= 0) elenco[i] = n; else elenco.push(n);
    }
    aggiornaCategorie();
    disegnaStats();
    disegna();
  }

  function riga(s) {
    const et = etichetta(s);
    const ric = ricorrenzaDi(s.ricorrenza);
    const r = el(`<div class="dir-riga ${s.fatta ? 'fatta' : ''}">
      <button class="dir-spunta" type="button" role="checkbox" aria-checked="${s.fatta ? 'true' : 'false'}"
        title="${s.fatta ? 'Segna come da fare' : 'Segna come fatta'}">${s.fatta ? '✔' : ''}</button>
      <div class="dir-corpo">
        <div class="dir-titolo">${esc(s.titolo)}</div>
        ${s.riferimento || s.responsabile ? `<div class="dir-dettagli">${[s.riferimento, s.responsabile ? 'a cura di ' + s.responsabile : ''].filter(Boolean).map(esc).join(' · ')}</div>` : ''}
        <div class="dir-chip">
          <span class="chip ${et.classe}" title="${esc(fmtDate(s.data_scadenza))}">${esc(fmtDate(s.data_scadenza))} · ${esc(et.testo)}</span>
          <span class="chip">${esc(s.categoria)}</span>
          ${ric.mesi ? `<span class="chip" title="Si ripete">🔁 ${esc(ric.label.toLowerCase())}</span>` : ''}
          ${s.importo != null ? `<span class="chip">${esc(fmtEuro(s.importo))}</span>` : ''}
          ${s.fatta && s.fatta_il ? `<span class="chip ok">fatta il ${esc(fmtDate(s.fatta_il.slice(0, 10)))}</span>` : ''}
        </div>
      </div>
      <div class="dir-azioni">
        <button class="btn ghost sm" data-mod title="Apri">✏️</button>
        ${admin ? '<button class="btn ghost sm" data-del title="Elimina">🗑️</button>' : ''}
      </div>
    </div>`);

    const spunta = r.querySelector('.dir-spunta');
    spunta.addEventListener('click', async () => {
      if (spunta.disabled) return;
      spunta.disabled = true;     // un doppio clic non deve far nascere due scadenze successive
      const eraFatta = !!s.fatta;
      let esito;
      try { esito = await store.segna(s, !eraFatta); }
      catch (e) { spunta.disabled = false; toast('Non è riuscito: ' + e.message, 'err'); return; }
      ricarica([esito.aggiornata, ...(esito.nuova ? [esito.nuova] : [])]);
      if (eraFatta) { toast('Rimessa fra le cose da fare', 'ok'); return; }
      const nome = s.titolo.length > 36 ? s.titolo.slice(0, 35).trimEnd() + '…' : s.titolo;
      toast(esito.nuova ? `Fatta: ${nome}. La prossima: ${fmtDate(esito.nuova.data_scadenza)}` : `Fatta: ${nome}`, 'ok', {
        label: 'Annulla', secondi: 5,
        onAzione: async () => {
          try {
            const { aggiornata } = await store.segna(esito.aggiornata, false);
            if (esito.nuova) { await store.remove(esito.nuova.id); elenco = elenco.filter(x => x.id !== esito.nuova.id); }
            ricarica([aggiornata]);
            toast('Annullato', 'ok');
          } catch (e) { toast('Annullamento non riuscito: ' + e.message, 'err'); }
        },
      });
    });

    const apri = () => ctx.go(`#/scadenze/scadenza/${s.id}`);
    r.querySelector('[data-mod]').addEventListener('click', apri);
    rendiCliccabile(r.querySelector('.dir-corpo'), apri);
    r.querySelector('[data-del]')?.addEventListener('click', async () => {
      if (!await confirmDialog(`Eliminare «${s.titolo}»?`, { danger: true, okLabel: 'Elimina' })) return;
      try { await store.remove(s.id); }
      catch (e) { toast(e.message, 'err'); return; }
      elenco = elenco.filter(x => x.id !== s.id);
      toast('Scadenza eliminata', 'ok');
      aggiornaCategorie(); disegnaStats(); disegna();
    });
    return r;
  }

  for (const sel of ['#q', '#f-vista', '#f-categoria']) {
    $(sel).addEventListener(sel === '#q' ? 'input' : 'change', () => { filtroRapido = null; disegna(); });
  }
  $('[data-azzera]').addEventListener('click', () => {
    $('#q').value = ''; $('#f-vista').value = 'aperte'; $('#f-categoria').value = '';
    filtroRapido = null; disegna();
  });

  aggiornaCategorie();
  disegnaStats();
  disegna();
}
