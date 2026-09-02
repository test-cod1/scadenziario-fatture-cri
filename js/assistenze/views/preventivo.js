import { preventivi } from '../data/store.js';
import { calcola, inLettere, oreTurno } from '../calc.js';
import { fmtOre } from '../lib/documento.js';
import { el, clear, esc, toast, confirmDialog, fmtEuro, todayISO } from '../../lib/ui.js';

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
      <button class="btn" id="btn-word">📄 Word</button>
      <button class="btn" id="btn-pdf">🖨️ Stampa / PDF</button>
      <button class="btn primary" id="btn-save">💾 Salva</button>
    </div>
  </div>`);
  view.appendChild(head);

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
    <button class="btn sm" id="add-turno" type="button" style="margin-top:12px">➕ Aggiungi turno</button>`);
  main.appendChild(cCal);

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

  function disegnaVoci() {
    const zona = cVoci.querySelector('#voci');
    clear(zona);
    for (const t of imp.tariffe) {
      const attiva = prev.voci.find(v => v.id === t.id);
      const riga = el(`<div class="voce-row">
        <label class="chk"><input type="checkbox" ${attiva ? 'checked' : ''}> <b>${esc(t.nome)}</b></label>
        <span class="mini">${t.tipo === 'fissa' ? 'prezzo fisso' : 'a ore'}</span>
        <div class="field" style="margin:0;max-width:150px">
          <input type="number" min="0" step="0.5" value="${attiva ? attiva.prezzo : t.prezzo}" ${attiva ? '' : 'disabled'}>
        </div>
        <span class="mini">${t.tipo === 'fissa' ? '€ cad.' : '€/ora'}</span>
      </div>`);
      const [chk, prezzo] = [riga.querySelector('input[type=checkbox]'), riga.querySelector('input[type=number]')];
      chk.addEventListener('change', () => {
        if (chk.checked) prev.voci.push({ ...t, prezzo: Number(prezzo.value) || 0 });
        else prev.voci = prev.voci.filter(v => v.id !== t.id);
        disegnaVoci(); disegnaCalendario(); aggiorna();
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
        <td><input type="time" value="${esc(r.dalle || '')}" style="width:110px"></td>
        <td><input type="time" value="${esc(r.alle || '')}" style="width:110px"></td>
        <td class="ore money">${fmtOre(oreTurno(r))}</td>
        ${prev.voci.map(v => `<td style="text-align:center"><input type="number" min="0" step="1" style="width:70px" data-voce="${esc(v.id)}" value="${r.qta?.[v.id] ?? ''}"></td>`).join('')}
        <td><input type="text" value="${esc(r.note || '')}" placeholder="—"></td>
        <td style="text-align:right"><button class="btn ghost sm" title="Rimuovi turno">✕</button></td>
      </tr>`);
      const [data, dalle, alle] = tr.querySelectorAll('input[type=date],input[type=time]');
      data.addEventListener('change', () => { r.data = data.value; aggiorna(); });
      for (const [campo, input] of [['dalle', dalle], ['alle', alle]]) {
        input.addEventListener('change', () => {
          r[campo] = input.value;
          tr.querySelector('.ore').textContent = fmtOre(oreTurno(r));
          aggiorna();
        });
      }
      tr.querySelectorAll('[data-voce]').forEach(input => {
        input.addEventListener('input', () => {
          r.qta = r.qta || {};
          r.qta[input.dataset.voce] = Number(input.value) || 0;
          aggiorna();
        });
      });
      tr.querySelector('input[type=text]').addEventListener('input', (e) => { r.note = e.target.value; });
      tr.querySelector('button').addEventListener('click', () => {
        prev.calendario.splice(i, 1); disegnaCalendario(); aggiorna();
      });
      tbody.appendChild(tr);
    });

    if (!prev.calendario.length) {
      tbody.appendChild(el(`<tr><td colspan="${5 + prev.voci.length}" class="muted" style="text-align:center;padding:22px">
        Nessun turno: aggiungine uno per calcolare il preventivo.</td></tr>`));
    }
  }

  cCal.querySelector('#add-turno').addEventListener('click', () => {
    const ultimo = prev.calendario[prev.calendario.length - 1];
    // Il turno nuovo eredita orari e quantità dal precedente: un servizio su
    // più giornate ha quasi sempre la stessa struttura, cambia solo la data.
    prev.calendario.push({
      data: '', dalle: ultimo?.dalle || '', alle: ultimo?.alle || '',
      qta: { ...(ultimo?.qta || {}) }, note: '',
    });
    disegnaCalendario(); aggiorna();
  });

  function aggiorna() {
    const r = calcola(prev);
    prev.totale = r.totale;
    clear(summary);
    const box = el(`<div class="tot-box">
      <div class="card-b breakdown">
        ${r.riepilogo.length
          ? r.riepilogo.map(v => `<div class="b-row"><span class="lbl">${esc(v.nome)}${v.tipo === 'fissa' ? ` × ${v.quantita}` : ` · ${fmtOre(v.ore)}`}</span><span class="money">${fmtEuro(v.importo)}</span></div>`).join('')
          : '<div class="b-row"><span class="lbl">Nessuna voce attiva</span><span class="money">—</span></div>'}
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
        note: prev.note, totale: prev.totale,
      });
      toast('Preventivo salvato', 'ok');
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

  // Uscire da un preventivo mai salvato è il modo più facile di perdere
  // mezz'ora di lavoro: si avvisa, ma solo se c'è davvero qualcosa da perdere.
  const elenco = view.querySelector('a[href="#/assistenze/preventivi"]');
  elenco.addEventListener('click', async (e) => {
    if (prev.id || (!prev.cliente && !prev.calendario.length)) return;
    e.preventDefault();
    if (await confirmDialog('Il preventivo non è ancora stato salvato: uscendo si perde. Vuoi uscire lo stesso?',
      { danger: true, okLabel: 'Esci senza salvare' })) ctx.go('#/assistenze/preventivi');
  });
}

function nuovoPreventivo(imp) {
  return {
    cliente: '', cliente_indirizzo: '', cliente_cf: '',
    referente: '', referente_email: '', referente_telefono: '',
    oggetto: '', luogo: '', data_documento: todayISO(), stato: 'bozza',
    // Si parte con le voci a ore del tariffario già attive: sono quelle che
    // servono quasi sempre, e toglierle è un clic.
    voci: imp.tariffe.filter(t => t.tipo !== 'fissa' && t.id === 'ambulanza').map(t => ({ ...t })),
    calendario: [], note: '',
  };
}

function card(titolo, corpo) {
  return el(`<div class="card" style="margin-bottom:18px">
    <div class="card-h">${esc(titolo)}</div><div class="card-b">${corpo}</div></div>`);
}
