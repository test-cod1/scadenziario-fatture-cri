// ============================================================
//  REGISTRO DEGLI STRAORDINARI — la pagina in cui si vive.
//  Un mese alla volta, una riga per straordinario, con i quattro numeri che
//  contano in testa e i filtri sotto. È il rovescio del foglio di carta: lì
//  si vedeva la griglia e si cercava a occhio la riga "EXTRA", qui si vedono
//  le richieste (chi, quando, perché, a che punto è) e la griglia è una
//  pagina a parte, per chi deve guardarla d'insieme.
// ============================================================
import { straordinari } from '../data/store.js';
import { TIPI, totali, fmtOre, oreConSegno, tipoDi, etichettaMese, nominativo } from '../calc.js';
import { el, clear, esc, toast, confirmDialog, selettoreMese, etichettaTipo, fmtGiorno, fmtOrario } from '../lib/ui.js';
import { exportXLSX, stampaElenco } from '../lib/export.js';

export async function renderRegistro(view, ctx) {
  const mese = ctx.stato.mese;
  let righe = await straordinari.listMese(mese);

  const head = el(`<div class="page-head">
    <div>
      <h1>Registro straordinari</h1>
      <p>${esc(etichettaMese(mese))} · ore richieste ai dipendenti dalla centrale operativa</p>
    </div>
    <div class="actions">
      <button class="btn" data-xls title="Scarica le righe filtrate in Excel">⬇️ Excel</button>
      <button class="btn" data-print title="Stampa l'elenco filtrato">🖨️ Stampa</button>
      <a class="btn primary" href="#/straordinari/nuovo">➕ Nuova richiesta</a>
    </div>
  </div>`);
  view.appendChild(head);

  view.appendChild(selettoreMese(mese, (m) => { ctx.stato.mese = m; ridisegnaPagina(); }));

  const stats = el('<div class="grid stats" style="margin:18px 0 20px"></div>');
  view.appendChild(stats);

  // Filtri: dipendente, tipo e ricerca libera su causale, servizio e note.
  const toolbar = el(`<div class="toolbar">
    <div class="search"><span class="search-icon" aria-hidden="true">🔍</span>
      <input type="text" id="q" placeholder="Cerca per dipendente, causale, servizio o note…"></div>
    <select id="f-dipendente" aria-label="Filtra per dipendente"><option value="">Tutti i dipendenti</option></select>
    <select id="f-tipo" aria-label="Filtra per tipo"><option value="">Tutti i tipi</option>
      ${TIPI.map(t => `<option value="${t.id}">${t.emoji} ${esc(t.label)}</option>`).join('')}</select>
    <button class="btn ghost sm" data-azzera hidden>Azzera filtri</button>
  </div>`);
  view.appendChild(toolbar);

  const selDipendente = toolbar.querySelector('#f-dipendente');
  // Nell'elenco ci sono i dipendenti attivi più chiunque abbia righe in questo
  // mese: un dipendente disattivato a metà mese deve restare filtrabile, o le
  // sue ore diventerebbero irraggiungibili proprio nel mese da liquidare.
  const idsInMese = new Set(righe.map(r => r.dipendente_id));
  for (const a of ctx.dipendenti) {
    if (!a.attivo && !idsInMese.has(a.id)) continue;
    selDipendente.appendChild(el(`<option value="${esc(a.id)}">${esc(nominativo(a))}${a.attivo ? '' : ' (non attivo)'}</option>`));
  }

  const card = el(`<div class="card"><div class="tbl-wrap"><table class="tbl str-tbl">
    <thead><tr>
      <th>Data</th><th>Dipendente</th><th>Orario</th><th class="money">Ore</th>
      <th>Tipo</th><th>Causale</th><th></th>
    </tr></thead><tbody></tbody>
    <tfoot><tr><td colspan="7"></td></tr></tfoot>
  </table></div></div>`);
  view.appendChild(card);
  const tbody = card.querySelector('tbody');
  const tfootCella = card.querySelector('tfoot td');

  const vuoto = el(`<div class="empty-state" hidden><div class="big">🕒</div>
    <p><b>Nessuno straordinario in ${esc(etichettaMese(mese))}</b></p>
    <p>Quando la centrale chiede ore in più a un dipendente, registrale qui:<br>
    a fine mese il riepilogo e il file per l'ufficio personale escono da soli.</p>
    <p style="margin-top:18px"><a class="btn primary" href="#/straordinari/nuovo">➕ Registra il primo straordinario</a></p></div>`);
  view.appendChild(vuoto);

  const senzaDipendenti = el(`<div class="banner warn" hidden><div class="bi">👤</div><div>
    <b>Nessun dipendente in anagrafica</b>
    <div class="small">Prima di registrare straordinari serve l'elenco dei dipendenti, con le ore
    settimanali di contratto: <a href="#/straordinari/dipendenti">aprilo e compilalo</a>.</div>
  </div>`);
  view.insertBefore(senzaDipendenti, stats);

  function filtrate() {
    const q = toolbar.querySelector('#q').value.toLowerCase().trim();
    const fa = selDipendente.value, ft = toolbar.querySelector('#f-tipo').value;
    return righe.filter(r => {
      if (fa && r.dipendente_id !== fa) return false;
      if (ft && r.tipo !== ft) return false;
      if (!q) return true;
      return [r.dipendente_nome, r.causale, r.servizio, r.note]
        .filter(Boolean).join(' ').toLowerCase().includes(q);
    });
  }

  function disegnaStats(elenco) {
    const t = totali(elenco);
    clear(stats);
    const sopraSoglia = elenco.length ? dipendentiSopraSoglia(elenco, ctx.imp.sogliaMensile) : [];
    stats.append(
      el(`<div class="stat"><div class="k">Ore richieste</div><div class="v">${esc(fmtOre(t.positive))}</div>
        <div class="s">straordinari e cambi turno</div></div>`),
      el(`<div class="stat"><div class="k">Recuperi</div><div class="v">${esc(fmtOre(t.recuperi))}</div>
        <div class="s">ore restituite ai dipendenti</div></div>`),
      el(`<div class="stat accent"><div class="k">Saldo del mese</div><div class="v">${esc(fmtOre(t.saldo, { segno: true }))}</div>
        <div class="s">${t.righe} righe${sopraSoglia.length ? ` · ${sopraSoglia.length} sopra la soglia` : ''}</div></div>`),
    );
  }

  function disegna() {
    const elenco = filtrate();
    disegnaStats(elenco);
    senzaDipendenti.hidden = ctx.dipendenti.some(a => a.attivo);
    const nessunFiltro = !toolbar.querySelector('#q').value && !selDipendente.value
      && !toolbar.querySelector('#f-tipo').value;
    toolbar.querySelector('[data-azzera]').hidden = nessunFiltro;
    // Con il mese davvero vuoto si mostra l'invito; con un filtro che non
    // trova nulla restano i filtri (altrimenti non si potrebbe allentarli).
    vuoto.hidden = righe.length > 0;
    toolbar.hidden = card.hidden = righe.length === 0;
    head.querySelector('[data-xls]').disabled = head.querySelector('[data-print]').disabled = elenco.length === 0;
    if (!righe.length) return;

    clear(tbody);
    if (!elenco.length) {
      tbody.appendChild(el(`<tr><td colspan="7" class="muted" style="text-align:center;padding:26px">Nessuna riga con questi filtri</td></tr>`));
      tfootCella.textContent = '';
      return;
    }

    let giornoPrecedente = null;
    for (const r of elenco) {
      // Separatore di giornata: in un mese fitto le righe dello stesso giorno
      // vanno lette insieme (è la giornata in cui è mancato qualcuno).
      if (r.data !== giornoPrecedente) {
        giornoPrecedente = r.data;
        const oreGiorno = elenco.filter(x => x.data === r.data).reduce((s, x) => s + oreConSegno(x), 0);
        tbody.appendChild(el(`<tr class="str-giorno"><td colspan="7">
          <b>${esc(fmtGiorno(r.data))}</b> <span class="muted">· ${esc(fmtOre(oreGiorno, { segno: true }))}</span></td></tr>`));
      }
      tbody.appendChild(rigaTabella(r));
    }

    const t = totali(elenco);
    tfootCella.innerHTML = `<b>${elenco.length} righe</b> · straordinari ${esc(fmtOre(t.positive))} ·
      recuperi ${esc(fmtOre(t.recuperi))} · <b>saldo ${esc(fmtOre(t.saldo, { segno: true }))}</b>`;
  }

  function rigaTabella(r) {
    const t = tipoDi(r.tipo);
    const ore = oreConSegno(r);
    const tr = el(`<tr>
      <td>${esc(fmtGiorno(r.data))}</td>
      <td><b>${esc(r.dipendente_nome)}</b></td>
      <td class="muted">${esc(fmtOrario(r.dalle, r.alle))}</td>
      <td class="money ${ore < 0 ? 'str-neg' : ''}">${esc(fmtOre(ore, { segno: true }))}</td>
      <td>${esc(etichettaTipo(r.tipo))}</td>
      <td>${esc(r.causale || '—')}${r.servizio ? `<div class="small muted">${esc(r.servizio)}</div>` : ''}</td>
      <td style="white-space:nowrap;text-align:right">
        <button class="btn ghost sm" data-del title="Elimina">🗑️</button>
      </td>
    </tr>`);

    // Riga cliccabile = apre l'editor.
    tr.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      ctx.go(`#/straordinari/richiesta/${r.id}`);
    });

    tr.querySelector('[data-del]').addEventListener('click', async () => {
      if (!await confirmDialog(
        `Eliminare definitivamente lo straordinario di ${r.dipendente_nome} del ${fmtGiorno(r.data)}? Le ore spariscono dai totali del mese.`,
        { danger: true, okLabel: 'Elimina' })) return;
      try { await straordinari.remove(r.id); }
      catch (e) { toast('Eliminazione non riuscita: ' + e.message, 'err'); return; }
      righe = righe.filter(x => x.id !== r.id);
      toast('Riga eliminata', 'ok');
      disegna();
    });

    return tr;
  }


  // Cambiare mese non cambia l'indirizzo (il mese vive in sezione.js, ed è
  // condiviso con il riepilogo): la pagina si ricarica da sola richiamando la
  // vista sullo stesso contenitore, senza passare dal router.
  function ridisegnaPagina() {
    clear(view);
    renderRegistro(view, ctx).catch(e => {
      view.appendChild(el(`<div class="empty-state"><div class="big">⚠️</div><p>Errore: ${esc(e.message)}</p></div>`));
    });
  }

  toolbar.querySelector('#q').addEventListener('input', disegna);
  toolbar.querySelectorAll('select').forEach(s => s.addEventListener('change', disegna));
  toolbar.querySelector('[data-azzera]').addEventListener('click', () => {
    toolbar.querySelector('#q').value = '';
    toolbar.querySelectorAll('select').forEach(s => { s.value = ''; });
    disegna();
  });
  head.querySelector('[data-xls]').addEventListener('click', () => exportXLSX(filtrate(), mese));
  head.querySelector('[data-print]').addEventListener('click', () => stampaElenco(filtrate(), mese, descrizioneFiltri(toolbar, selDipendente)));

  disegna();
}

// Quali dipendenti hanno superato la soglia mensile: serve solo al conteggio in
// testata, il dettaglio sta nel riepilogo.
function dipendentiSopraSoglia(elenco, soglia) {
  const per = new Map();
  for (const r of elenco) per.set(r.dipendente_id, (per.get(r.dipendente_id) || 0) + oreConSegno(r));
  return [...per.entries()].filter(([, ore]) => ore > soglia);
}

// Riga di sottotitolo della stampa: senza, un elenco filtrato per un solo
// dipendente stampato sembrerebbe il registro intero del mese.
function descrizioneFiltri(toolbar, selDipendente) {
  const parti = [];
  const q = toolbar.querySelector('#q').value.trim();
  if (selDipendente.value) parti.push(selDipendente.selectedOptions[0].textContent);
  const tipo = toolbar.querySelector('#f-tipo');
  if (tipo.value) parti.push(tipoDi(tipo.value).label);
  if (q) parti.push(`ricerca "${q}"`);
  return parti.join(' · ');
}
