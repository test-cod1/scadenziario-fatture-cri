import { corsi as storeCorsi, preventivi as storePreventivi } from '../data/store.js';
import { nomeBreve } from '../calc.js';
import { statistiche, anniDisponibili, discentiEffettivi, idonei } from '../corsi.js';
import { el, clear, esc, fmtEuro, todayISO } from '../../lib/ui.js';
import { buildXlsxBlob } from '../../lib/xlsx.js';
import { avvisoTabella } from './corsi.js';

// ============================================================
//  STATISTICHE DELLA FORMAZIONE ESTERNA
//  Quanto si è formato, per anno: corsi svolti, persone formate, ore,
//  ricavi, con il confronto sull'anno prima. Poi da dove arriva — quali
//  corsi, quali committenti, quali docenti — e come vanno i preventivi.
//
//  Si conta solo quello che è registrato come SVOLTO nel registro dei
//  corsi: un corso tenuto ma lasciato "programmato" qui non c'è, e la
//  pagina lo dice in testa invece di mostrare numeri più bassi in silenzio.
// ============================================================

const MESI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
const num = (n, d = 0) => Number(n || 0).toLocaleString('it-IT', { maximumFractionDigits: d });
const perc = (x) => x === null || x === undefined ? '—' : `${Math.round(x * 100)}%`;

export async function renderStatistiche(view, ctx) {
  let corsi, preventivi;
  try {
    [corsi, preventivi] = await Promise.all([storeCorsi.list(), storePreventivi.list()]);
  } catch (e) {
    view.appendChild(avvisoTabella(e));
    return;
  }
  const oggi = todayISO();
  const annoCorrente = Number(oggi.slice(0, 4));
  const anni = anniDisponibili(corsi, preventivi);
  if (!anni.includes(annoCorrente)) anni.unshift(annoCorrente);

  const head = el(`<div class="page-head">
    <div><h1>Statistiche</h1><p>I corsi svolti, le persone formate e l'andamento dei preventivi</p></div>
    <div class="inline">
      <select id="anno" aria-label="Anno">
        ${anni.map(a => `<option value="${a}" ${a === annoCorrente ? 'selected' : ''}>${a}</option>`).join('')}
        <option value="">Tutti gli anni</option>
      </select>
      <button class="btn" id="esporta">📊 Excel</button>
    </div>
  </div>`);
  view.appendChild(head);
  const selAnno = head.querySelector('#anno');
  const corpo = el('<div></div>');
  view.appendChild(corpo);

  function draw() {
    const anno = selAnno.value ? Number(selAnno.value) : null;
    const s = statistiche(corsi, preventivi, { anno, oggi });
    clear(corpo);

    // ---- avvisi: quello che manca ai numeri ----
    const daRegistrare = corsi.filter(c => c.stato === 'programmato' && c.data_inizio &&
      (c.data_fine || c.data_inizio) < oggi && (anno === null || c.data_inizio.startsWith(String(anno)))).length;
    if (daRegistrare || s.senzaData) {
      corpo.appendChild(el(`<div class="banner warn"><div class="bi">⚠️</div><div>
        <b>Qualche corso non è contato</b>
        <div class="small">${[
          daRegistrare ? `${daRegistrare} ${daRegistrare === 1 ? 'corso è già passato ma è ancora segnato' : 'corsi sono già passati ma sono ancora segnati'} come programmato: <a href="#/formazione/corsi">registralo come svolto</a> per farlo entrare qui.` : '',
          s.senzaData ? `${s.senzaData} ${s.senzaData === 1 ? 'corso svolto non ha' : 'corsi svolti non hanno'} la data, e non ${s.senzaData === 1 ? 'appartiene' : 'appartengono'} a nessun anno: compare solo in «Tutti gli anni».` : '',
        ].filter(Boolean).join(' ')}</div></div></div>`));
    }

    // ---- i numeri principali ----
    const confronto = (attuale, prima, euro = false) => {
      if (!s.precedente || !prima) return anno !== null ? `<span class="muted">nessun dato nel ${anno - 1}</span>` : '';
      const d = (attuale - prima) / prima;
      const segno = d >= 0 ? '▲' : '▼';
      return `<span class="${d >= 0 ? 'pos' : 'neg'}">${segno} ${Math.abs(Math.round(d * 100))}%</span> sul ${anno - 1} (${euro ? fmtEuro(prima) : num(prima)})`;
    };
    const p = s.precedente;
    corpo.appendChild(el(`<div class="grid stats" style="margin-bottom:22px">
      <div class="stat accent"><div class="k">Corsi svolti</div><div class="v">${num(s.edizioni)}</div>
        <div class="s">${confronto(s.edizioni, p?.edizioni)}</div></div>
      <div class="stat ok"><div class="k">Persone formate</div><div class="v">${num(s.discenti)}</div>
        <div class="s">${confronto(s.discenti, p?.discenti)}</div></div>
      <div class="stat"><div class="k">Ore di formazione</div><div class="v">${num(s.oreUomo, 1)}</div>
        <div class="s">ore × persone · ${num(s.ore, 1)} ore d'aula</div></div>
      <div class="stat"><div class="k">Ricavi dai corsi</div><div class="v">${fmtEuro(s.ricavi)}</div>
        <div class="s">${confronto(s.ricavi, p?.ricavi, true) || 'IVA esclusa'}</div></div>
      <div class="stat"><div class="k">Idonei</div><div class="v">${s.presentiConEsito ? perc(s.idonei / s.presentiConEsito) : '—'}</div>
        <div class="s">${s.presentiConEsito ? `${num(s.idonei)} su ${num(s.presentiConEsito)} con esito registrato` : 'nessun elenco nominativo'}</div></div>
    </div>`));

    if (!s.edizioni) {
      corpo.appendChild(el(`<div class="empty-state"><div class="big">📊</div>
        <p>Nessun corso svolto ${anno !== null ? `nel ${anno}` : 'registrato'}.<br>
        I corsi entrano qui quando nel <a href="#/formazione/corsi">registro</a> sono segnati come «Svolto».</p></div>`));
    }

    // ---- andamento mensile ----
    if (anno !== null && s.edizioni) {
      corpo.appendChild(riquadro('Mese per mese', `<p class="hint" style="margin:0 0 10px">Persone formate per mese di inizio del corso. Passa sopra una colonna per vedere quanti corsi sono.</p>${graficoMesi(s.perMese)}`));
    }

    if (s.edizioni) {
      const colonne = el('<div class="st-colonne"></div>');
      // ---- per tipo di corso ----
      const maxCorso = Math.max(1, ...s.perCorso.map(x => x.discenti));
      colonne.appendChild(riquadro('Per tipo di corso', tabella(
        ['Corso', 'Persone', 'Corsi', 'Ore', 'Ricavi'],
        s.perCorso.map(x => [
          `<b>${esc(nomeBreve(x.nome))}</b>${barra(x.discenti / maxCorso)}`,
          num(x.discenti), num(x.edizioni), num(x.ore, 1), fmtEuro(x.ricavi),
        ]), [false, true, true, true, true])));

      // ---- committenti ----
      const top = s.perCliente.slice(0, 10);
      const altri = s.perCliente.length - top.length;
      colonne.appendChild(riquadro(`Committenti${s.committenti ? ` (${s.committenti})` : ''}`, tabella(
        ['Committente', 'Persone', 'Corsi', 'Ricavi', '% ricavi'],
        top.map(x => [esc(x.nome), num(x.discenti), num(x.edizioni), fmtEuro(x.ricavi), s.ricavi ? perc(x.ricavi / s.ricavi) : '—']),
        [false, true, true, true, true]) +
        (altri > 0 ? `<p class="mini" style="margin:8px 0 0">e altri ${altri}.</p>` : '') +
        (s.edizioni > s.perCliente.reduce((t, x) => t + x.edizioni, 0)
          ? '<p class="mini" style="margin:6px 0 0">I corsi senza committente (aperti a privati) non compaiono in questo elenco.</p>' : '')));

      // ---- docenti ----
      colonne.appendChild(riquadro('Docenti', s.perDocente.length
        ? tabella(['Docente', 'Ore d\'aula', 'Corsi', 'Persone'],
          s.perDocente.map(x => [esc(x.nome), num(x.ore, 1), num(x.edizioni), num(x.discenti)]), [false, true, true, true])
        : '<p class="muted" style="margin:0">Nessun docente indicato nei corsi svolti: si scrivono nella scheda del corso.</p>'));

      // ---- dove ----
      const tot = s.sedi.nostra + s.sedi.cliente;
      colonne.appendChild(riquadro('Dove', `
        <div class="fat-fascia"><span class="fat-fascia-e">Sede CRI</span>${barra(s.sedi.nostra / tot, true)}<b>${num(s.sedi.nostra)}</b><span class="fat-fascia-n">${perc(s.sedi.nostra / tot)}</span></div>
        <div class="fat-fascia"><span class="fat-fascia-e">Dal committente</span>${barra(s.sedi.cliente / tot, true)}<b>${num(s.sedi.cliente)}</b><span class="fat-fascia-n">${perc(s.sedi.cliente / tot)}</span></div>`));
      corpo.appendChild(colonne);
    }

    // ---- preventivi ----
    const pr = s.preventivi;
    corpo.appendChild(riquadro(`Preventivi${anno !== null ? ` del ${anno}` : ''}`, `
      <div class="fat-conc">
        <div class="fat-conc-v"><b>${num(pr.emessi)}</b><span>inviati (bozze escluse)</span></div>
        <div class="fat-conc-v"><b>${num(pr.confermati)}</b><span>confermati</span></div>
        <div class="fat-conc-v"><b>${num(pr.annullati)}</b><span>annullati</span></div>
        <div class="fat-conc-v"><b>${num(pr.inAttesa)}</b><span>in attesa di risposta</span></div>
        <div class="fat-conc-v"><b>${perc(pr.conversione)}</b><span>conversione, sulle risposte</span></div>
        <div class="fat-conc-v"><b>${fmtEuro(pr.valoreConfermato)}</b><span>valore confermato${pr.valoreMedio ? ` · medio ${fmtEuro(pr.valoreMedio)}` : ''}</span></div>
      </div>
      <p class="mini" style="margin:10px 0 0">Per data del documento. La conversione conta solo i preventivi che hanno avuto una risposta: quelli ancora in attesa non sono un no. Il valore è IVA compresa, come nel preventivo.</p>`));

    if (s.inProgramma || s.daFissare) {
      corpo.appendChild(el(`<p class="mini" style="margin:14px 2px 0">In arrivo: ${s.inProgramma} ${s.inProgramma === 1 ? 'corso in programma' : 'corsi in programma'}${s.daFissare ? ` e ${s.daFissare} da fissare` : ''} — <a href="#/formazione/corsi">vai al registro</a>.</p>`));
    }
  }

  head.querySelector('#esporta').addEventListener('click', () => {
    const anno = selAnno.value ? Number(selAnno.value) : null;
    const righe = corsi
      .filter(c => c.stato === 'svolto' && (anno === null || String(c.data_inizio || '').startsWith(String(anno))))
      .sort((a, b) => String(a.data_inizio || '').localeCompare(String(b.data_inizio || '')));
    const blob = buildXlsxBlob([
      { header: 'Data inizio', tipo: 'data', get: c => c.data_inizio },
      { header: 'Data fine', tipo: 'data', get: c => c.data_fine },
      { header: 'Corso', tipo: 'testo', get: c => c.corso_nome },
      { header: 'Committente', tipo: 'testo', get: c => c.cliente || '' },
      { header: 'Sede', tipo: 'testo', get: c => c.sede_tipo === 'cliente' ? (c.sede || 'presso il committente') : 'Sede CRI' },
      { header: 'Docenti', tipo: 'testo', get: c => c.docenti || '' },
      { header: 'Ore', tipo: 'numero', get: c => c.ore },
      { header: 'Persone formate', tipo: 'numero', get: c => discentiEffettivi(c) },
      { header: 'Idonei', tipo: 'numero', get: c => (c.partecipanti || []).length ? idonei(c) : '' },
      { header: 'Importo (IVA esclusa)', tipo: 'valuta', get: c => c.importo },
    ], righe);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `corsi-svolti-${anno || 'tutti'}.xlsx`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  });

  selAnno.addEventListener('change', draw);
  draw();
}

function riquadro(titolo, html) {
  return el(`<div class="card" style="margin-bottom:18px"><div class="card-h">${esc(titolo)}</div><div class="card-b">${html}</div></div>`);
}

function tabella(intestazioni, righe, numeriche) {
  const cl = (i) => numeriche[i] ? ' style="text-align:right;white-space:nowrap"' : '';
  return `<div class="tbl-wrap"><table class="tbl tbl-stat"><thead><tr>${intestazioni.map((h, i) => `<th${cl(i)}>${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${righe.map(r => `<tr>${r.map((c, i) => `<td${cl(i)}>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

// La barra è proporzionale alla voce più alta, non al totale: serve a
// confrontare le voci fra loro, come le fasce del Fatturato.
function barra(quota, comeFascia = false) {
  const w = Math.max(2, Math.round((quota || 0) * 100));
  return `<span class="fat-fascia-b${comeFascia ? '' : ' st-barra'}"><i class="ok" style="width:${w}%"></i></span>`;
}

// Colonne disegnate a mano in SVG, come gli altri grafici della casa (vedi
// js/analisi/views/fatturato.js): una libreria per un grafico solo sarebbe
// peso inutile. Il viewBox lo fa stringere col riquadro, anche sul telefono.
function graficoMesi(mesi) {
  const W = 960, H = 130, top = 18, basso = 26, slot = W / 12, barW = 34;
  const max = Math.max(1, ...mesi.map(m => m.discenti));
  let corpo = '';
  mesi.forEach((m, i) => {
    const h = Math.round((m.discenti / max) * H);
    const x = i * slot + (slot - barW) / 2;
    if (m.discenti) {
      corpo += `<rect x="${x}" y="${top + H - h}" width="${barW}" height="${h}" rx="3" fill="var(--cri-red)">
        <title>${MESI[i]}: ${m.discenti} ${m.discenti === 1 ? 'persona' : 'persone'}, ${m.edizioni} ${m.edizioni === 1 ? 'corso' : 'corsi'}</title></rect>
        <text x="${x + barW / 2}" y="${top + H - h - 5}" text-anchor="middle" font-size="11" fill="var(--ink-soft)">${m.discenti}</text>`;
    }
    corpo += `<text x="${i * slot + slot / 2}" y="${top + H + 18}" text-anchor="middle" font-size="12" fill="var(--ink-soft)">${MESI[i]}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H + top + basso}" style="display:block;width:100%;height:auto" role="img" aria-label="Persone formate per mese">
    <line x1="0" y1="${top + H}" x2="${W}" y2="${top + H}" stroke="var(--line)"/>${corpo}</svg>`;
}
