// ============================================================
//  RIEPILOGO MENSILE — la griglia dipendenti × giorni.
//  È la vista che eredita la forma del foglio di carta, perché per capire
//  "come stiamo distribuendo le ore" serve vedere il mese tutto insieme. La
//  differenza è che qui i totali non si sommano a mano, le celle si aprono
//  sul dettaglio, e chi sfora la soglia è evidenziato invece che scoperto a
//  fine anno.
// ============================================================
import { straordinari } from '../data/store.js';
import {
  riepilogoMensile, totaliPerGiorno, giorniDelMese, etichettaMese, totali,
  fmtOre, tipoDi, statoDi,
} from '../calc.js';
import { el, clear, esc, toast, confirmDialog, openModal, selettoreMese, fmtGiorno, fmtOrario, rendiCliccabile } from '../lib/ui.js';
import { exportXLSX, stampaRiepilogo } from '../lib/export.js';

export async function renderRiepilogo(view, ctx) {
  const mese = ctx.stato.mese;
  let righe = await straordinari.listMese(mese);
  const giorni = giorniDelMese(mese);

  const head = el(`<div class="page-head">
    <div>
      <h1>Riepilogo mensile</h1>
      <p>${esc(etichettaMese(mese))} · ore per dipendente, giorno per giorno</p>
    </div>
    <div class="actions">
      <button class="btn" data-xls>⬇️ Excel</button>
      <button class="btn" data-print>🖨️ Stampa griglia</button>
      ${ctx.ruolo === 'admin' ? '<button class="btn primary" data-liquida title="Segna come liquidate tutte le righe confermate del mese">✅ Chiudi il mese</button>' : ''}
    </div>
  </div>`);
  view.appendChild(head);
  view.appendChild(selettoreMese(mese, (m) => { ctx.stato.mese = m; ridisegna(); }));

  const zona = el('<div></div>');
  view.appendChild(zona);

  function ridisegna() {
    clear(view);
    renderRiepilogo(view, ctx).catch(e =>
      view.appendChild(el(`<div class="empty-state"><div class="big">⚠️</div><p>Errore: ${esc(e.message)}</p></div>`)));
  }

  function disegna() {
    clear(zona);
    const t = totali(righe);
    const riepilogo = riepilogoMensile(righe, ctx.dipendenti, mese);
    const perGiorno = totaliPerGiorno(riepilogo, mese);
    const conOre = riepilogo.filter(r => r.righe > 0);

    if (t.daConfermare) {
      zona.appendChild(el(`<div class="banner warn"><div class="bi">⏳</div><div>
        <b>${t.daConfermare} righe ancora da confermare</b>
        <div class="small">Sono già conteggiate qui sotto, ma non sono state verificate: prima di mandare
        il riepilogo all'ufficio personale, <a href="#/straordinari/registro">controllale nel registro</a>.</div>
      </div>`));
    }

    const stats = el(`<div class="grid stats" style="margin:18px 0 20px">
      <div class="stat"><div class="k">Ore richieste</div><div class="v">${esc(fmtOre(t.positive))}</div>
        <div class="s">a ${conOre.length} dipendenti su ${riepilogo.length}</div></div>
      <div class="stat"><div class="k">Recuperi</div><div class="v">${esc(fmtOre(t.recuperi))}</div>
        <div class="s">ore restituite</div></div>
      <div class="stat accent"><div class="k">Saldo del mese</div><div class="v">${esc(fmtOre(t.saldo, { segno: true }))}</div>
        <div class="s">da riconoscere ai dipendenti</div></div>
      <div class="stat"><div class="k">Media per dipendente</div>
        <div class="v">${esc(fmtOre(conOre.length ? t.saldo / conOre.length : 0))}</div>
        <div class="s">fra chi ha fatto ore</div></div>
    </div>`);
    zona.appendChild(stats);

    if (!riepilogo.length) {
      zona.appendChild(el(`<div class="empty-state"><div class="big">👤</div>
        <p><b>Nessun dipendente in anagrafica</b></p>
        <p>Il riepilogo mostra una riga per dipendente: <a href="#/straordinari/dipendenti">compila prima l'elenco</a>.</p></div>`));
      return;
    }

    // ---------- la griglia ----------
    const intestazione = giorni.map(g =>
      `<th class="${g.festivo ? 'fest' : ''}" title="${esc(fmtGiorno(g.iso))}">
        <span class="dow">${['do', 'lu', 'ma', 'me', 'gi', 've', 'sa'][g.dow]}</span>${g.numero}</th>`).join('');

    const tabella = el(`<div class="card"><div class="tbl-wrap"><table class="str-griglia">
      <thead><tr><th class="nome">Dipendente</th>${intestazione}
        <th class="tot">Str.</th><th class="tot">Rec.</th><th class="tot saldo">Saldo</th></tr></thead>
      <tbody></tbody>
      <tfoot><tr><th class="nome">Totale giornata</th>
        ${giorni.map(g => `<td class="${g.festivo ? 'fest' : ''} tot">${perGiorno[g.iso] ? numero(perGiorno[g.iso]) : ''}</td>`).join('')}
        <td class="tot">${numero(t.positive)}</td><td class="tot">${numero(t.recuperi)}</td>
        <td class="tot saldo">${numero(t.saldo)}</td></tr></tfoot>
    </table></div></div>`);
    const tbody = tabella.querySelector('tbody');

    for (const r of riepilogo) {
      const sopra = r.saldo > ctx.imp.sogliaMensile;
      const tr = el(`<tr class="${r.righe ? '' : 'str-vuota'}">
        <th class="nome" title="${esc(r.nome)}">${esc(r.nome)}${r.oreContratto ? ` <span class="oc">${numero(r.oreContratto)}h</span>` : ''}</th>
        ${giorni.map(g => cellaGiorno(r, g)).join('')}
        <td class="tot">${r.positive ? numero(r.positive) : ''}</td>
        <td class="tot">${r.recuperi ? numero(r.recuperi) : ''}</td>
        <td class="tot saldo ${sopra ? 'sopra' : ''}" ${sopra ? `title="Oltre la soglia di ${ctx.imp.sogliaMensile} ore al mese"` : ''}>${r.righe ? numero(r.saldo) : ''}</td>
      </tr>`);
      // Ogni cella piena apre il dettaglio della giornata: è la domanda che
      // il foglio di carta lasciava sempre senza risposta ("questo 3,5 di
      // martedì da dove viene?").
      tr.querySelectorAll('[data-giorno]').forEach(td => {
        rendiCliccabile(td, () => dettaglioGiorno(r, td.dataset.giorno));
      });
      tbody.appendChild(tr);
    }
    zona.appendChild(tabella);

    zona.appendChild(el(`<p class="muted small" style="margin-top:12px">
      Le ore sono il saldo della giornata: i recuperi sono in rosso, con il segno meno.
      I dipendenti senza ore restano in elenco apposta — vedere gli zeri è il modo per accorgersi
      di chi si sta caricando di straordinari e chi no.</p>`));

    head.querySelector('[data-xls]').onclick = () => exportXLSX(righe, mese);
    head.querySelector('[data-print]').onclick = () => stampaRiepilogo(riepilogo, perGiorno, mese, { righe });
    const btnLiquida = head.querySelector('[data-liquida]');
    if (btnLiquida) {
      const confermate = righe.filter(r => r.stato === 'confermato').length;
      btnLiquida.disabled = confermate === 0;
      btnLiquida.title = confermate
        ? `Segna come liquidate le ${confermate} righe confermate di ${etichettaMese(mese)}`
        : 'Nessuna riga confermata da liquidare in questo mese';
      btnLiquida.onclick = async () => {
        if (!await confirmDialog(
          `Segnare come liquidate le ${confermate} righe confermate di ${etichettaMese(mese)}? ` +
          `Le righe ancora da confermare non vengono toccate.`, { okLabel: 'Chiudi il mese' })) return;
        let n;
        try { n = await straordinari.liquidaMese(mese); }
        catch (e) { toast('Operazione non riuscita: ' + e.message, 'err'); return; }
        righe = await straordinari.listMese(mese);
        toast(`${n} righe segnate come liquidate`, 'ok');
        disegna();
      };
    }
  }

  function cellaGiorno(r, g) {
    const cella = r.giorni[g.iso];
    const ore = cella ? cella.ore : 0;
    const classi = [g.festivo ? 'fest' : '', ore > 0 ? 'pos' : '', ore < 0 ? 'neg' : ''].filter(Boolean).join(' ');
    if (!cella) return `<td class="${classi}"></td>`;
    const daConfermare = cella.dettagli.some(x => x.stato === 'richiesto');
    return `<td class="${classi} piena ${daConfermare ? 'dubbia' : ''}" data-giorno="${g.iso}"
      title="${esc(cella.dettagli.map(x => `${tipoDi(x.tipo).label} ${fmtOre(x.ore)} — ${statoDi(x.stato).label}`).join(' · '))}">${numero(ore)}</td>`;
  }

  function dettaglioGiorno(r, data) {
    const cella = r.giorni[data];
    if (!cella) return;
    const body = el(`<div>
      <table class="tbl"><thead><tr><th>Orario</th><th class="money">Ore</th><th>Tipo</th><th>Causale</th><th>Stato</th></tr></thead>
      <tbody>${cella.dettagli.map(x => `<tr>
        <td>${esc(fmtOrario(x.dalle, x.alle))}</td>
        <td class="money">${esc(fmtOre(x.ore))}</td>
        <td>${esc(tipoDi(x.tipo).label)}</td>
        <td>${esc(x.causale || '—')}${x.servizio ? `<div class="small muted">${esc(x.servizio)}</div>` : ''}</td>
        <td>${esc(statoDi(x.stato).label)}</td></tr>
        ${x.note ? `<tr><td colspan="5" class="small muted">${esc(x.note)}</td></tr>` : ''}`).join('')}</tbody></table>
      <p class="muted small" style="margin:12px 0 0">Richiesto da: ${esc([...new Set(cella.dettagli.map(x => x.richiesto_da_nome).filter(Boolean))].join(', ') || '—')}</p>
    </div>`);
    const foot = el(`<div style="display:flex;gap:10px;justify-content:flex-end">
      <button class="btn" data-apri>Apri nel registro</button></div>`);
    const { close } = openModal({ title: `${r.nome} — ${fmtGiorno(data)}`, body, footer: foot, wide: true });
    foot.querySelector('[data-apri]').addEventListener('click', () => {
      close();
      // Una riga sola si apre direttamente; più righe nello stesso giorno
      // si guardano meglio nel registro.
      if (cella.dettagli.length === 1) ctx.go(`#/straordinari/richiesta/${cella.dettagli[0].id}`);
      else ctx.go('#/straordinari/registro');
    });
  }

  disegna();
}

function numero(n) {
  const v = Number(n) || 0;
  if (!v) return '0';
  return (v < 0 ? '−' : '') + Math.abs(v).toLocaleString('it-IT', { maximumFractionDigits: 2 });
}
