import { corsi as storeCorsi, clienti } from '../data/store.js';
import { nomeBreve } from '../calc.js';
import { STATI_CORSO, ESITI, oreDaDurata, discentiEffettivi, leggiPartecipanti } from '../corsi.js';
import { fmtData } from '../lib/documento.js';
import { el, clear, esc, toast, confirmDialog, openModal, todayISO } from '../../lib/ui.js';
import { sorvegliaUscita, armaGuardiaIndietro } from '../../lib/uscita.js';
import { CAMPO_DECIMALE, testoDecimale, leggiDecimale } from '../../lib/importi.js';
import { buildXlsxBlob } from '../../lib/xlsx.js';
// Import statico: la stampa apre una finestra, e Safari la blocca come popup
// se prima del window.open c'è un'attesa (vedi stampaBlocchi.js).
import { stampaDocumento } from '../../lib/stampaBlocchi.js';
import { avvisoTabella } from './corsi.js';

// ============================================================
//  SCHEDA DI UN CORSO
//  Quattro blocchi: quale corso, quando e dove (con chi lo tiene), chi
//  c'era e com'è andata, e infine stato e importo. L'elenco dei
//  partecipanti è facoltativo — non sempre l'azienda manda i nomi — ma
//  quando c'è è lui a dire quanti erano presenti, e da lui esce il foglio
//  presenze da far firmare in aula.
// ============================================================

const ETICHETTA = { programmato: 'Programmato', svolto: 'Svolto', annullato: 'Annullato' };

export async function renderCorso(view, id, ctx) {
  const imp = ctx.imp;
  let corso;
  if (id && id !== 'nuovo') {
    try { corso = await storeCorsi.get(id); }
    catch (e) { view.appendChild(e.tabellaMancante ? avvisoTabella(e) : el(`<div class="empty-state"><div class="big">⚠️</div><p>Corso non trovato: ${esc(e.message)}</p></div>`)); return; }
    corso.partecipanti = corso.partecipanti || [];
  } else {
    corso = nuovoCorso();
  }
  const admin = ctx.user?.ruolo === 'admin';

  const head = el(`<div class="page-head">
    <div><h1>${corso.id ? esc(nomeBreve(corso.corso_nome)) : 'Nuovo corso'} <span class="chip" id="salvataggio" hidden></span></h1>
      <p>${corso.id ? esc([corso.cliente, corso.data_inizio ? fmtData(corso.data_inizio) : 'data da fissare'].filter(Boolean).join(' · ')) : 'Un\'edizione di un corso: date, docenti e partecipanti'}</p></div>
    <div class="inline">
      <a class="btn" href="#/formazione/corsi">← Registro</a>
      <button class="btn" id="btn-presenze" title="Foglio presenze da far firmare in aula">🖨️ Foglio presenze</button>
      ${corso.id && admin ? '<button class="btn" id="btn-elimina">🗑️ Elimina</button>' : ''}
      <button class="btn primary" id="btn-save" title="Salva (Ctrl+S)">💾 Salva</button>
    </div>
  </div>`);
  view.appendChild(head);

  let sporco = false;
  const etichetta = head.querySelector('#salvataggio');
  function mostraSalvataggio() {
    etichetta.hidden = !sporco && !corso.id;
    etichetta.className = 'chip ' + (sporco ? 'warn' : 'ok');
    etichetta.textContent = sporco ? '● Modifiche non salvate' : '✓ Salvato';
  }
  const modificato = () => { sporco = true; armaGuardiaIndietro(); mostraSalvataggio(); };
  mostraSalvataggio();

  const editor = el('<div class="editor"><div class="col-main"></div><div class="summary"></div></div>');
  view.appendChild(editor);
  const main = editor.querySelector('.col-main');
  const summary = editor.querySelector('.summary');

  // ---------- 1. il corso ----------
  const cCorso = card(1, 'Quale corso', `
    ${imp.corsi.length ? `<div class="field"><label>Dal catalogo</label>
      <select id="dal-catalogo"><option value="">— scegli per compilare i campi qui sotto —</option>
        ${imp.corsi.map(c => `<option value="${esc(c.id)}" ${corso.corso_id === c.id ? 'selected' : ''}>${esc(nomeBreve(c.nome))}${c.durata ? ` (${esc(c.durata)})` : ''}</option>`).join('')}
      </select></div>` : ''}
    <div class="field"><label>Denominazione</label><input type="text" id="corso_nome" value="${esc(corso.corso_nome || '')}"></div>
    <div class="form-row three">
      <div class="field"><label>Durata</label><input type="text" id="durata" value="${esc(corso.durata || '')}" placeholder="es. 12 ore"></div>
      <div class="field"><label>Ore (per le statistiche)</label><input ${CAMPO_DECIMALE} id="ore" value="${testoDecimale(corso.ore)}" placeholder="es. 12"></div>
      <div class="field"><label>Rinnovo ogni (anni)</label><input type="text" inputmode="numeric" autocomplete="off" id="rinnovo_anni" value="${esc(corso.rinnovo_anni ?? '')}" placeholder="non scade"></div>
    </div>
    ${corso.preventivo_id ? `<p class="mini" style="margin:4px 0 0">📄 Nato dal preventivo — <a href="#/formazione/preventivo/${esc(corso.preventivo_id)}">aprilo</a></p>` : ''}`);
  main.appendChild(cCorso);

  // ---------- 2. quando, dove, chi ----------
  const cQuando = card(2, 'Quando, dove e con chi', `
    <div class="form-row">
      <div class="field"><label>Committente</label>
        <input type="text" id="cliente" list="rubrica-corsi" autocomplete="off" value="${esc(corso.cliente || '')}" placeholder="vuoto per un corso aperto a privati">
        <datalist id="rubrica-corsi"></datalist></div>
      <div class="field"><label>Docenti / istruttori</label>
        <input type="text" id="docenti" value="${esc(corso.docenti || '')}" placeholder="es. Rossi, Bianchi">
        <div class="hint">Separati da virgola: le statistiche contano le ore di ciascuno.</div></div>
    </div>
    <div class="form-row">
      <div class="field"><label>Data di inizio</label><input type="date" id="data_inizio" value="${esc(corso.data_inizio || '')}"></div>
      <div class="field"><label>Data di fine</label><input type="date" id="data_fine" value="${esc(corso.data_fine || '')}">
        <div class="hint">Lasciala vuota per un corso di una giornata.</div></div>
    </div>
    <div class="form-row">
      <div class="field"><label>Dove si svolge</label>
        <select id="sede_tipo">
          <option value="nostra" ${corso.sede_tipo !== 'cliente' ? 'selected' : ''}>Presso la nostra sede</option>
          <option value="cliente" ${corso.sede_tipo === 'cliente' ? 'selected' : ''}>Presso il committente</option>
        </select></div>
      <div class="field" id="campo-sede"><label>Indirizzo</label><input type="text" id="sede" value="${esc(corso.sede || '')}" placeholder="es. Via Cornigliano 34, Genova"></div>
    </div>`);
  main.appendChild(cQuando);

  // ---------- 3. partecipanti ----------
  const cPart = card(3, 'Partecipanti ed esito', `
    <div class="rubrica-azioni">
      <button class="btn sm" id="add-part" type="button">➕ Aggiungi persona</button>
      <button class="btn sm" id="incolla" type="button">📋 Incolla un elenco</button>
      <button class="btn sm" id="tutti-idonei" type="button">✓ Tutti idonei</button>
      <button class="btn sm" id="esporta" type="button">📊 Excel</button>
    </div>
    <div id="senza-elenco" class="field" style="max-width:260px"><label>Numero di discenti</label>
      <input type="number" min="0" step="1" id="discenti" value="${esc(corso.discenti ?? '')}" placeholder="da definire">
      <div class="hint">Senza l'elenco dei nomi conta questo numero. Appena aggiungi le persone, il conto lo fa l'elenco.</div></div>
    <div id="elenco"></div>`);
  main.appendChild(cPart);

  // ---------- 4. stato e importo ----------
  const cStato = card(4, 'Stato e importo', `
    <div class="form-row">
      <div class="field"><label>Stato</label><select id="stato">${STATI_CORSO.map(s =>
        `<option value="${s}" ${corso.stato === s ? 'selected' : ''}>${ETICHETTA[s]}</option>`).join('')}</select>
        <div class="hint">Solo i corsi svolti entrano nelle statistiche e fanno partire il conto del rinnovo.</div></div>
      <div class="field"><label>Importo, IVA esclusa (€)</label><input ${CAMPO_DECIMALE} id="importo" value="${testoDecimale(corso.importo)}" placeholder="0,00">
        <div class="hint">La parte del preventivo che spetta a questo corso: è proposta da sola quando nasce da un preventivo.</div></div>
    </div>
    <div class="field"><label>Note</label><textarea id="note" rows="2" placeholder="Annotazioni interne: materiale, aula, accordi…">${esc(corso.note || '')}</textarea></div>`);
  main.appendChild(cStato);

  // ------------------------------------------------------------------
  //  Campi semplici
  // ------------------------------------------------------------------
  for (const campo of ['corso_nome', 'durata', 'cliente', 'docenti', 'sede', 'stato', 'note']) {
    const input = view.querySelector('#' + campo);
    const scrivi = () => { corso[campo] = input.value; aggiorna(); };
    input.addEventListener('input', scrivi);
    input.addEventListener('change', scrivi);
  }
  // La durata scritta propone le ore, finché le ore non le si scrive a mano.
  let oreToccate = corso.ore !== null && corso.ore !== undefined && corso.ore !== '';
  view.querySelector('#durata').addEventListener('input', () => {
    if (oreToccate) return;
    corso.ore = oreDaDurata(corso.durata);
    view.querySelector('#ore').value = testoDecimale(corso.ore);
  });
  view.querySelector('#ore').addEventListener('input', (e) => {
    corso.ore = leggiDecimale(e.target.value);
    oreToccate = e.target.value.trim() !== '';
    aggiorna();
  });
  view.querySelector('#rinnovo_anni').addEventListener('input', (e) => {
    const n = parseInt(e.target.value, 10);
    corso.rinnovo_anni = n > 0 ? n : null;
    aggiorna();
  });
  view.querySelector('#importo').addEventListener('input', (e) => { corso.importo = leggiDecimale(e.target.value); aggiorna(); });
  view.querySelector('#discenti').addEventListener('input', (e) => {
    corso.discenti = e.target.value === '' ? null : Math.max(0, parseInt(e.target.value, 10) || 0);
    aggiorna();
  });

  for (const campo of ['data_inizio', 'data_fine']) {
    view.querySelector('#' + campo).addEventListener('change', (e) => {
      corso[campo] = e.target.value || null;
      aggiorna();
    });
  }

  const selCatalogo = view.querySelector('#dal-catalogo');
  selCatalogo?.addEventListener('change', () => {
    const c = imp.corsi.find(x => x.id === selCatalogo.value);
    if (!c) return;
    corso.corso_id = c.id;
    corso.sigla = c.sigla || null;
    for (const [campo, valore] of [['corso_nome', c.nome], ['durata', c.durata || '']]) {
      corso[campo] = valore;
      view.querySelector('#' + campo).value = valore;
    }
    corso.ore = oreDaDurata(c.durata);
    oreToccate = false;
    view.querySelector('#ore').value = testoDecimale(corso.ore);
    corso.rinnovo_anni = Number(c.rinnovo_anni) || null;
    view.querySelector('#rinnovo_anni').value = corso.rinnovo_anni ?? '';
    aggiorna();
  });

  const selSede = view.querySelector('#sede_tipo');
  const mostraSede = () => { cQuando.querySelector('#campo-sede').hidden = corso.sede_tipo !== 'cliente'; };
  selSede.addEventListener('change', () => { corso.sede_tipo = selSede.value; mostraSede(); aggiorna(); });
  mostraSede();

  clienti.list().then(lista => {
    const dl = cQuando.querySelector('#rubrica-corsi');
    for (const c of lista) dl.appendChild(el(`<option value="${esc(c.nome)}"></option>`));
  }).catch(() => { /* senza rubrica il campo resta un campo di testo */ });

  // ------------------------------------------------------------------
  //  PARTECIPANTI
  // ------------------------------------------------------------------
  function disegnaElenco() {
    const zona = cPart.querySelector('#elenco');
    clear(zona);
    const p = corso.partecipanti;
    cPart.querySelector('#senza-elenco').hidden = p.length > 0;
    cPart.querySelector('#tutti-idonei').hidden = !p.length;
    cPart.querySelector('#esporta').hidden = !p.length;
    if (!p.length) return;
    const tab = el(`<div class="tbl-wrap"><table class="tbl tbl-partecipanti">
      <thead><tr><th>#</th><th>Cognome</th><th>Nome</th><th>Codice fiscale</th><th>Esito</th><th></th></tr></thead>
      <tbody></tbody></table></div>`);
    const tb = tab.querySelector('tbody');
    p.forEach((x, i) => {
      const tr = el(`<tr class="${x.esito === 'assente' ? 'assente' : ''}">
        <td class="muted">${i + 1}</td>
        <td><input type="text" data-k="cognome" value="${esc(x.cognome || '')}" aria-label="Cognome"></td>
        <td><input type="text" data-k="nome" value="${esc(x.nome || '')}" aria-label="Nome"></td>
        <td><input type="text" data-k="cf" value="${esc(x.cf || '')}" aria-label="Codice fiscale" maxlength="16" style="text-transform:uppercase"></td>
        <td><select data-k="esito" aria-label="Esito">${ESITI.map(([v, l]) => `<option value="${v}" ${x.esito === v ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
        <td><button class="btn ghost sm" type="button" title="Togli" aria-label="Togli">✕</button></td>
      </tr>`);
      tr.querySelectorAll('[data-k]').forEach(inp => {
        const evento = inp.tagName === 'SELECT' ? 'change' : 'input';
        inp.addEventListener(evento, () => {
          x[inp.dataset.k] = inp.dataset.k === 'cf' ? inp.value.toUpperCase().trim() : inp.value;
          if (inp.dataset.k === 'esito') tr.classList.toggle('assente', x.esito === 'assente');
          aggiorna();
        });
      });
      tr.querySelector('button').addEventListener('click', () => { p.splice(i, 1); disegnaElenco(); aggiorna(); });
      tb.appendChild(tr);
    });
    zona.appendChild(tab);
  }

  cPart.querySelector('#add-part').addEventListener('click', () => {
    corso.partecipanti.push({ cognome: '', nome: '', cf: '', esito: 'idoneo' });
    disegnaElenco(); aggiorna();
    cPart.querySelector('tbody tr:last-child input')?.focus();
  });

  cPart.querySelector('#tutti-idonei').addEventListener('click', () => {
    corso.partecipanti.forEach(x => { if (x.esito !== 'assente') x.esito = 'idoneo'; });
    disegnaElenco(); aggiorna();
  });

  cPart.querySelector('#incolla').addEventListener('click', () => {
    const body = el(`<div>
      <p class="hint" style="margin:0 0 10px">Una persona per riga. Va bene incollare da Excel (colonne cognome, nome, codice fiscale) o da una mail («Rossi Mario RSSMRA80A01D969X»): il codice fiscale si riconosce da solo, il primo nome è il cognome.</p>
      <textarea rows="10" style="width:100%" placeholder="Rossi Mario RSSMRA80A01D969X&#10;Bianchi Anna"></textarea>
      <div class="mini" id="anteprima-incolla" style="margin-top:6px"></div></div>`);
    const ta = body.querySelector('textarea');
    const ant = body.querySelector('#anteprima-incolla');
    ta.addEventListener('input', () => {
      const n = leggiPartecipanti(ta.value).length;
      ant.textContent = n ? `${n} ${n === 1 ? 'persona riconosciuta' : 'persone riconosciute'}` : '';
    });
    const foot = el('<div style="display:flex;gap:10px"><button class="btn" data-no>Annulla</button><button class="btn primary" data-ok>Aggiungi all\'elenco</button></div>');
    const { close } = openModal({ title: 'Incolla un elenco di partecipanti', body, footer: foot });
    foot.querySelector('[data-no]').onclick = () => close();
    foot.querySelector('[data-ok]').onclick = () => {
      const nuovi = leggiPartecipanti(ta.value);
      if (!nuovi.length) { toast('Nessun nome riconosciuto', 'err'); return; }
      // Lo stesso codice fiscale due volte è quasi sempre l'elenco incollato
      // di nuovo: si salta, invece di raddoppiare le persone formate.
      const giaCf = new Set(corso.partecipanti.map(x => x.cf).filter(Boolean));
      const daAggiungere = nuovi.filter(x => !x.cf || !giaCf.has(x.cf));
      corso.partecipanti.push(...daAggiungere);
      close();
      disegnaElenco(); aggiorna();
      const saltati = nuovi.length - daAggiungere.length;
      toast(`${daAggiungere.length} ${daAggiungere.length === 1 ? 'persona aggiunta' : 'persone aggiunte'}` +
        (saltati ? ` · ${saltati} già in elenco` : ''), 'ok');
    };
    ta.focus();
  });

  cPart.querySelector('#esporta').addEventListener('click', () => {
    const esito = Object.fromEntries(ESITI);
    const blob = buildXlsxBlob([
      { header: 'Cognome', tipo: 'testo', get: x => x.cognome },
      { header: 'Nome', tipo: 'testo', get: x => x.nome },
      { header: 'Codice fiscale', tipo: 'testo', get: x => x.cf },
      { header: 'Esito', tipo: 'testo', get: x => esito[x.esito] || '' },
      { header: 'Corso', tipo: 'testo', get: () => corso.corso_nome },
      { header: 'Data', tipo: 'data', get: () => corso.data_inizio },
    ], corso.partecipanti);
    scarica(blob, `partecipanti ${nomeBreve(corso.corso_nome)} ${corso.data_inizio || ''}.xlsx`.replace(/[\\/:*?"<>|]/g, '-'));
  });

  // ------------------------------------------------------------------
  //  Riepilogo e controlli
  // ------------------------------------------------------------------
  function aggiorna({ dallUtente = true } = {}) {
    if (dallUtente) modificato();
    clear(summary);
    const p = corso.partecipanti;
    const presenti = discentiEffettivi(corso);
    const conta = (e) => p.filter(x => x.esito === e).length;
    const ore = Number(corso.ore) || 0;
    summary.appendChild(el(`<div class="tot-box">
      <div class="card-b breakdown">
        <div class="b-row"><span class="lbl">Quando</span><span>${corso.data_inizio
          ? esc(fmtData(corso.data_inizio) + (corso.data_fine && corso.data_fine !== corso.data_inizio ? ' → ' + fmtData(corso.data_fine) : ''))
          : '<span class="avviso-zero">da fissare</span>'}</span></div>
        <div class="b-row"><span class="lbl">Ore</span><span>${ore || '—'}</span></div>
        ${p.length ? `<div class="b-row"><span class="lbl">In elenco</span><span>${p.length}</span></div>
          <div class="b-row"><span class="lbl">Idonei</span><span>${conta('idoneo')}</span></div>
          ${conta('non_idoneo') ? `<div class="b-row"><span class="lbl">Non idonei</span><span>${conta('non_idoneo')}</span></div>` : ''}
          ${conta('assente') ? `<div class="b-row"><span class="lbl">Assenti</span><span>${conta('assente')}</span></div>` : ''}` : ''}
        ${ore && presenti ? `<div class="b-row"><span class="lbl">Ore di formazione erogate</span><span>${ore * presenti}</span></div>` : ''}
      </div>
      <div class="row addebito">
        <div><div class="k">${corso.stato === 'svolto' ? 'Persone formate' : 'Discenti'}</div><div class="mini">${esc(ETICHETTA[corso.stato] || '')}</div></div>
        <div class="v">${presenti || '—'}</div>
      </div>
    </div>`));
    summary.appendChild(controlli());
    const salvaQui = el('<button class="btn primary salva-riepilogo" type="button">💾 Salva il corso</button>');
    salvaQui.addEventListener('click', salva);
    summary.appendChild(salvaQui);
  }

  function controlli() {
    const oggi = todayISO();
    const voci = [
      [corso.corso_nome ? 'ok' : 'no', corso.corso_nome ? 'Corso indicato' : 'Manca il corso'],
      [corso.data_inizio ? 'ok' : (corso.stato === 'svolto' ? 'no' : 'warn'), corso.data_inizio ? 'Date fissate' : 'Data da fissare'],
      [corso.docenti ? 'ok' : 'warn', corso.docenti ? 'Docenti assegnati' : 'Docenti da assegnare'],
    ];
    if (corso.stato === 'programmato' && corso.data_inizio && (corso.data_fine || corso.data_inizio) < oggi) {
      voci.push(['warn', 'Il corso è già passato: segna i presenti e lo stato «Svolto»']);
    }
    if (corso.stato === 'svolto') {
      voci.push(discentiEffettivi(corso)
        ? ['ok', 'Presenti registrati']
        : ['no', 'Corso svolto senza presenti: aggiungi l\'elenco o il numero']);
      if (corso.partecipanti.some(x => !x.cf)) voci.push(['warn', 'Qualche partecipante senza codice fiscale: serve per l\'attestato']);
    }
    if (corso.data_inizio && corso.data_fine && corso.data_fine < corso.data_inizio) voci.push(['no', 'La data di fine è prima di quella di inizio']);
    const icona = { ok: '✓', warn: '!', no: '✕' };
    return el(`<div class="card controlli-invio">
      <div class="card-h">${voci.every(([s]) => s === 'ok') ? '✓ Tutto registrato' : 'Da completare'}</div>
      <ul class="card-b">${voci.map(([s, t]) => `<li class="ci-${s}"><span class="ci-ico" aria-hidden="true">${icona[s]}</span><span>${esc(t)}</span></li>`).join('')}</ul>
    </div>`);
  }

  disegnaElenco();
  aggiorna({ dallUtente: false });

  // ------------------------------------------------------------------
  //  Azioni
  // ------------------------------------------------------------------
  let inCorso = false;
  async function salva() {
    if (inCorso) return;
    if (!(corso.corso_nome || '').trim()) { toast('Manca il nome del corso', 'err'); return; }
    if (corso.data_inizio && corso.data_fine && corso.data_fine < corso.data_inizio) { toast('La data di fine è prima di quella di inizio', 'err'); return; }
    if (corso.stato === 'svolto' && !corso.data_inizio) { toast('Un corso svolto ha bisogno della sua data', 'err'); return; }
    inCorso = true;
    const btn = view.querySelector('#btn-save'); const old = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<span class="spinner sm"></span> Salvo…';
    try {
      // Le righe vuote dell'elenco (aggiunte e mai compilate) non sono
      // persone: non si salvano e non si contano.
      const partecipanti = corso.partecipanti.filter(x => (x.cognome || x.nome || x.cf || '').trim());
      const salvato = await storeCorsi.save({
        ...corso,
        corso_nome: corso.corso_nome.trim(),
        partecipanti,
        // Con l'elenco, il numero salvato è quello dei presenti: chi legge
        // la tabella fuori dall'app trova lo stesso conto delle statistiche.
        discenti: partecipanti.length ? discentiEffettivi({ partecipanti }) : corso.discenti,
        sede: corso.sede_tipo === 'cliente' ? (corso.sede || null) : null,
        cliente: (corso.cliente || '').trim() || null,
        docenti: (corso.docenti || '').trim() || null,
      });
      corso.partecipanti = partecipanti;
      corso.updated_at = salvato.updated_at;
      sporco = false;
      toast('Corso salvato', 'ok');
      if (!corso.id) { corso.id = salvato.id; ctx.go(`#/formazione/corso/${salvato.id}`); }
      disegnaElenco();
      mostraSalvataggio();
    } catch (e) {
      if (e.conflitto) {
        if (await confirmDialog('Qualcun altro ha modificato questo corso nel frattempo. Ricaricare la versione aggiornata (perdendo le tue modifiche)?',
          { danger: true, okLabel: 'Ricarica' })) { sporco = false; location.reload(); }
        return;
      }
      toast('Errore nel salvataggio: ' + e.message, 'err');
    } finally { btn.disabled = false; btn.innerHTML = old; inCorso = false; }
  }
  view.querySelector('#btn-save').addEventListener('click', salva);

  const scorciatoia = (e) => {
    if (!editor.isConnected) { document.removeEventListener('keydown', scorciatoia); return; }
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 's') { e.preventDefault(); salva(); }
  };
  document.addEventListener('keydown', scorciatoia);

  view.querySelector('#btn-elimina')?.addEventListener('click', async () => {
    if (!await confirmDialog(`Eliminare questo corso? Con lui se ne va l'elenco dei partecipanti.`, { danger: true, okLabel: 'Elimina' })) return;
    try { await storeCorsi.remove(corso.id); } catch (e) { toast('Eliminazione non riuscita: ' + e.message, 'err'); return; }
    sporco = false;
    toast('Corso eliminato', 'ok');
    ctx.go('#/formazione/corsi');
  });

  view.querySelector('#btn-presenze').addEventListener('click', () => {
    stampaDocumento(fogliPresenze(corso, imp), `Presenze ${nomeBreve(corso.corso_nome)}`)
      .catch(e => toast('Stampa non riuscita: ' + e.message, 'err'));
  });

  sorvegliaUscita(editor, () => sporco);
}

// Il foglio presenze, sulla carta intestata come i preventivi: i dati del
// corso in testa e una riga per persona con lo spazio per la firma. Senza
// elenco nominativo escono righe vuote, tante quanti i discenti previsti
// (almeno dieci), da compilare a mano in aula.
function fogliPresenze(corso, imp) {
  const p = corso.partecipanti.filter(x => (x.cognome || x.nome || '').trim());
  const vuote = p.length ? 0 : Math.max(10, Number(corso.discenti) || 0);
  const quando = corso.data_inizio
    ? fmtData(corso.data_inizio) + (corso.data_fine && corso.data_fine !== corso.data_inizio ? ` – ${fmtData(corso.data_fine)}` : '')
    : '____________________';
  const dove = corso.sede_tipo === 'cliente' ? (corso.sede || 'presso il committente') : (imp.testi?.sede_nostra || 'Sede CRI').replace(/^I corsi si svolgeranno presso /i, '').replace(/\.$/, '');
  return [
    { t: 'titolo', testo: 'Registro presenze' },
    { t: 'p', testo: corso.corso_nome, grassetto: true },
    { t: 'p', testo: [corso.durata ? `Durata: ${corso.durata}` : '', `Data: ${quando}`].filter(Boolean).join(' — ') },
    { t: 'p', testo: `Sede: ${dove}` },
    ...(corso.cliente ? [{ t: 'p', testo: `Committente: ${corso.cliente}` }] : []),
    { t: 'p', testo: `Docenti: ${corso.docenti || '____________________'}` },
    { t: 'spazio' },
    {
      t: 'tabella',
      intestazioni: ['N.', 'Cognome e nome', 'Codice fiscale', 'Firma'],
      allineamenti: ['centro', 'sx', 'sx', 'sx'],
      larghezze: [6, 36, 24, 34],
      righe: [
        ...p.map((x, i) => [String(i + 1), `${x.cognome || ''} ${x.nome || ''}`.trim(), x.cf || '', '']),
        ...Array.from({ length: vuote }, (_, i) => [String(i + 1), '', '', '']),
      ],
    },
    { t: 'spazio' },
    { t: 'p', testo: 'Firma del docente: ______________________________' },
  ];
}

function scarica(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function nuovoCorso() {
  return {
    preventivo_id: null, corso_id: null, corso_nome: '', sigla: null, durata: '', ore: null, rinnovo_anni: null,
    cliente: '', data_inizio: null, data_fine: null, sede_tipo: 'nostra', sede: '', docenti: '',
    stato: 'programmato', discenti: null, partecipanti: [], importo: null, note: '',
  };
}

function card(numero, titolo, corpo) {
  return el(`<div class="card">
    <div class="card-h"><span><span class="passo-num">${numero}</span>${esc(titolo)}</span></div><div class="card-b">${corpo}</div></div>`);
}
