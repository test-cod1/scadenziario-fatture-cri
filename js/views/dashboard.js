import { fatture, pagamenti, proposte } from '../data/store.js';
import { el, clear, esc, fmtDate, fmtEuro, giorniDa, debounce, toast, rendiCliccabile, todayISO, sommaGiorniISO, fineMeseISO } from '../lib/ui.js';
import { exportXLSX, exportPDF } from '../lib/export.js';
import { apriEditor, apriUpload, apriPagamentoRapido, apriProponiPagamento, apriNuovaNotaCredito } from './fattura.js';
import { FILTRO_FORNITORE_KEY } from './report.js';

const STATO_LABEL = { da_pagare: 'Da pagare', pagata_parziale: 'Pagata parz.', pagata: 'Pagata', stornata: 'Stornata' };
const STATO_CHIP = { da_pagare: 'warn', pagata_parziale: 'red', pagata: 'ok', stornata: 'info' };
const STATI_CHIUSI = ['pagata', 'stornata']; // niente altro da pagare: il chip non apre più pagamento/proposta

// Confini dell'intervallo "questo mese"/"quest'anno", usati sia al primo
// caricamento sia a ogni ricarica per le statistiche di pagato.
//
// I periodi coprono il mese e l'anno INTERI, non si fermano a oggi: le card
// si intitolano "agosto 2026" e "2026", quindi devono contare anche un
// pagamento registrato con data più avanti nello stesso mese (capita, ad
// esempio, annotando un bonifico con la sua data valuta). Fermandosi a oggi
// il totale contraddiceva la propria etichetta.
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

export async function renderDashboard(view, ctx) {
  let tutte = [], pagatoMese = 0, pagatoAnno = 0, contaArchivio = 0;
  try {
    const { inizioMese, fineMese, inizioAnno, fineAnno } = confiniPeriodoCorrente();
    [tutte, pagatoMese, pagatoAnno, contaArchivio] = await Promise.all([
      fatture.listAperte(),
      pagamenti.sommaPeriodo(inizioMese, fineMese),
      pagamenti.sommaPeriodo(inizioAnno, fineAnno),
      fatture.contaArchivio(),
    ]);
  }
  catch (e) { view.appendChild(el(`<div class="empty-state"><div class="big">⚠️</div><p>Errore nel caricamento: ${esc(e.message)}</p></div>`)); return; }
  let proposteInAttesa = await caricaProposteInAttesa();
  let archivioCaricato = false;
  let archivio = [];   // fatture chiuse di anni precedenti, caricate su richiesta (vedi caricaArchivio)

  const state = { q: '', stato: '', da: '', aData: '', importoMin: '', importoMax: '', soloAperte: false };
  // Arrivo da un click su un fornitore nel Report: preimposta la ricerca e
  // consuma subito la chiave, altrimenti resterebbe applicata a ogni rientro
  // nella dashboard finché non viene aperto di nuovo il Report.
  const filtroFornitore = sessionStorage.getItem(FILTRO_FORNITORE_KEY);
  if (filtroFornitore !== null) { state.q = filtroFornitore; sessionStorage.removeItem(FILTRO_FORNITORE_KEY); }

  const wrap = el(`<div>
    <div class="page-head">
      <div><h1>Scadenziario Fatture</h1><p>Fatture fornitori — CRI Genova</p></div>
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
      <div class="search"><span class="search-icon">🔎</span><input type="text" id="q" placeholder="Cerca fornitore, numero fattura, note…"></div>
      <select id="f-stato">
        <option value="">Tutti gli stati</option>
        <option value="da_pagare">Da pagare</option>
        <option value="pagata_parziale">Pagata parzialmente</option>
        <option value="pagata">Pagata</option>
        <option value="stornata">Stornata</option>
      </select>
      <input type="date" id="f-da" title="Scadenza da">
      <input type="date" id="f-a" title="Scadenza a">
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
        <div class="muted" style="padding:6px 0">Fatture pagate/stornate di anni precedenti: si caricano aprendo questo pannello.</div>
      </div>
    </details>
    <div class="drop-page-overlay" id="drop-overlay"><div class="box">📎 Rilascia qui i file per caricare le fatture</div></div>
  </div>`);
  view.appendChild(wrap);

  // Drag&drop di file PDF/immagini/XML ovunque sulla pagina, non solo dal
  // pulsante "Carica PDF/XML": conta gli enter/leave perché dragleave scatta
  // anche passando sopra un elemento figlio, non solo uscendo dalla pagina.
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
    if (e.dataTransfer.files.length) apriUpload(ctx, ricarica, e.dataTransfer.files);
  });

  renderStats(wrap.querySelector('#stats'), tutte, filtraSoloAperte, filtraScadute, filtraInScadenza7, pagatoMese, pagatoAnno);
  renderAlert(wrap.querySelector('#alert-zone'), tutte);
  if (state.q) wrap.querySelector('#q').value = state.q;

  // L'archivio si carica solo alla prima apertura (evento nativo "toggle"
  // del <details>): non serve altro codice per renderlo raggiungibile da
  // tastiera, <summary> lo è già di suo. Viene però caricato anche da solo
  // appena si usa un filtro o la ricerca (vedi filtriAttivi/refreshTable):
  // prima una fattura vecchia già pagata non veniva trovata cercandola, e
  // sembrava non essere mai stata inserita.
  async function caricaArchivio() {
    if (archivioCaricato) return;
    const zona = wrap.querySelector('#archivio-zone');
    clear(zona);
    zona.appendChild(el('<div class="spinner" style="margin:20px auto"></div>'));
    try {
      archivio = await fatture.listArchivio();
      archivioCaricato = true;
      disegnaArchivio();
    } catch (e) {
      clear(zona);
      zona.appendChild(el(`<div class="empty-state"><div class="big">⚠️</div><p>Errore: ${esc(e.message)}</p></div>`));
    }
  }
  wrap.querySelector('#archivio').addEventListener('toggle', (e) => { if (e.target.open) caricaArchivio(); });

  // Gli stessi filtri della tabella principale valgono anche per l'archivio:
  // altrimenti il pannello mostrava sempre tutto, ignorando la ricerca appena
  // digitata sopra.
  function disegnaArchivio() {
    if (!archivioCaricato) return;
    renderTable(wrap.querySelector('#archivio-zone'), applyFilters(archivio), ctx, ricarica, proposteInAttesa);
  }

  function filtriAttivi() {
    return !!(state.q || state.stato || state.da || state.aData || state.importoMin || state.importoMax);
  }

  function applyFilters(sorgente = tutte) {
    let r = sorgente;
    if (state.soloAperte) r = r.filter(f => !STATI_CHIUSI.includes(f.stato));
    if (state.q) {
      const q = state.q.toLowerCase();
      r = r.filter(f => (f.fornitore || '').toLowerCase().includes(q) || (f.numero_fattura || '').toLowerCase().includes(q) || (f.note || '').toLowerCase().includes(q));
    }
    if (state.stato) r = r.filter(f => f.stato === state.stato);
    if (state.da) r = r.filter(f => f.scadenza && f.scadenza >= state.da);
    if (state.aData) r = r.filter(f => f.scadenza && f.scadenza <= state.aData);
    if (state.importoMin) r = r.filter(f => Number(f.importo) >= Number(state.importoMin));
    if (state.importoMax) r = r.filter(f => Number(f.importo) <= Number(state.importoMax));
    return r;
  }

  // Righe da esportare: sempre TUTTE quelle che rispettano i filtri, archivio
  // compreso — se non è ancora stato scaricato lo si scarica adesso. Prima
  // l'export lavorava solo sul sottoinsieme "aperte" e ometteva in silenzio le
  // fatture chiuse di anni precedenti, anche col pannello archivio aperto.
  async function righeDaEsportare() {
    await caricaArchivio();
    return [...applyFilters(tutte), ...applyFilters(archivio)];
  }

  // Clic sulla card "Da pagare (totale)": filtra la tabella sulle fatture
  // ancora aperte, azzerando gli altri filtri per lo stesso motivo di
  // filtraInScadenza7 qui sotto.
  function filtraSoloAperte() {
    Object.assign(state, { q: '', stato: '', da: '', aData: '', importoMin: '', importoMax: '', soloAperte: true });
    wrap.querySelectorAll('#q,#f-stato,#f-da,#f-a,#f-min,#f-max').forEach(i => i.value = '');
    refreshTable();
  }

  // Clic sulla card "Scaduto e non pagato": stesso calcolo di renderStats
  // (fatture aperte con scadenza già passata), qui espresso come filtro per
  // data fino a ieri incluso.
  function filtraScadute() {
    const isoIeri = sommaGiorniISO(todayISO(), -1);
    Object.assign(state, { q: '', stato: '', da: '', aData: isoIeri, importoMin: '', importoMax: '', soloAperte: true });
    wrap.querySelector('#q').value = '';
    wrap.querySelector('#f-stato').value = '';
    wrap.querySelector('#f-da').value = '';
    wrap.querySelector('#f-a').value = isoIeri;
    wrap.querySelector('#f-min').value = '';
    wrap.querySelector('#f-max').value = '';
    refreshTable();
  }

  // Clic sulla card "In scadenza (7 giorni)": filtra la tabella sotto sulle
  // sole fatture di quella card (stesso calcolo di renderStats), azzerando
  // gli altri filtri perché altrimenti potrebbero contraddirla silenziosamente
  // (es. uno stato già scelto che esclude proprio quelle fatture).
  function filtraInScadenza7() {
    const isoOggi = todayISO();
    const isoTra7 = sommaGiorniISO(isoOggi, 7);
    Object.assign(state, { q: '', stato: '', da: isoOggi, aData: isoTra7, importoMin: '', importoMax: '', soloAperte: true });
    wrap.querySelector('#q').value = '';
    wrap.querySelector('#f-stato').value = '';
    wrap.querySelector('#f-da').value = isoOggi;
    wrap.querySelector('#f-a').value = isoTra7;
    wrap.querySelector('#f-min').value = '';
    wrap.querySelector('#f-max').value = '';
    refreshTable();
  }

  function refreshTable() {
    renderTable(wrap.querySelector("#tbl-zone"), applyFilters(), ctx, ricarica, proposteInAttesa);
    mostraNotaSenzaScadenza();
    // Appena si cerca o si filtra, l'archivio va caricato e filtrato anche
    // lui: chi cerca una fattura del 2025 già pagata deve trovarla, non
    // ricevere "nessun risultato".
    if (filtriAttivi() && !archivioCaricato) caricaArchivio();
    else disegnaArchivio();
    aggiornaConteggioArchivio();
  }

  // Il titolo del pannello dice quante fatture archiviate rientrano nei
  // filtri correnti, così il risultato è visibile senza doverlo aprire.
  function aggiornaConteggioArchivio() {
    const zona = wrap.querySelector('#archivio-conta');
    if (!archivioCaricato) { zona.textContent = contaArchivio; return; }
    const trovate = applyFilters(archivio).length;
    zona.textContent = filtriAttivi() ? `${trovate} di ${archivio.length}` : archivio.length;
  }

  // Un filtro per data esclude necessariamente le fatture prive di scadenza:
  // senza avvisare, sembravano sparite. Qui lo si dice esplicitamente.
  function mostraNotaSenzaScadenza() {
    const zona = wrap.querySelector("#nota-filtri");
    const filtroData = !!(state.da || state.aData);
    const escluse = filtroData ? tutte.filter(f => !f.scadenza).length : 0;
    zona.textContent = escluse
      ? escluse + (escluse === 1 ? " fattura senza data di scadenza non rientra" : " fatture senza data di scadenza non rientrano") + " nel filtro per data."
      : "";
  }

  // Una modifica può spostare una fattura da un sottoinsieme all'altro (es.
  // rimuovere un pagamento su una fattura archiviata la riapre, facendola
  // rientrare fra le "aperte"): per questo si ricaricano sempre entrambi il
  // sottoinsieme attivo E, se il pannello è già aperto, l'archivio — non solo
  // quello da cui è partita la modifica.
  async function ricarica() {
    const { inizioMese, fineMese, inizioAnno, fineAnno } = confiniPeriodoCorrente();
    // Niente `let contaArchivio` qui: dichiararlo di nuovo mascherava quello
    // esterno, che restava fermo al valore del primo caricamento.
    [tutte, pagatoMese, pagatoAnno, contaArchivio] = await Promise.all([
      fatture.listAperte(),
      pagamenti.sommaPeriodo(inizioMese, fineMese),
      pagamenti.sommaPeriodo(inizioAnno, fineAnno),
      fatture.contaArchivio(),
    ]);
    proposteInAttesa = await caricaProposteInAttesa();
    // L'archivio va riletto se era già stato scaricato, non solo se il
    // pannello è aperto: da quando ricerca ed export lo usano, può essere in
    // memoria anche a pannello chiuso.
    if (archivioCaricato) { archivioCaricato = false; await caricaArchivio(); }
    renderStats(wrap.querySelector('#stats'), tutte, filtraSoloAperte, filtraScadute, filtraInScadenza7, pagatoMese, pagatoAnno);
    renderAlert(wrap.querySelector('#alert-zone'), tutte);
    refreshTable();
  }

  // Un tocco manuale a un qualsiasi altro filtro esce dalla vista "solo
  // aperte" impostata da filtraInScadenza7: altrimenti scegliere ad es. lo
  // stato "Pagata" darebbe sempre zero risultati, in contraddizione silenziosa
  // con quel filtro rimasto attivo dietro le quinte.
  const onSearch = debounce(v => { state.q = v; state.soloAperte = false; refreshTable(); }, 250);
  wrap.querySelector('#q').addEventListener('input', e => onSearch(e.target.value));
  wrap.querySelector('#f-stato').addEventListener('change', e => { state.stato = e.target.value; state.soloAperte = false; refreshTable(); });
  wrap.querySelector('#f-da').addEventListener('change', e => { state.da = e.target.value; state.soloAperte = false; refreshTable(); });
  wrap.querySelector('#f-a').addEventListener('change', e => { state.aData = e.target.value; state.soloAperte = false; refreshTable(); });
  wrap.querySelector('#f-min').addEventListener('input', debounce(e => { state.importoMin = e.target.value; state.soloAperte = false; refreshTable(); }, 250));
  wrap.querySelector('#f-max').addEventListener('input', debounce(e => { state.importoMax = e.target.value; state.soloAperte = false; refreshTable(); }, 250));
  wrap.querySelector('#f-reset').addEventListener('click', () => {
    Object.assign(state, { q: '', stato: '', da: '', aData: '', importoMin: '', importoMax: '', soloAperte: false });
    wrap.querySelectorAll('#q,#f-stato,#f-da,#f-a,#f-min,#f-max').forEach(i => i.value = '');
    refreshTable();
  });
  collegaExport('#exp-csv', exportXLSX);
  collegaExport('#exp-pdf', exportPDF);

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
  wrap.querySelector('#nuova').addEventListener('click', () => apriEditor(null, ctx, ricarica));
  wrap.querySelector('#carica').addEventListener('click', () => apriUpload(ctx, ricarica));
  wrap.querySelector('#nuova-nc').addEventListener('click', () => apriNuovaNotaCredito(ctx, ricarica));

  refreshTable();
}

// Mappa fattura_id -> n. proposte in attesa: usata solo per mostrare un
// avviso accanto allo stato, così non si propone due volte la stessa cosa
// senza accorgersene. Se la tabella non esiste ancora (patch SQL non
// eseguita) si degrada in silenzio a "nessuna proposta", senza rompere la
// dashboard.
async function caricaProposteInAttesa() {
  try { return await proposte.conteggioInAttesa(); }
  catch { return new Map(); }
}

// `tutte` è il sottoinsieme "attivo" (fatture.listAperte): esclude le
// fatture chiuse di anni precedenti, ormai in archivio. Non cambia nulla per
// i totali di questa funzione (dovuto/scaduto/in scadenza riguardano solo
// fatture ancora aperte, sempre presenti in `tutte` a prescindere dall'anno)
// tranne "Pagato questo mese/anno", che infatti arriva già calcolato da fuori
// (pagamenti.sommaPeriodo, indipendente da cosa è archiviato).
function renderStats(node, tutte, onClickTotale, onClickScadute, onClickInScadenza7, pagatoMese, pagatoAnno) {
  clear(node);
  const nonPagate = tutte.filter(f => !STATI_CHIUSI.includes(f.stato));
  const totaleDovuto = nonPagate.reduce((s, f) => s + f._residuo, 0);
  const oggi = todayISO();
  const scadute = nonPagate.filter(f => f.scadenza && f.scadenza < oggi);
  const totaleScaduto = scadute.reduce((s, f) => s + f._residuo, 0);
  const annoCorrente = oggi.slice(0, 4);
  const inScadenza7 = nonPagate.filter(f => { const g = giorniDa(f.scadenza); return g !== null && g >= 0 && g <= 7; });

  const cards = [
    { k: 'DA PAGARE (TOTALE)', v: fmtEuro(totaleDovuto), s: `${nonPagate.length} fatture`, cls: 'accent', onClick: onClickTotale, titolo: 'Filtra la tabella su queste fatture' },
    { k: 'SCADUTO E NON PAGATO', v: fmtEuro(totaleScaduto), s: `${scadute.length} fatture in ritardo`, cls: totaleScaduto > 0 ? 'warn' : '', onClick: onClickScadute, titolo: 'Filtra la tabella su queste fatture' },
    { k: 'IN SCADENZA (7 GIORNI)', v: inScadenza7.length, s: fmtEuro(inScadenza7.reduce((s, f) => s + f._residuo, 0)), cls: '', onClick: onClickInScadenza7, titolo: 'Filtra la tabella su queste fatture' },
    { k: 'PAGATO QUESTO MESE', v: fmtEuro(pagatoMese), s: new Date().toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }), cls: 'ok' },
    { k: 'PAGATO QUEST\'ANNO', v: fmtEuro(pagatoAnno), s: annoCorrente, cls: 'ok' },
  ];
  for (const c of cards) {
    const cardEl = el(`<div class="stat ${c.cls}" ${c.titolo ? `title="${esc(c.titolo)}"` : ''}><div class="k">${esc(c.k)}</div><div class="v">${c.v}</div><div class="s">${esc(String(c.s))}</div></div>`);
    if (c.onClick) { cardEl.classList.add('stat-clickable'); rendiCliccabile(cardEl, c.onClick); }
    node.appendChild(cardEl);
  }
}

function renderAlert(node, tutte) {
  clear(node);
  const oggi = todayISO();
  const nonPagate = tutte.filter(f => !STATI_CHIUSI.includes(f.stato) && f.scadenza);
  const scadute = nonPagate.filter(f => f.scadenza < oggi);
  const entro7 = nonPagate.filter(f => { const g = giorniDa(f.scadenza); return g >= 0 && g <= 7; });
  if (!scadute.length && !entro7.length) return;
  const parts = [];
  if (scadute.length) parts.push(`<b>⚠️ ${scadute.length} fattura/e scadute e non pagate</b>`);
  if (entro7.length) parts.push(`<div style="margin-top:${scadute.length ? '10px' : '0'}"><b>⏰ ${entro7.length} fattura/e in scadenza nei prossimi 7 giorni</b></div>`);
  node.appendChild(el(`<div class="banner ${scadute.length ? 'danger' : 'warn'}"><div class="bi">${scadute.length ? '⚠️' : '⏰'}</div><div>${parts.join('')}</div></div>`));
}

function renderTable(node, righe, ctx, ricarica, proposteInAttesa) {
  clear(node);
  if (!righe.length) { node.appendChild(el(`<div class="empty-state"><div class="big">🧾</div><p>Nessuna fattura trovata con questi filtri.</p></div>`)); return; }
  const isAdmin = ctx.user.ruolo === 'admin';
  const azione = isAdmin ? apriPagamentoRapido : apriProponiPagamento;
  const titoloChip = isAdmin ? 'Clicca per segnare un pagamento' : 'Clicca per proporre un pagamento';
  const oggi = todayISO();
  const table = el(`<table class="tbl tbl-fatture"><thead><tr>
    <th>Fornitore</th><th>N. Fattura</th><th>Data</th><th class="money-col">Importo</th><th>Scadenza</th><th>Stato</th><th class="money-col">Residuo</th><th></th>
  </tr></thead><tbody></tbody></table>`);
  const tbody = table.querySelector('tbody');
  for (const f of righe) {
    const scaduta = !STATI_CHIUSI.includes(f.stato) && f.scadenza && f.scadenza < oggi;
    const nProposte = proposteInAttesa ? (proposteInAttesa.get(f.id) || 0) : 0;
    const tr = el(`<tr class="${scaduta ? 'scaduta' : ''}">
      <td>${esc(f.fornitore)}</td>
      <td>${esc(f.numero_fattura || '—')}</td>
      <td>${fmtDate(f.data_fattura)}</td>
      <td class="money money-col">${fmtEuro(f.importo)}</td>
      <td>${fmtDate(f.scadenza)}</td>
      <td>
        <span class="chip ${STATO_CHIP[f.stato] || ''}" ${!STATI_CHIUSI.includes(f.stato) ? `data-stato title="${esc(titoloChip)}"` : ''}>${STATO_LABEL[f.stato] || f.stato}</span>
        ${nProposte ? `<span class="chip" title="${isAdmin ? 'In attesa di conferma' : 'Hai già una proposta in attesa per questa fattura'}" style="margin-left:4px">📨 ${nProposte}</span>` : ''}
      </td>
      <td class="money money-col">${fmtEuro(f._residuo)}</td>
      <td style="text-align:right"><button class="btn ghost sm" data-edit>✏️</button></td>
    </tr>`);
    rendiCliccabile(tr, (e) => { if (!e.target.closest('[data-edit]') && !e.target.closest('[data-stato]')) apriEditor(f.id, ctx, ricarica); });
    tr.querySelector('[data-edit]').addEventListener('click', (e) => { e.stopPropagation(); apriEditor(f.id, ctx, ricarica); });
    const chipStato = tr.querySelector('[data-stato]');
    if (chipStato) rendiCliccabile(chipStato, (e) => { e.stopPropagation(); azione(f, ctx, ricarica); });
    tbody.appendChild(tr);
  }
  node.appendChild(table);
}
