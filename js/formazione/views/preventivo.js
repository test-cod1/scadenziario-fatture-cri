import { preventivi } from '../data/store.js';
import { calcola, inLettere, rigaDaCorso, oggettoProposto, ALIQUOTA_IVA } from '../calc.js';
import { etichettaSconto } from '../lib/documento.js';
import { el, clear, esc, toast, confirmDialog, fmtEuro, todayISO } from '../../lib/ui.js';
import { sorvegliaUscita, armaGuardiaIndietro } from '../../lib/uscita.js';
import { INIZIO_ANNO, dataAmmessa, MSG_DATA } from '../date.js';
import { CAMPO_DECIMALE, testoDecimale, leggiDecimale, leggiDecimaleO0 } from '../../lib/importi.js';

// ============================================================
//  EDITOR DEL PREVENTIVO DI FORMAZIONE
//  Quattro blocchi in fila: a chi va il preventivo, quali corsi si propongono
//  (con quante persone e a che prezzo), dove si tengono, e come si chiude il
//  conto — sconti, IVA, note. A destra il riepilogo si aggiorna a ogni
//  modifica.
//
//  Il pezzo che conta è quello dei corsi: ogni riga è una copia del corso
//  preso dal catalogo, e resta modificabile qui dentro. Così il preventivo
//  fatto oggi continuerà a mostrare i prezzi di oggi anche quando il catalogo
//  sarà cambiato.
// ============================================================

const avvisaData = () => toast(MSG_DATA, 'err');

const REGIMI = [
  ['nessuno', 'Nessuna indicazione'],
  ['esente', 'Esente IVA (art. 10)'],
  ['soggetto', `Soggetto a IVA ${ALIQUOTA_IVA}%`],
];

export async function renderPreventivo(view, id, ctx) {
  const imp = ctx.imp;
  let prev;
  if (id) {
    try { prev = await preventivi.get(id); }
    catch (e) { view.appendChild(el(`<div class="empty-state"><div class="big">⚠️</div><p>Preventivo non trovato: ${esc(e.message)}</p></div>`)); return; }
    prev.righe = prev.righe || [];
  } else {
    prev = nuovoPreventivo(imp);
  }

  // Un preventivo già scritto ha il suo oggetto: non va sovrascritto dalla
  // proposta automatica quando si aggiunge o si toglie un corso.
  let oggettoToccato = !!prev.oggetto;

  const head = el(`<div class="page-head">
    <div>
      <h1>${id ? 'Modifica preventivo' : 'Nuovo preventivo'}</h1>
      <p>Corsi di formazione per aziende ed enti</p>
    </div>
    <div class="inline">
      <a class="btn" href="#/formazione/preventivi">← Elenco</a>
      <button class="btn" id="btn-anteprima">👁 Anteprima</button>
      <button class="btn" id="btn-word">📄 Word</button>
      <button class="btn" id="btn-pdf">🖨️ Stampa / PDF</button>
      <button class="btn primary" id="btn-save">💾 Salva</button>
    </div>
  </div>`);
  view.appendChild(head);

  // Diventa true alla prima modifica e torna false quando si salva: da qui
  // dipende l'avviso in uscita.
  let sporco = false;
  const modificato = () => { sporco = true; armaGuardiaIndietro(); };

  const editor = el(`<div class="editor"><div class="col-main"></div><div class="summary"></div></div>`);
  view.appendChild(editor);
  const main = editor.querySelector('.col-main');
  const summary = editor.querySelector('.summary');

  // ---------- destinatario ----------
  const cDest = card('Destinatario', `
    <div class="rubrica-azioni">
      <button class="btn sm" id="btn-rubrica" type="button">📇 Scegli dalla rubrica</button>
      <button class="btn sm" id="btn-salva-cliente" type="button">➕ Salva in rubrica</button>
      <span class="mini">le aziende si riusano da un preventivo all'altro</span>
    </div>
    <div class="form-row">
      <div class="field"><label>Azienda / ente</label>
        <input type="text" id="cliente" value="${esc(prev.cliente || '')}"></div>
      <div class="field"><label>Codice fiscale / P.IVA</label><input type="text" id="cliente_cf" value="${esc(prev.cliente_cf || '')}"></div>
    </div>
    <div class="field"><label>Indirizzo</label><input type="text" id="cliente_indirizzo" value="${esc(prev.cliente_indirizzo || '')}"></div>
    <div class="form-row three">
      <div class="field"><label>Referente (Alla c.a.)</label><input type="text" id="referente" value="${esc(prev.referente || '')}"></div>
      <div class="field"><label>Email</label><input type="text" id="referente_email" value="${esc(prev.referente_email || '')}"></div>
      <div class="field"><label>Telefono</label><input type="text" id="referente_telefono" value="${esc(prev.referente_telefono || '')}"></div>
    </div>`);
  main.appendChild(cDest);

  // ---------- documento ----------
  const cDoc = card('Il documento', `
    <div class="form-row">
      <div class="field"><label>Oggetto</label>
        <input type="text" id="oggetto" placeholder="PREVENTIVO CORSI BLSD" value="${esc(prev.oggetto || '')}">
        <div class="hint">Proposto dai corsi scelti finché non lo riscrivi tu.</div></div>
      <div class="field"><label>Numero di protocollo</label>
        <input type="text" id="protocollo" placeholder="lascia vuoto se non serve" value="${esc(prev.protocollo || '')}">
        <div class="hint">Se lo compili, nel documento compare «Prot. n. …» sopra la data.</div></div>
    </div>
    <div class="form-row">
      <div class="field"><label>Data del documento</label><input type="date" id="data_documento" min="${INIZIO_ANNO}" value="${esc(prev.data_documento || todayISO())}"></div>
      <div class="field"><label>Stato</label><select id="stato">
        ${['bozza', 'inviato', 'confermato', 'annullato'].map(s => `<option value="${s}" ${prev.stato === s ? 'selected' : ''}>${s[0].toUpperCase() + s.slice(1)}</option>`).join('')}
      </select></div>
    </div>`);
  main.appendChild(cDoc);

  // ---------- corsi ----------
  const cCorsi = card('Corsi proposti', `
    <p class="hint" style="margin:0 0 12px">Una riga per corso. Il <b>listino</b> è il prezzo pieno e il <b>prezzo riservato</b> quello offerto a questo cliente: nel documento il listino compare solo dove è più alto, come nella formula «euro 60 a discente, per Voi euro 55». Tutto quello che c'è qui arriva dal catalogo ed è modificabile: la modifica vale solo per questo preventivo.</p>
    <div class="cal-azioni" style="margin:0 0 4px">
      <select id="scelta-corso" aria-label="Corso da aggiungere">
        ${imp.corsi.map(c => `<option value="${esc(c.id)}">${esc(c.nome)}</option>`).join('')}
      </select>
      <button class="btn sm" id="add-corso" type="button">➕ Aggiungi</button>
      <span class="mini">oppure</span>
      <button class="btn sm" id="add-libero" type="button">Corso non in catalogo</button>
    </div>
    <div id="righe"></div>`);
  main.appendChild(cCorsi);

  // ---------- sede ----------
  const cSede = card('Sede del corso', `
    <div class="form-row">
      <div class="field"><label>Dove si svolge</label>
        <select id="sede_tipo">
          <option value="nostra" ${prev.sede_tipo !== 'cliente' ? 'selected' : ''}>Presso la nostra sede (Corso Gastaldi 11)</option>
          <option value="cliente" ${prev.sede_tipo === 'cliente' ? 'selected' : ''}>Presso il committente</option>
        </select></div>
      <div class="field" id="campo-trasferta"><label>Maggiorazione per la trasferta (€)</label>
        <input ${CAMPO_DECIMALE} id="trasferta" value="${testoDecimale(prev.trasferta)}" placeholder="0,00">
        <div class="hint">Si somma una volta sola al totale. Lasciala vuota se è già compresa nel prezzo.</div></div>
    </div>
    <div class="field" id="campo-sede"><label>Indirizzo della sede del committente</label>
      <input type="text" id="sede" value="${esc(prev.sede || '')}" placeholder="es. Via Cornigliano 34, Genova">
      <div class="hint">Viene aggiunto in coda alla frase sulla sede.</div></div>`);
  main.appendChild(cSede);

  // ---------- iva e sconto ----------
  main.appendChild(card('IVA e sconti', `
    <div class="field" style="max-width:320px"><label>Regime IVA di questo preventivo</label>
      <select id="regime_iva">${REGIMI.map(([v, l]) =>
        `<option value="${v}" ${(prev.regime_iva || 'nessuno') === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <div class="hint">«Nessuna indicazione» stampa solo gli importi, come nei preventivi scritti finora. Le due frasi si cambiano in Impostazioni.</div></div>
    <p class="hint" style="margin:16px 0 12px">Gli sconti sono facoltativi e utilizzabili anche insieme: la percentuale si calcola sul totale, l'importo fisso si toglie da quello che resta. Sono un'altra cosa rispetto al prezzo riservato di ogni corso — usali per uno sconto sull'intero pacchetto.</p>
    <div class="form-row">
      <div class="field"><label>Sconto in percentuale (%)</label>
        <input ${CAMPO_DECIMALE} id="sconto_percentuale" value="${testoDecimale(prev.sconto_percentuale)}" placeholder="0"></div>
      <div class="field"><label>Sconto in valore (€)</label>
        <input ${CAMPO_DECIMALE} id="sconto_valore" value="${testoDecimale(prev.sconto_valore)}" placeholder="0,00"></div>
    </div>
    <div class="hint" id="sconto-hint"></div>`));

  // ---------- note ----------
  main.appendChild(card('Note', `<textarea id="note" rows="3" placeholder="Testo libero, compare nel preventivo prima dei saluti…">${esc(prev.note || '')}</textarea>`));

  // ------------------------------------------------------------------
  //  Aggancio dei campi semplici: scrivono direttamente sull'oggetto
  // ------------------------------------------------------------------
  for (const campo of ['cliente', 'cliente_cf', 'cliente_indirizzo', 'referente', 'referente_email',
    'referente_telefono', 'protocollo', 'sede', 'stato', 'regime_iva', 'note']) {
    const input = view.querySelector('#' + campo);
    input.addEventListener('input', () => { prev[campo] = input.value; aggiorna(); });
    input.addEventListener('change', () => { prev[campo] = input.value; aggiorna(); });
  }
  prev.data_documento = prev.data_documento || todayISO();

  // L'oggetto è a parte: appena lo si scrive a mano, la proposta automatica
  // smette di sovrascriverlo. Svuotarlo la riattiva — è il modo per tornare
  // indietro senza dover indovinare la formula giusta.
  const campoOggetto = view.querySelector('#oggetto');
  campoOggetto.addEventListener('input', () => {
    prev.oggetto = campoOggetto.value;
    oggettoToccato = campoOggetto.value.trim() !== '';
    aggiorna();
  });

  // ------------------------------------------------------------------
  //  RUBRICA
  //  Scegliere un'azienda riempie il destinatario; "Salva in rubrica" fa il
  //  contrario. I dati restano comunque copiati dentro il preventivo:
  //  correggere una scheda non tocca i documenti già mandati.
  // ------------------------------------------------------------------
  function scrivi(campo, valore) {
    const input = view.querySelector('#' + campo);
    if (!input) return;
    input.value = valore || '';
    prev[campo] = input.value;
  }

  cDest.querySelector('#btn-rubrica').addEventListener('click', async () => {
    const { scegliCliente } = await import('./sceltaCliente.js');
    const c = await scegliCliente();
    if (!c) return;
    scrivi('cliente', c.nome);
    scrivi('cliente_cf', c.cf);
    scrivi('cliente_indirizzo', c.indirizzo);
    // Il referente è la persona di contatto per QUESTA richiesta: si prende
    // dalla rubrica solo se non l'hai già scritto tu.
    if (!prev.referente) {
      scrivi('referente', c.referente);
      scrivi('referente_email', c.referente_email);
      scrivi('referente_telefono', c.referente_telefono);
    }
    aggiorna();
    toast(`Destinatario compilato da «${c.nome}»`, 'ok');
  });

  cDest.querySelector('#btn-salva-cliente').addEventListener('click', async () => {
    if (!prev.cliente) { toast('Scrivi prima il nome dell\'azienda', 'err'); return; }
    const { schedaCliente } = await import('./rubrica.js');
    schedaCliente({
      nome: prev.cliente,
      cf: prev.cliente_cf,
      indirizzo: prev.cliente_indirizzo,
      referente: prev.referente,
      referente_email: prev.referente_email,
      referente_telefono: prev.referente_telefono,
    });
  });

  // La data del documento sta fuori dal ciclo qui sopra perché una data
  // troppo indietro va rifiutata: il campo torna al valore di prima invece di
  // registrare l'anno sbagliato.
  const campoData = view.querySelector('#data_documento');
  campoData.addEventListener('change', () => {
    if (!dataAmmessa(campoData.value)) { avvisaData(); campoData.value = prev.data_documento || ''; return; }
    prev.data_documento = campoData.value;
    aggiorna();
  });

  // Sede: i campi della trasferta hanno senso solo se il corso si tiene dal
  // cliente, e restano nascosti altrimenti — una cifra scritta in un campo
  // che non incide è il modo più semplice per sbagliare un totale.
  const selSede = view.querySelector('#sede_tipo');
  selSede.addEventListener('change', () => {
    prev.sede_tipo = selSede.value;
    // Passando "dal cliente" la maggiorazione si propone da sola, ma solo se
    // il campo è ancora vuoto: chi l'aveva azzerata a mano non se la ritrova
    // di nuovo addosso.
    if (prev.sede_tipo === 'cliente' && (prev.trasferta === null || prev.trasferta === undefined)) {
      prev.trasferta = Number(imp.trasferta_predefinita) || 0;
      view.querySelector('#trasferta').value = testoDecimale(prev.trasferta);
    }
    mostraCampiSede();
    aggiorna();
  });
  const campoTrasferta = view.querySelector('#trasferta');
  campoTrasferta.addEventListener('input', () => {
    prev.trasferta = leggiDecimale(campoTrasferta.value);
    aggiorna();
  });
  function mostraCampiSede() {
    const dalCliente = prev.sede_tipo === 'cliente';
    cSede.querySelector('#campo-sede').hidden = !dalCliente;
    cSede.querySelector('#campo-trasferta').hidden = !dalCliente;
  }
  mostraCampiSede();

  // I due sconti sono campi numerici indipendenti: vuoto significa "nessuno
  // sconto di questo tipo", e si salva come null invece che come zero.
  for (const campo of ['sconto_percentuale', 'sconto_valore']) {
    const input = view.querySelector('#' + campo);
    input.addEventListener('input', () => {
      prev[campo] = leggiDecimale(input.value);
      aggiorna();
    });
  }

  // ------------------------------------------------------------------
  //  Le righe dei corsi
  // ------------------------------------------------------------------
  function disegnaRighe() {
    const zona = cCorsi.querySelector('#righe');
    clear(zona);
    if (!prev.righe.length) {
      zona.appendChild(el(`<p class="muted" style="padding:18px 0;text-align:center">
        Nessun corso: sceglilo qui sopra e premi «Aggiungi».</p>`));
      return;
    }

    prev.righe.forEach((r, i) => {
      const aZero = !Number(r.prezzo);
      const riga = el(`<div class="mezzo-row${aZero ? ' senza-prezzo' : ''}">
        <div class="field"><label>Denominazione del corso</label>
          <input type="text" data-k="nome" value="${esc(r.nome || '')}"></div>
        <div class="form-row three">
          <div class="field"><label>Durata</label><input type="text" data-k="durata" value="${esc(r.durata || '')}" placeholder="es. 12 ore"></div>
          <div class="field"><label>Listino a discente (€)</label>
            <input ${CAMPO_DECIMALE} data-k="listino" value="${testoDecimale(r.listino)}" placeholder="0,00"></div>
          <div class="field"><label>Prezzo riservato (€)</label>
            <input ${CAMPO_DECIMALE} data-k="prezzo" value="${testoDecimale(r.prezzo)}" placeholder="0,00"></div>
        </div>
        <div class="form-row">
          <div class="field"><label>N. discenti</label>
            <input type="number" min="0" step="1" data-k="discenti" value="${r.discenti ?? ''}" placeholder="da definire"></div>
          <div class="field"><label>Attestazione rilasciata</label>
            <input type="text" data-k="attestato" value="${esc(r.attestato || '')}"></div>
        </div>
        <div class="mini riga-totale"></div>
        <button class="rm btn ghost sm" type="button">✕ Togli il corso</button>
      </div>`);

      const aggiornaTotaleRiga = () => {
        const discenti = Math.max(0, Number(r.discenti) || 0);
        const importo = discenti * (Number(r.prezzo) || 0);
        const risparmio = discenti * Math.max(0, (Number(r.listino) || 0) - (Number(r.prezzo) || 0));
        riga.querySelector('.riga-totale').innerHTML = discenti
          ? `Totale riga: <b>${esc(fmtEuro(importo))}</b>` +
            (risparmio > 0 ? ` · sconto rispetto al listino: ${esc(fmtEuro(risparmio))}` : '')
          : 'Numero di discenti da definire: nel documento il corso compare col prezzo a persona, senza totale.';
        const manca = !Number(r.prezzo);
        riga.classList.toggle('senza-prezzo', manca);
      };
      aggiornaTotaleRiga();

      riga.querySelectorAll('[data-k]').forEach(input => {
        input.addEventListener('input', () => {
          const k = input.dataset.k;
          if (k === 'listino' || k === 'prezzo') {
            r[k] = leggiDecimale(input.value);
          } else if (k === 'discenti') {
            r[k] = input.value === '' ? null : Number(input.value) || 0;
          } else {
            r[k] = input.value;
          }
          // Si aggiorna la riga sul posto invece di ridisegnarla: mentre si
          // scrive un prezzo, il campo deve restare sotto le dita.
          aggiornaTotaleRiga();
          aggiorna();
        });
      });

      riga.querySelector('.rm').addEventListener('click', async () => {
        // Conferma solo se nella riga c'è qualcosa da perdere.
        if ((r.discenti || r.prezzo) && !await confirmDialog(
          `Togliere «${r.nome || 'il corso'}» dal preventivo?`, { danger: true, okLabel: 'Togli' })) return;
        prev.righe.splice(i, 1);
        proponiOggetto();
        disegnaRighe(); aggiorna();
      });

      zona.appendChild(riga);
    });
  }

  // L'oggetto proposto si ricalcola quando cambia l'elenco dei corsi, ma solo
  // finché non lo si è scritto a mano.
  function proponiOggetto() {
    if (oggettoToccato) return;
    prev.oggetto = prev.righe.length ? oggettoProposto(prev.righe) : '';
    campoOggetto.value = prev.oggetto;
  }

  cCorsi.querySelector('#add-corso').addEventListener('click', () => {
    const scelta = cCorsi.querySelector('#scelta-corso').value;
    const corso = imp.corsi.find(c => c.id === scelta);
    if (!corso) { toast('Il catalogo è vuoto: aggiungi i corsi in Impostazioni', 'err'); return; }
    // Lo stesso corso due volte capita davvero (due edizioni, due gruppi di
    // discenti): non si blocca, ma si avvisa, perché più spesso è un clic di
    // troppo.
    if (prev.righe.some(r => r.id === corso.id)) toast('Questo corso era già nel preventivo: ora compare due volte', 'warn');
    prev.righe.push(rigaDaCorso(corso));
    proponiOggetto();
    disegnaRighe(); aggiorna();
  });

  cCorsi.querySelector('#add-libero').addEventListener('click', () => {
    prev.righe.push({
      id: 'libero-' + Date.now(), nome: '', durata: '', attestato: '', sigla: '',
      discenti: null, listino: 0, prezzo: 0,
    });
    disegnaRighe(); aggiorna();
    // Il cursore va sul nome della riga appena creata: è l'unico campo che
    // non arriva già compilato.
    cCorsi.querySelector('#righe .mezzo-row:last-child input[data-k=nome]')?.focus();
  });

  // ------------------------------------------------------------------
  //  Riepilogo
  // ------------------------------------------------------------------
  function aggiorna({ dallUtente = true } = {}) {
    if (dallUtente) modificato();
    const r = calcola(prev);
    prev.totale = r.totale;

    const hint = view.querySelector('#sconto-hint');
    if (hint) {
      const limitato = r.sconti.find(s => s.ridotto);
      hint.textContent = r.sconto > 0
        ? `Sconto totale: ${fmtEuro(r.sconto)} su ${fmtEuro(r.totaleLordo)}` +
          (r.sconti.length > 1 ? ` (${r.sconti.map(s => fmtEuro(s.importo)).join(' + ')})` : '') +
          (limitato ? ` — ⚠️ lo sconto di ${fmtEuro(limitato.richiesto)} supera quello che resta da scontare: nel documento vale ${fmtEuro(limitato.importo)}.` : '')
        : '';
      hint.classList.toggle('avviso', !!limitato);
    }

    clear(summary);
    const box = el(`<div class="tot-box">
      <div class="card-b breakdown">
        ${r.righe.length
          ? r.righe.map(x => `<div class="b-row"><span class="lbl">${esc(x.nome || 'corso senza nome')}${
              x.discenti ? ` · ${x.discenti} ${x.discenti === 1 ? 'discente' : 'discenti'}` : ' · discenti da definire'
            }</span><span class="money">${x.discenti ? esc(fmtEuro(x.importo)) : '—'}</span></div>`).join('')
          : '<div class="b-row"><span class="lbl">Nessun corso scelto</span><span class="money">—</span></div>'}
        ${r.trasferta > 0 ? `<div class="b-row"><span class="lbl">Trasferta</span><span class="money">${fmtEuro(r.trasferta)}</span></div>` : ''}
        ${r.sconto > 0 ? `<div class="b-row strong"><span class="lbl">Totale</span><span class="money">${fmtEuro(r.totaleLordo)}</span></div>
          ${r.sconti.map(s => `<div class="b-row"><span class="lbl">${esc(etichettaSconto(s))}</span><span class="money">− ${fmtEuro(s.importo)}</span></div>`).join('')}` : ''}
        ${r.conIva ? `<div class="b-row"><span class="lbl">Imponibile</span><span class="money">${fmtEuro(r.imponibile)}</span></div>
          <div class="b-row"><span class="lbl">IVA ${ALIQUOTA_IVA}%</span><span class="money">${fmtEuro(r.iva)}</span></div>` : ''}
        ${r.risparmio > 0 ? `<div class="b-row"><span class="lbl">Sconto sul listino già applicato ai corsi</span><span class="money">${fmtEuro(r.risparmio)}</span></div>` : ''}
      </div>
      <div class="row addebito">
        <div><div class="k">Totale preventivo</div><div class="mini">${r.totale ? 'euro ' + inLettere(r.totale) : 'da compilare'}</div></div>
        <div class="v money">${fmtEuro(r.totale)}</div>
      </div>
    </div>`);
    summary.appendChild(box);

    // Basta UN corso senza prezzo per far uscire un preventivo che regala
    // qualcosa: è il caso della riga aggiunta di fretta fra altre col prezzo
    // giusto, e da solo non si nota.
    const senzaPrezzo = prev.righe.filter(x => !Number(x.prezzo));
    if (senzaPrezzo.length) {
      const uno = senzaPrezzo.length === 1;
      summary.appendChild(el(`<div class="banner warn" style="margin-top:12px"><div class="bi">⚠️</div><div>
        <b>${uno ? 'Un corso senza prezzo' : `${senzaPrezzo.length} corsi senza prezzo`}</b>
        <div class="small">${esc(senzaPrezzo.map(x => x.nome || 'corso senza nome').join(', '))}: ${uno ? 'è a 0 € e non incide' : 'sono a 0 € e non incidono'}
        sul totale. Correggi il prezzo nella riga, oppure nel catalogo (Impostazioni) se vale per tutti.</div>
      </div></div>`));
    }
    if (!imp.corsi.length) {
      summary.appendChild(el(`<div class="banner warn" style="margin-top:12px"><div class="bi">⚠️</div><div>
        Il catalogo dei corsi è vuoto: aggiungi i corsi in <b>Impostazioni</b>, così arrivano già compilati con durata, attestazione e prezzo.</div></div>`));
    }
  }

  // Il primo disegno non è una modifica dell'utente: senza dallUtente:false il
  // preventivo nascerebbe già sporco e chiederebbe conferma in uscita anche a
  // chi lo ha soltanto aperto.
  disegnaRighe(); aggiorna({ dallUtente: false });

  // ------------------------------------------------------------------
  //  Azioni
  // ------------------------------------------------------------------
  async function salva() {
    if (!prev.cliente) { toast('Manca il committente', 'err'); return null; }
    const btn = view.querySelector('#btn-save'); const old = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<span class="spinner sm"></span> Salvo…';
    try {
      const salvato = await preventivi.save({
        id: prev.id, cliente: prev.cliente, cliente_indirizzo: prev.cliente_indirizzo, cliente_cf: prev.cliente_cf,
        referente: prev.referente, referente_email: prev.referente_email, referente_telefono: prev.referente_telefono,
        protocollo: prev.protocollo || null, oggetto: prev.oggetto, data_documento: prev.data_documento || null,
        stato: prev.stato || 'bozza', righe: prev.righe,
        sede_tipo: prev.sede_tipo || 'nostra', sede: prev.sede || null,
        trasferta: prev.trasferta ?? null, regime_iva: prev.regime_iva || 'nessuno',
        sconto_percentuale: prev.sconto_percentuale ?? null, sconto_valore: prev.sconto_valore ?? null,
        note: prev.note, totale: prev.totale,
        // Versione da cui si è partiti: se nel frattempo qualcun altro ha
        // salvato lo stesso preventivo, il salvataggio si ferma invece di
        // cancellargli il lavoro (vedi store.js).
        updated_at: prev.updated_at,
      });
      toast('Preventivo salvato', 'ok');
      sporco = false;
      prev.updated_at = salvato.updated_at;
      if (!prev.id) { prev.id = salvato.id; ctx.go(`#/formazione/preventivo/${salvato.id}`); }
      return salvato;
    } catch (e) {
      if (e.conflitto) {
        const ricarica = await confirmDialog(
          'Qualcun altro ha modificato questo preventivo mentre lo stavi aprendo. ' +
          'Puoi ricaricare la versione aggiornata (perdendo le tue modifiche) oppure restare qui e ricopiartele.',
          { danger: true, okLabel: 'Ricarica la versione aggiornata' });
        if (ricarica) { sporco = false; location.reload(); }
        return null;
      }
      toast('Errore nel salvataggio: ' + e.message, 'err');
      return null;
    } finally { btn.disabled = false; btn.innerHTML = old; }
  }

  view.querySelector('#btn-save').addEventListener('click', salva);

  view.querySelector('#btn-pdf').addEventListener('click', async () => {
    try {
      const { stampaPreventivo } = await import('../lib/stampa.js');
      await stampaPreventivo(prev, imp);
    } catch (e) { toast('Stampa non riuscita: ' + e.message, 'err'); }
  });

  view.querySelector('#btn-word').addEventListener('click', async () => {
    const btn = view.querySelector('#btn-word'); const old = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<span class="spinner sm"></span> Genero…';
    try {
      const { scaricaDocx } = await import('../lib/docx.js');
      await scaricaDocx(prev, imp);
    } catch (e) { toast('Generazione Word non riuscita: ' + e.message, 'err'); }
    finally { btn.disabled = false; btn.innerHTML = old; }
  });

  view.querySelector('#btn-anteprima').addEventListener('click', async () => {
    try {
      const { anteprimaPreventivo } = await import('../lib/stampa.js');
      await anteprimaPreventivo(prev, imp);
    } catch (e) { toast('Anteprima non riuscita: ' + e.message, 'err'); }
  });

  // Si sorveglia il nodo dell'editor, non il contenitore della pagina: uscito
  // di qui, la sorveglianza si spegne da sola.
  sorvegliaUscita(editor, () => sporco);
}

function nuovoPreventivo(imp) {
  return {
    cliente: '', cliente_indirizzo: '', cliente_cf: '',
    referente: '', referente_email: '', referente_telefono: '',
    protocollo: '', oggetto: '', data_documento: todayISO(), stato: 'bozza',
    // Si parte senza corsi: quale sia quello giusto lo sa solo chi scrive il
    // preventivo, e sceglierlo è un clic.
    righe: [],
    sede_tipo: 'nostra', sede: '', trasferta: null,
    // Nessuna indicazione IVA finché non la si sceglie: è come sono stati
    // scritti i preventivi finora, e una frase sul regime fiscale messa per
    // default sarebbe una dichiarazione fatta al posto di chi firma.
    regime_iva: 'nessuno',
    sconto_percentuale: null, sconto_valore: null, note: '',
  };
}

function card(titolo, corpo) {
  return el(`<div class="card" style="margin-bottom:18px">
    <div class="card-h">${esc(titolo)}</div><div class="card-b">${corpo}</div></div>`);
}
