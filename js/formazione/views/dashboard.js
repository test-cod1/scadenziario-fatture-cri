import { preventivi, corsi as storeCorsi } from '../data/store.js';
import { dateCorsiSvolti } from '../corsi.js';
import { pianificaCorsi } from './corsi.js';
import { linkFatturazione, linkValido, urlDi } from '../../lib/linkFatturazione.js';
import { fmtData } from '../lib/documento.js';
import { daRicontattare, giorniValidita } from '../calc.js';
import { el, clear, esc, toast, confirmDialog, fmtEuro, todayISO, giorniDa, rendiCliccabile } from '../../lib/ui.js';
// Import statico, non import() al clic: la stampa apre una finestra, e Safari
// la blocca come popup se prima del window.open c'è un'attesa (27/09/2026).
import { stampaPreventivo } from '../lib/stampa.js';

// ============================================================
//  ELENCO DEI PREVENTIVI DI FORMAZIONE
//  In testa quattro riquadri che sono anche filtri, uno per ogni cosa da
//  fare: le bozze da finire, gli inviati che aspettano risposta (e quelli la
//  cui offerta è già scaduta), i confermati, e le aziende da ricontattare
//  perché il loro attestato sta per scadere.
//
//  Sotto si cerca per azienda o per corso, si cambia stato senza aprire il
//  preventivo e si duplica: le aziende richiamano ogni tre anni per lo stesso
//  aggiornamento, e ricopiare tutto a mano non ha senso.
// ============================================================

const STATI = ['bozza', 'inviato', 'confermato', 'annullato'];
const ETICHETTA = { bozza: 'Bozza', inviato: 'Inviato', confermato: 'Confermato', annullato: 'Annullato' };
// Filtro in più, che non è uno stato: i confermati il cui rinnovo è vicino.
const RINNOVI = 'rinnovi';

export async function renderDashboard(view, ctx) {
  // I corsi servono a due cose: contare il rinnovo dalla data in cui il
  // corso si è tenuto davvero, e sapere quali confermati sono già stati
  // pianificati. Se il registro non è ancora attivo (patch non eseguita)
  // l'elenco funziona lo stesso, come prima.
  const [list, registro, linkFatt] = await Promise.all([
    preventivi.list(),
    storeCorsi.list().catch(() => []),
    linkFatturazione.elenco('formazione').catch(() => []),
  ]);
  const dateCorsi = dateCorsiSvolti(registro);
  const pianificati = new Set(registro.map(c => c.preventivo_id).filter(Boolean));
  // I link dei dati di fatturazione, per metterli nel documento stampato da
  // qui come in quello dell'editor. Il preventivo si copia invece di
  // modificarlo: la riga dell'elenco si salva intera (cambio di stato,
  // duplica), e un campo in più verrebbe mandato al database.
  const linkDi = new Map(linkFatt.filter(linkValido).map(l => [l.preventivo_id, urlDi(l.token)]));
  const conLink = (p) => (linkDi.has(p.id) ? { ...p, _linkFatturazione: linkDi.get(p.id) } : p);
  // Chi ha mandato i dati di fatturazione e non sono ancora stati riportati
  // nel preventivo: lo si segnala nella riga.
  const datiNuovi = new Set(linkFatt.filter(l => l.inviato_il && (!l.acquisiti_il || l.inviato_il > l.acquisiti_il)).map(l => l.preventivo_id));
  // L'ordine è quello della data del documento, il più recente in cima: è la
  // data che si legge nella colonna, e un preventivo duplicato o corretto
  // dopo mesi non deve saltare in testa solo perché è stato creato ieri.
  list.sort((a, b) => (b.data_documento || '').localeCompare(a.data_documento || '') ||
    (b.created_at || '').localeCompare(a.created_at || ''));
  // Eliminare un preventivo è irreversibile e tocca il lavoro di tutti:
  // resta agli admin della sezione, come la policy di cancellazione lato
  // database. All'operatore restano duplica, Word e stampa.
  const admin = ctx.user?.ruolo === 'admin';
  const oggi = todayISO();
  const validita = giorniValidita(ctx.imp.testi?.validita);

  view.appendChild(el(`<div class="page-head">
    <div><h1>Preventivi</h1><p>Corsi di formazione erogati ad aziende ed enti</p></div>
    <a class="btn primary" href="#/formazione/nuovo">➕ Nuovo preventivo</a>
  </div>`));

  // Statistiche e stato "nessun preventivo" si ridisegnano sul posto, senza
  // svuotare la pagina: il router mette in cima la riga "← Tutte le sezioni",
  // e un clear(view) se la porterebbe via lasciando la pagina senza uscita.
  const stats = el('<div class="grid stats" style="margin-bottom:22px"></div>');
  view.appendChild(stats);

  const vuoto = el(`<div class="empty-state" hidden><div class="big">🎓</div>
    <p>Nessun preventivo ancora.<br>Creane uno con "Nuovo preventivo".</p></div>`);
  view.appendChild(vuoto);

  const toolbar = el(`<div class="toolbar">
    <div class="search"><span class="search-icon" aria-hidden="true">🔍</span>
      <input type="text" id="q" placeholder="Cerca per azienda, referente, oggetto, corso o protocollo…"></div>
    <select id="f-stato" aria-label="Filtra per stato">
      <option value="">Tutti gli stati</option>
      ${STATI.map(s => `<option value="${s}">${ETICHETTA[s]}</option>`).join('')}
      <option value="${RINNOVI}">Da ricontattare per il rinnovo</option>
    </select>
  </div>`);
  view.appendChild(toolbar);
  const campoQ = toolbar.querySelector('#q');
  const selFiltro = toolbar.querySelector('#f-stato');

  const card = el(`<div class="card"><div class="tbl-wrap"><table class="tbl tbl-formazione">
    <thead><tr><th>Committente</th><th>Data</th><th>Corsi</th><th style="text-align:right">Totale</th><th>Stato</th><th></th></tr></thead>
    <tbody></tbody></table></div></div>`);
  view.appendChild(card);
  const tbody = card.querySelector('tbody');

  // Un inviato da più giorni di quanti ne dichiara la validità è un'offerta
  // scaduta: l'azienda non ha risposto, e o la si sollecita o la si chiude.
  const scaduto = (p) => p.stato === 'inviato' && validita !== null && p.data_documento &&
    -giorniDa(p.data_documento) > validita;

  function disegnaStats(rinnovi) {
    const conta = (s) => list.filter(p => p.stato === s);
    const bozze = conta('bozza');
    const inviati = conta('inviato');
    const confermati = conta('confermato');
    const scaduti = inviati.filter(scaduto).length;
    const discenti = confermati.reduce((s, p) => s + contaDiscenti(p), 0);
    const filtro = selFiltro.value;
    const riquadro = (chiave, classe, k, v, s) => {
      const nodo = el(`<div class="stat stat-clickable ${classe}${filtro === chiave ? ' attivo' : ''}"
        aria-pressed="${filtro === chiave}" title="${filtro === chiave ? 'Mostra tutti' : 'Mostra solo questi'}">
        <div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`);
      // Un secondo clic sul riquadro già scelto toglie il filtro: è il gesto
      // che viene naturale, più che cercare "Tutti gli stati" nel menu.
      rendiCliccabile(nodo, () => {
        selFiltro.value = filtro === chiave ? '' : chiave;
        draw();
      });
      return nodo;
    };
    clear(stats);
    stats.append(
      riquadro('bozza', 'accent', 'Bozze', bozze.length,
        bozze.length ? 'da completare e inviare' : 'nessuna in sospeso'),
      riquadro('inviato', scaduti ? 'warn' : '', 'In attesa di risposta', inviati.length,
        scaduti ? `⚠️ ${scaduti} con l'offerta scaduta` : 'inviati, senza risposta'),
      riquadro('confermato', 'ok', 'Confermati', confermati.length,
        `${fmtEuro(confermati.reduce((s, p) => s + Number(p.totale || 0), 0))} · ${discenti} ${discenti === 1 ? 'discente' : 'discenti'}`),
      riquadro(RINNOVI, rinnovi.length ? 'warn' : '', 'Da ricontattare', rinnovi.length,
        rinnovi.length ? 'attestati in scadenza: proponi il rinnovo' : 'nessun rinnovo nei prossimi mesi'),
    );
  }

  function draw() {
    // Ricalcolato a ogni disegno: cambiare uno stato dall'elenco (un
    // confermato che torna inviato, un nuovo preventivo per la stessa
    // azienda) cambia chi c'è da ricontattare.
    const rinnovi = daRicontattare(list, ctx.imp.corsi, oggi, 120, dateCorsi);
    const rinnovoDi = new Map(rinnovi.map(x => [x.prev, x.rinnovo]));
    disegnaStats(rinnovi);
    // Archivio vuoto (o svuotato eliminando l'ultimo preventivo): al posto di
    // filtri e tabella si mostra l'invito a crearne uno.
    vuoto.hidden = list.length > 0;
    toolbar.hidden = card.hidden = list.length === 0;
    if (!list.length) return;

    const q = campoQ.value.toLowerCase().trim();
    const filtro = selFiltro.value;
    clear(tbody);
    const base = filtro === RINNOVI ? rinnovi.map(x => x.prev) : list.filter(p => !filtro || p.stato === filtro);
    const filtrati = base.filter(p => !q || testoCercabile(p).includes(q));
    if (!filtrati.length) {
      const msg = filtro === RINNOVI && !q
        ? 'Nessuna azienda da ricontattare: i rinnovi compaiono qui quattro mesi prima della scadenza.'
        : 'Nessun preventivo con questi filtri.';
      const tr = el(`<tr><td colspan="6" class="muted" style="text-align:center;padding:26px">${esc(msg)}
        ${filtro || q ? '<div style="margin-top:10px"><button class="btn sm" type="button">Mostra tutti</button></div>' : ''}</td></tr>`);
      tr.querySelector('button')?.addEventListener('click', () => { selFiltro.value = ''; campoQ.value = ''; draw(); });
      tbody.appendChild(tr);
      return;
    }
    for (const p of filtrati) tbody.appendChild(riga(p, rinnovoDi.get(p)));
  }

  function riga(p, rinnovo) {
    const corsi = p.righe || [];
    const discenti = contaDiscenti(p);
    // Sotto lo stato, quello che serve per decidere cosa fare: da quanto è
    // fuori un inviato, o quando scade l'attestato di un confermato.
    let nota = '';
    if (rinnovo) {
      const gg = giorniDa(rinnovo);
      nota = `<div class="mini nota-stato avviso">🔁 ${gg < 0 ? 'rinnovo scaduto il' : 'rinnovo dal'} ${fmtData(rinnovo)}</div>`;
    } else if (p.stato === 'inviato' && p.data_documento) {
      const gg = -giorniDa(p.data_documento);
      nota = scaduto(p)
        ? `<div class="mini nota-stato avviso">offerta scaduta (${gg} gg)</div>`
        : `<div class="mini nota-stato">${gg <= 0 ? 'oggi' : `da ${gg} ${gg === 1 ? 'giorno' : 'giorni'}`}</div>`;
    }
    const tr = el(`<tr class="riga-apribile">
      <td><b>${esc(p.cliente || '—')}</b>
        <div class="mini">${esc(p.oggetto || 'senza oggetto')}${p.protocollo ? ` · Prot. n. ${esc(p.protocollo)}` : ''}</div>
        ${datiNuovi.has(p.id) ? '<div class="mini nota-stato avviso">📩 dati di fatturazione ricevuti</div>' : ''}</td>
      <td style="white-space:nowrap">${p.data_documento ? fmtData(p.data_documento) : '<span class="muted">—</span>'}</td>
      <td>${corsi.length ? esc(riassuntoCorsi(corsi)) : '<span class="muted">nessuno</span>'}
        <div class="mini">${discenti ? `${discenti} ${discenti === 1 ? 'discente' : 'discenti'}` : 'discenti da definire'}</div></td>
      <td class="money">${fmtEuro(p.totale)}</td>
      <td><select data-stato class="sel-stato" data-valore="${esc(p.stato)}" aria-label="Stato del preventivo">${STATI.map(s =>
        `<option value="${s}" ${p.stato === s ? 'selected' : ''}>${ETICHETTA[s]}</option>`).join('')}</select>${nota}</td>
      <td style="white-space:nowrap;text-align:right">
        ${p.stato === 'confermato' && !rinnovo
          ? `<button class="btn ghost sm" data-corsi title="${pianificati.has(p.id) ? 'Vedi i corsi di questo preventivo' : 'Crea i corsi da fissare, uno per riga del preventivo'}">${pianificati.has(p.id) ? '📅' : '📅 Pianifica'}</button>`
          : ''}
        ${rinnovo
          ? '<button class="btn sm" data-copia title="Crea un nuovo preventivo uguale, come bozza con la data di oggi">🔁 Prepara rinnovo</button>'
          : '<button class="btn ghost sm" data-copia title="Duplica come nuova bozza">⧉</button>'}
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
        // Confermato vuol dire che i corsi si faranno: è il momento di
        // metterli in calendario, e l'avviso offre di farlo subito.
        if (p.stato === 'confermato' && !pianificati.has(p.id)) {
          toast('Preventivo confermato', 'ok', { label: 'Pianifica i corsi', secondi: 8, onAzione: () => pianificaCorsi(p, ctx) });
        } else {
          toast(`Stato aggiornato: ${ETICHETTA[p.stato].toLowerCase()}`, 'ok');
        }
        // Si ridisegna tutto: col filtro su uno stato la riga deve uscire
        // dalla vista, e i riquadri in testa devono contarla altrove.
        draw();
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
        // Il duplicato nasce come bozza, con la data di oggi. Il protocollo
        // NON si copia: è il numero di quel documento, e ritrovarselo
        // identico su due lettere diverse sarebbe un errore difficile da
        // accorgersi. Un rinnovo tiene l'oggetto com'era — è la stessa
        // richiesta tre anni dopo — mentre una copia qualsiasi lo marca.
        const { id, created_at, updated_at, created_by, ...resto } = p;
        const copia = await preventivi.save({
          ...resto,
          protocollo: null,
          oggetto: rinnovo ? p.oggetto : (p.oggetto || '') + ' (copia)',
          stato: 'bozza',
          data_documento: todayISO(),
        });
        toast(rinnovo ? 'Rinnovo creato come bozza: controlla prezzi e discenti' : 'Preventivo duplicato', 'ok');
        ctx.go(`#/formazione/preventivo/${copia.id}`);
      } catch (e) {
        toast('Duplicazione non riuscita: ' + e.message, 'err');
        btn.disabled = false;
      }
    });

    tr.querySelector('[data-corsi]')?.addEventListener('click', () => pianificaCorsi(p, ctx));

    tr.querySelector('[data-pdf]').addEventListener('click', async () => {
      try {
        await stampaPreventivo(conLink(p), ctx.imp);
      } catch (e) { toast('Stampa non riuscita: ' + e.message, 'err'); }
    });
    tr.querySelector('[data-word]').addEventListener('click', async () => {
      try {
        const { scaricaDocx } = await import('../lib/docx.js');
        await scaricaDocx(conLink(p), ctx.imp);
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
    return tr;
  }

  campoQ.addEventListener('input', draw);
  selFiltro.addEventListener('change', draw);
  draw();
}

function contaDiscenti(p) {
  return (p.righe || []).reduce((s, r) => s + (Number(r.discenti) || 0), 0);
}

// I corsi in una riga sola: la sigla dice di che famiglia sono («BLSD»,
// «PRIMO SOCCORSO») e la durata distingue il corso dall'aggiornamento: un
// nome di catalogo intero non ci starebbe. Il corso fuori catalogo, senza
// sigla, compare col suo nome.
function riassuntoCorsi(righe) {
  const conta = new Map();
  for (const r of righe) {
    const sigla = (r.sigla || '').trim();
    const nome = sigla ? `${sigla}${r.durata ? ` ${r.durata}` : ''}` : (r.nome || 'corso').trim();
    conta.set(nome, (conta.get(nome) || 0) + 1);
  }
  return [...conta].map(([n, c]) => c > 1 ? `${n} ×${c}` : n).join(', ');
}

// Anche i nomi dei corsi entrano nella ricerca: "chi ci ha chiesto il BLSD?"
// è la domanda che si fa più spesso, e l'oggetto non sempre lo dice.
function testoCercabile(p) {
  return [p.cliente, p.referente, p.referente_email, p.oggetto, p.protocollo, ...(p.righe || []).map(r => r.nome)]
    .filter(Boolean).join(' ').toLowerCase();
}
