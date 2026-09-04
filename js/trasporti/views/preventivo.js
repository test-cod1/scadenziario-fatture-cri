import { preventivi } from '../data/store.js';
import { calcola, nuovoInput } from '../calc.js';
import { CONFIG } from '../config.js';
import { geocode, route, RoutingError } from '../lib/routing.js';
import { prezzoRiferimento, paeseDaIso } from '../data/fuel-prices.js';
import { stampaPreventivo } from '../lib/pdf.js';
import { el, clear, esc, fmtEuro, fmtNum, fmtKm, fmtDate, toast, debounce, confirmDialog } from '../lib/ui.js';
import { sorvegliaUscita, armaGuardiaIndietro } from '../../lib/uscita.js';

export async function renderPreventivo(view, id, ctx) {
  const imp = ctx.imp;
  // Niente clear(view): la pagina la svuota gia' il router del portale, che ci
  // lascia in cima la riga di ritorno alla home delle sezioni.

  // ---- carica o crea ----
  let prev;
  if (id) {
    prev = await preventivi.get(id);
    if (!prev) { view.appendChild(el('<div class="empty-state"><div class="big">❓</div><p>Preventivo non trovato.</p></div>')); return; }
    const rawInput = prev.input || {};
    prev.input = { ...nuovoInput(imp), ...rawInput };
    // Compatibilità con preventivi salvati prima degli interruttori Pasti/Pernottamento/
    // Sanitari: se il flag non esisteva ancora, la sezione era sempre attiva -> resta attiva.
    if (rawInput.pastiOn === undefined) prev.input.pastiOn = true;
    if (rawInput.pernottamentoOn === undefined) prev.input.pernottamentoOn = true;
    // "Sanitari" nasce dalla vecchia sezione "Medico al seguito": il suo interruttore
    // era prima memorizzato in medicoOn. Se assente, eredita da lì (o resta attivo se
    // il preventivo è ancora più vecchio, precedente a qualunque interruttore).
    if (rawInput.sanitariOn === undefined) prev.input.sanitariOn = rawInput.medicoOn !== undefined ? rawInput.medicoOn : true;
    // Il ruolo Medico era l'unico esistente prima dei due ruoli separati: resta incluso
    // di default per i preventivi vecchi. L'Infermiere è un ruolo nuovo, assente prima.
    if (rawInput.medicoOn === undefined) prev.input.medicoOn = true;
    if (rawInput.infermiereOn === undefined) prev.input.infermiereOn = false;
    if (rawInput.materialeOn === undefined) prev.input.materialeOn = true;
    prev.tappe = prev.tappe || [];
    prev.partenza = prev.input.partenza || defaultPartenza();
  } else {
    prev = {
      titolo: '', note: '',
      tappe: [emptyTappa()],
      andata_ritorno: true, km_auto: true,
      input: nuovoInput(imp),
      paese_dest: 'IT', paese_dest_nome: 'Italia',
      partenza: defaultPartenza(),
    };
    // prezzo iniziale = Italia diesel
    prev.input.prezzoCarburante = prezzoRiferimento('IT', prev.input.alimentazione, tabella(imp));
  }
  // I flag UI e la partenza vivono dentro input (jsonb) per persistere senza colonne dedicate.
  let prezzoAuto = prev.input._prezzoAuto !== false; // di default il prezzo segue il Paese
  let pedaggioAuto = prev.input._pedaggioAuto !== false; // stima pedaggi estero attiva finché non la modifichi a mano
  // "estero" non è più un interruttore manuale: dipende SEMPRE dalla destinazione
  // (aggiornato in onTappeChanged -> updateEstero()).
  let medicoOreAuto = prev.input._medicoOreAuto !== false; // le ore sanitari seguono la durata del percorso finché non le tocchi
  let medicoTotAuto = prev.input._medicoTotAuto !== false;         // il totale medico = ore × tariffa finché non lo tocchi
  let infermiereTotAuto = prev.input._infermiereTotAuto !== false; // il totale infermiere = ore × tariffa finché non lo tocchi
  let calcKmSeq = 0; // scarta le risposte di route() obsolete se parte una richiesta più recente

  // ---- layout ----
  const head = el(`<div class="page-head">
    <div>
      <h1>${id ? 'Modifica preventivo' : 'Nuovo preventivo'}</h1>
      <p>Partenza modificabile — default: <b>${esc(CONFIG.partenza.label)}</b></p>
    </div>
    <div class="inline">
      <a class="btn" href="#/trasporti/preventivi">← Elenco</a>
      <button class="btn" id="btn-pdf">🖨️ Stampa / PDF</button>
      <button class="btn primary" id="btn-save">💾 Salva</button>
    </div>
  </div>`);
  view.appendChild(head);

  const editor = el(`<div class="editor">
    <div class="col-main"></div>
    <div class="summary"></div>
  </div>`);
  view.appendChild(editor);

  // Il preventivo vive in memoria fino al clic su "Salva": uscendo prima si
  // perde tutto. La sorveglianza c'era già nell'editor delle assistenze e
  // nelle impostazioni, ma non qui — dove c'è da perdere di più (itinerario,
  // km calcolati, voci). Un solo ascoltatore delegato sull'editor copre campi,
  // tendine, interruttori e caselle: quello che sta fuori (i pulsanti in
  // testata) non cambia dati.
  let sporco = false;
  const modificato = () => { sporco = true; armaGuardiaIndietro(); };
  editor.addEventListener('input', modificato);
  editor.addEventListener('change', modificato);
  const main = editor.querySelector('.col-main');
  const summaryCol = editor.querySelector('.summary');

  // ================= SEZIONE 2: PERCORSO E MEZZO (sempre visibile) =================
  const cItin = card('', `
    <div class="form-row three">
      <div class="field"><label>Mezzo</label><select id="mezzo">
        ${imp.mezzi.map(m => `<option value="${m.id}" ${prev.input.mezzoId===m.id?'selected':''}>${esc(m.nome)} — ${fmtNum(m.consumo,1)} km/l</option>`).join('')}
      </select><div class="hint" id="mezzo-hint"></div></div>
      <div class="field"><label>Alimentazione</label><select id="alim">
        <option value="diesel">Gasolio (diesel)</option>
        <option value="benzina">Benzina</option>
      </select></div>
      <div class="field">
        <label>Prezzo carburante (€/l) <span class="badge-auto" id="badge-auto">auto</span></label>
        <input type="number" step="0.001" id="prezzoCarb">
        <div class="hint" id="carb-hint"></div>
      </div>
    </div>
    <div id="itin-dynamic"></div>`, { collapsible: false });
  main.appendChild(cItin);
  const itinBody = cItin.querySelector('#itin-dynamic');
  renderItinerario();

  // ================= SEZIONE 3: EQUIPAGGIO E PASTI =================
  const cEq = card('Equipaggio e pasti', `
    <div class="form-row three">
      <div class="field"><label>Persone in squadra</label><input type="number" min="0" id="persone" value="${prev.input.persone}"></div>
      <div class="field"><label>Pasti a persona</label><input type="number" min="0" id="pastiPersona" value="${prev.input.pastiPersona}"></div>
      <div class="field"><label>Costo a pasto (€)</label><input type="number" min="0" step="0.5" id="pastoCosto" value="${prev.input.pastoCosto}"></div>
    </div>`);
  main.appendChild(cEq);

  // ================= SEZIONE 4: PERNOTTAMENTO =================
  const cPern = card('Pernottamento', `
    <div class="form-row three">
      <div class="field"><label>Notti</label><input type="number" min="0" id="notti" value="${prev.input.notti}"></div>
      <div class="field"><label>N. camere</label><input type="number" min="0" id="camere" value="${prev.input.camere}"></div>
      <div class="field"><label>€ a camera / notte</label><input type="number" min="0" step="0.5" id="prezzoCameraNotte" value="${prev.input.prezzoCameraNotte}"></div>
    </div>
    <div class="field"><label>€ a persona / notte (opzionale, alternativo alle camere)</label><input type="number" min="0" step="0.5" id="prezzoPersonaNotte" value="${prev.input.prezzoPersonaNotte}"></div>`);
  main.appendChild(cPern);

  // ================= SEZIONE 5: SANITARI (MEDICO / INFERMIERE) =================
  const cMedico = card('Sanitari', `
    <div class="form-row three">
      <div class="field"><label>Ore stimate <span class="badge-auto" id="badge-medico-ore">stima</span></label>
        <input type="number" min="0" step="0.5" id="medicoOre" value="${prev.input.medicoOre || ''}">
        <div class="hint" id="medico-ore-hint"></div></div>
      <div class="field"></div>
      <div class="field"></div>
    </div>
    <label class="section-t" style="margin-top:2px">Personale sanitario — puoi selezionare uno o entrambi</label>
    <div class="form-row three">
      <div class="field"><label>&nbsp;</label>
        <label class="chk"><input type="checkbox" id="ruolo-medico" ${prev.input.medicoOn?'checked':''}> Medico</label>
      </div>
      <div class="field"><label>Tariffa oraria (€/h)</label>
        <input type="number" min="0" step="0.5" id="medicoOraria" value="${prev.input.medicoOraria}"></div>
      <div class="field"><label>Totale medico (€) <span class="badge-auto" id="badge-medico-tot">calcolato</span></label>
        <input type="number" min="0" step="0.5" id="medico" value="${prev.input.medico || ''}">
        <div class="hint" id="medico-tot-hint"></div></div>
    </div>
    <div class="form-row three">
      <div class="field"><label>&nbsp;</label>
        <label class="chk"><input type="checkbox" id="ruolo-infermiere" ${prev.input.infermiereOn?'checked':''}> Infermiere</label>
      </div>
      <div class="field"><label>Tariffa oraria (€/h)</label>
        <input type="number" min="0" step="0.5" id="infermiereOraria" value="${prev.input.infermiereOraria}"></div>
      <div class="field"><label>Totale infermiere (€) <span class="badge-auto" id="badge-infermiere-tot">calcolato</span></label>
        <input type="number" min="0" step="0.5" id="infermiere" value="${prev.input.infermiere || ''}">
        <div class="hint" id="infermiere-tot-hint"></div></div>
    </div>`);
  main.appendChild(cMedico);

  // ================= SEZIONE 5b: PEDAGGI ESTERO (automatica, no interruttore manuale) =================
  const cPedaggi = card('Pedaggi estero', `
    <div class="form-row">
      <div class="field"><label>Pedaggi / vignette estero (€) <span class="badge-auto" id="badge-pedaggio">stima</span></label>
        <input type="number" min="0" step="0.5" id="pedaggi" value="${prev.input.pedaggi}">
        <div class="hint" id="pedaggio-hint"></div></div>
      <div class="field"></div>
    </div>`);
  main.appendChild(cPedaggi);

  // ================= SEZIONE 5c: MATERIALE DI CONSUMO =================
  const cMateriale = card('Materiale di consumo', `
    <div id="materiale"></div>
    <button class="btn sm" id="add-mat" type="button">➕ Aggiungi voce</button>`);
  main.appendChild(cMateriale);
  renderMateriale();

  const cNote = card('Note', `<textarea id="note" rows="3" placeholder="Note per il preventivo (visibili in stampa)…">${esc(prev.note || '')}</textarea>`);
  main.appendChild(cNote);

  // ---------------- BINDINGS ----------------
  const $ = (sel) => view.querySelector(sel);
  bind('#note', v => prev.note = v, 'text');

  $('#mezzo').addEventListener('change', e => {
    prev.input.mezzoId = e.target.value;
    const m = imp.mezzi.find(x => x.id === e.target.value);
    if (m) { prev.input.alimentazione = m.alimentazione; $('#alim').value = m.alimentazione; }
    if (prezzoAuto) refillPrezzo();
    updateMezzoHint(); recalc();
  });
  $('#alim').value = prev.input.alimentazione;
  $('#alim').addEventListener('change', e => { prev.input.alimentazione = e.target.value; if (prezzoAuto) refillPrezzo(); recalc(); });

  $('#prezzoCarb').value = prev.input.prezzoCarburante ?? '';
  $('#prezzoCarb').addEventListener('input', e => {
    prev.input.prezzoCarburante = num(e.target.value);
    prezzoAuto = false; $('#badge-auto').style.display = 'none'; recalc();
  });

  bindNum('#persone', 'persone');
  bindNum('#pastiPersona', 'pastiPersona');
  bindNum('#pastoCosto', 'pastoCosto');
  bindNum('#notti', 'notti');
  bindNum('#camere', 'camere');
  bindNum('#prezzoCameraNotte', 'prezzoCameraNotte');
  bindNum('#prezzoPersonaNotte', 'prezzoPersonaNotte');
  $('#pedaggi').value = prev.input.pedaggi || '';
  $('#pedaggi').addEventListener('input', e => {
    prev.input.pedaggi = num(e.target.value);
    pedaggioAuto = false;
    const b = $('#badge-pedaggio'); if (b) b.style.display = 'none';
    const h = $('#pedaggio-hint'); if (h) h.textContent = 'Valore inserito a mano.';
    recalc();
  });
  $('#medicoOre').addEventListener('input', e => {
    prev.input.medicoOre = num(e.target.value);
    medicoOreAuto = false;
    const b = $('#badge-medico-ore'); if (b) b.style.display = 'none';
    const h = $('#medico-ore-hint'); if (h) h.textContent = 'Valore inserito a mano.';
    if (medicoTotAuto) refillMedicoTotale();
    if (infermiereTotAuto) refillInfermiereTotale();
    recalc();
  });
  $('#medicoOraria').addEventListener('input', e => {
    prev.input.medicoOraria = num(e.target.value);
    if (medicoTotAuto) refillMedicoTotale();
    recalc();
  });
  $('#medico').addEventListener('input', e => {
    prev.input.medico = num(e.target.value);
    medicoTotAuto = false;
    const b = $('#badge-medico-tot'); if (b) b.style.display = 'none';
    const h = $('#medico-tot-hint'); if (h) h.textContent = 'Valore inserito a mano.';
    recalc();
  });
  $('#infermiereOraria').addEventListener('input', e => {
    prev.input.infermiereOraria = num(e.target.value);
    if (infermiereTotAuto) refillInfermiereTotale();
    recalc();
  });
  $('#infermiere').addEventListener('input', e => {
    prev.input.infermiere = num(e.target.value);
    infermiereTotAuto = false;
    const b = $('#badge-infermiere-tot'); if (b) b.style.display = 'none';
    const h = $('#infermiere-tot-hint'); if (h) h.textContent = 'Valore inserito a mano.';
    recalc();
  });
  $('#ruolo-medico').addEventListener('change', e => {
    prev.input.medicoOn = e.target.checked;
    setRuoloAbilitato('medico', e.target.checked);
    recalc();
  });
  $('#ruolo-infermiere').addEventListener('change', e => {
    prev.input.infermiereOn = e.target.checked;
    setRuoloAbilitato('infermiere', e.target.checked);
    recalc();
  });
  $('#add-mat').addEventListener('click', () => { prev.input.materiale.push({ desc: '', importo: 0 }); renderMateriale(); recalc(); });

  head.querySelector('#btn-save').addEventListener('click', save);
  head.querySelector('#btn-pdf').addEventListener('click', () => { syncItinerario(); prev.risultato = calcola(prev.input, imp); stampaPreventivo({ ...prev }, imp); });

  updateMezzoHint();
  updateCarbHint();
  updateEstero();
  initMedico();
  initSezioni();
  recalc();
  // Dopo il primo disegno: queste chiamate scrivono nei campi da codice, che
  // non fa scattare "input", quindi il preventivo non nasce già sporco.
  sorvegliaUscita(editor, () => sporco);

  // ================================================================
  //  ITINERARIO
  // ================================================================
  function renderItinerario() {
    clear(itinBody);
    const box = el('<div class="tappe"></div>');
    // partenza (modificabile, default sede CRI)
    box.appendChild(partenzaRow());
    // tappe destinazione
    prev.tappe.forEach((t, i) => box.appendChild(tappaRow(t, i)));
    itinBody.appendChild(box);

    const controls = el(`<div>
      <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <button class="btn sm" id="add-tappa" type="button">➕ Aggiungi tappa</button>
        <label class="chk"><input type="checkbox" id="ar" ${prev.andata_ritorno?'checked':''}> Andata e ritorno (rientro alla sede)</label>
        <button class="btn sm" id="calc-km" type="button">🧭 Ricalcola percorso</button>
      </div>
      <div class="form-row" style="margin-top:12px">
        <div class="field"><label>Km totali</label><input type="number" min="0" id="kmTotali" value="${prev.input.kmTotali||''}">
          <div class="hint" id="km-hint">Calcolati in automatico dalla destinazione. Puoi correggerli a mano.</div></div>
        <div class="field"></div>
      </div>
      <div class="form-row" style="margin-top:14px;padding-top:14px;border-top:1px dashed var(--line)">
        <div class="field"><label>Tariffa € / km</label><input type="number" min="0" step="0.05" id="tariffaKm" value="${prev.input.tariffaKm}">
          <div class="hint">Totale = km × tariffa + le voci attive (pasti, pernottamento, sanitari, materiale, pedaggi).</div></div>
        <div class="field"><label>Preset rapidi</label>
          <div class="pill-toggle" id="tariffa-preset">
            <button type="button" data-t="1.15">1,15</button>
            <button type="button" data-t="1.20">1,20</button>
            <button type="button" data-t="1.30">1,30</button>
          </div>
        </div>
      </div>
      <div class="switch-row">
        <label class="switch"><input type="checkbox" id="sw-pasti" ${prev.input.pastiOn ? 'checked' : ''}><span class="slider"></span>Pasti</label>
        <label class="switch"><input type="checkbox" id="sw-pernotto" ${prev.input.pernottamentoOn ? 'checked' : ''}><span class="slider"></span>Pernottamento</label>
        <label class="switch"><input type="checkbox" id="sw-sanitari" ${prev.input.sanitariOn ? 'checked' : ''}><span class="slider"></span>Sanitari</label>
        <label class="switch"><input type="checkbox" id="sw-materiale" ${prev.input.materialeOn ? 'checked' : ''}><span class="slider"></span>Materiale</label>
      </div>
    </div>`);
    itinBody.appendChild(controls);

    controls.querySelector('#add-tappa').addEventListener('click', () => { prev.tappe.push(emptyTappa()); renderItinerario(); });
    controls.querySelector('#ar').addEventListener('change', e => { prev.andata_ritorno = e.target.checked; autoCalcolaKm(); });
    controls.querySelector('#calc-km').addEventListener('click', () => calcolaKm());
    const kmInput = controls.querySelector('#kmTotali');
    kmInput.addEventListener('input', e => {
      prev.input.kmTotali = num(e.target.value); prev.km_auto = false;
      if (prev.input.estero && pedaggioAuto) refillPedaggio();
      recalc();
    });
    controls.querySelector('#tariffaKm').addEventListener('input', e => {
      prev.input.tariffaKm = num(e.target.value); recalc();
    });
    controls.querySelector('#tariffa-preset').addEventListener('click', e => {
      const b = e.target.closest('[data-t]'); if (!b) return;
      prev.input.tariffaKm = Number(b.dataset.t);
      controls.querySelector('#tariffaKm').value = b.dataset.t;
      recalc();
    });
    // Interruttori sezioni facoltative: off di default, la maggior parte dei
    // trasporti non le usa. Attivandoli si apre anche il relativo pannello.
    controls.querySelector('#sw-pasti').addEventListener('change', e => setSezione('pastiOn', cEq, e.target.checked));
    controls.querySelector('#sw-pernotto').addEventListener('change', e => setSezione('pernottamentoOn', cPern, e.target.checked));
    controls.querySelector('#sw-sanitari').addEventListener('change', e => setSezione('sanitariOn', cMedico, e.target.checked));
    controls.querySelector('#sw-materiale').addEventListener('change', e => setSezione('materialeOn', cMateriale, e.target.checked));
  }

  function partenzaRow() {
    const p = prev.partenza;
    const row = el(`<div class="tappa fissa">
      <div class="marker">P</div>
      <div class="body">
        <input type="text" placeholder="Partenza (indirizzo)…" value="${esc(p.label || '')}">
        <div class="ac" style="display:none"></div>
      </div>
      <button class="rm" title="Ripristina sede CRI" type="button">↺</button>
    </div>`);
    const input = row.querySelector('input');
    const acBox = row.querySelector('.ac');
    attachAutocomplete(input, acBox, (sel) => {
      Object.assign(prev.partenza, sel);
      input.value = sel.label;
      autoCalcolaKm();
    });
    input.addEventListener('input', () => { prev.partenza.label = input.value; prev.partenza.lon = prev.partenza.lat = null; });
    row.querySelector('.rm').addEventListener('click', () => { prev.partenza = defaultPartenza(); renderItinerario(); autoCalcolaKm(); });
    return row;
  }

  function tappaRow(t, i) {
    const isLast = i === prev.tappe.length - 1;
    const row = el(`<div class="tappa">
      <div class="marker">${i + 1}</div>
      <div class="body">
        <input type="text" placeholder="Indirizzo destinazione${isLast ? ' finale' : ''} (città, via, Paese)…" value="${esc(t.label || '')}">
        <div class="ac" style="display:none"></div>
      </div>
      <button class="rm" title="Rimuovi" type="button">✕</button>
    </div>`);
    const input = row.querySelector('input');
    const acBox = row.querySelector('.ac');
    attachAutocomplete(input, acBox, (sel) => {
      Object.assign(t, sel);
      input.value = sel.label;
      onTappeChanged();
    });
    input.addEventListener('input', () => { t.label = input.value; t.lon = t.lat = null; });
    row.querySelector('.rm').addEventListener('click', () => {
      if (prev.tappe.length <= 1) { prev.tappe[0] = emptyTappa(); }
      else prev.tappe.splice(i, 1);
      renderItinerario(); onTappeChanged();
    });
    return row;
  }

  function onTappeChanged() {
    // Paese destinazione = ultima tappa con coordinate
    const dest = [...prev.tappe].reverse().find(t => t.iso2 || t.iso3);
    if (dest) {
      const info = paeseDaIso(dest.iso2 || dest.iso3, tabella(imp));
      if (info) { prev.paese_dest = info.iso2; prev.paese_dest_nome = info.nome; }
      else { prev.paese_dest = dest.iso2 || null; prev.paese_dest_nome = dest.paese || null; }
      if (prezzoAuto) refillPrezzo();
    }
    updateEstero(); // dipende solo dalla destinazione: aggiornata ad ogni cambio
    updateCarbHint();
    recalc();
    autoCalcolaKm(); // km automatici appena c'è la destinazione
  }

  // Ricalcola i km/percorso appena c'è partenza + destinazione con coordinate.
  function autoCalcolaKm() {
    const partOk = Number.isFinite(prev.partenza.lon) && Number.isFinite(prev.partenza.lat);
    const hasDest = prev.tappe.some(t => Number.isFinite(t.lon) && Number.isFinite(t.lat));
    if (partOk && hasDest) calcolaKm({ auto: true });
  }

  async function calcolaKm({ auto = false } = {}) {
    const btn = view.querySelector('#calc-km');
    const part = prev.partenza;
    if (!Number.isFinite(part.lon) || !Number.isFinite(part.lat)) { if (!auto) toast('Seleziona una partenza valida dall\'elenco.', 'err'); return; }
    const stops = prev.tappe.filter(t => Number.isFinite(t.lon) && Number.isFinite(t.lat));
    if (!stops.length) { if (!auto) toast('Seleziona almeno una destinazione dall\'elenco suggerimenti.', 'err'); return; }
    const coords = [[part.lon, part.lat], ...stops.map(t => [t.lon, t.lat])];
    if (prev.andata_ritorno) coords.push([part.lon, part.lat]);
    const mySeq = ++calcKmSeq;
    const old = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spinner sm"></span> Calcolo…';
    try {
      const r = await route(coords);
      if (mySeq !== calcKmSeq) return; // una richiesta più recente ha già preso il suo posto
      prev.input.kmTotali = Math.round(r.distanceKm);
      prev.km_auto = true;
      view.querySelector('#kmTotali').value = prev.input.kmTotali;
      const h = Math.floor(r.durationMin / 60), m = Math.round(r.durationMin % 60);
      view.querySelector('#km-hint').innerHTML = `✅ ${fmtKm(prev.input.kmTotali)} · durata stimata ${h}h ${m}m ${prev.andata_ritorno ? '(a/r)' : '(sola andata)'}`;
      if (prev.input.estero && pedaggioAuto) refillPedaggio();
      if (medicoOreAuto) refillMedicoOre(r.durationMin);
      recalc();
    } catch (e) {
      if (mySeq !== calcKmSeq) return;
      const msg = e instanceof RoutingError ? e.message : (e.message || 'Errore nel calcolo');
      view.querySelector('#km-hint').innerHTML = `<span style="color:var(--danger)">⚠️ ${esc(msg)} — inserisci i km a mano.</span>`;
      if (!auto) toast(msg, 'err');
    } finally { if (mySeq === calcKmSeq) { btn.disabled = false; btn.innerHTML = old; } }
  }

  function syncItinerario() {
    const kmEl = view.querySelector('#kmTotali');
    if (kmEl) prev.input.kmTotali = num(kmEl.value);
  }

  // ================================================================
  //  MATERIALE DI CONSUMO
  // ================================================================
  function renderMateriale() {
    const box = view.querySelector('#materiale');
    clear(box);
    (prev.input.materiale || []).forEach((m, i) => {
      const r = el(`<div class="matrow">
        <input type="text" placeholder="Descrizione (es. ossigeno, orinale, DPI…)" value="${esc(m.desc || '')}">
        <input type="number" step="0.5" placeholder="€" value="${m.importo || ''}">
        <button class="rm btn ghost sm" type="button" title="Rimuovi">✕</button>
      </div>`);
      const [d, imp2] = r.querySelectorAll('input');
      d.addEventListener('input', () => { m.desc = d.value; });
      imp2.addEventListener('input', () => { m.importo = num(imp2.value); recalc(); });
      r.querySelector('.rm').addEventListener('click', () => { prev.input.materiale.splice(i, 1); renderMateriale(); recalc(); });
      box.appendChild(r);
    });
  }

  // ================================================================
  //  RIEPILOGO (colonna destra)
  // ================================================================
  function recalc() {
    const r = calcola(prev.input, imp);
    prev.risultato = r;
    prev.km_totali = prev.input.kmTotali;
    clear(summaryCol);

    const line = (lbl, val, strong) => `<div class="b-row ${strong ? 'strong' : ''}"><span class="lbl">${lbl}</span><span class="money">${fmtEuro(val)}</span></div>`;
    const bd = el(`<div class="tot-box"><div class="card-b breakdown">
      ${line(`Carburante (${fmtNum(r.litri,1)} l)`, r.carburante)}
      ${line('Pasti', r.pasti)}
      ${r.pernottamento > 0 ? line('Pernottamento', r.pernottamento) : ''}
      ${r.pedaggi > 0 ? line('Pedaggi/vignette', r.pedaggi) : ''}
      ${r.medico > 0 ? line(prev.input.medicoOre ? `Medico (${fmtNum(prev.input.medicoOre,1)}h × ${fmtEuro(prev.input.medicoOraria)}/h)` : 'Medico', r.medico) : ''}
      ${r.infermiere > 0 ? line(prev.input.medicoOre ? `Infermiere (${fmtNum(prev.input.medicoOre,1)}h × ${fmtEuro(prev.input.infermiereOraria)}/h)` : 'Infermiere', r.infermiere) : ''}
      ${r.materiale > 0 ? line('Materiale', r.materiale) : ''}
    </div></div>`);
    summaryCol.appendChild(bd);

    const box = el(`<div class="tot-box">
      <div class="row"><div><div class="k">Spesa reale</div><div class="mini">costo vivo del viaggio</div></div><div class="v money">${fmtEuro(r.spesaReale)}</div></div>
      <div class="row"><div><div class="k">Addebito (km×tariffa)</div><div class="mini">${fmtKm(prev.input.kmTotali)} × ${fmtEuro(prev.input.tariffaKm)} + rimborsi</div></div><div class="v money">${fmtEuro(r.addebitoKm)}</div></div>
      <div class="row addebito"><div><div class="k">Totale</div><div class="mini">tariffa + voci attive</div></div><div class="v money">${fmtEuro(r.addebito)}</div></div>
      <div class="row margine"><div><div class="k">Margine</div><div class="mini">${r.margineperc!=null?fmtNum(r.margineperc,0)+'%':''}${r.tariffaEffettiva?` · ${fmtEuro(r.tariffaEffettiva)}/km eff.`:''}</div></div><div class="v money ${r.margine>=0?'pos':'neg'}">${fmtEuro(r.margine)}</div></div>
    </div>`);
    summaryCol.appendChild(box);
  }

  // ================================================================
  //  SALVATAGGIO
  // ================================================================
  async function save() {
    syncItinerario();
    prev.titolo = titoloDaDestinazione();
    prev.risultato = calcola(prev.input, imp);
    prev.km_totali = prev.input.kmTotali;
    // record con SOLO colonne reali; partenza e flag UI dentro input (jsonb)
    const rec = {
      titolo: prev.titolo,
      note: prev.note ?? null,
      tappe: prev.tappe || [],
      andata_ritorno: prev.andata_ritorno,
      km_auto: prev.km_auto,
      km_totali: prev.km_totali,
      paese_dest: prev.paese_dest ?? null,
      paese_dest_nome: prev.paese_dest_nome ?? null,
      input: { ...prev.input, partenza: prev.partenza, _prezzoAuto: prezzoAuto, _pedaggioAuto: pedaggioAuto, _medicoOreAuto: medicoOreAuto, _medicoTotAuto: medicoTotAuto, _infermiereTotAuto: infermiereTotAuto },
      risultato: prev.risultato,
    };
    if (prev.id) rec.id = prev.id;
    if (prev.created_at) rec.created_at = prev.created_at;
    const btn = head.querySelector('#btn-save'); const old = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<span class="spinner sm"></span> Salvo…';
    try {
      const saved = await preventivi.save(rec);
      toast('Preventivo salvato', 'ok');
      sporco = false;   // salvato: uscendo non c'è più niente da perdere
      prev.id = saved.id;
      prev.created_at = saved.created_at;
      ctx.go(`#/trasporti/preventivo/${saved.id}`);
    } catch (e) {
      toast('Errore nel salvataggio: ' + (e.message || e), 'err');
      console.error(e);
    } finally { btn.disabled = false; btn.innerHTML = old; }
  }

  // ---------------- helpers locali ----------------
  // collapsible=false -> card normale sempre visibile (solo la prima sezione).
  // Le altre sono <details> nativi: si aprono/chiudono cliccando il titolo,
  // senza bisogno di JS di gestione (il contenuto resta comunque nel DOM).
  function card(title, bodyHtml, { collapsible = true, open = false } = {}) {
    if (!collapsible) {
      const head = title ? `<div class="card-h">${esc(title)}</div>` : '';
      return el(`<div class="card">${head}<div class="card-b">${bodyHtml}</div></div>`);
    }
    return el(`<details class="card collapsible"${open ? ' open' : ''}>
      <summary class="card-h">${esc(title)}<span class="chev">▾</span></summary>
      <div class="card-b">${bodyHtml}</div>
    </details>`);
  }
  function bind(sel, setter, kind) {
    const e = view.querySelector(sel); if (!e) return;
    e.addEventListener('input', () => setter(e.value));
  }
  function bindNum(sel, key) {
    const e = view.querySelector(sel); if (!e) return;
    e.addEventListener('input', () => { prev.input[key] = num(e.value); recalc(); });
  }
  function refillPrezzo() {
    const p = prezzoRiferimento(prev.paese_dest || 'IT', prev.input.alimentazione, tabella(imp));
    const badge = view.querySelector('#badge-auto');
    if (p != null) {
      prev.input.prezzoCarburante = p;
      const inp = view.querySelector('#prezzoCarb'); if (inp) inp.value = p;
      if (badge) badge.style.display = '';
    } else if (badge) {
      // Nessun prezzo di riferimento per questo Paese: non lasciare il badge
      // "auto" su un valore ormai riferito alla destinazione precedente.
      badge.style.display = 'none';
    }
  }
  function tariffaEstero() {
    const r = imp.pedaggiEsteroKm != null ? imp.pedaggiEsteroKm : 0.10;
    return Number(r) || 0;
  }
  function refillPedaggio() {
    const rate = tariffaEstero();
    const km = num(prev.input.kmTotali);
    prev.input.pedaggi = Math.round(km * rate);
    const inp = view.querySelector('#pedaggi'); if (inp) inp.value = prev.input.pedaggi || '';
    const badge = view.querySelector('#badge-pedaggio'); if (badge) badge.style.display = '';
    const h = view.querySelector('#pedaggio-hint');
    if (h) h.innerHTML = `≈ ${fmtNum(km, 0)} km × ${fmtEuro(rate)}/km (stima estero). Adegua a mano per vignette o caselli reali.`;
  }
  // Attiva/disattiva una sezione facoltativa (Pasti/Pernottamento/Medico) dal
  // relativo interruttore in Itinerario: se off, la sezione è nascosta e non
  // conta nel totale (gating fatto in calcola() sui flag pastiOn/pernottamentoOn/medicoOn).
  function setSezione(key, cardEl, on) {
    prev.input[key] = on;
    cardEl.style.display = on ? '' : 'none';
    if (on && cardEl.tagName === 'DETAILS') cardEl.open = true;
    recalc();
  }
  // Applica la visibilità iniziale delle sezioni facoltative in base ai flag salvati.
  function initSezioni() {
    cEq.style.display = prev.input.pastiOn ? '' : 'none';
    cPern.style.display = prev.input.pernottamentoOn ? '' : 'none';
    cMedico.style.display = prev.input.sanitariOn ? '' : 'none';
    cMateriale.style.display = prev.input.materialeOn ? '' : 'none';
  }
  // La sezione "Pedaggi estero" NON ha un interruttore manuale: si attiva
  // unicamente quando la destinazione è fuori dall'Italia (prev.paese_dest).
  // Chiamata sia all'avvio sia ogni volta che cambia la destinazione.
  function updateEstero() {
    const on = !!(prev.paese_dest && prev.paese_dest !== 'IT');
    prev.input.estero = on;
    cPedaggi.style.display = on ? '' : 'none';
    if (!on) {
      prev.input.pedaggi = 0;
      const p = view.querySelector('#pedaggi'); if (p) p.value = '';
      return;
    }
    if (cPedaggi.tagName === 'DETAILS') cPedaggi.open = true;
    if (pedaggioAuto) {
      refillPedaggio();
    } else {
      const badge = view.querySelector('#badge-pedaggio'); if (badge) badge.style.display = 'none';
      const h = view.querySelector('#pedaggio-hint'); if (h) h.textContent = 'Valore inserito a mano.';
    }
  }
  // Ore stimate dalla durata del percorso (arrotondate alla mezz'ora), condivise
  // dai due ruoli sanitari (fanno lo stesso viaggio).
  function refillMedicoOre(durationMin) {
    const ore = Math.round((num(durationMin) / 60) * 2) / 2;
    prev.input.medicoOre = ore;
    const inp = view.querySelector('#medicoOre'); if (inp) inp.value = ore || '';
    const badge = view.querySelector('#badge-medico-ore'); if (badge) badge.style.display = '';
    const h = view.querySelector('#medico-ore-hint'); if (h) h.innerHTML = `≈ durata del percorso. Stima, modificabile.`;
    if (medicoTotAuto) refillMedicoTotale();
    if (infermiereTotAuto) refillInfermiereTotale();
  }
  function refillMedicoTotale() {
    const ore = num(prev.input.medicoOre);
    const tariffa = num(prev.input.medicoOraria);
    prev.input.medico = Math.round(ore * tariffa * 100) / 100;
    const inp = view.querySelector('#medico'); if (inp) inp.value = prev.input.medico || '';
    const badge = view.querySelector('#badge-medico-tot'); if (badge) badge.style.display = '';
    const h = view.querySelector('#medico-tot-hint');
    if (h) h.innerHTML = `= ${fmtNum(ore,1)} h × ${fmtEuro(tariffa)}/h. Calcolato, modificabile.`;
  }
  function refillInfermiereTotale() {
    const ore = num(prev.input.medicoOre);
    const tariffa = num(prev.input.infermiereOraria);
    prev.input.infermiere = Math.round(ore * tariffa * 100) / 100;
    const inp = view.querySelector('#infermiere'); if (inp) inp.value = prev.input.infermiere || '';
    const badge = view.querySelector('#badge-infermiere-tot'); if (badge) badge.style.display = '';
    const h = view.querySelector('#infermiere-tot-hint');
    if (h) h.innerHTML = `= ${fmtNum(ore,1)} h × ${fmtEuro(tariffa)}/h. Calcolato, modificabile.`;
  }
  // Abilita/disabilita i campi tariffa e totale del ruolo (medico/infermiere)
  // in base al checkbox: se il ruolo non è incluso i campi sono disattivati.
  function setRuoloAbilitato(ruolo, on) {
    const tariffaInp = view.querySelector(ruolo === 'medico' ? '#medicoOraria' : '#infermiereOraria');
    const totInp = view.querySelector(ruolo === 'medico' ? '#medico' : '#infermiere');
    if (tariffaInp) tariffaInp.disabled = !on;
    if (totInp) totInp.disabled = !on;
  }
  function initMedico() {
    if (!medicoOreAuto) {
      const badge = view.querySelector('#badge-medico-ore'); if (badge) badge.style.display = 'none';
      const h = view.querySelector('#medico-ore-hint'); if (h) h.textContent = 'Valore inserito a mano.';
    }
    if (!medicoTotAuto) {
      const badge = view.querySelector('#badge-medico-tot'); if (badge) badge.style.display = 'none';
      const h = view.querySelector('#medico-tot-hint'); if (h) h.textContent = 'Valore inserito a mano.';
    } else if (prev.input.medicoOre) {
      const h = view.querySelector('#medico-tot-hint');
      if (h) h.innerHTML = `= ${fmtNum(prev.input.medicoOre,1)} h × ${fmtEuro(prev.input.medicoOraria)}/h. Calcolato, modificabile.`;
    }
    if (!infermiereTotAuto) {
      const badge = view.querySelector('#badge-infermiere-tot'); if (badge) badge.style.display = 'none';
      const h = view.querySelector('#infermiere-tot-hint'); if (h) h.textContent = 'Valore inserito a mano.';
    } else if (prev.input.medicoOre) {
      const h = view.querySelector('#infermiere-tot-hint');
      if (h) h.innerHTML = `= ${fmtNum(prev.input.medicoOre,1)} h × ${fmtEuro(prev.input.infermiereOraria)}/h. Calcolato, modificabile.`;
    }
    setRuoloAbilitato('medico', prev.input.medicoOn);
    setRuoloAbilitato('infermiere', prev.input.infermiereOn);
  }
  // Titolo automatico = destinazione finale semplificata (solo al salvataggio).
  function titoloDaDestinazione() {
    const dest = [...prev.tappe].reverse().find(t => t && t.label && String(t.label).trim());
    const citta = dest ? shorten(dest.label).replace(/\s*\(.*\)\s*$/, '').trim() : '';
    return citta ? `Genova → ${citta}` : 'Preventivo trasporto';
  }
  function updateMezzoHint() {
    const m = imp.mezzi.find(x => x.id === prev.input.mezzoId);
    const h = view.querySelector('#mezzo-hint');
    if (m && h) h.textContent = `Consumo di riferimento: ${fmtNum(m.consumo,1)} km/l`;
  }
  function updateCarbHint() {
    const h = view.querySelector('#carb-hint'); if (!h) return;
    const dest = prev.paese_dest || 'IT';
    const info = paeseDaIso(dest, tabella(imp));
    if (dest === 'IT' && imp._prezzoItaliaLiveAl) {
      h.innerHTML = `📡 Media nazionale live (MISE, ${esc(fmtDate(imp._prezzoItaliaLiveAl))}). Modificabile.`;
    } else if (info) {
      h.innerHTML = `Media ${esc(info.nome)} (${fmtDate(imp.fuelDataDate)}). Modificabile.`;
    } else {
      h.textContent = 'Prezzo manuale.';
    }
  }
}

// ================= autocomplete geocoding =================
function attachAutocomplete(input, box, onSelect) {
  let items = [], sel = -1;
  const run = debounce(async () => {
    const q = input.value.trim();
    if (q.length < 3) { hide(); return; }
    box.style.display = 'block'; box.innerHTML = '<div class="empty">Ricerca…</div>';
    try {
      items = await geocode(q, { size: 6 });
      draw();
    } catch (e) {
      box.innerHTML = `<div class="empty">⚠️ ${esc(e.message || 'ricerca non disponibile')}</div>`;
    }
  }, 350);
  function draw() {
    if (!items.length) { box.innerHTML = '<div class="empty">Nessun risultato</div>'; return; }
    box.innerHTML = items.map((it, i) =>
      `<div class="item ${i===sel?'sel':''}" data-i="${i}"><span class="flag">${flag(it.iso2)}</span>${esc(it.label)}</div>`).join('');
    box.querySelectorAll('.item').forEach(d => d.addEventListener('mousedown', ev => {
      ev.preventDefault(); choose(Number(d.dataset.i));
    }));
  }
  function choose(i) { const it = items[i]; if (it) onSelect(it); hide(); }
  function hide() { box.style.display = 'none'; sel = -1; }
  input.addEventListener('input', run);
  input.addEventListener('keydown', e => {
    if (box.style.display === 'none') return;
    if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, items.length - 1); draw(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); draw(); e.preventDefault(); }
    else if (e.key === 'Enter') { if (sel >= 0) { choose(sel); e.preventDefault(); } }
    else if (e.key === 'Escape') hide();
  });
  input.addEventListener('blur', () => setTimeout(hide, 150));
}

// ================= util =================
function emptyTappa() { return { label: '', lon: null, lat: null, iso2: null, iso3: null, paese: null }; }
function tabella(imp) { return imp.prezziCustom || undefined; }
function num(v) { const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : 0; }
function shorten(s) { return String(s).split(',')[0].trim(); }
function defaultPartenza() {
  return {
    label: CONFIG.partenza.indirizzo || CONFIG.partenza.label,
    lon: CONFIG.partenza.lon,
    lat: CONFIG.partenza.lat,
    iso2: 'IT', iso3: 'ITA', paese: 'Italia',
  };
}
function flag(iso2) {
  if (!iso2 || iso2.length !== 2) return '🏳️';
  return String.fromCodePoint(...[...iso2.toUpperCase()].map(c => 0x1f1e6 + c.charCodeAt(0) - 65));
}
