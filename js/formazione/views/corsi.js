import { corsi as storeCorsi, preventivi } from '../data/store.js';
import { nomeBreve } from '../calc.js';
import { STATI_CORSO, discentiEffettivi, corsiDaPreventivo } from '../corsi.js';
import { fmtData } from '../lib/documento.js';
import { el, clear, esc, toast, confirmDialog, todayISO, rendiCliccabile } from '../../lib/ui.js';

// ============================================================
//  REGISTRO DEI CORSI
//  Le edizioni dei corsi, una riga ciascuna: quelle ancora da fissare (nate
//  da un preventivo confermato, senza date), quelle in programma, quelle
//  svolte. È la pagina di lavoro di chi organizza: dice cosa c'è da
//  calendarizzare, cosa si tiene a breve e cosa è passato senza che
//  qualcuno ne abbia registrato presenze ed esito.
//
//  Si arriva qui anche da un preventivo («Pianifica i corsi»): in quel caso
//  l'elenco mostra solo i corsi di quel preventivo, finché non si chiede di
//  vederli tutti.
// ============================================================

const ETICHETTA = { programmato: 'Programmato', svolto: 'Svolto', annullato: 'Annullato' };

// Filtri: tre riquadri di lavoro più gli stati veri e propri.
const FILTRI = [
  ['', 'Tutti i corsi'],
  ['dafissare', 'Da fissare (senza date)'],
  ['inprogramma', 'In programma'],
  ['daregistrare', 'Passati, da registrare'],
  ['svolto', 'Svolti'],
  ['annullato', 'Annullati'],
];

export async function renderCorsi(view, ctx, preventivoId = null) {
  let lista;
  try {
    lista = await storeCorsi.list();
  } catch (e) {
    view.appendChild(avvisoTabella(e));
    return;
  }
  const admin = ctx.user?.ruolo === 'admin';
  const oggi = todayISO();
  const annoCorrente = Number(oggi.slice(0, 4));

  // Un corso in programma con la data già passata è il caso da non perdere:
  // si è tenuto (quasi sempre) ma nessuno ha segnato chi c'era. Finché resta
  // "programmato" non entra nelle statistiche e non fa partire il rinnovo.
  const passato = (c) => c.stato === 'programmato' && c.data_inizio && (c.data_fine || c.data_inizio) < oggi;
  const categoria = (c) => c.stato !== 'programmato' ? c.stato
    : !c.data_inizio ? 'dafissare' : passato(c) ? 'daregistrare' : 'inprogramma';

  let preventivo = null;
  if (preventivoId) {
    try { preventivo = await preventivi.get(preventivoId); } catch { /* eliminato: resta il filtro, senza nome */ }
  }

  view.appendChild(el(`<div class="page-head">
    <div><h1>Corsi</h1><p>Il registro delle edizioni: da fissare, in programma e svolte</p></div>
    <a class="btn primary" href="#/formazione/corso/nuovo">➕ Nuovo corso</a>
  </div>`));

  const stats = el('<div class="grid stats" style="margin-bottom:22px"></div>');
  view.appendChild(stats);

  const filtroPrev = el(`<div class="banner info" ${preventivoId ? '' : 'hidden'}><div class="bi">📄</div><div>
    <b>Corsi del preventivo${preventivo ? ` per ${esc(preventivo.cliente || 'senza committente')}` : ''}</b>
    <div class="small">${preventivo ? `${esc(preventivo.oggetto || '')} · ` : ''}<a href="#/formazione/corsi">mostra tutti i corsi</a>${preventivo ? ` · <a href="#/formazione/preventivo/${esc(preventivo.id)}">apri il preventivo</a>` : ''}</div>
  </div></div>`);
  view.appendChild(filtroPrev);

  const anni = [...new Set(lista.map(c => Number(String(c.data_inizio || '').slice(0, 4))).filter(Boolean))].sort((a, b) => b - a);
  const toolbar = el(`<div class="toolbar">
    <div class="search"><span class="search-icon" aria-hidden="true">🔍</span>
      <input type="text" id="q" placeholder="Cerca per corso, committente, docente, sede o partecipante…"></div>
    <select id="f-cat" aria-label="Filtra i corsi">${FILTRI.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>
    <select id="f-anno" aria-label="Anno"><option value="">Tutti gli anni</option>${anni.map(a => `<option value="${a}">${a}</option>`).join('')}</select>
  </div>`);
  view.appendChild(toolbar);
  const campoQ = toolbar.querySelector('#q');
  const selCat = toolbar.querySelector('#f-cat');
  const selAnno = toolbar.querySelector('#f-anno');

  const vuoto = el(`<div class="empty-state" hidden><div class="big">📅</div>
    <p>Nessun corso registrato.<br>Nascono da un preventivo confermato, con «Pianifica i corsi», oppure da «Nuovo corso».</p></div>`);
  view.appendChild(vuoto);

  const card = el(`<div class="card"><div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Quando</th><th>Corso</th><th>Committente</th><th>Dove e chi</th><th style="text-align:center">Discenti</th><th>Stato</th><th></th></tr></thead>
    <tbody></tbody></table></div></div>`);
  view.appendChild(card);
  const tbody = card.querySelector('tbody');

  function disegnaStats(base) {
    const n = (cat) => base.filter(c => categoria(c) === cat).length;
    const svoltiAnno = base.filter(c => c.stato === 'svolto' && String(c.data_inizio || '').startsWith(String(annoCorrente)));
    const formati = svoltiAnno.reduce((s, c) => s + discentiEffettivi(c), 0);
    const filtro = selCat.value;
    const riquadro = (chiave, classe, k, v, s) => {
      const nodo = el(`<div class="stat stat-clickable ${classe}${filtro === chiave ? ' attivo' : ''}" aria-pressed="${filtro === chiave}">
        <div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`);
      rendiCliccabile(nodo, () => { selCat.value = filtro === chiave ? '' : chiave; draw(); });
      return nodo;
    };
    clear(stats);
    const daFissare = n('dafissare'), daRegistrare = n('daregistrare');
    stats.append(
      riquadro('dafissare', daFissare ? 'warn' : '', 'Da fissare', daFissare, daFissare ? 'confermati, senza date' : 'tutti calendarizzati'),
      riquadro('inprogramma', 'accent', 'In programma', n('inprogramma'), 'dai prossimi giorni in poi'),
      riquadro('daregistrare', daRegistrare ? 'warn' : '', 'Da registrare', daRegistrare,
        daRegistrare ? '⚠️ già passati: segna presenze ed esito' : 'nessun corso in sospeso'),
      riquadro('svolto', 'ok', `Svolti nel ${annoCorrente}`, svoltiAnno.length, `${formati} ${formati === 1 ? 'persona formata' : 'persone formate'}`),
    );
  }

  function draw() {
    const base = preventivoId ? lista.filter(c => c.preventivo_id === preventivoId) : lista;
    disegnaStats(base);
    vuoto.hidden = base.length > 0;
    toolbar.hidden = card.hidden = !base.length;
    if (!base.length) return;

    const q = campoQ.value.toLowerCase().trim();
    const cat = selCat.value;
    const anno = selAnno.value;
    const filtrati = base
      .filter(c => !cat || categoria(c) === cat)
      .filter(c => !anno || String(c.data_inizio || '').startsWith(anno))
      .filter(c => !q || testoCercabile(c).includes(q))
      .sort(ordine);
    clear(tbody);
    if (!filtrati.length) {
      const tr = el(`<tr><td colspan="7" class="muted" style="text-align:center;padding:26px">Nessun corso con questi filtri.
        <div style="margin-top:10px"><button class="btn sm" type="button">Mostra tutti</button></div></td></tr>`);
      tr.querySelector('button').addEventListener('click', () => { selCat.value = ''; selAnno.value = ''; campoQ.value = ''; draw(); });
      tbody.appendChild(tr);
      return;
    }
    for (const c of filtrati) tbody.appendChild(riga(c));
  }

  // Prima quello che chiede un'azione: i corsi passati da registrare, poi
  // quelli da fissare, poi il calendario in ordine di data, e in fondo
  // l'archivio degli svolti dal più recente.
  function ordine(a, b) {
    const peso = { daregistrare: 0, dafissare: 1, inprogramma: 2, svolto: 3, annullato: 4 };
    const d = peso[categoria(a)] - peso[categoria(b)];
    if (d) return d;
    const da = a.data_inizio || '', db = b.data_inizio || '';
    return categoria(a) === 'inprogramma' || categoria(a) === 'daregistrare' ? da.localeCompare(db) : db.localeCompare(da);
  }

  function riga(c) {
    const cat = categoria(c);
    const quando = c.data_inizio
      ? `${fmtData(c.data_inizio)}${c.data_fine && c.data_fine !== c.data_inizio ? `<div class="mini">fino al ${fmtData(c.data_fine)}</div>` : ''}`
      : '<span class="chip warn">da fissare</span>';
    const discenti = discentiEffettivi(c);
    const nPart = (c.partecipanti || []).length;
    const tr = el(`<tr>
      <td style="white-space:nowrap">${quando}</td>
      <td><b>${esc(nomeBreve(c.corso_nome))}</b><div class="mini">${esc([c.durata, c.sigla].filter(Boolean).join(' · '))}</div></td>
      <td>${esc(c.cliente || '—')}</td>
      <td><div>${c.sede_tipo === 'cliente' ? esc(c.sede || 'presso il committente') : 'Sede CRI'}</div>
        <div class="mini">${c.docenti ? '👤 ' + esc(c.docenti) : 'docenti da assegnare'}</div></td>
      <td style="text-align:center">${discenti || '<span class="muted">—</span>'}${nPart ? '<div class="mini">elenco nominativo</div>' : ''}</td>
      <td><select data-stato class="sel-stato" data-valore="${esc(c.stato)}" aria-label="Stato del corso">${STATI_CORSO.map(s =>
        `<option value="${s}" ${c.stato === s ? 'selected' : ''}>${ETICHETTA[s]}</option>`).join('')}</select>
        ${cat === 'daregistrare' ? '<div class="mini nota-stato avviso">già passato: registralo</div>' : ''}</td>
      <td style="white-space:nowrap;text-align:right">
        ${admin ? '<button class="btn ghost sm" data-del title="Elimina">🗑️</button>' : ''}
      </td>
    </tr>`);
    tr.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('select')) return;
      ctx.go(`#/formazione/corso/${c.id}`);
    });

    const sel = tr.querySelector('[data-stato]');
    sel.addEventListener('click', (e) => e.stopPropagation());
    sel.addEventListener('change', async () => {
      const prima = c.stato;
      // Segnare svolto un corso senza data lo farebbe sparire dalle
      // statistiche di ogni anno: prima la data, poi lo stato.
      if (sel.value === 'svolto' && !c.data_inizio) {
        sel.value = prima;
        toast('Prima indica la data del corso: aprilo e compila «Quando»', 'err');
        return;
      }
      try {
        const salvato = await storeCorsi.save({ ...c, stato: sel.value });
        c.stato = sel.value;
        c.updated_at = salvato.updated_at;
        toast(`Corso segnato come ${ETICHETTA[c.stato].toLowerCase()}`, 'ok');
        draw();
      } catch (e) {
        sel.value = prima;
        toast(e.conflitto ? 'Corso modificato da un altro utente: ricarica la pagina.' : 'Errore: ' + e.message, 'err');
      }
    });

    tr.querySelector('[data-del]')?.addEventListener('click', async () => {
      if (!await confirmDialog(`Eliminare il corso «${nomeBreve(c.corso_nome)}»${c.cliente ? ` per ${c.cliente}` : ''}? Con lui se ne va l'elenco dei partecipanti.`,
        { danger: true, okLabel: 'Elimina' })) return;
      try { await storeCorsi.remove(c.id); } catch (e) { toast('Eliminazione non riuscita: ' + e.message, 'err'); return; }
      lista.splice(lista.indexOf(c), 1);
      toast('Corso eliminato', 'ok');
      draw();
    });
    return tr;
  }

  campoQ.addEventListener('input', draw);
  selCat.addEventListener('change', draw);
  selAnno.addEventListener('change', draw);
  draw();
}

function testoCercabile(c) {
  return [c.corso_nome, c.sigla, c.cliente, c.docenti, c.sede,
    ...(c.partecipanti || []).map(p => `${p.cognome} ${p.nome} ${p.cf}`)]
    .filter(Boolean).join(' ').toLowerCase();
}

// La pagina al posto dell'elenco quando la tabella non c'è ancora: dice
// cosa fare, invece di un errore tecnico.
export function avvisoTabella(e) {
  return el(`<div class="banner ${e.tabellaMancante ? 'warn' : 'danger'}"><div class="bi">⚠️</div><div>
    <b>${e.tabellaMancante ? 'Registro dei corsi da attivare' : 'Corsi non disponibili'}</b>
    <div class="small">${esc(e.message)}</div></div></div>`);
}

// ------------------------------------------------------------------
//  «PIANIFICA I CORSI» — dal preventivo confermato al registro
//  Una riga del preventivo diventa un corso da fissare. Se il preventivo ha
//  già i suoi corsi non se ne creano altri: si va a vederli. Rifare due
//  volte la stessa pianificazione per un doppio clic raddoppierebbe le
//  statistiche, ed è un errore che non si vede.
// ------------------------------------------------------------------
export async function pianificaCorsi(prev, ctx) {
  if (!prev?.id) { toast('Salva prima il preventivo', 'err'); return; }
  let esistenti;
  try { esistenti = await storeCorsi.perPreventivo(prev.id); } catch (e) { toast(e.message, 'err'); return; }
  if (esistenti.length) { ctx.go(`#/formazione/corsi/${prev.id}`); return; }
  const nuovi = corsiDaPreventivo(prev);
  if (!nuovi.length) { toast('Il preventivo non ha corsi da pianificare', 'err'); return; }
  if (!await confirmDialog(
    `Creare ${nuovi.length === 1 ? 'un corso' : `${nuovi.length} corsi`} da fissare per «${prev.cliente || 'senza committente'}»? ` +
    'Uno per ogni riga del preventivo: date, docenti e partecipanti si aggiungono dopo.',
    { okLabel: 'Pianifica' })) return;
  try {
    await storeCorsi.creaTutti(nuovi);
  } catch (e) { toast('Pianificazione non riuscita: ' + e.message, 'err'); return; }
  toast(nuovi.length === 1 ? 'Corso creato: fissane la data' : `${nuovi.length} corsi creati: fissane le date`, 'ok');
  ctx.go(`#/formazione/corsi/${prev.id}`);
}
