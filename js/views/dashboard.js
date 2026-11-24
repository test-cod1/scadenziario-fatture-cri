import { fatture, pagamenti, proposte } from '../data/store.js';
import { el, clear, esc, fmtDate, fmtEuro, giorniDa, debounce, toast, rendiCliccabile, todayISO, sommaGiorniISO, fineMeseISO, parseEuro } from '../lib/ui.js';
import { FILTRO_FORNITORE_KEY, leggiFiltroSoggetto, nelSoggetto } from '../lib/filtriReport.js';
import { CAMPO_DECIMALE } from '../lib/importi.js';
import { ordinaRighe, prossimoOrdinamento, thOrdinabile, collegaOrdinamento } from '../lib/ordinaTabella.js';
import { selezionabile, totaleSelezione, potaSelezione } from '../lib/selezioneFatture.js';

// L'editor della fattura (con la lettura degli XML e l'anteprima dei file) e
// l'export Excel/PDF (con il generatore xlsx e lo zip) si caricano al primo
// clic che li usa, non all'apertura dell'elenco: sono la parte più pesante
// dello scadenziario e chi apre la pagina solo per guardare non li usa.
// Le funzioni qui sotto hanno gli stessi nomi di quelle di fattura.js, così
// i punti che le chiamano non cambiano.
const daEditor = (nome) => (...argomenti) => import('./fattura.js')
  .then(m => m[nome](...argomenti))
  .catch(e => toast('Impossibile aprire la fattura: ' + e.message, 'err'));
const apriEditor = daEditor('apriEditor');
const apriUpload = daEditor('apriUpload');
const apriPagamentoRapido = daEditor('apriPagamentoRapido');
const apriNuovaNotaCredito = daEditor('apriNuovaNotaCredito');
const apriPagamentoMultiplo = daEditor('apriPagamentoMultiplo');

const STATO_LABEL = { da_pagare: 'Da pagare', pagata_parziale: 'Pagata parz.', pagata: 'Pagata', stornata: 'Stornata' };
const STATO_CHIP = { da_pagare: 'warn', pagata_parziale: 'red', pagata: 'ok', stornata: 'info' };
const STATI_CHIUSI = ['pagata', 'stornata']; // niente altro da pagare: il chip non apre più pagamento/proposta

// Il debito con la cooperativa Il Biscione pesa da solo quanto tutto il resto
// messo insieme: la card «Da pagare» ha un interruttore per vedere il totale
// con o senza di lui. Si riconosce dal nome (nelle fatture registrate non c'è
// la partita IVA). La scelta si ricorda su questo browser; le altre card non
// cambiano.
const eBiscione = (f) => /biscione/i.test(f.fornitore || '');
const CHIAVE_BISCIONE = 'scadenziario.daPagareConBiscione';
function leggiConBiscione() {
  try { return localStorage.getItem(CHIAVE_BISCIONE) !== 'no'; } catch { return true; }
}
function salvaConBiscione(v) {
  try { localStorage.setItem(CHIAVE_BISCIONE, v ? 'si' : 'no'); } catch { /* niente memoria: pazienza */ }
}

// Colonne ordinabili con un clic sull'intestazione. Lo stato si ordina per
// avanzamento (da pagare → stornata), non in ordine alfabetico dell'etichetta.
const ORDINE_STATO = { da_pagare: 0, pagata_parziale: 1, pagata: 2, stornata: 3 };
const COLONNE = {
  fornitore: { get: f => f.fornitore, tipo: 'testo' },
  numero:    { get: f => f.numero_fattura, tipo: 'testo' },
  data:      { get: f => f.data_fattura, tipo: 'data' },
  importo:   { get: f => f.importo, tipo: 'numero' },
  scadenza:  { get: f => f.scadenza, tipo: 'data' },
  stato:     { get: f => ORDINE_STATO[f.stato], tipo: 'numero' },
  residuo:   { get: f => f._residuo, tipo: 'numero' },
};

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
  let tutte = [], pagatoMese = 0, pagatoAnno = 0, contaArchivio = 0, proposteInAttesa = new Map(), aggiornato = null;
  try {
    const { inizioMese, fineMese, inizioAnno, fineAnno } = confiniPeriodoCorrente();
    // Le proposte in attesa partono insieme alle altre letture: prima
    // aspettavano che fossero finite tutte, un giro di rete in più a ogni
    // apertura. caricaProposteInAttesa non fallisce mai (in caso di errore
    // restituisce un elenco vuoto), quindi non può far cadere le altre.
    [tutte, pagatoMese, pagatoAnno, contaArchivio, proposteInAttesa, aggiornato] = await Promise.all([
      fatture.listAperte(),
      pagamenti.sommaPeriodo(inizioMese, fineMese),
      pagamenti.sommaPeriodo(inizioAnno, fineAnno),
      fatture.contaArchivio(),
      caricaProposteInAttesa(),
      caricaAggiornamento(),
    ]);
  }
  catch (e) { view.appendChild(el(`<div class="empty-state"><div class="big">⚠️</div><p>Errore nel caricamento: ${esc(e.message)}</p></div>`)); return; }
  let archivioCaricato = false;
  let archivio = [];   // fatture chiuse di anni precedenti, caricate su richiesta (vedi caricaArchivio)

  // `sort` nullo = ordine di arrivo dal database (per scadenza). Non lo tocca
  // «Azzera filtri»: l'ordinamento non è un filtro, non toglie righe.
  // `soggetto`: il fornitore scelto nel Report, come gruppo (partita IVA e
  // grafie del nome), vedi lib/filtriReport.js. Nullo = nessun filtro.
  // `senzaBiscione`: lo imposta il clic su «Da pagare» quando l'interruttore
  // è spento; come `soloAperte`, lo toglie qualunque tocco manuale ai filtri.
  // `pagato`: { da, a, etichetta } impostato dal clic su «Pagato questo
  // mese/anno»: solo le fatture con almeno un pagamento in quel periodo. Si
  // toglie come `senzaBiscione`.
  let conBiscione = leggiConBiscione();
  const state = { q: '', soggetto: null, stato: '', da: '', aData: '', importoMin: '', importoMax: '', soloAperte: false, senzaBiscione: false, pagato: null, sort: null };
  const onSort = (campo) => { state.sort = prossimoOrdinamento(state.sort, campo); refreshTable(); };
  // Fatture spuntate per sommarne il residuo (vedi lib/selezioneFatture.js).
  // Restano spuntate anche cambiando ricerca o filtri, così si possono
  // mettere insieme fatture trovate con ricerche diverse; la barra in fondo
  // dice quante di loro non sono in vista.
  const selezionate = new Set();
  const selezione = {
    ids: selezionate,
    cambia(ids, si) { for (const id of ids) { if (si) selezionate.add(id); else selezionate.delete(id); } refreshTable(); },
  };
  // Arrivo da un click su un fornitore nel Report: preimposta la ricerca e
  // consuma subito la chiave, altrimenti resterebbe applicata a ogni rientro
  // nella dashboard finché non viene aperto di nuovo il Report.
  const filtroFornitore = sessionStorage.getItem(FILTRO_FORNITORE_KEY);
  if (filtroFornitore !== null) {
    const filtro = leggiFiltroSoggetto(filtroFornitore);
    if (filtro.partita_iva) state.soggetto = filtro; else state.q = filtro.testo;
    sessionStorage.removeItem(FILTRO_FORNITORE_KEY);
  }

  const wrap = el(`<div>
    <div class="page-head">
      <div><h1>Scadenziario Fatture</h1><p>Fatture fornitori — Croce Rossa Italiana — Comitato di Genova</p><p class="aggiornato" id="aggiornato" hidden></p></div>
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
      <input ${CAMPO_DECIMALE} id="f-min" placeholder="Importo min €" style="width:120px">
      <input ${CAMPO_DECIMALE} id="f-max" placeholder="Importo max €" style="width:120px">
      <button class="btn ghost sm" id="f-reset">Azzera filtri</button>
    </div>
    <div class="muted" id="filtro-soggetto" style="font-size:13px;margin:-8px 0 10px" hidden></div>
    <div class="muted" id="filtro-biscione" style="font-size:13px;margin:-8px 0 10px" hidden></div>
    <div class="muted" id="filtro-pagato" style="font-size:13px;margin:-8px 0 10px" hidden></div>
    <div class="muted" id="nota-filtri" style="font-size:13px;margin:-8px 0 10px"></div>
    <div class="card"><div class="card-b tbl-wrap" id="tbl-zone"></div></div>
    <div class="barra-selezione" id="barra-selezione" role="status" aria-live="polite" hidden></div>
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

  disegnaStats();
  renderAlert(wrap.querySelector('#alert-zone'), tutte);
  renderAggiornamento(wrap.querySelector('#aggiornato'), aggiornato);
  if (state.q) wrap.querySelector('#q').value = state.q;

  function disegnaStats() {
    renderStats(wrap.querySelector('#stats'), tutte, filtraSoloAperte, filtraScadute, () => filtraPagato('mese'), () => filtraPagato('anno'), pagatoMese, pagatoAnno, conBiscione, cambiaBiscione);
  }

  // L'interruttore cambia il totale della card; se la tabella sta mostrando
  // proprio le fatture di quella card, segue anche lei.
  function cambiaBiscione(v) {
    conBiscione = v;
    salvaConBiscione(v);
    disegnaStats();
    const vistaTotale = state.soloAperte && !state.da && !state.aData;
    if (vistaTotale) { state.senzaBiscione = !v; refreshTable(); }
  }

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
    renderTable(wrap.querySelector('#archivio-zone'), applyFilters(archivio), ctx, ricarica, proposteInAttesa, state.sort, onSort);
  }

  function filtriAttivi() {
    return !!(state.q || state.soggetto || state.stato || state.da || state.aData || state.importoMin || state.importoMax || state.pagato);
  }

  function applyFilters(sorgente = tutte) {
    let r = sorgente;
    if (state.soloAperte) r = r.filter(f => !STATI_CHIUSI.includes(f.stato));
    if (state.senzaBiscione) r = r.filter(f => !eBiscione(f));
    if (state.pagato) {
      const { da, a } = state.pagato;
      r = r.filter(f => (f.pagamenti || []).some(pg => pg.data_pagamento && pg.data_pagamento >= da && pg.data_pagamento <= a));
    }
    if (state.soggetto) r = r.filter(f => nelSoggetto(state.soggetto, f, 'fornitore'));
    if (state.q) {
      const q = state.q.toLowerCase();
      r = r.filter(f => (q === 'f24' && f.tipo_documento === 'f24') || (f.fornitore || '').toLowerCase().includes(q) || (f.numero_fattura || '').toLowerCase().includes(q) || (f.note || '').toLowerCase().includes(q));
    }
    if (state.stato) r = r.filter(f => f.stato === state.stato);
    if (state.da) r = r.filter(f => f.scadenza && f.scadenza >= state.da);
    if (state.aData) r = r.filter(f => f.scadenza && f.scadenza <= state.aData);
    // parseEuro e non Number: i due campi accettano anche "1.234,56", che
    // Number() leggerebbe come NaN e il filtro lascerebbe passare tutto.
    const min = parseEuro(state.importoMin);
    if (min !== null) r = r.filter(f => Number(f.importo) >= min);
    const max = parseEuro(state.importoMax);
    if (max !== null) r = r.filter(f => Number(f.importo) <= max);
    return r;
  }

  // Righe da esportare: sempre TUTTE quelle che rispettano i filtri, archivio
  // compreso — se non è ancora stato scaricato lo si scarica adesso. Prima
  // l'export lavorava solo sul sottoinsieme "aperte" e ometteva in silenzio le
  // fatture chiuse di anni precedenti, anche col pannello archivio aperto.
  async function righeDaEsportare() {
    await caricaArchivio();
    // Nello stesso ordine scelto a video, se se n'è scelto uno.
    return ordinaRighe([...applyFilters(tutte), ...applyFilters(archivio)], state.sort, COLONNE);
  }

  // Clic sulla card "Da pagare (totale)": filtra la tabella sulle fatture
  // ancora aperte, azzerando gli altri filtri perché altrimenti potrebbero
  // contraddirla silenziosamente (es. uno stato già scelto che esclude
  // proprio quelle fatture).
  function filtraSoloAperte() {
    Object.assign(state, { q: '', soggetto: null, stato: '', da: '', aData: '', importoMin: '', importoMax: '', soloAperte: true, senzaBiscione: !conBiscione, pagato: null });
    wrap.querySelectorAll('#q,#f-stato,#f-da,#f-a,#f-min,#f-max').forEach(i => i.value = '');
    refreshTable();
  }

  // Clic su «Pagato questo mese» / «Pagato quest'anno»: le fatture con almeno
  // un pagamento nel periodo della card (stessi confini della somma), anche
  // già chiuse e anche in archivio. Azzera gli altri filtri come le altre card.
  function filtraPagato(periodo) {
    const { inizioMese, fineMese, inizioAnno, fineAnno } = confiniPeriodoCorrente();
    const pagato = periodo === 'mese'
      ? { da: inizioMese, a: fineMese, etichetta: new Date().toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }) }
      : { da: inizioAnno, a: fineAnno, etichetta: 'nel ' + inizioAnno.slice(0, 4) };
    if (periodo === 'mese') pagato.etichetta = 'a ' + pagato.etichetta;
    Object.assign(state, { q: '', soggetto: null, stato: '', da: '', aData: '', importoMin: '', importoMax: '', soloAperte: false, senzaBiscione: false, pagato });
    wrap.querySelectorAll('#q,#f-stato,#f-da,#f-a,#f-min,#f-max').forEach(i => i.value = '');
    refreshTable();
  }

  // Clic sulla card "Scaduto e non pagato": stesso calcolo di renderStats
  // (fatture aperte con scadenza già passata), qui espresso come filtro per
  // data fino a ieri incluso.
  function filtraScadute() {
    const isoIeri = sommaGiorniISO(todayISO(), -1);
    Object.assign(state, { q: '', soggetto: null, stato: '', da: '', aData: isoIeri, importoMin: '', importoMax: '', soloAperte: true, senzaBiscione: false, pagato: null });
    wrap.querySelector('#q').value = '';
    wrap.querySelector('#f-stato').value = '';
    wrap.querySelector('#f-da').value = '';
    wrap.querySelector('#f-a').value = isoIeri;
    wrap.querySelector('#f-min').value = '';
    wrap.querySelector('#f-max').value = '';
    refreshTable();
  }

  function refreshTable() {
    const visibili = applyFilters();
    renderTable(wrap.querySelector("#tbl-zone"), visibili, ctx, ricarica, proposteInAttesa, state.sort, onSort, selezione);
    mostraSelezione(visibili);
    mostraFiltroSoggetto();
    mostraFiltroBiscione();
    mostraFiltroPagato();
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

  // Barra in fondo con il totale delle fatture spuntate: c'è solo finché se
  // ne spunta almeno una.
  function mostraSelezione(visibili) {
    const zona = wrap.querySelector('#barra-selezione');
    clear(zona);
    const scelte = tutte.filter(f => selezionate.has(f.id));
    zona.hidden = !scelte.length;
    if (!scelte.length) return;
    const t = totaleSelezione(scelte);
    const idVisibili = new Set(visibili.map(f => f.id));
    const nascoste = scelte.filter(f => !idVisibili.has(f.id)).length;
    const dettagli = [];
    if (t.giaVersato > 0) dettagli.push(`importo ${fmtEuro(t.importo)}, già pagato o stornato ${fmtEuro(t.giaVersato)}`);
    if (nascoste) dettagli.push(`<b>${nascoste === 1 ? '1 non è in vista' : nascoste + ' non sono in vista'}</b> con i filtri attuali`);
    zona.appendChild(el(`<div class="barra-selezione-in">
      <div class="barra-selezione-testo">
        <div><b>${t.n === 1 ? '1 fattura selezionata' : t.n + ' fatture selezionate'}</b> · Totale da pagare <b class="barra-selezione-totale">${fmtEuro(t.residuo)}</b></div>
        ${dettagli.length ? `<div class="barra-selezione-nota">${dettagli.join(' · ')}</div>` : ''}
      </div>
      <div class="barra-selezione-azioni">
        <button type="button" class="btn sm" data-copia title="Copia la cifra per incollarla nel bonifico">📋 Copia importo</button>
        <button type="button" class="btn ghost sm" data-svuota>Deseleziona</button>
        <button type="button" class="btn primary sm" data-paga title="Registra un pagamento per ciascuna fattura selezionata">✓ Segna come ${t.n === 1 ? 'pagata' : 'pagate'}</button>
      </div>
    </div>`));
    zona.querySelector('[data-paga]').addEventListener('click', () => apriPagamentoMultiplo(scelte, ctx, ricarica, proposteInAttesa));
    zona.querySelector('[data-svuota]').addEventListener('click', () => { selezionate.clear(); refreshTable(); });
    zona.querySelector('[data-copia]').addEventListener('click', async () => {
      // Senza simbolo né punti delle migliaia: è come lo vogliono i campi
      // importo dei bonifici on line.
      const cifra = t.residuo.toFixed(2).replace('.', ',');
      try { await navigator.clipboard.writeText(cifra); toast(`Copiato: ${cifra}`); }
      catch { toast('Copia non riuscita: seleziona la cifra a mano.', 'err'); }
    });
  }

  // Il filtro per soggetto non ha un campo suo nella barra: si dice qui quale
  // fornitore si sta guardando, con il modo di toglierlo (lo toglie anche
  // «Azzera filtri»).
  function mostraFiltroSoggetto() {
    const zona = wrap.querySelector('#filtro-soggetto');
    clear(zona);
    zona.hidden = !state.soggetto;
    if (!state.soggetto) return;
    zona.appendChild(el(`<span>Solo le fatture di <b>${esc(state.soggetto.nome || 'questo fornitore')}</b> (P.IVA ${esc(state.soggetto.partita_iva)}), con tutte le grafie del nome. <button type="button" class="btn ghost sm">Togli</button></span>`));
    zona.querySelector('button').addEventListener('click', () => { state.soggetto = null; refreshTable(); });
  }

  // Con l'interruttore spento il clic su «Da pagare» lascia fuori il
  // Biscione: lo si dice, altrimenti mancherebbero righe senza un perché.
  function mostraFiltroBiscione() {
    const zona = wrap.querySelector('#filtro-biscione');
    clear(zona);
    zona.hidden = !state.senzaBiscione;
    if (!state.senzaBiscione) return;
    zona.appendChild(el('<span>Senza le fatture del <b>Biscione</b>. <button type="button" class="btn ghost sm">Mostra anche quelle</button></span>'));
    zona.querySelector('button').addEventListener('click', () => { state.senzaBiscione = false; state.pagato = null; refreshTable(); });
  }

  function mostraFiltroPagato() {
    const zona = wrap.querySelector('#filtro-pagato');
    clear(zona);
    zona.hidden = !state.pagato;
    if (!state.pagato) return;
    zona.appendChild(el(`<span>Solo le fatture con un pagamento <b>${esc(state.pagato.etichetta)}</b>, comprese quelle già chiuse. <button type="button" class="btn ghost sm">Mostra tutte</button></span>`));
    zona.querySelector('button').addEventListener('click', () => { state.pagato = null; refreshTable(); });
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
  // Un errore qui non va lasciato cadere: `ricarica` viene invocata dalla
  // chiusura dei modali (`onClose`), dove nessuno aspetta la promise. Se la
  // rete cadeva proprio in quel momento si aveva un rifiuto non gestito,
  // nessun messaggio e la tabella ferma ai dati vecchi — che è esattamente
  // l'aria di "il salvataggio non è andato a buon fine".
  async function ricarica() {
    try {
      const { inizioMese, fineMese, inizioAnno, fineAnno } = confiniPeriodoCorrente();
      // Niente `let contaArchivio` qui: dichiararlo di nuovo mascherava quello
      // esterno, che restava fermo al valore del primo caricamento.
      [tutte, pagatoMese, pagatoAnno, contaArchivio, proposteInAttesa, aggiornato] = await Promise.all([
        fatture.listAperte(),
        pagamenti.sommaPeriodo(inizioMese, fineMese),
        pagamenti.sommaPeriodo(inizioAnno, fineAnno),
        fatture.contaArchivio(),
        caricaProposteInAttesa(),
        caricaAggiornamento(),
      ]);
      // L'archivio va riletto se era già stato scaricato, non solo se il
      // pannello è aperto: da quando ricerca ed export lo usano, può essere in
      // memoria anche a pannello chiuso.
      if (archivioCaricato) { archivioCaricato = false; await caricaArchivio(); }
      potaSelezione(selezionate, tutte);
      disegnaStats();
      renderAlert(wrap.querySelector('#alert-zone'), tutte);
      renderAggiornamento(wrap.querySelector('#aggiornato'), aggiornato);
      refreshTable();
    } catch (e) {
      toast('Aggiornamento non riuscito: ' + e.message + ' — ricarica la pagina.', 'err');
    }
  }

  // Un tocco manuale a un qualsiasi altro filtro esce dalla vista "solo
  // aperte" impostata dalle card in cima: altrimenti scegliere ad es. lo
  // stato "Pagata" darebbe sempre zero risultati, in contraddizione silenziosa
  // con quel filtro rimasto attivo dietro le quinte.
  const onSearch = debounce(v => { state.q = v; state.soloAperte = false; state.senzaBiscione = false; state.pagato = null; refreshTable(); }, 250);
  wrap.querySelector('#q').addEventListener('input', e => onSearch(e.target.value));
  wrap.querySelector('#f-stato').addEventListener('change', e => { state.stato = e.target.value; state.soloAperte = false; state.senzaBiscione = false; state.pagato = null; refreshTable(); });
  wrap.querySelector('#f-da').addEventListener('change', e => { state.da = e.target.value; state.soloAperte = false; state.senzaBiscione = false; state.pagato = null; refreshTable(); });
  wrap.querySelector('#f-a').addEventListener('change', e => { state.aData = e.target.value; state.soloAperte = false; state.senzaBiscione = false; state.pagato = null; refreshTable(); });
  wrap.querySelector('#f-min').addEventListener('input', debounce(e => { state.importoMin = e.target.value; state.soloAperte = false; state.senzaBiscione = false; state.pagato = null; refreshTable(); }, 250));
  wrap.querySelector('#f-max').addEventListener('input', debounce(e => { state.importoMax = e.target.value; state.soloAperte = false; state.senzaBiscione = false; state.pagato = null; refreshTable(); }, 250));
  wrap.querySelector('#f-reset').addEventListener('click', () => {
    Object.assign(state, { q: '', soggetto: null, stato: '', da: '', aData: '', importoMin: '', importoMax: '', soloAperte: false, senzaBiscione: false, pagato: null });
    wrap.querySelectorAll('#q,#f-stato,#f-da,#f-a,#f-min,#f-max').forEach(i => i.value = '');
    refreshTable();
  });
  collegaExport('#exp-csv', 'exportXLSX');
  collegaExport('#exp-pdf', 'exportPDF');

  // L'export può dover prima scaricare l'archivio: si disabilita il pulsante
  // nel frattempo, così non si generano due file per un doppio click. Il
  // modulo dell'export si scarica in parallelo alle righe.
  function collegaExport(selettore, esporta) {
    const btn = wrap.querySelector(selettore);
    btn.addEventListener('click', async () => {
      const old = btn.innerHTML;
      btn.disabled = true; btn.innerHTML = '<span class="spinner sm"></span> Preparazione…';
      try {
        const [righe, modulo] = await Promise.all([righeDaEsportare(), import('../lib/export.js')]);
        modulo[esporta](righe);
      }
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

// Data dell'ultima fattura e dell'ultimo pagamento registrati, per sapere a
// colpo d'occhio fin dove è aggiornato lo scadenziario. Come le proposte,
// non fa mai cadere la pagina: se la lettura non riesce la riga non compare.
async function caricaAggiornamento() {
  try {
    const [fattura, pagamento] = await Promise.all([fatture.ultima(), pagamenti.ultimo()]);
    return { fattura, pagamento };
  } catch { return null; }
}

function renderAggiornamento(node, aggiornato) {
  clear(node);
  const { fattura, pagamento } = aggiornato || {};
  node.hidden = !fattura && !pagamento;
  if (node.hidden) return;
  const pezzi = [];
  if (fattura) pezzi.push(`ultima fattura del <b>${fmtDate(fattura.data_fattura)}</b>`);
  if (pagamento) pezzi.push(`ultimo pagamento del <b>${fmtDate(pagamento.data_pagamento)}</b>`);
  node.innerHTML = 'Aggiornato a: ' + pezzi.join(' · ');
}

// `tutte` è il sottoinsieme "attivo" (fatture.listAperte): esclude le
// fatture chiuse di anni precedenti, ormai in archivio. Non cambia nulla per
// i totali di questa funzione (dovuto/scaduto/in scadenza riguardano solo
// fatture ancora aperte, sempre presenti in `tutte` a prescindere dall'anno)
// tranne "Pagato questo mese/anno", che infatti arriva già calcolato da fuori
// (pagamenti.sommaPeriodo, indipendente da cosa è archiviato).
function renderStats(node, tutte, onClickTotale, onClickScadute, onClickPagatoMese, onClickPagatoAnno, pagatoMese, pagatoAnno, conBiscione, onCambiaBiscione) {
  clear(node);
  const nonPagate = tutte.filter(f => !STATI_CHIUSI.includes(f.stato));
  const daPagare = conBiscione ? nonPagate : nonPagate.filter(f => !eBiscione(f));
  const totaleDovuto = daPagare.reduce((s, f) => s + f._residuo, 0);
  const oggi = todayISO();
  const scadute = nonPagate.filter(f => f.scadenza && f.scadenza < oggi);
  const totaleScaduto = scadute.reduce((s, f) => s + f._residuo, 0);
  const annoCorrente = oggi.slice(0, 4);

  const cards = [
    { k: conBiscione ? 'DA PAGARE (TOTALE)' : 'DA PAGARE (SENZA BISCIONE)', v: fmtEuro(totaleDovuto), s: `${daPagare.length} fatture`, cls: 'accent', onClick: onClickTotale, titolo: 'Filtra la tabella su queste fatture', interruttore: true },
    { k: 'SCADUTO E NON PAGATO', v: fmtEuro(totaleScaduto), s: `${scadute.length} fatture in ritardo`, cls: totaleScaduto > 0 ? 'warn' : '', onClick: onClickScadute, titolo: 'Filtra la tabella su queste fatture' },
    { k: 'PAGATO QUESTO MESE', v: fmtEuro(pagatoMese), s: new Date().toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }), cls: 'ok', onClick: onClickPagatoMese, titolo: 'Filtra la tabella sulle fatture pagate questo mese' },
    { k: 'PAGATO QUEST\'ANNO', v: fmtEuro(pagatoAnno), s: annoCorrente, cls: 'ok', onClick: onClickPagatoAnno, titolo: 'Filtra la tabella sulle fatture pagate quest\'anno' },
  ];
  for (const c of cards) {
    const cardEl = el(`<div class="stat ${c.cls}" ${c.titolo ? `title="${esc(c.titolo)}"` : ''}><div class="k">${esc(c.k)}</div><div class="v">${c.v}</div><div class="s">${esc(String(c.s))}</div></div>`);
    if (c.onClick) { cardEl.classList.add('stat-clickable'); rendiCliccabile(cardEl, c.onClick); }
    if (c.interruttore) {
      const sw = el(`<label class="interruttore" title="Acceso: il totale comprende Il Biscione. Spento: lo lascia fuori."><input type="checkbox" role="switch" ${conBiscione ? 'checked' : ''}><span class="interruttore-pista" aria-hidden="true"></span>Biscione</label>`);
      // Il clic e i tasti sull'interruttore non devono arrivare alla card,
      // che altrimenti filtrerebbe la tabella.
      sw.addEventListener('click', e => e.stopPropagation());
      sw.addEventListener('keydown', e => e.stopPropagation());
      sw.querySelector('input').addEventListener('change', e => onCambiaBiscione(e.target.checked));
      cardEl.appendChild(sw);
    }
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
  node.appendChild(el(`<div class="banner ${scadute.length ? 'danger' : 'warn'}"><div>${parts.join('')}</div></div>`));
}

// `selezione` ({ ids, cambia }) aggiunge la colonna delle caselle per sommare
// più fatture; l'archivio non la passa: lì sono tutte già chiuse.
function renderTable(node, righe, ctx, ricarica, proposteInAttesa, sort, onSort, selezione = null) {
  clear(node);
  if (!righe.length) { node.appendChild(el(`<div class="empty-state"><div class="big">🧾</div><p>Nessuna fattura trovata con questi filtri.</p></div>`)); return; }
  // La casella in intestazione spunta (o toglie) le sole fatture in vista che
  // si possono pagare: cercato un fornitore, un clic le prende tutte.
  const spuntabili = selezione ? righe.filter(selezionabile).map(f => f.id) : [];
  const nSpuntate = spuntabili.filter(id => selezione.ids.has(id)).length;
  const thSelezione = !selezione ? '' : `<th class="col-sel">${spuntabili.length
    ? `<input type="checkbox" class="sel-fattura" data-sel-tutte aria-label="Seleziona tutte le fatture da pagare in elenco" title="Seleziona tutte le fatture da pagare in elenco" ${nSpuntate === spuntabili.length ? 'checked' : ''}>`
    : ''}</th>`;
  const isAdmin = ctx.user.ruolo === 'admin';
  // Anche l'operatore registra i pagamenti (dal 18/11/2026): il chip apre
  // per tutti il pagamento rapido, che offre a sua volta «Proponi pagamento».
  const azione = apriPagamentoRapido;
  const titoloChip = 'Clicca per segnare un pagamento';
  const oggi = todayISO();
  const table = el(`<table class="tbl tbl-fatture"><thead><tr>
    ${thSelezione}${thOrdinabile('Fornitore', 'fornitore', sort)}${thOrdinabile('N. Fattura', 'numero', sort).replace('<th', '<th data-col-secondaria')}${thOrdinabile('Data', 'data', sort).replace('<th', '<th data-col-secondaria')}${thOrdinabile('Importo', 'importo', sort, 'money-col')}${thOrdinabile('Scadenza', 'scadenza', sort)}${thOrdinabile('Stato', 'stato', sort)}${thOrdinabile('Residuo', 'residuo', sort, 'money-col')}<th></th>
  </tr></thead><tbody></tbody></table>`);
  collegaOrdinamento(table, onSort);
  const tbody = table.querySelector('tbody');
  for (const f of ordinaRighe(righe, sort, COLONNE)) {
    const scaduta = !STATI_CHIUSI.includes(f.stato) && f.scadenza && f.scadenza < oggi;
    const nProposte = proposteInAttesa ? (proposteInAttesa.get(f.id) || 0) : 0;
    const spuntata = !!selezione && selezione.ids.has(f.id);
    const tdSelezione = !selezione ? '' : `<td class="col-sel" data-sel-cella>${selezionabile(f)
      ? `<input type="checkbox" class="sel-fattura" data-sel aria-label="Seleziona per il totale: ${esc(f.fornitore)} ${esc(f.numero_fattura || '')}" ${spuntata ? 'checked' : ''}>`
      : ''}</td>`;
    const tr = el(`<tr class="${scaduta ? 'scaduta' : ''}${spuntata ? ' selezionata' : ''}">
      ${tdSelezione}<td>${f.tipo_documento === 'f24' ? '<span class="chip" title="Rata di modello F24, non una fattura">F24</span> ' : ''}${esc(f.fornitore)}${Number(f.ritenuta) > 0 ? ` <span class="chip" title="Ritenuta d'acconto ${esc(fmtEuro(f.ritenuta))}: si versa con l'F24 entro il 16 del mese dopo il pagamento">RA</span>` : ''}</td>
      <td data-col-secondaria>${esc(f.numero_fattura || '—')}</td>
      <td data-col-secondaria>${fmtDate(f.data_fattura)}</td>
      <td class="money money-col">${fmtEuro(f.importo)}</td>
      <td>${fmtDate(f.scadenza)}</td>
      <td>
        <span class="chip ${STATO_CHIP[f.stato] || ''}" ${!STATI_CHIUSI.includes(f.stato) ? `data-stato title="${esc(titoloChip)}"` : ''}>${STATO_LABEL[f.stato] || f.stato}</span>
        ${nProposte ? `<span class="chip" title="${isAdmin ? 'In attesa di conferma' : 'Hai già una proposta in attesa per questa fattura'}" style="margin-left:4px">📨 ${nProposte}</span>` : ''}
      </td>
      <td class="money money-col">${fmtEuro(f._residuo)}</td>
      <td style="text-align:right"><button class="btn ghost sm" data-edit>✏️</button></td>
    </tr>`);
    rendiCliccabile(tr, (e) => { if (!e.target.closest('[data-edit]') && !e.target.closest('[data-stato]') && !e.target.closest('[data-sel-cella]')) apriEditor(f.id, ctx, ricarica); });
    // Tutta la cella della casella la spunta (bersaglio più comodo), senza
    // aprire la fattura come farebbe il clic sul resto della riga.
    const cellaSel = tr.querySelector('[data-sel-cella]');
    if (cellaSel) {
      const casella = cellaSel.querySelector('[data-sel]');
      cellaSel.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!casella) return;
        if (e.target !== casella) casella.checked = !casella.checked;
        selezione.cambia([f.id], casella.checked);
      });
      cellaSel.addEventListener('keydown', (e) => e.stopPropagation());
    }
    tr.querySelector('[data-edit]').addEventListener('click', (e) => { e.stopPropagation(); apriEditor(f.id, ctx, ricarica); });
    const chipStato = tr.querySelector('[data-stato]');
    if (chipStato) rendiCliccabile(chipStato, (e) => { e.stopPropagation(); azione(f, ctx, ricarica); });
    tbody.appendChild(tr);
  }
  const selTutte = table.querySelector('[data-sel-tutte]');
  if (selTutte) {
    selTutte.indeterminate = nSpuntate > 0 && nSpuntate < spuntabili.length;
    selTutte.addEventListener('click', (e) => { e.stopPropagation(); selezione.cambia(spuntabili, selTutte.checked); });
  }
  node.appendChild(table);
}
