// ============================================================
//  IL CONTO DI UN CENTRO DI COSTO, IN SOLA LETTURA (centro-condiviso.html)
//  Lo apre chi ha ricevuto il link dalla sezione Analisi, senza accedere
//  al portale. Il codice sta dopo il # («…/centro-condiviso.html#codice»):
//  la parte dopo il # non viene mandata al server con la pagina, quindi
//  non finisce nei log né nel Referer; lo spedisce solo questo script, nel
//  corpo della richiesta a /api/centro-condiviso.
//
//  I conti e i grafici sono gli stessi della pagina del portale
//  (js/analisi/calc.js e views/grafici.js): due pagine che mostrano lo
//  stesso centro non possono dire due numeri diversi. Qui non c'è nessun
//  pulsante che modifica: la pagina non saprebbe nemmeno come farlo.
// ============================================================
import { FORMA_TOKEN } from '../lib/datiFatturazione.mjs';
import { vociDi, totaliDi, anni, perAnno, perMese, perCategoria } from '../analisi/calc.js';
import { graficoAndamento, graficoCategorie, tabellaAnni, MESI_BREVI, nomeMese } from '../analisi/views/grafici.js';
import { barraPeriodo, intervallo, nomePeriodo } from '../analisi/views/periodo.js';
import { el, esc, clear, fmtEuro, fmtDate, fmtDateTime } from '../lib/ui.js';

const zona = document.getElementById('conto');
const token = decodeURIComponent(location.hash.replace(/^#/, ''));

function errore(titolo, testo) {
  zona.innerHTML = `<div class="card pp-card"><div class="card-b">
    <h1 class="pp-titolo">${esc(titolo)}</h1><p>${esc(testo)}</p></div></div>`;
}

async function avvia() {
  if (!FORMA_TOKEN.test(token)) {
    errore('Link non valido', 'Il link è incompleto. Copialo per intero, oppure chiedine uno nuovo a chi te lo ha mandato.');
    return;
  }
  let r;
  try {
    const res = await fetch('/api/centro-condiviso', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
    });
    r = { ok: res.ok, ...(await res.json().catch(() => ({}))) };
  } catch { errore('Pagina non raggiungibile', 'Controlla la connessione e ricarica la pagina.'); return; }
  if (!r.ok) { errore('Link non disponibile', r.error || 'Il link non è valido o non è più attivo.'); return; }
  disegnaPagina(r.centro, r.movimenti.map((m, i) => ({ ...m, id: String(i), centro_id: 'c' })), r.letto_il);
}

function periodoDi(c) {
  if (c.inizio && c.fine) return `${fmtDate(c.inizio)} – ${fmtDate(c.fine)}`;
  if (c.inizio) return `dal ${fmtDate(c.inizio)}`;
  if (c.fine) return `fino al ${fmtDate(c.fine)}`;
  return '';
}

function disegnaPagina(centro, movimenti, lettoIl) {
  document.title = `${centro.nome} · Croce Rossa Italiana — Comitato di Genova`;
  const stato = { anno: '', da: '', a: '' };
  const sotto = [centro.descrizione, periodoDi(centro)].filter(Boolean).join(' · ');

  clear(zona);
  const testa = el(`<div class="pp-conto-testa">
    <h1 class="pp-titolo">${esc(centro.nome)}${centro.chiuso ? ' <span class="chip">conclusa</span>' : ''}</h1>
    ${sotto ? `<p class="pp-sotto">${esc(sotto)}</p>` : ''}
    <p class="pp-agg">Centro di costo · sola lettura · dati aggiornati al ${esc(fmtDateTime(lettoIl))}</p>
  </div>`);
  const barra = barraPeriodo(anni(movimenti), stato, disegna);
  const stats = el('<div class="grid stats" style="margin:0 0 20px"></div>');
  const quadroAnni = el('<div class="card" style="margin-bottom:18px"><div class="card-b"></div></div>');
  const grafici = el('<div class="an-quadro"></div>');
  const colonne = el('<div class="cc-colonne"></div>');
  zona.append(testa, barra, stats, quadroAnni, grafici, colonne);

  function scegliAnno(anno) {
    stato.anno = anno;
    Object.assign(stato, intervallo(anno));
    barra.querySelector('#f-anno').value = anno;
    disegna();
  }

  const card = (classe, k, v, s) => el(`<div class="stat ${classe}"><div class="k">${esc(k)}</div>
    <div class="v">${esc(v)}</div><div class="s">${esc(s)}</div></div>`);

  function disegna() {
    const voci = vociDi('c', movimenti, stato);
    const t = totaliDi(voci);
    const quanti = n => `${n} ${n === 1 ? 'movimento' : 'movimenti'} ${nomePeriodo(stato.anno)}`;
    barra.querySelector('[data-nota]').textContent = `${movimenti.length} movimenti in tutto`;

    clear(stats);
    stats.append(
      card('ok', 'Entrate', fmtEuro(t.entrate), quanti(t.nEntrate)),
      card('warn', 'Uscite', fmtEuro(t.uscite), quanti(t.nUscite)),
      card(t.saldo < 0 ? 'danger' : 'ok', 'Saldo', fmtEuro(t.saldo), 'entrate meno uscite'),
    );

    const conEntrate = movimenti.some(v => v.tipo === 'entrata');
    const corpoAnni = quadroAnni.firstElementChild;
    clear(corpoAnni);
    quadroAnni.hidden = !movimenti.length;
    if (movimenti.length) corpoAnni.appendChild(tabellaAnni(perAnno(movimenti), stato.anno, scegliAnno, { mostraEntrate: conEntrate }));

    clear(grafici);
    grafici.hidden = !voci.length;
    if (voci.length) {
      const andamento = stato.anno
        ? perMese(voci, stato.anno).map(m => ({ etichetta: MESI_BREVI[m.mese], titolo: `${nomeMese(m.mese)} ${stato.anno}`, entrate: m.entrate, uscite: m.uscite }))
        : perAnno(movimenti).filter(r => r.anno).reverse().map(r => ({ etichetta: r.anno, titolo: r.anno, entrate: r.entrate, uscite: r.uscite }));
      const sx = el('<div class="card"><div class="card-b"></div></div>');
      sx.firstElementChild.appendChild(graficoAndamento(andamento, {
        titolo: `${conEntrate ? 'Entrate e uscite' : 'Uscite'} ${stato.anno ? `mese per mese, ${stato.anno}` : 'per anno'}`,
        mostraEntrate: conEntrate,
      }));
      const dx = el('<div class="card"><div class="card-b"></div></div>');
      const catU = perCategoria(voci, 'uscita'), catE = perCategoria(voci, 'entrata');
      if (catU.length) dx.firstElementChild.appendChild(graficoCategorie(catU, { titolo: `Uscite per categoria ${nomePeriodo(stato.anno)}` }));
      if (catE.length) dx.firstElementChild.appendChild(graficoCategorie(catE, { titolo: `Entrate per categoria ${nomePeriodo(stato.anno)}`, tipo: 'entrata' }));
      grafici.append(sx, dx);
    }

    clear(colonne);
    colonne.append(
      colonna('Entrate', voci.filter(v => v.tipo === 'entrata'), t.entrate),
      colonna('Uscite', voci.filter(v => v.tipo !== 'entrata'), t.uscite),
    );
  }

  function colonna(titolo, voci, totale) {
    const c = el(`<div class="card"><div class="card-h">${esc(titolo)} — ${esc(fmtEuro(totale))}</div>
      <div class="card-b"><div class="cc-voci"></div></div></div>`);
    const dentro = c.querySelector('.cc-voci');
    if (!voci.length) {
      dentro.appendChild(el(`<p class="muted" style="font-size:13px;margin:0">Nessun movimento ${esc(nomePeriodo(stato.anno))}.</p>`));
      return c;
    }
    let annoCorrente = null;
    for (const v of voci) {
      const anno = v.data ? v.data.slice(0, 4) : '';
      if (!stato.anno && anno !== annoCorrente) {
        annoCorrente = anno;
        const sub = voci.filter(x => (x.data ? x.data.slice(0, 4) : '') === anno);
        const somma = sub.reduce((s, x) => s + Math.round(Number(x.importo) * 100), 0) / 100;
        dentro.appendChild(el(`<div class="cc-anno"><span>${anno ? esc(anno) : 'Senza data'} · ${sub.length}</span><b>${esc(fmtEuro(somma))}</b></div>`));
      }
      const tit = v.descrizione || v.controparte || v.documento || '—';
      const det = [v.data ? fmtDate(v.data) : 'senza data', v.descrizione && v.controparte ? v.controparte : '', v.documento || '']
        .filter(Boolean).join(' · ');
      dentro.appendChild(el(`<div class="cc-voce pp-voce">
        <div class="cc-voce-chi">
          <div class="cc-voce-nome">${esc(tit)}${v.categoria ? `<span class="cc-voce-cat">${esc(v.categoria)}</span>` : ''}</div>
          <div class="cc-voce-sotto">${esc(det)}</div>
        </div>
        <div class="cc-voce-euro"><b>${esc(fmtEuro(Number(v.importo)))}</b></div>
      </div>`));
    }
    return c;
  }

  disegna();
}

avvia();
