// ============================================================
//  RICHIESTA DI STRAORDINARIO — la scheda che si compila in centrale.
//  Volutamente corta: chi la usa la sta compilando mentre risponde al
//  telefono. Gli orari si prendono dal quadrante, le ore si calcolano da
//  soli (e restano correggibili), causale e tipo sono scelte da elenco.
//  Le tre cose che il foglio di carta non registrava — perché, chi l'ha
//  chiesto, a che punto è — qui sono campi, non memoria di qualcuno.
// ============================================================
import { straordinari } from '../data/store.js';
import { TIPI, STATI, durataOre, parseOre, fmtOre, tipoDi, nominativo, meseDi } from '../calc.js';
import { el, esc, toast, confirmDialog, todayISO, fmtGiorno } from '../lib/ui.js';
import { collegaOrologio } from '../../lib/orologio.js';
import { sorvegliaUscita, armaGuardiaIndietro, smettiDiSorvegliare } from '../../lib/uscita.js';

export async function renderRichiesta(view, id, ctx) {
  const nuovo = !id;
  let rec = nuovo ? bozza(ctx) : await straordinari.get(id);
  // Righe dello stesso autista nello stesso giorno: servono all'avviso sui
  // doppioni (la stessa serata registrata due volte è l'errore più comune di
  // un registro compilato in due persone).
  let stessoGiorno = [];

  let sporco = false;
  const modificato = () => { sporco = true; armaGuardiaIndietro(); };

  const attivi = ctx.autisti.filter(a => a.attivo || a.id === rec.autista_id);

  const editor = el(`<div class="str-editor">
    <div class="page-head">
      <div>
        <h1>${nuovo ? 'Nuova richiesta di straordinario' : 'Straordinario'}</h1>
        <p>${nuovo ? 'Registra le ore chieste a un autista: bastano autista, giorno e ore.'
                   : `${esc(rec.autista_nome)} · ${esc(fmtGiorno(rec.data))}`}</p>
      </div>
      <div class="actions">
        <a class="btn" href="#/straordinari/registro">← Registro</a>
        ${nuovo ? '<button class="btn" data-salva-nuovo title="Salva e prepara subito un\'altra riga">💾 Salva e nuova</button>' : ''}
        <button class="btn primary" data-salva>💾 Salva</button>
      </div>
    </div>

    <div class="banner warn" data-avviso-doppione hidden><div class="bi">⚠️</div><div></div></div>

    <div class="card"><div class="card-h">Dati della richiesta</div><div class="card-b str-form">
      <div class="form-row">
        <div class="field">
          <label for="f-autista">Autista *</label>
          <select id="f-autista">
            <option value="">— scegli —</option>
            ${attivi.map(a => `<option value="${esc(a.id)}">${esc(nominativo(a))}${a.ore_contratto ? ` (${a.ore_contratto}h)` : ''}</option>`).join('')}
          </select>
          <div class="hint" data-contratto></div>
        </div>
        <div class="field">
          <label for="f-data">Giorno *</label>
          <input type="date" id="f-data">
          <div class="hint" data-giorno></div>
        </div>
      </div>

      <div class="field">
        <label>Tipo</label>
        <div class="str-tipi" role="radiogroup" aria-label="Tipo di straordinario">
          ${TIPI.map(t => `<button type="button" class="str-tipo" data-tipo="${t.id}" role="radio" aria-checked="false"
            title="${esc(t.descrizione)}"><span>${t.emoji}</span>${esc(t.label)}</button>`).join('')}
        </div>
        <div class="hint" data-tipo-desc></div>
      </div>

      <div class="form-row three">
        <div class="field">
          <label for="f-dalle">Dalle</label>
          <input type="text" id="f-dalle" class="ora">
        </div>
        <div class="field">
          <label for="f-alle">Alle</label>
          <input type="text" id="f-alle" class="ora">
        </div>
        <div class="field">
          <label for="f-ore">Ore conteggiate *</label>
          <input type="text" id="f-ore" inputmode="decimal" placeholder="es. 2,5">
          <div class="hint" data-ore-hint>Si calcolano dagli orari; correggile se avete concordato altro.</div>
        </div>
      </div>

      <div class="form-row">
        <div class="field">
          <label for="f-causale">Causale</label>
          <input type="text" id="f-causale" list="str-causali" placeholder="perché sono state chieste queste ore">
          <datalist id="str-causali">${ctx.imp.causali.map(c => `<option value="${esc(c)}"></option>`).join('')}</datalist>
        </div>
        <div class="field">
          <label for="f-servizio">Servizio / mezzo</label>
          <input type="text" id="f-servizio" placeholder="es. GE 12, trasporto Milano, assistenza stadio">
        </div>
      </div>

      <div class="form-row">
        <div class="field">
          <label for="f-stato">Stato</label>
          <select id="f-stato">${STATI.map(s => `<option value="${s.id}">${esc(s.label)}</option>`).join('')}</select>
          <div class="hint" data-stato-desc></div>
        </div>
        <div class="field">
          <label for="f-richiedente">Richiesto da</label>
          <input type="text" id="f-richiedente" placeholder="chi ha chiesto lo straordinario">
          <div class="hint">Precompilato con il tuo nome: cambialo se la richiesta viene da altri.</div>
        </div>
      </div>

      <div class="field">
        <label for="f-note">Note</label>
        <textarea id="f-note" rows="2" placeholder="dettagli utili a fine mese: accordi presi, autorizzazioni, chi è stato sostituito…"></textarea>
      </div>

      ${nuovo ? '' : `<div class="str-meta muted small" data-meta></div>`}
    </div></div>

    ${nuovo ? '' : `<div class="str-elimina">
      <button class="btn danger ghost" data-elimina>🗑️ Elimina questa riga</button>
      <span class="muted small">Se il servizio non è stato svolto, meglio metterla in stato "Annullato": resta traccia della richiesta.</span>
    </div>`}
  </div>`);
  view.appendChild(editor);

  const campi = {
    autista: editor.querySelector('#f-autista'),
    data: editor.querySelector('#f-data'),
    dalle: editor.querySelector('#f-dalle'),
    alle: editor.querySelector('#f-alle'),
    ore: editor.querySelector('#f-ore'),
    causale: editor.querySelector('#f-causale'),
    servizio: editor.querySelector('#f-servizio'),
    stato: editor.querySelector('#f-stato'),
    richiedente: editor.querySelector('#f-richiedente'),
    note: editor.querySelector('#f-note'),
  };

  collegaOrologio(campi.dalle, { onCambio: () => { proponiOre(); modificato(); } });
  collegaOrologio(campi.alle, { onCambio: () => { proponiOre(); modificato(); } });

  // Le ore le propone il calcolo degli orari, ma smette di farlo appena
  // qualcuno le scrive a mano: un rientro di 50 minuti conteggiato come 1h
  // concordata non deve tornare a 0,83 solo perché si è corretto un orario.
  let oreAMano = false;
  function proponiOre() {
    if (oreAMano) return;
    const d = durataOre(campi.dalle.value, campi.alle.value);
    if (d === null) return;
    campi.ore.value = String(d).replace('.', ',');
    aggiornaHintOre();
  }
  function aggiornaHintOre() {
    const ore = parseOre(campi.ore.value);
    const hint = editor.querySelector('[data-ore-hint]');
    const d = durataOre(campi.dalle.value, campi.alle.value);
    if (ore === null) { hint.textContent = 'Si calcolano dagli orari; correggile se avete concordato altro.'; hint.classList.remove('avviso'); return; }
    const segno = tipoDi(rec.tipo).segno;
    const parti = [`Conteggiate ${fmtOre(ore)}${segno < 0 ? ' in meno (recupero)' : ''}.`];
    if (d !== null && Math.abs(d - ore) > 0.01) parti.push(`Gli orari indicati ne farebbero ${fmtOre(d)}.`);
    if (ore > ctx.imp.sogliaSingola) parti.push(`Sopra la soglia di ${fmtOre(ctx.imp.sogliaSingola)} per una singola richiesta: controlla che non sia un errore di battitura.`);
    hint.textContent = parti.join(' ');
    hint.classList.toggle('avviso', ore > ctx.imp.sogliaSingola);
  }

  // ---------- tipo (pulsanti invece di una tendina: sono quattro e la
  // scelta cambia il segno delle ore, quindi deve vedersi) ----------
  function scegliTipo(idTipo, daUtente) {
    rec.tipo = idTipo;
    editor.querySelectorAll('.str-tipo').forEach(b => {
      const sel = b.dataset.tipo === idTipo;
      b.classList.toggle('sel', sel);
      b.setAttribute('aria-checked', sel ? 'true' : 'false');
    });
    editor.querySelector('[data-tipo-desc]').textContent = tipoDi(idTipo).descrizione;
    aggiornaHintOre();
    if (daUtente) modificato();
  }
  editor.querySelectorAll('.str-tipo').forEach(b =>
    b.addEventListener('click', () => scegliTipo(b.dataset.tipo, true)));

  // ---------- riempimento dai dati ----------
  function riempi() {
    campi.autista.value = rec.autista_id || '';
    campi.data.value = rec.data || '';
    campi.dalle.value = String(rec.dalle || '').slice(0, 5);
    campi.alle.value = String(rec.alle || '').slice(0, 5);
    campi.ore.value = rec.ore === null || rec.ore === undefined ? '' : String(rec.ore).replace('.', ',');
    campi.causale.value = rec.causale || '';
    campi.servizio.value = rec.servizio || '';
    campi.stato.value = rec.stato || 'richiesto';
    campi.richiedente.value = rec.richiesto_da_nome || '';
    campi.note.value = rec.note || '';
    scegliTipo(rec.tipo || 'straordinario', false);
    aggiornaContratto();
    aggiornaGiorno();
    aggiornaStatoDesc();
    if (!nuovo) {
      editor.querySelector('[data-meta]').textContent =
        `Registrata il ${new Date(rec.created_at).toLocaleString('it-IT')}` +
        (rec.updated_at && rec.updated_at !== rec.created_at
          ? ` · ultima modifica ${new Date(rec.updated_at).toLocaleString('it-IT')}` : '');
    }
  }

  function aggiornaContratto() {
    const a = ctx.autisti.find(x => x.id === campi.autista.value);
    editor.querySelector('[data-contratto]').textContent = a?.ore_contratto
      ? `Contratto da ${a.ore_contratto} ore settimanali.` : '';
  }
  function aggiornaGiorno() {
    const hint = editor.querySelector('[data-giorno]');
    if (!campi.data.value) { hint.textContent = ''; hint.classList.remove('avviso'); return; }
    const d = new Date(campi.data.value + 'T00:00:00');
    const festivo = d.getDay() === 0 || d.getDay() === 6;
    const futuro = campi.data.value > todayISO();
    hint.textContent = fmtGiorno(campi.data.value) + (festivo ? ' · sabato/domenica' : '') +
      (futuro ? ' · richiesta per una data futura' : '');
    hint.classList.toggle('avviso', futuro);
  }
  function aggiornaStatoDesc() {
    const s = STATI.find(x => x.id === campi.stato.value) || STATI[0];
    editor.querySelector('[data-stato-desc]').textContent = s.descrizione;
  }

  // ---------- avviso doppioni ----------
  async function controllaDoppioni() {
    const banner = editor.querySelector('[data-avviso-doppione]');
    const testo = banner.querySelector('div:last-child');
    if (!campi.autista.value || !campi.data.value) { banner.hidden = true; return; }
    try {
      stessoGiorno = (await straordinari.listAutista(campi.autista.value, { da: campi.data.value, al: campi.data.value }))
        .filter(r => r.id !== rec.id && r.stato !== 'annullato');
    } catch { stessoGiorno = []; }          // l'avviso è un aiuto, non deve bloccare il salvataggio
    if (!stessoGiorno.length) { banner.hidden = true; return; }
    const dettaglio = stessoGiorno.map(r => `${fmtOre(r.ore)} (${tipoDi(r.tipo).label.toLowerCase()})`).join(', ');
    testo.innerHTML = `<b>Per questo autista c'è già una riga in questo giorno</b>
      <div class="small">${esc(dettaglio)}. Se sono ore diverse va bene così; se è la stessa serata,
      correggi quella esistente invece di aggiungerne un'altra.</div>`;
    banner.hidden = false;
  }

  // ---------- eventi ----------
  campi.autista.addEventListener('change', () => { aggiornaContratto(); controllaDoppioni(); modificato(); });
  campi.data.addEventListener('change', () => { aggiornaGiorno(); controllaDoppioni(); modificato(); });
  campi.ore.addEventListener('input', () => { oreAMano = true; aggiornaHintOre(); modificato(); });
  campi.stato.addEventListener('change', () => { aggiornaStatoDesc(); modificato(); });
  for (const c of [campi.causale, campi.servizio, campi.richiedente, campi.note]) {
    c.addEventListener('input', modificato);
  }

  // ---------- salvataggio ----------
  function raccogli() {
    const a = ctx.autisti.find(x => x.id === campi.autista.value);
    return {
      ...rec,
      autista_id: campi.autista.value || null,
      autista_nome: a ? nominativo(a) : rec.autista_nome,
      data: campi.data.value || null,
      dalle: campi.dalle.value || null,
      alle: campi.alle.value || null,
      ore: parseOre(campi.ore.value),
      tipo: rec.tipo,
      causale: campi.causale.value,
      servizio: campi.servizio.value,
      stato: campi.stato.value,
      richiesto_da: rec.richiesto_da || ctx.user?.id || null,
      richiesto_da_nome: campi.richiedente.value.trim() || null,
      note: campi.note.value,
    };
  }

  async function salva({ poiNuova } = {}) {
    const da = raccogli();
    if (!da.autista_id) { toast('Scegli l’autista', 'err'); campi.autista.focus(); return; }
    if (!da.data) { toast('Indica il giorno', 'err'); campi.data.focus(); return; }
    if (!da.ore || da.ore <= 0) { toast('Indica quante ore', 'err'); campi.ore.focus(); return; }
    if (da.ore > 24) { toast('Le ore di una singola riga non possono superare 24', 'err'); campi.ore.focus(); return; }
    // Una soglia superata non è un errore (una notte intera di emergenza
    // esiste): si chiede conferma, non si rifiuta.
    if (da.ore > ctx.imp.sogliaSingola && !await confirmDialog(
      `${fmtOre(da.ore)} in una sola richiesta: è sopra la soglia di ${fmtOre(ctx.imp.sogliaSingola)}. Confermi?`,
      { okLabel: 'Sì, è corretto' })) { campi.ore.focus(); return; }

    let salvata;
    try { salvata = await straordinari.save(da); }
    catch (e) { toast('Salvataggio non riuscito: ' + e.message, 'err'); return; }

    sporco = false;
    toast(nuovo ? 'Straordinario registrato' : 'Modifiche salvate', 'ok');
    // Il registro si apre sul mese della riga appena salvata, non su quello
    // che era selezionato prima: registrando il 2 del mese uno straordinario
    // del 31 precedente, tornare indietro e non trovarlo sembrerebbe una
    // riga persa.
    ctx.stato.mese = meseDi(salvata.data);

    if (poiNuova) {
      // "Salva e nuova" tiene giorno, tipo e richiedente (si registra una
      // serata alla volta, di solito con più autisti coinvolti) e azzera il
      // resto.
      rec = { ...bozza(ctx), data: salvata.data, tipo: salvata.tipo, richiesto_da_nome: salvata.richiesto_da_nome };
      oreAMano = false;
      riempi();
      campi.autista.focus();
      controllaDoppioni();
      return;
    }
    // Prima di cambiare pagina da codice si smonta la sorveglianza: altrimenti
    // la navigazione viene scambiata per un "indietro" e riporta qui (vedi
    // smettiDiSorvegliare in js/lib/uscita.js).
    smettiDiSorvegliare();
    ctx.go('#/straordinari/registro');
  }

  editor.querySelector('[data-salva]').addEventListener('click', () => salva());
  editor.querySelector('[data-salva-nuovo]')?.addEventListener('click', () => salva({ poiNuova: true }));
  editor.querySelector('[data-elimina]')?.addEventListener('click', async () => {
    if (!await confirmDialog('Eliminare definitivamente questa riga?', { danger: true, okLabel: 'Elimina' })) return;
    try { await straordinari.remove(rec.id); }
    catch (e) { toast('Eliminazione non riuscita: ' + e.message, 'err'); return; }
    sporco = false;
    toast('Riga eliminata', 'ok');
    // Prima di cambiare pagina da codice si smonta la sorveglianza: altrimenti
    // la navigazione viene scambiata per un "indietro" e riporta qui (vedi
    // smettiDiSorvegliare in js/lib/uscita.js).
    smettiDiSorvegliare();
    ctx.go('#/straordinari/registro');
  });

  riempi();
  controllaDoppioni();
  if (nuovo) campi.autista.focus();
  sorvegliaUscita(editor, () => sporco);
}

// Riga nuova: il giorno è oggi (in centrale si registra a fine turno) e il
// richiedente è chi sta scrivendo — le due cose che altrimenti si compilano
// venti volte al mese sempre uguali.
function bozza(ctx) {
  return {
    autista_id: '',
    autista_nome: '',
    data: todayISO(),
    dalle: '', alle: '', ore: '',
    tipo: 'straordinario',
    causale: '', servizio: '',
    stato: 'richiesto',
    richiesto_da: ctx.user?.id || null,
    richiesto_da_nome: ctx.user?.nome || ctx.user?.email || '',
    note: '',
  };
}
