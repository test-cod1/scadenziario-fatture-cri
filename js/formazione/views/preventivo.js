import { preventivi, clienti } from '../data/store.js';
import { calcola, inLettere, rigaDaCorso, oggettoProposto, nomeBreve, ALIQUOTA_IVA } from '../calc.js';
import { etichettaSconto } from '../lib/documento.js';
import { el, clear, esc, toast, confirmDialog, fmtEuro, todayISO } from '../../lib/ui.js';
import { sorvegliaUscita, armaGuardiaIndietro } from '../../lib/uscita.js';
import { INIZIO_ANNO, dataAmmessa, MSG_DATA } from '../date.js';
import { CAMPO_DECIMALE, testoDecimale, leggiDecimale } from '../../lib/importi.js';
// Import statico, non import() al clic: la stampa apre una finestra, e Safari
// la blocca come popup se prima del window.open c'è un'attesa (27/09/2026).
import { anteprimaPreventivo, stampaPreventivo } from '../lib/stampa.js';
import { pianificaCorsi } from './corsi.js';
import { cardDatiFatturazione, perDestinatario } from '../../lib/linkFatturazione.js';

// ============================================================
//  EDITOR DEL PREVENTIVO DI FORMAZIONE
//  Cinque passi numerati, nell'ordine in cui si scrive un preventivo: a chi
//  va, quali corsi (con quante persone e a che prezzo), dove si tengono,
//  come si chiude il conto — IVA e sconti — e infine i dati del documento.
//  L'oggetto sta in fondo perché lo propongono i corsi scelti. A destra il
//  riepilogo si aggiorna a ogni modifica e dice cosa manca prima di
//  mandarlo.
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
      <h1>${id ? 'Modifica preventivo' : 'Nuovo preventivo'} <span class="chip" id="salvataggio" hidden></span></h1>
      <p>Corsi di formazione per aziende ed enti</p>
    </div>
    <div class="inline">
      <a class="btn" href="#/formazione/preventivi">← Elenco</a>
      <button class="btn" id="btn-anteprima">👁 Anteprima</button>
      <button class="btn" id="btn-word">📄 Word</button>
      <button class="btn" id="btn-pdf">🖨️ Stampa / PDF</button>
      <button class="btn" id="btn-corsi" hidden title="I corsi da tenere per questo preventivo">📅 Corsi</button>
      <button class="btn primary" id="btn-save" title="Salva (Ctrl+S)">💾 Salva</button>
    </div>
  </div>`);
  view.appendChild(head);

  // Diventa true alla prima modifica e torna false quando si salva: da qui
  // dipendono l'avviso in uscita e l'etichetta accanto al titolo, che dice
  // senza bisogno di indovinare se quello che si vede è già registrato.
  let sporco = false;
  // Lo stato com'è registrato, non come lo si sta scrivendo: i corsi si
  // pianificano da un preventivo confermato e salvato.
  let statoSalvato = prev.id ? prev.stato : null;
  const etichetta = head.querySelector('#salvataggio');
  function mostraSalvataggio() {
    head.querySelector('#btn-corsi').hidden = !(prev.id && statoSalvato === 'confermato');
    etichetta.hidden = !sporco && !prev.id;
    etichetta.className = 'chip ' + (sporco ? 'warn' : 'ok');
    etichetta.textContent = sporco ? '● Modifiche non salvate' : '✓ Salvato';
  }
  const modificato = () => { sporco = true; armaGuardiaIndietro(); mostraSalvataggio(); };
  mostraSalvataggio();

  const editor = el(`<div class="editor"><div class="col-main"></div><div class="summary"></div></div>`);
  view.appendChild(editor);
  const main = editor.querySelector('.col-main');
  const summary = editor.querySelector('.summary');

  // ---------- 1. destinatario ----------
  const cDest = card(1, 'A chi va', `
    <div class="rubrica-azioni">
      <button class="btn sm" id="btn-rubrica" type="button">📇 Scegli dalla rubrica</button>
      <button class="btn sm" id="btn-salva-cliente" type="button">➕ Salva in rubrica</button>
      <span class="mini">oppure inizia a scrivere il nome: le aziende in rubrica vengono suggerite</span>
    </div>
    <div class="form-row">
      <div class="field"><label>Azienda / ente</label>
        <input type="text" id="cliente" list="rubrica-formazione" autocomplete="off" value="${esc(prev.cliente || '')}">
        <datalist id="rubrica-formazione"></datalist></div>
      <div class="field"><label>Codice fiscale / P.IVA</label><input type="text" id="cliente_cf" value="${esc(prev.cliente_cf || '')}"></div>
    </div>
    <div class="field"><label>Indirizzo</label><input type="text" id="cliente_indirizzo" value="${esc(prev.cliente_indirizzo || '')}"></div>
    <div class="form-row three">
      <div class="field"><label>Referente (Alla c.a.)</label><input type="text" id="referente" value="${esc(prev.referente || '')}"></div>
      <div class="field"><label>Email</label><input type="text" id="referente_email" value="${esc(prev.referente_email || '')}"></div>
      <div class="field"><label>Telefono</label><input type="text" id="referente_telefono" value="${esc(prev.referente_telefono || '')}"></div>
    </div>`);
  main.appendChild(cDest);

  // ---------- 2. corsi ----------
  // Il catalogo è un riquadro per corso, non un menu a tendina: si vede
  // tutto quello che si può proporre, con durata e prezzo, e un clic lo
  // aggiunge. Il numero sul riquadro dice quante volte è già nel preventivo.
  const cCorsi = card(2, 'Quali corsi', `
    <p class="hint" style="margin:0 0 10px">Clicca un corso per aggiungerlo: arriva con durata, attestazione e prezzo di listino, e qui dentro resta tutto modificabile — la modifica vale solo per questo preventivo.</p>
    <div class="cal-azioni catalogo-corsi">
      ${imp.corsi.map(c => `<button type="button" class="corso-pick" data-corso="${esc(c.id)}" title="${esc(c.nome)}">
        <span class="cp-nome">${esc(nomeBreve(c.nome))}</span>
        <span class="cp-dati">${esc([c.durata, Number(c.prezzo) ? fmtEuro(c.prezzo) + ' a discente' : 'prezzo da impostare'].filter(Boolean).join(' · '))}</span>
        <span class="cp-conta" hidden></span>
      </button>`).join('')}
      <button type="button" class="corso-pick libero" id="add-libero">
        <span class="cp-nome">✎ Corso fuori catalogo</span>
        <span class="cp-dati">per una richiesta una tantum</span>
      </button>
    </div>
    <div id="righe"></div>`);
  main.appendChild(cCorsi);

  // ---------- 3. sede ----------
  const cSede = card(3, 'Dove', `
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

  // ---------- 4. iva e sconto ----------
  main.appendChild(card(4, 'IVA e sconti', `
    <div class="field" style="max-width:320px"><label>Regime IVA di questo preventivo</label>
      <select id="regime_iva">${REGIMI.map(([v, l]) =>
        `<option value="${v}" ${(prev.regime_iva || 'nessuno') === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <div class="hint">«Nessuna indicazione» stampa solo gli importi, come nei preventivi scritti finora. Le due frasi si cambiano in Impostazioni.</div></div>
    <p class="hint" style="margin:16px 0 12px">Sconti sull'intero pacchetto, facoltativi e utilizzabili insieme: la percentuale si calcola sul totale, l'importo fisso si toglie da quello che resta. Per abbassare il prezzo di un solo corso usa il suo prezzo riservato.</p>
    <div class="form-row">
      <div class="field"><label>Sconto in percentuale (%)</label>
        <input ${CAMPO_DECIMALE} id="sconto_percentuale" value="${testoDecimale(prev.sconto_percentuale)}" placeholder="0"></div>
      <div class="field"><label>Sconto in valore (€)</label>
        <input ${CAMPO_DECIMALE} id="sconto_valore" value="${testoDecimale(prev.sconto_valore)}" placeholder="0,00"></div>
    </div>
    <div class="hint" id="sconto-hint"></div>`));

  // ---------- 5. documento e note ----------
  const cDoc = card(5, 'Il documento', `
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
    </div>
    <div class="field"><label>Note</label>
      <textarea id="note" rows="3" placeholder="Testo libero, compare nel preventivo prima dei saluti…">${esc(prev.note || '')}</textarea></div>`);
  main.appendChild(cDoc);

  // ---------- 6. dati di fatturazione dal cliente ----------
  // Il link da mandare al cliente, che compila da sé i dati per la fattura;
  // finisce anche nel documento (vedi js/lib/linkFatturazione.js). I dati
  // ricevuti si riportano nel destinatario con un clic.
  const { card: cFatt } = cardDatiFatturazione({
    sezione: 'formazione', prev, numero: 6,
    onLink: (url) => { prev._linkFatturazione = url; },
    onUsa: (d) => {
      for (const [campo, valore] of Object.entries(perDestinatario(d))) if (valore) scrivi(campo, valore);
      aggiorna();
      toast('Destinatario aggiornato con i dati del cliente: ricordati di salvare', 'ok');
      cDest.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
  });
  main.appendChild(cFatt);

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

  function compilaDa(c) {
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
  }

  cDest.querySelector('#btn-rubrica').addEventListener('click', async () => {
    const { scegliCliente } = await import('./sceltaCliente.js');
    const c = await scegliCliente();
    if (c) compilaDa(c);
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

  // Suggerimenti mentre si scrive il nome: la rubrica si legge in sottofondo
  // e finisce in un <datalist>, così il campo resta un campo di testo
  // qualsiasi — chi scrive un'azienda nuova non trova niente di diverso. Se
  // il nome scritto (o scelto dai suggerimenti) è esattamente quello di una
  // scheda, il resto del destinatario si compila da lì, una volta sola per
  // nome: chi poi corregge l'indirizzo a mano non se lo vede riscrivere.
  let rubrica = [];
  let ultimoCompilato = (prev.cliente || '').trim().toLowerCase();
  clienti.list().then(lista => {
    rubrica = lista;
    const dl = cDest.querySelector('#rubrica-formazione');
    for (const c of lista) dl.appendChild(el(`<option value="${esc(c.nome)}"></option>`));
  }).catch(() => { /* senza rubrica il campo resta un campo di testo: nessun danno */ });
  //
  // Si guarda la scelta dai suggerimenti (che il browser segnala come input
  // senza tasti, o come «sostituzione») e l'uscita dal campo, non ogni tasto:
  // scrivendo «ACME SRL» lettera per lettera si passerebbe da «ACME», e se
  // anche quella è in rubrica il destinatario si compilerebbe con l'azienda
  // sbagliata a metà parola.
  const campoCliente = cDest.querySelector('#cliente');
  function daRubrica() {
    const nome = campoCliente.value.trim().toLowerCase();
    if (!nome || nome === ultimoCompilato) return;
    const c = rubrica.find(x => x.nome.trim().toLowerCase() === nome);
    if (!c) return;
    ultimoCompilato = nome;
    compilaDa(c);
  }
  campoCliente.addEventListener('input', (e) => {
    if (!e.inputType || e.inputType === 'insertReplacementText') daRubrica();
  });
  campoCliente.addEventListener('change', daRubrica);

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
  //  In vista restano i numeri che cambiano da un preventivo all'altro —
  //  quante persone e a che prezzo — con il totale della riga accanto.
  //  Durata e attestazione arrivano dal catalogo e si toccano di rado:
  //  stanno sotto, in un pannello che si apre quando serve.
  // ------------------------------------------------------------------
  function disegnaRighe() {
    const zona = cCorsi.querySelector('#righe');
    clear(zona);
    contaNelCatalogo();
    if (!prev.righe.length) {
      zona.appendChild(el(`<p class="muted righe-vuote">Nessun corso ancora: clicca uno dei corsi qui sopra.</p>`));
      return;
    }

    prev.righe.forEach((r, i) => {
      const libero = String(r.id || '').startsWith('libero-');
      const riga = el(`<div class="mezzo-row corso-riga">
        <div class="cr-testa">
          <span class="cr-num">${i + 1}</span>
          <input type="text" data-k="nome" class="cr-nome" aria-label="Denominazione del corso" placeholder="Denominazione del corso" value="${esc(r.nome || '')}">
          <button class="rm btn ghost sm" type="button" title="Togli il corso dal preventivo" aria-label="Togli il corso">✕</button>
        </div>
        <div class="cr-numeri">
          <div class="field"><label>N. discenti</label>
            <input type="number" min="0" step="1" data-k="discenti" value="${esc(r.discenti ?? '')}" placeholder="da definire"></div>
          <div class="field"><label>Listino a discente (€)</label>
            <input ${CAMPO_DECIMALE} data-k="listino" value="${testoDecimale(r.listino)}" placeholder="0,00"></div>
          <div class="field"><label>Prezzo riservato (€)</label>
            <input ${CAMPO_DECIMALE} data-k="prezzo" value="${testoDecimale(r.prezzo)}" placeholder="0,00"></div>
          <div class="field cr-importo"><label>Totale riga</label><div class="cr-valore money"></div></div>
        </div>
        <div class="mini riga-totale"></div>
        <details class="cr-dettagli"${libero && !r.durata ? ' open' : ''}>
          <summary><span class="cr-freccia" aria-hidden="true">▸</span> Durata e attestazione: <span class="cr-riassunto"></span></summary>
          <div class="form-row">
            <div class="field"><label>Durata</label><input type="text" data-k="durata" value="${esc(r.durata || '')}" placeholder="es. 12 ore"></div>
            <div class="field"><label>Attestazione rilasciata</label>
              <input type="text" data-k="attestato" value="${esc(r.attestato || '')}" placeholder="es. Rilascio di attestazione"></div>
          </div>
        </details>
      </div>`);

      const aggiornaTotaleRiga = () => {
        const discenti = Math.max(0, Number(r.discenti) || 0);
        const importo = discenti * (Number(r.prezzo) || 0);
        const risparmio = discenti * Math.max(0, (Number(r.listino) || 0) - (Number(r.prezzo) || 0));
        const manca = !Number(r.prezzo);
        riga.querySelector('.cr-valore').textContent = discenti ? fmtEuro(importo) : '—';
        riga.querySelector('.riga-totale').innerHTML = manca
          ? '<span class="avviso-zero">⚠️ Manca il prezzo: così il corso è a 0 € e non incide sul totale.</span>'
          : !discenti
            ? 'Discenti da definire: nel documento il corso compare col prezzo a persona, senza totale.'
            : risparmio > 0 ? `Sconto rispetto al listino: ${esc(fmtEuro(risparmio))}` : '';
        riga.querySelector('.cr-riassunto').textContent =
          [r.durata, r.attestato].filter(Boolean).join(' · ') || 'da compilare';
        riga.classList.toggle('senza-prezzo', manca);
      };
      aggiornaTotaleRiga();

      riga.querySelectorAll('[data-k]').forEach(input => {
        input.addEventListener('input', () => {
          const k = input.dataset.k;
          if (k === 'listino') {
            // Finché il prezzo riservato è uguale al listino non è un prezzo
            // riservato, è il listino ripetuto: correggendo il listino lo si
            // porta dietro, invece di lasciare un prezzo vecchio che sembra
            // uno sconto.
            const nuovo = leggiDecimale(input.value);
            if ((Number(r.prezzo) || 0) === (Number(r.listino) || 0)) {
              r.prezzo = nuovo;
              riga.querySelector('[data-k=prezzo]').value = testoDecimale(nuovo);
            }
            r.listino = nuovo;
          } else if (k === 'prezzo') {
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

  // Il numerino sui riquadri del catalogo: quante volte quel corso è già nel
  // preventivo. Evita il doppio clic involontario senza vietarlo.
  function contaNelCatalogo() {
    cCorsi.querySelectorAll('.corso-pick[data-corso]').forEach(b => {
      const n = prev.righe.filter(r => r.id === b.dataset.corso).length;
      const badge = b.querySelector('.cp-conta');
      badge.hidden = !n;
      badge.textContent = n > 1 ? `✓ ×${n}` : '✓';
      b.classList.toggle('scelto', n > 0);
    });
  }

  // L'oggetto proposto si ricalcola quando cambia l'elenco dei corsi, ma solo
  // finché non lo si è scritto a mano.
  function proponiOggetto() {
    if (oggettoToccato) return;
    prev.oggetto = prev.righe.length ? oggettoProposto(prev.righe) : '';
    campoOggetto.value = prev.oggetto;
  }

  // Dopo aver aggiunto un corso il cursore va dove serve: sul numero di
  // discenti, che è la sola cosa che il catalogo non può sapere.
  function vaiAllUltima(selettore) {
    const ultima = cCorsi.querySelector('#righe .corso-riga:last-child');
    ultima?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    ultima?.querySelector(selettore)?.focus({ preventScroll: true });
  }

  cCorsi.querySelectorAll('.corso-pick[data-corso]').forEach(b => b.addEventListener('click', () => {
    const corso = imp.corsi.find(c => c.id === b.dataset.corso);
    if (!corso) return;
    // Lo stesso corso due volte capita davvero (due edizioni, due gruppi di
    // discenti): non si blocca, ma si avvisa, perché più spesso è un clic di
    // troppo.
    if (prev.righe.some(r => r.id === corso.id)) toast('Questo corso era già nel preventivo: ora compare due volte', 'warn');
    prev.righe.push(rigaDaCorso(corso));
    proponiOggetto();
    disegnaRighe(); aggiorna();
    vaiAllUltima('[data-k=discenti]');
  }));

  cCorsi.querySelector('#add-libero').addEventListener('click', () => {
    prev.righe.push({
      id: 'libero-' + Date.now(), nome: '', durata: '', attestato: '', sigla: '',
      discenti: null, listino: 0, prezzo: 0,
    });
    disegnaRighe(); aggiorna();
    // Il cursore va sul nome della riga appena creata: è l'unico campo che
    // non arriva già compilato.
    vaiAllUltima('input[data-k=nome]');
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
          ? r.righe.map(x => `<div class="b-row"><span class="lbl">${esc(nomeBreve(x.nome))}${
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
        <div><div class="k">${r.daDefinire && !r.senzaTotale ? 'Totale parziale' : 'Totale preventivo'}</div><div class="mini">${r.totale ? 'euro ' + inLettere(r.totale) : 'da compilare'}</div></div>
        <div class="v money">${fmtEuro(r.totale)}</div>
      </div>
    </div>`);
    summary.appendChild(box);
    summary.appendChild(controlli(r));

    const salvaQui = el('<button class="btn primary salva-riepilogo" type="button">💾 Salva il preventivo</button>');
    salvaQui.addEventListener('click', salva);
    summary.appendChild(salvaQui);

    if (!imp.corsi.length) {
      summary.appendChild(el(`<div class="banner warn"><div class="bi">⚠️</div><div>
        Il catalogo dei corsi è vuoto: aggiungi i corsi in <b>Impostazioni</b>, così arrivano già compilati con durata, attestazione e prezzo.</div></div>`));
    }
  }

  // «Prima di inviarlo»: le cose che un preventivo deve avere per uscire,
  // spuntate man mano. Basta UN corso senza prezzo per mandare un preventivo
  // che regala qualcosa — è il caso della riga aggiunta di fretta fra altre
  // col prezzo giusto, e da solo non si nota. I discenti da definire invece
  // sono legittimi, e compaiono come avviso, non come errore.
  function controlli(r) {
    const senzaPrezzo = prev.righe.filter(x => !Number(x.prezzo));
    const voci = [
      [prev.cliente ? 'ok' : 'no', prev.cliente ? 'Committente' : 'Manca il committente'],
      [prev.righe.length ? 'ok' : 'no', prev.righe.length
        ? `${prev.righe.length} ${prev.righe.length === 1 ? 'corso' : 'corsi'}`
        : 'Nessun corso scelto'],
    ];
    if (prev.righe.length) {
      voci.push(senzaPrezzo.length
        ? ['no', `Senza prezzo: ${senzaPrezzo.map(x => x.nome || 'corso senza nome').join(', ')}. Correggilo nella riga, o nel catalogo (Impostazioni) se vale per tutti.`]
        : ['ok', 'Prezzi di tutti i corsi']);
      voci.push(r.daDefinire
        ? ['warn', r.senzaTotale
          ? 'Discenti da definire: il documento indica il prezzo a persona, senza totale'
          : `${r.daDefinire} ${r.daDefinire === 1 ? 'corso' : 'corsi'} con discenti da definire: il totale sarà parziale`]
        : ['ok', `${r.discenti} ${r.discenti === 1 ? 'discente' : 'discenti'} in tutto`]);
    }
    if (prev.sede_tipo === 'cliente' && !(prev.sede || '').trim()) {
      voci.push(['warn', 'Manca l\'indirizzo della sede del committente']);
    }
    const icona = { ok: '✓', warn: '!', no: '✕' };
    const pronto = voci.every(([s]) => s !== 'no');
    return el(`<div class="card controlli-invio">
      <div class="card-h">${pronto ? '✓ Pronto per l\'invio' : 'Prima di inviarlo'}</div>
      <ul class="card-b">${voci.map(([s, t]) => `<li class="ci-${s}"><span class="ci-ico" aria-hidden="true">${icona[s]}</span><span>${esc(t)}</span></li>`).join('')}</ul>
    </div>`);
  }

  // Il primo disegno non è una modifica dell'utente: senza dallUtente:false il
  // preventivo nascerebbe già sporco e chiederebbe conferma in uscita anche a
  // chi lo ha soltanto aperto.
  disegnaRighe(); aggiorna({ dallUtente: false });

  // ------------------------------------------------------------------
  //  Azioni
  // ------------------------------------------------------------------
  let salvataggioInCorso = false;
  async function salva() {
    if (salvataggioInCorso) return null;
    if (!prev.cliente) {
      toast('Manca il committente', 'err');
      campoCliente.focus();
      return null;
    }
    salvataggioInCorso = true;
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
      statoSalvato = salvato.stato;
      if (!prev.id) { prev.id = salvato.id; ctx.go(`#/formazione/preventivo/${salvato.id}`); }
      mostraSalvataggio();
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
    } finally { btn.disabled = false; btn.innerHTML = old; salvataggioInCorso = false; }
  }

  view.querySelector('#btn-save').addEventListener('click', salva);

  view.querySelector('#btn-corsi').addEventListener('click', () => {
    if (sporco) { toast('Salva prima le modifiche: i corsi nascono dal preventivo salvato', 'err'); return; }
    pianificaCorsi(prev, ctx);
  });

  // Ctrl+S (Cmd+S sul Mac) salva invece di aprire il "Salva pagina con nome"
  // del browser, che è quello che chiunque si aspetta in un editor. Il
  // listener sta sul documento e si toglie da solo la prima volta che scatta
  // dopo che l'editor è uscito dalla pagina.
  const scorciatoia = (e) => {
    if (!editor.isConnected) { document.removeEventListener('keydown', scorciatoia); return; }
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      salva();
    }
  };
  document.addEventListener('keydown', scorciatoia);

  view.querySelector('#btn-pdf').addEventListener('click', async () => {
    try {
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

// Il numero davanti al titolo dice l'ordine in cui si compila: chi apre
// l'editor la prima volta vede subito che sono cinque passi, e quale viene
// dopo.
function card(numero, titolo, corpo) {
  return el(`<div class="card">
    <div class="card-h"><span><span class="passo-num">${numero}</span>${esc(titolo)}</span></div><div class="card-b">${corpo}</div></div>`);
}
