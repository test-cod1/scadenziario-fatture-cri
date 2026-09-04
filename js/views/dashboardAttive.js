import { fattureAttive, incassi } from '../data/storeAttive.js';
import { el, clear, esc, fmtDate, fmtEuro, giorniDa, debounce, rendiCliccabile, toast, todayISO, fineMeseISO } from '../lib/ui.js';
import { impostazioni } from '../data/store.js';
import { exportXLSXAttive, exportPDFAttive } from '../lib/export.js';
import { apriEditorAttiva, apriUploadAttive, apriIncassoRapido, apriNuovaNotaCreditoAttiva, apriSollecitoRapido } from './fatturaAttiva.js';
import { FILTRO_CLIENTE_KEY } from './reportAttive.js';

const STATO_LABEL = { da_incassare: 'Da incassare', incassata_parziale: 'Incassata parz.', incassata: 'Incassata', stornata: 'Stornata' };
const STATO_CHIP = { da_incassare: 'warn', incassata_parziale: 'red', incassata: 'ok', stornata: 'info' };
const STATI_CHIUSI = ['incassata', 'stornata'];

// Vedi il commento gemello in dashboard.js: periodi su mese e anno interi,
// coerenti con l'etichetta delle card, e data locale (non UTC).
function confiniPeriodoCorrente() {
  const oggi = todayISO();
  const inizioMese = oggi.slice(0, 7) + '-01';
  const anno = oggi.slice(0, 4);
  return {
    oggi,
    inizioMese, fineMese: fineMeseISO(oggi),
    inizioAnno: `${anno}-01-01`, fineAnno: `${anno}-12-31`,
  };
}

// Dopo quanti giorni dall'emissione una fattura non incassata va segnalata.
// Le fatture attive non hanno una scadenza propria, quindi si riusa il
// "Scadenza di default (giorni)" delle Impostazioni: prima qui c'era un 60
// cablato che replicava lo stesso identico valore di default, e cambiarlo
// nelle Impostazioni non aveva alcun effetto su questo avviso.
const GIORNI_ALLERTA_FALLBACK = 60;
async function giorniAllertaIncasso() {
  try {
    const s = await impostazioni.get();
    return Number.isFinite(s?.giorni_scadenza_default) ? s.giorni_scadenza_default : GIORNI_ALLERTA_FALLBACK;
  } catch { return GIORNI_ALLERTA_FALLBACK; }   // un intoppo nella lettura non deve impedire la dashboard
}

export async function renderDashboardAttive(view, ctx) {
  let tutte = [], incassatoMese = 0, incassatoAnno = 0, contaArchivio = 0, giorniAllerta = GIORNI_ALLERTA_FALLBACK;
  try {
    const { inizioMese, fineMese, inizioAnno, fineAnno } = confiniPeriodoCorrente();
    [tutte, incassatoMese, incassatoAnno, contaArchivio, giorniAllerta] = await Promise.all([
      fattureAttive.listAperte(),
      incassi.sommaPeriodo(inizioMese, fineMese),
      incassi.sommaPeriodo(inizioAnno, fineAnno),
      fattureAttive.contaArchivio(),
      giorniAllertaIncasso(),
    ]);
  }
  catch (e) { view.appendChild(el(`<div class="empty-state"><div class="big">⚠️</div><p>Errore nel caricamento: ${esc(e.message)}</p></div>`)); return; }
  let archivioCaricato = false;
  let archivio = [];   // fatture chiuse di anni precedenti, caricate su richiesta (vedi caricaArchivio)

  const state = { q: '', stato: '', da: '', aData: '', importoMin: '', importoMax: '', soloAperte: false, soloIncassateMese: false };
  // Arrivo da un click su un cliente nel Report: preimposta la ricerca e
  // consuma subito la chiave, altrimenti resterebbe applicata a ogni rientro
  // nella dashboard finché non viene aperto di nuovo il Report.
  const filtroCliente = sessionStorage.getItem(FILTRO_CLIENTE_KEY);
  if (filtroCliente !== null) { state.q = filtroCliente; sessionStorage.removeItem(FILTRO_CLIENTE_KEY); }

  const wrap = el(`<div>
    <div class="page-head">
      <div><h1>Fatture Attive</h1><p>Fatture emesse ai clienti — CRI Genova</p></div>
      <div class="actions">
        <button class="btn" id="exp-csv">📊 Esporta Excel</button>
        <button class="btn" id="exp-pdf">🖨️ Esporta PDF</button>
        <button class="btn" id="carica">📎 Carica PDF/XML</button>
        <button class="btn" id="nuova-nc">+ Nota di credito</button>
        <button class="btn primary" id="nuova">+ Nuova fattura</button>
      </div>
    </div>
    <div id="alert-zone"></div>
    <div class="grid stats" id="stats" style="margin-bottom:22px"></div>
    <div class="toolbar">
      <div class="search"><span class="search-icon">🔎</span><input type="text" id="q" placeholder="Cerca cliente, numero fattura, note…"></div>
      <select id="f-stato">
        <option value="">Tutti gli stati</option>
        <option value="da_incassare">Da incassare</option>
        <option value="incassata_parziale">Incassata parzialmente</option>
        <option value="incassata">Incassata</option>
        <option value="stornata">Stornata</option>
      </select>
      <input type="date" id="f-da" title="Data fattura da">
      <input type="date" id="f-a" title="Data fattura a">
      <input type="number" id="f-min" placeholder="Importo min €" style="width:120px">
      <input type="number" id="f-max" placeholder="Importo max €" style="width:120px">
      <button class="btn ghost sm" id="f-reset">Azzera filtri</button>
    </div>
    <div class="muted" id="nota-filtri" style="font-size:13px;margin:-8px 0 10px"></div>
    <div class="card"><div class="card-b tbl-wrap" id="tbl-zone"></div></div>
    <details class="card" id="archivio" style="margin-top:22px">
      <summary class="card-h">
        <span>📁 Archivio fatture concluse (<span id="archivio-conta">${contaArchivio}</span>)</span>
        <span class="archivio-freccia">▸</span>
      </summary>
      <div class="card-b tbl-wrap" id="archivio-zone">
        <div class="muted" style="padding:6px 0">Fatture incassate/stornate di anni precedenti: si caricano aprendo questo pannello.</div>
      </div>
    </details>
    <div class="drop-page-overlay" id="drop-overlay"><div class="box">📎 Rilascia qui i file per caricare le fatture</div></div>
  </div>`);
  view.appendChild(wrap);

  const overlay = wrap.querySelector('#drop-overlay');
  let dragDepth = 0;
  wrap.addEventListener('dragenter', e => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    dragDepth++;
    overlay.classList.add('show');
  });
  wrap.addEventListener('dragover', e => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); });
  wrap.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) overlay.classList.remove('show'); });
  wrap.addEventListener('drop', e => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    dragDepth = 0; overlay.classList.remove('show');
    if (e.dataTransfer.files.length) apriUploadAttive(ctx, ricarica, e.dataTransfer.files);
  });

  renderStats(wrap.querySelector('#stats'), tutte, filtraSoloAperte, filtraIncassatoMese, incassatoMese, incassatoAnno);
  renderAlertAttive(wrap.querySelector('#alert-zone'), tutte, giorniAllerta);
  if (state.q) wrap.querySelector('#q').value = state.q;

  // Vedi il commento gemello in dashboard.js: l'archivio si carica alla prima
  // apertura del pannello, ma anche da solo appena si usa un filtro o la
  // ricerca, così una fattura vecchia già incassata si trova cercandola.
  async function caricaArchivio() {
    if (archivioCaricato) return;
    const zona = wrap.querySelector('#archivio-zone');
    clear(zona);
    zona.appendChild(el('<div class="spinner" style="margin:20px auto"></div>'));
    try {
      archivio = await fattureAttive.listArchivio();
      archivioCaricato = true;
      disegnaArchivio();
    } catch (e) {
      clear(zona);
      zona.appendChild(el(`<div class="empty-state"><div class="big">⚠️</div><p>Errore: ${esc(e.message)}</p></div>`));
    }
  }
  wrap.querySelector('#archivio').addEventListener('toggle', (e) => { if (e.target.open) caricaArchivio(); });

  // Gli stessi filtri della tabella principale valgono anche per l'archivio.
  function disegnaArchivio() {
    if (!archivioCaricato) return;
    renderTable(wrap.querySelector('#archivio-zone'), applyFilters(archivio), ctx, ricarica);
  }

  function filtriAttivi() {
    return !!(state.q || state.stato || state.da || state.aData || state.importoMin || state.importoMax);
  }

  // Righe da esportare: sempre tutte quelle che rispettano i filtri, archivio
  // compreso — se non è ancora stato scaricato lo si scarica adesso.
  async function righeDaEsportare() {
    await caricaArchivio();
    return [...applyFilters(tutte), ...applyFilters(archivio)];
  }

  function applyFilters(sorgente = tutte) {
    let r = sorgente;
    if (state.soloAperte) r = r.filter(f => !STATI_CHIUSI.includes(f.stato));
    if (state.soloIncassateMese) {
      const { inizioMese, fineMese } = confiniPeriodoCorrente();
      r = r.filter(f => (f.incassi || []).some(inc => inc.data_incasso >= inizioMese && inc.data_incasso <= fineMese));
    }
    if (state.q) {
      const q = state.q.toLowerCase();
      r = r.filter(f => (f.cliente || '').toLowerCase().includes(q) || (f.numero_fattura || '').toLowerCase().includes(q) || (f.note || '').toLowerCase().includes(q));
    }
    if (state.stato) r = r.filter(f => f.stato === state.stato);
    // Le fatture attive non hanno una scadenza (vedi patch-2026-08-30-rimuovi-
    // scadenza-attive.sql): il filtro temporale lavora quindi sulla data di
    // emissione, l'unico riferimento che hanno.
    if (state.da) r = r.filter(f => f.data_fattura && f.data_fattura >= state.da);
    if (state.aData) r = r.filter(f => f.data_fattura && f.data_fattura <= state.aData);
    if (state.importoMin) r = r.filter(f => Number(f.importo) >= Number(state.importoMin));
    if (state.importoMax) r = r.filter(f => Number(f.importo) <= Number(state.importoMax));
    return r;
  }

  function refreshTable() {
    renderTable(wrap.querySelector("#tbl-zone"), applyFilters(), ctx, ricarica);
    mostraNotaSenzaData();
    if (filtriAttivi() && !archivioCaricato) caricaArchivio();
    else disegnaArchivio();
    aggiornaConteggioArchivio();
  }

  // Un filtro per data esclude necessariamente le fatture prive di data
  // fattura: senza avvisare, sembrerebbero sparite (stesso avviso della
  // dashboard passive per il filtro sulla scadenza).
  function mostraNotaSenzaData() {
    const zona = wrap.querySelector('#nota-filtri');
    const escluse = (state.da || state.aData) ? tutte.filter(f => !f.data_fattura).length : 0;
    zona.textContent = escluse
      ? escluse + (escluse === 1 ? ' fattura senza data non rientra' : ' fatture senza data non rientrano') + ' nel filtro per data.'
      : '';
  }

  // Il titolo del pannello dice quante fatture archiviate rientrano nei
  // filtri correnti, così il risultato è visibile senza doverlo aprire.
  function aggiornaConteggioArchivio() {
    const zona = wrap.querySelector('#archivio-conta');
    if (!archivioCaricato) { zona.textContent = contaArchivio; return; }
    const trovate = applyFilters(archivio).length;
    zona.textContent = filtriAttivi() ? `${trovate} di ${archivio.length}` : archivio.length;
  }

  // Vedi il commento gemello in dashboard.js: clic sulla card "Da incassare
  // (totale)", filtra sulle fatture ancora aperte azzerando gli altri filtri.
  function filtraSoloAperte() {
    Object.assign(state, { q: '', stato: '', da: '', aData: '', importoMin: '', importoMax: '', soloAperte: true, soloIncassateMese: false });
    wrap.querySelectorAll('#q,#f-stato,#f-da,#f-a,#f-min,#f-max').forEach(i => i.value = '');
    refreshTable();
  }

  // Clic sulla card "Incassato questo mese": filtra sulle fatture che hanno
  // ricevuto almeno un incasso nel mese corrente (stesso intervallo usato per
  // calcolare il valore della card) — a differenza di filtraSoloAperte non è
  // un filtro sullo stato della fattura, ma sulla data dei suoi incassi.
  function filtraIncassatoMese() {
    Object.assign(state, { q: '', stato: '', da: '', aData: '', importoMin: '', importoMax: '', soloAperte: false, soloIncassateMese: true });
    wrap.querySelectorAll('#q,#f-stato,#f-da,#f-a,#f-min,#f-max').forEach(i => i.value = '');
    refreshTable();
  }

  // Vedi il commento gemello in dashboard.js: si ricaricano sempre sia il
  // sottoinsieme attivo sia, se il pannello è già aperto, l'archivio.
  // Vedi il commento gemello in dashboard.js: un errore qui arriverebbe da
  // `onClose` di un modale, dove nessuno aspetta la promise — senza catch
  // restava un rifiuto non gestito e la tabella ferma ai dati vecchi.
  async function ricarica() {
    try {
      const { inizioMese, fineMese, inizioAnno, fineAnno } = confiniPeriodoCorrente();
      // Niente `let contaArchivio` qui: dichiararlo di nuovo mascherava quello
      // esterno, che restava fermo al valore del primo caricamento.
      [tutte, incassatoMese, incassatoAnno, contaArchivio] = await Promise.all([
        fattureAttive.listAperte(),
        incassi.sommaPeriodo(inizioMese, fineMese),
        incassi.sommaPeriodo(inizioAnno, fineAnno),
        fattureAttive.contaArchivio(),
      ]);
      // L'archivio va riletto se era già stato scaricato, non solo se il
      // pannello è aperto: ricerca ed export lo usano anche a pannello chiuso.
      if (archivioCaricato) { archivioCaricato = false; await caricaArchivio(); }
      renderStats(wrap.querySelector('#stats'), tutte, filtraSoloAperte, filtraIncassatoMese, incassatoMese, incassatoAnno);
      renderAlertAttive(wrap.querySelector('#alert-zone'), tutte, giorniAllerta);
      refreshTable();
    } catch (e) {
      toast('Aggiornamento non riuscito: ' + e.message + ' — ricarica la pagina.', 'err');
    }
  }

  // Un tocco manuale a un qualsiasi altro filtro esce dalle viste impostate
  // da filtraSoloAperte/filtraIncassatoMese: vedi il commento gemello in
  // dashboard.js.
  const onSearch = debounce(v => { state.q = v; state.soloAperte = false; state.soloIncassateMese = false; refreshTable(); }, 250);
  wrap.querySelector('#q').addEventListener('input', e => onSearch(e.target.value));
  wrap.querySelector('#f-stato').addEventListener('change', e => { state.stato = e.target.value; state.soloAperte = false; state.soloIncassateMese = false; refreshTable(); });
  wrap.querySelector('#f-da').addEventListener('change', e => { state.da = e.target.value; state.soloAperte = false; state.soloIncassateMese = false; refreshTable(); });
  wrap.querySelector('#f-a').addEventListener('change', e => { state.aData = e.target.value; state.soloAperte = false; state.soloIncassateMese = false; refreshTable(); });
  wrap.querySelector('#f-min').addEventListener('input', debounce(e => { state.importoMin = e.target.value; state.soloAperte = false; state.soloIncassateMese = false; refreshTable(); }, 250));
  wrap.querySelector('#f-max').addEventListener('input', debounce(e => { state.importoMax = e.target.value; state.soloAperte = false; state.soloIncassateMese = false; refreshTable(); }, 250));
  wrap.querySelector('#f-reset').addEventListener('click', () => {
    Object.assign(state, { q: '', stato: '', da: '', aData: '', importoMin: '', importoMax: '', soloAperte: false, soloIncassateMese: false });
    wrap.querySelectorAll('#q,#f-stato,#f-da,#f-a,#f-min,#f-max').forEach(i => i.value = '');
    refreshTable();
  });
  collegaExport('#exp-csv', exportXLSXAttive);
  collegaExport('#exp-pdf', exportPDFAttive);

  // L'export può dover prima scaricare l'archivio: si disabilita il pulsante
  // nel frattempo, così non si generano due file per un doppio click.
  function collegaExport(selettore, esporta) {
    const btn = wrap.querySelector(selettore);
    btn.addEventListener('click', async () => {
      const old = btn.innerHTML;
      btn.disabled = true; btn.innerHTML = '<span class="spinner sm"></span> Preparazione…';
      try { esporta(await righeDaEsportare()); }
      catch (e) { toast('Errore nell\'export: ' + e.message, 'err'); }
      finally { btn.disabled = false; btn.innerHTML = old; }
    });
  }
  wrap.querySelector('#nuova').addEventListener('click', () => apriEditorAttiva(null, ctx, ricarica));
  wrap.querySelector('#carica').addEventListener('click', () => apriUploadAttive(ctx, ricarica));
  wrap.querySelector('#nuova-nc').addEventListener('click', () => apriNuovaNotaCreditoAttiva(ctx, ricarica));

  refreshTable();
}

// `tutte` è il sottoinsieme "attivo" (fattureAttive.listAperte): esclude le
// fatture chiuse di anni precedenti, ormai in archivio. "Incassato questo
// mese/anno" arriva già calcolato da fuori (incassi.sommaPeriodo,
// indipendente da cosa è archiviato) — vedi il commento gemello in
// dashboard.js.
function renderStats(node, tutte, onClickTotale, onClickIncassatoMese, incassatoMese, incassatoAnno) {
  clear(node);
  const nonIncassate = tutte.filter(f => !STATI_CHIUSI.includes(f.stato));
  const totaleDovuto = nonIncassate.reduce((s, f) => s + f._residuo, 0);
  const oggi = todayISO();
  const annoCorrente = oggi.slice(0, 4);

  const cards = [
    { k: 'DA INCASSARE (TOTALE)', v: fmtEuro(totaleDovuto), s: `${nonIncassate.length} fatture`, cls: 'accent', onClick: onClickTotale, titolo: 'Filtra la tabella su queste fatture' },
    { k: 'INCASSATO QUESTO MESE', v: fmtEuro(incassatoMese), s: new Date().toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }), cls: 'ok', onClick: onClickIncassatoMese, titolo: 'Filtra la tabella su queste fatture' },
    { k: 'INCASSATO QUEST\'ANNO', v: fmtEuro(incassatoAnno), s: annoCorrente, cls: 'ok' },
  ];
  for (const c of cards) {
    const cardEl = el(`<div class="stat ${c.cls}" ${c.titolo ? `title="${esc(c.titolo)}"` : ''}><div class="k">${esc(c.k)}</div><div class="v">${c.v}</div><div class="s">${esc(String(c.s))}</div></div>`);
    if (c.onClick) { cardEl.classList.add('stat-clickable'); rendiCliccabile(cardEl, c.onClick); }
    node.appendChild(cardEl);
  }
}

// Le fatture attive non hanno una scadenza propria (a differenza delle
// passive): l'unico riferimento temporale è la data di emissione, quindi
// l'avviso segnala chi non è ancora stato incassato a distanza di più giorni
// di quelli configurati in Impostazioni (vedi giorniAllertaIncasso),
// indipendentemente da eventuali solleciti già inviati.
function renderAlertAttive(node, tutte, giorniAllerta) {
  clear(node);
  const nonIncassate = tutte.filter(f => !STATI_CHIUSI.includes(f.stato) && f.data_fattura);
  const oltreSoglia = nonIncassate.filter(f => { const g = giorniDa(f.data_fattura); return g !== null && -g > giorniAllerta; });
  if (!oltreSoglia.length) return;
  node.appendChild(el(`<div class="banner danger"><div class="bi">⚠️</div><div><b>⚠️ ${oltreSoglia.length} fattura/e emesse da oltre ${giorniAllerta} giorni e non ancora incassate</b></div></div>`));
}

function renderTable(node, righe, ctx, ricarica) {
  clear(node);
  if (!righe.length) { node.appendChild(el(`<div class="empty-state"><div class="big">🧾</div><p>Nessuna fattura trovata con questi filtri.</p></div>`)); return; }
  const table = el(`<table class="tbl tbl-fatture"><thead><tr>
    <th>Cliente</th><th>N. Fattura</th><th>Data</th><th class="money-col">Importo</th><th>Stato</th><th class="money-col">Residuo</th><th>Sollecito</th><th></th>
  </tr></thead><tbody></tbody></table>`);
  const tbody = table.querySelector('tbody');
  for (const f of righe) {
    const tr = el(`<tr>
      <td>${esc(f.cliente)}</td>
      <td>${esc(f.numero_fattura || '—')}</td>
      <td>${fmtDate(f.data_fattura)}</td>
      <td class="money money-col">${fmtEuro(f.importo)}</td>
      <td>
        <span class="chip ${STATO_CHIP[f.stato] || ''}" ${!STATI_CHIUSI.includes(f.stato) ? `data-stato title="Clicca per segnare un incasso"` : ''}>${STATO_LABEL[f.stato] || f.stato}</span>
      </td>
      <td class="money money-col">${fmtEuro(f._residuo)}</td>
      <td><span class="chip ${f.data_sollecito ? 'info' : ''}" data-sollecito title="Clicca per aggiornare il sollecito">${f.data_sollecito ? '🔔 ' + fmtDate(f.data_sollecito) : '— nessuno'}</span></td>
      <td style="text-align:right"><button class="btn ghost sm" data-edit>✏️</button></td>
    </tr>`);
    rendiCliccabile(tr, (e) => { if (!e.target.closest('[data-edit]') && !e.target.closest('[data-stato]') && !e.target.closest('[data-sollecito]')) apriEditorAttiva(f.id, ctx, ricarica); });
    tr.querySelector('[data-edit]').addEventListener('click', (e) => { e.stopPropagation(); apriEditorAttiva(f.id, ctx, ricarica); });
    const chipStato = tr.querySelector('[data-stato]');
    if (chipStato) rendiCliccabile(chipStato, (e) => { e.stopPropagation(); apriIncassoRapido(f, ctx, ricarica); });
    rendiCliccabile(tr.querySelector('[data-sollecito]'), (e) => { e.stopPropagation(); apriSollecitoRapido(f, ctx, ricarica); });
    tbody.appendChild(tr);
  }
  node.appendChild(table);
}
