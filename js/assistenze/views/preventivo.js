import { preventivi } from '../data/store.js';
import { calcola, inLettere, oreTurno } from '../calc.js';
import { fmtOre, etichettaSconto } from '../lib/documento.js';
import { el, clear, esc, toast, confirmDialog, fmtEuro, todayISO, sommaGiorniISO } from '../../lib/ui.js';
import { collegaOrologio } from '../../lib/orologio.js';

// ============================================================
//  EDITOR DEL PREVENTIVO DI ASSISTENZA
//  Tre blocchi in fila: a chi va il preventivo, quali voci del tariffario si
//  usano, e il calendario dei turni — che è anche il calcolo, perché il
//  totale esce da lì. A destra il riepilogo si aggiorna a ogni modifica.
// ============================================================

export async function renderPreventivo(view, id, ctx) {
  const imp = ctx.imp;
  let prev;
  if (id) {
    try { prev = await preventivi.get(id); }
    catch (e) { view.appendChild(el(`<div class="empty-state"><div class="big">⚠️</div><p>Preventivo non trovato: ${esc(e.message)}</p></div>`)); return; }
    prev.voci = prev.voci || [];
    prev.calendario = prev.calendario || [];
  } else {
    prev = nuovoPreventivo(imp);
  }

  const head = el(`<div class="page-head">
    <div>
      <h1>${id ? 'Modifica preventivo' : 'Nuovo preventivo'}</h1>
      <p>Assistenza sanitaria a manifestazioni ed eventi</p>
    </div>
    <div class="inline">
      <a class="btn" href="#/assistenze/preventivi">← Elenco</a>
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
  const modificato = () => { sporco = true; };

  const editor = el(`<div class="editor"><div class="col-main"></div><div class="summary"></div></div>`);
  view.appendChild(editor);
  const main = editor.querySelector('.col-main');
  const summary = editor.querySelector('.summary');

  // ---------- destinatario ----------
  main.appendChild(card('Destinatario', `
    <div class="form-row">
      <div class="field"><label>Cliente / ente</label><input type="text" id="cliente" value="${esc(prev.cliente || '')}"></div>
      <div class="field"><label>Codice fiscale / P.IVA</label><input type="text" id="cliente_cf" value="${esc(prev.cliente_cf || '')}"></div>
    </div>
    <div class="field"><label>Indirizzo</label><input type="text" id="cliente_indirizzo" value="${esc(prev.cliente_indirizzo || '')}"></div>
    <div class="form-row three">
      <div class="field"><label>Referente</label><input type="text" id="referente" value="${esc(prev.referente || '')}"></div>
      <div class="field"><label>Email</label><input type="text" id="referente_email" value="${esc(prev.referente_email || '')}"></div>
      <div class="field"><label>Telefono</label><input type="text" id="referente_telefono" value="${esc(prev.referente_telefono || '')}"></div>
    </div>`));

  // ---------- evento ----------
  main.appendChild(card('Servizio', `
    <div class="field"><label>Oggetto — di quale evento si tratta</label>
      <input type="text" id="oggetto" placeholder="es. Torneo giovanile di pallavolo del 12 aprile 2026" value="${esc(prev.oggetto || '')}">
      <div class="hint">Finisce nella riga «Oggetto:» del documento, dopo la formula fissa.</div></div>
    <div class="field"><label>Luogo</label><input type="text" id="luogo" placeholder="es. Palasport di Genova, via …" value="${esc(prev.luogo || '')}"></div>
    <div class="form-row">
      <div class="field"><label>Data del documento</label><input type="date" id="data_documento" value="${esc(prev.data_documento || todayISO())}"></div>
      <div class="field"><label>Stato</label><select id="stato">
        ${['bozza', 'inviato', 'confermato', 'annullato'].map(s => `<option value="${s}" ${prev.stato === s ? 'selected' : ''}>${s[0].toUpperCase() + s.slice(1)}</option>`).join('')}
      </select></div>
    </div>`));

  // ---------- voci ----------
  const cVoci = card('Voci del preventivo', `
    <p class="hint" style="margin:0 0 12px">Scegli cosa serve per questo servizio. I prezzi arrivano dal tariffario (Impostazioni) e qui restano modificabili: la modifica vale solo per questo preventivo.</p>
    <div id="voci"></div>`);
  main.appendChild(cVoci);

  // ---------- calendario ----------
  const cCal = card('Calendario dell\'assistenza', `
    <p class="hint" style="margin:0 0 12px">Una riga per turno. Le ore si calcolano dagli orari (un turno che scavalca la mezzanotte è gestito), e il totale è ore × tariffa × quantità. Il calendario viene riportato anche nel preventivo.</p>
    <div class="tbl-wrap"><table class="tbl cal-tbl"><thead></thead><tbody></tbody></table></div>
    <div class="cal-azioni">
      <button class="btn sm" id="add-turno" type="button">➕ Aggiungi turno</button>
      <span class="mini">oppure tutti i giorni</span>
      <input type="date" id="da-data" aria-label="dal giorno">
      <span class="mini">→</span>
      <input type="date" id="a-data" aria-label="al giorno">
      <button class="btn sm" id="add-intervallo" type="button">Aggiungi</button>
    </div>
    <div class="hint" id="cal-avvisi"></div>`);
  main.appendChild(cCal);

  // ---------- sconto ----------
  main.appendChild(card('Sconto', `
    <p class="hint" style="margin:0 0 12px">Facoltativi, e utilizzabili anche insieme: la percentuale si calcola sul totale, l'importo fisso si toglie da quello che resta. Nel documento compaiono il totale pieno, gli sconti applicati e il totale da corrispondere.</p>
    <div class="form-row">
      <div class="field"><label>Sconto in percentuale (%)</label>
        <input type="number" min="0" max="100" step="0.5" id="sconto_percentuale" value="${prev.sconto_percentuale ?? ''}" placeholder="0"></div>
      <div class="field"><label>Sconto in valore (€)</label>
        <input type="number" min="0" step="0.5" id="sconto_valore" value="${prev.sconto_valore ?? ''}" placeholder="0,00"></div>
    </div>
    <div class="hint" id="sconto-hint"></div>`));

  // ---------- note ----------
  main.appendChild(card('Note', `<textarea id="note" rows="3" placeholder="Testo libero, compare nel preventivo prima dei saluti…">${esc(prev.note || '')}</textarea>`));

  // ------------------------------------------------------------------
  //  Aggancio dei campi semplici: scrivono direttamente sull'oggetto
  // ------------------------------------------------------------------
  for (const campo of ['cliente', 'cliente_cf', 'cliente_indirizzo', 'referente', 'referente_email',
    'referente_telefono', 'oggetto', 'luogo', 'data_documento', 'stato', 'note']) {
    const input = view.querySelector('#' + campo);
    input.addEventListener('input', () => { prev[campo] = input.value; aggiorna(); });
    input.addEventListener('change', () => { prev[campo] = input.value; aggiorna(); });
  }
  prev.data_documento = prev.data_documento || todayISO();

  // I due sconti sono campi numerici indipendenti: vuoto significa "nessuno
  // sconto di questo tipo", e si salva come null invece che come zero.
  for (const campo of ['sconto_percentuale', 'sconto_valore']) {
    const input = view.querySelector('#' + campo);
    input.addEventListener('input', () => {
      prev[campo] = input.value === '' ? null : Number(input.value) || 0;
      aggiorna();
    });
  }

  function disegnaVoci() {
    const zona = cVoci.querySelector('#voci');
    clear(zona);
    // Alle voci del tariffario si aggiungono quelle usate in questo preventivo
    // che nel frattempo dal tariffario sono state togliate: continuavano a
    // contare nel totale e a comparire nel documento, ma dall'editor erano
    // invisibili — non si potevano né correggere né rimuovere.
    const fuoriTariffario = prev.voci.filter(v => !imp.tariffe.some(t => t.id === v.id));
    for (const t of [...imp.tariffe, ...fuoriTariffario]) {
      const orfana = fuoriTariffario.includes(t);
      const attiva = prev.voci.find(v => v.id === t.id);
      const riga = el(`<div class="voce-row">
        <label class="chk"><input type="checkbox" ${attiva ? 'checked' : ''}> <b>${esc(t.nome)}</b></label>
        <span class="mini">${t.tipo === 'fissa' ? 'prezzo fisso' : 'a ore'}${orfana ? ' · non più in tariffario' : ''}</span>
        <div class="field" style="margin:0;max-width:150px">
          <input type="number" min="0" step="0.5" value="${attiva ? attiva.prezzo : t.prezzo}" ${attiva ? '' : 'disabled'}>
        </div>
        <span class="mini">${t.tipo === 'fissa' ? '€ cad.' : '€/ora'}</span>
      </div>`);
      const [chk, prezzo] = [riga.querySelector('input[type=checkbox]'), riga.querySelector('input[type=number]')];
      chk.addEventListener('change', () => {
        if (chk.checked) prev.voci.push({ ...t, prezzo: Number(prezzo.value) || 0 });
        else prev.voci = prev.voci.filter(v => v.id !== t.id);
        disegnaVoci(); disegnaCalendario(); aggiorna({ dallUtente: false });
      });
      prezzo.addEventListener('input', () => {
        const v = prev.voci.find(x => x.id === t.id);
        if (v) { v.prezzo = Number(prezzo.value) || 0; aggiorna(); }
      });
      zona.appendChild(riga);
    }
    if (!imp.tariffe.length) {
      zona.appendChild(el('<div class="banner warn"><div class="bi">⚠️</div><div>Il tariffario è vuoto: aggiungi le voci in <b>Impostazioni</b>.</div></div>'));
    }
  }

  function disegnaCalendario() {
    const thead = cCal.querySelector('thead');
    const tbody = cCal.querySelector('tbody');
    clear(thead); clear(tbody);
    thead.appendChild(el(`<tr>
      <th style="min-width:140px">Data</th><th>Dalle</th><th>Alle</th><th>Ore</th>
      ${prev.voci.map(v => `<th style="text-align:center">${esc(v.nome)}</th>`).join('')}
      <th>Note</th><th></th>
    </tr>`));

    prev.calendario.forEach((r, i) => {
      const tr = el(`<tr>
        <td><input type="date" value="${esc(r.data || '')}"></td>
        <td><input type="text" class="ora" value="${esc(r.dalle || '')}" style="width:86px" aria-label="dalle"></td>
        <td><input type="text" class="ora" value="${esc(r.alle || '')}" style="width:86px" aria-label="alle"></td>
        <td class="ore money">${fmtOre(oreTurno(r))}</td>
        ${prev.voci.map(v => `<td style="text-align:center"><input type="number" min="0" step="1" style="width:70px" data-voce="${esc(v.id)}" value="${r.qta?.[v.id] ?? ''}"></td>`).join('')}
        <td><input type="text" class="nota" value="${esc(r.note || '')}" placeholder="—"></td>
        <td style="text-align:right"><button class="btn ghost sm" title="Rimuovi turno" aria-label="Rimuovi turno">✕</button></td>
      </tr>`);

      const data = tr.querySelector('input[type=date]');
      data.addEventListener('change', () => {
        r.data = data.value;
        // Riordina solo quando la data è stata scelta: farlo mentre si scrive
        // sposterebbe la riga sotto le dita.
        ordinaCalendario();
        disegnaCalendario();
        aggiorna();
      });

      // Orari col quadrante: si scelgono ora e poi minuti, a passi di dieci.
      const [dalle, alle] = tr.querySelectorAll('input.ora');
      for (const [campo, input] of [['dalle', dalle], ['alle', alle]]) {
        collegaOrologio(input, {
          onCambio: (valore) => {
            r[campo] = valore;
            tr.querySelector('.ore').textContent = fmtOre(oreTurno(r));
            aggiorna();
          },
        });
      }

      tr.querySelectorAll('[data-voce]').forEach(input => {
        input.addEventListener('input', () => {
          r.qta = r.qta || {};
          r.qta[input.dataset.voce] = Number(input.value) || 0;
          aggiorna();
        });
      });
      tr.querySelector('input.nota').addEventListener('input', (e) => { r.note = e.target.value; modificato(); });

      tr.querySelector('button').addEventListener('click', async () => {
        // Conferma solo se nella riga c'è qualcosa da perdere: su un turno
        // appena aggiunto e ancora vuoto sarebbe solo un clic in più.
        const pieno = r.data || r.dalle || r.alle || r.note || Object.values(r.qta || {}).some(q => q);
        if (pieno && !await confirmDialog(
          `Rimuovere il turno${r.data ? ' del ' + r.data.split('-').reverse().join('/') : ''}?`,
          { danger: true, okLabel: 'Rimuovi' })) return;
        prev.calendario.splice(i, 1);
        disegnaCalendario(); aggiorna();
      });
      tbody.appendChild(tr);
    });

    if (!prev.calendario.length) {
      tbody.appendChild(el(`<tr><td colspan="${5 + prev.voci.length}" class="muted" style="text-align:center;padding:22px">
        Nessun turno: aggiungine uno per calcolare il preventivo.</td></tr>`));
    }
  }

  // Il turno nuovo eredita orari e quantità dal precedente: un servizio su
  // più giornate ha quasi sempre la stessa struttura, cambia solo la data.
  function turnoComeUltimo(data = '') {
    const ultimo = prev.calendario[prev.calendario.length - 1];
    return {
      data, dalle: ultimo?.dalle || '', alle: ultimo?.alle || '',
      qta: { ...(ultimo?.qta || {}) }, note: '',
    };
  }

  cCal.querySelector('#add-turno').addEventListener('click', () => {
    prev.calendario.push(turnoComeUltimo());
    disegnaCalendario(); aggiorna();
  });

  // Manifestazioni di più giorni: si scrivono le due date e l'app crea un
  // turno per ogni giornata, con gli stessi orari e le stesse quantità. Prima
  // erano cinque righe da compilare a mano per un servizio di cinque giorni.
  cCal.querySelector('#add-intervallo').addEventListener('click', () => {
    const da = cCal.querySelector('#da-data').value;
    const a = cCal.querySelector('#a-data').value || da;
    if (!da) { toast('Indica almeno il primo giorno', 'err'); return; }
    if (a < da) { toast('Il secondo giorno viene prima del primo', 'err'); return; }
    // Le date si scorrono con sommaGiorniISO (che lavora in UTC su una data
    // già "senza ora"): passando da new Date(...).toISOString() il fuso
    // italiano riportava indietro di un giorno, e chiedendo dal 16 al 18 si
    // ottenevano 15, 16 e 17.
    const giorni = [];
    for (let g = da; g <= a; g = sommaGiorniISO(g, 1)) giorni.push(g);
    if (giorni.length > 60) { toast('Intervallo troppo lungo (oltre 60 giorni)', 'err'); return; }
    const esistenti = new Set(prev.calendario.map(r => r.data));
    let aggiunti = 0;
    for (const g of giorni) {
      if (esistenti.has(g)) continue;   // un giorno già in calendario non si duplica
      prev.calendario.push(turnoComeUltimo(g));
      aggiunti++;
    }
    ordinaCalendario();
    cCal.querySelector('#da-data').value = '';
    cCal.querySelector('#a-data').value = '';
    disegnaCalendario(); aggiorna();
    toast(aggiunti ? `${aggiunti} ${aggiunti === 1 ? 'turno aggiunto' : 'turni aggiunti'}` : 'Quei giorni sono già in calendario',
      aggiunti ? 'ok' : 'warn');
  });

  // Il calendario finisce nel documento consegnato al cliente: le giornate
  // vanno in ordine, anche se un turno dimenticato viene aggiunto dopo. I
  // turni senza data restano in fondo, dove non danno fastidio mentre si
  // compilano.
  function ordinaCalendario() {
    prev.calendario.sort((x, y) => {
      if (!x.data) return 1;
      if (!y.data) return -1;
      return (x.data + (x.dalle || '')).localeCompare(y.data + (y.dalle || ''));
    });
  }

  function aggiorna({ dallUtente = true } = {}) {
    if (dallUtente) modificato();
    const r = calcola(prev);
    prev.totale = r.totale;
    const hint = view.querySelector('#sconto-hint');
    if (hint) {
      hint.textContent = r.sconto > 0
        ? `Sconto totale: ${fmtEuro(r.sconto)} su ${fmtEuro(r.totaleLordo)}` +
          (r.sconti.length > 1 ? ` (${r.sconti.map(s => fmtEuro(s.importo)).join(' + ')})` : '')
        : '';
    }
    // Un turno senza data o di durata zero finirebbe nel documento così com'è:
    // meglio dirlo mentre si compila che scoprirlo dal cliente.
    const avvisi = view.querySelector('#cal-avvisi');
    if (avvisi) {
      const senzaData = r.righe.filter(x => !x.data).length;
      const senzaOre = r.righe.filter(x => x.data && !x.ore).length;
      const pezzi = [];
      if (senzaData) pezzi.push(`${senzaData} ${senzaData === 1 ? 'turno senza data' : 'turni senza data'}`);
      if (senzaOre) pezzi.push(`${senzaOre} ${senzaOre === 1 ? 'turno di durata zero' : 'turni di durata zero'}`);
      avvisi.textContent = pezzi.length ? '⚠️ ' + pezzi.join(' e ') + ': nel preventivo compaiono così.' : '';
      avvisi.classList.toggle('avviso', pezzi.length > 0);
    }

    clear(summary);
    const box = el(`<div class="tot-box">
      <div class="card-b breakdown">
        ${r.riepilogo.length
          ? r.riepilogo.map(v => `<div class="b-row"><span class="lbl">${esc(v.nome)}${v.tipo === 'fissa' ? ` × ${v.quantita}` : ` · ${fmtOre(v.ore)}`}</span><span class="money">${fmtEuro(v.importo)}</span></div>`).join('')
          : `<div class="b-row"><span class="lbl">${prev.voci.length
              ? 'Quantità da indicare nel calendario'
              : 'Nessuna voce selezionata'}</span><span class="money">—</span></div>`}
        ${r.sconto > 0 ? `<div class="b-row strong"><span class="lbl">Totale</span><span class="money">${fmtEuro(r.totaleLordo)}</span></div>
          ${r.sconti.map(s => `<div class="b-row"><span class="lbl">${esc(etichettaSconto(s))}</span><span class="money">− ${fmtEuro(s.importo)}</span></div>`).join('')}` : ''}
      </div>
      <div class="row addebito">
        <div><div class="k">Totale preventivo</div><div class="mini">${r.totale ? 'euro ' + inLettere(r.totale) : 'da compilare'}</div></div>
        <div class="v money">${fmtEuro(r.totale)}</div>
      </div>
    </div>`);
    summary.appendChild(box);
    if (imp.tariffe.some(t => !t.prezzo) && prev.voci.some(v => !v.prezzo)) {
      summary.appendChild(el('<div class="banner warn" style="margin-top:12px"><div class="bi">⚠️</div><div><b>Prezzi a zero</b><div class="small">Alcune voci hanno tariffa 0: impostala qui sopra o nel tariffario.</div></div></div>'));
    }
  }

  disegnaVoci(); disegnaCalendario(); aggiorna();

  // ------------------------------------------------------------------
  //  Azioni
  // ------------------------------------------------------------------
  async function salva() {
    if (!prev.cliente) { toast('Manca il cliente', 'err'); return null; }
    const btn = view.querySelector('#btn-save'); const old = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<span class="spinner sm"></span> Salvo…';
    try {
      const salvato = await preventivi.save({
        id: prev.id, cliente: prev.cliente, cliente_indirizzo: prev.cliente_indirizzo, cliente_cf: prev.cliente_cf,
        referente: prev.referente, referente_email: prev.referente_email, referente_telefono: prev.referente_telefono,
        oggetto: prev.oggetto, luogo: prev.luogo, data_documento: prev.data_documento || null,
        stato: prev.stato || 'bozza', voci: prev.voci, calendario: prev.calendario,
        sconto_percentuale: prev.sconto_percentuale ?? null, sconto_valore: prev.sconto_valore ?? null,
        note: prev.note, totale: prev.totale,
      });
      toast('Preventivo salvato', 'ok');
      sporco = false;
      if (!prev.id) { prev.id = salvato.id; ctx.go(`#/assistenze/preventivo/${salvato.id}`); }
      return salvato;
    } catch (e) {
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

  sorvegliaUscita(view, () => sporco);
}

// ------------------------------------------------------------------
//  MODIFICHE NON SALVATE
//  Prima l'avviso c'era solo su un preventivo mai salvato e solo cliccando
//  "← Elenco": aprire un preventivo esistente, sistemare il calendario e
//  uscire dal menu laterale perdeva tutto in silenzio. Ora si intercetta
//  qualunque link interno e anche la chiusura della scheda.
// ------------------------------------------------------------------
let statoSorveglianza = null;

function sorvegliaUscita(view, cSporco) {
  statoSorveglianza = { view, cSporco };

  if (!sorvegliaUscita._installata) {
    sorvegliaUscita._installata = true;

    // Chiusura o ricaricamento della scheda: il browser mostra il suo avviso
    // (il testo non è personalizzabile, lo decide lui).
    window.addEventListener('beforeunload', (e) => {
      if (attivo() && statoSorveglianza.cSporco()) { e.preventDefault(); e.returnValue = ''; }
    });

    // Qualunque link interno: si ferma la navigazione e si chiede.
    document.addEventListener('click', (e) => {
      if (!attivo() || !statoSorveglianza.cSporco()) return;
      const a = e.target.closest('a[href^="#/"]');
      if (!a) return;
      const destinazione = a.getAttribute('href');
      if (destinazione === location.hash) return;
      e.preventDefault();
      e.stopPropagation();
      confirmDialog('Ci sono modifiche non salvate: uscendo si perdono. Vuoi uscire lo stesso?',
        { danger: true, okLabel: 'Esci senza salvare' })
        .then(ok => { if (ok) { statoSorveglianza = null; location.hash = destinazione; } });
    }, true);
  }
}

// La sorveglianza vale solo per l'editor ancora in pagina: quando il router
// disegna un'altra vista, il vecchio nodo non è più attaccato al documento.
function attivo() {
  return !!statoSorveglianza && statoSorveglianza.view.isConnected;
}

function nuovoPreventivo(imp) {
  return {
    cliente: '', cliente_indirizzo: '', cliente_cf: '',
    referente: '', referente_email: '', referente_telefono: '',
    oggetto: '', luogo: '', data_documento: todayISO(), stato: 'bozza',
    // Si parte con la prima voce a ore del tariffario già attiva: è quella che
    // serve quasi sempre (l'ambulanza), e toglierla è un clic. Prima si
    // cercava l'id 'ambulanza': rifacendo il tariffario da capo non veniva
    // preselezionato più nulla.
    voci: imp.tariffe.filter(t => t.tipo !== 'fissa').slice(0, 1).map(t => ({ ...t })),
    calendario: [], sconto_percentuale: null, sconto_valore: null, note: '',
  };
}

function card(titolo, corpo) {
  return el(`<div class="card" style="margin-bottom:18px">
    <div class="card-h">${esc(titolo)}</div><div class="card-b">${corpo}</div></div>`);
}
