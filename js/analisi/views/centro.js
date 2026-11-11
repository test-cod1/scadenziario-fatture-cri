// ============================================================
//  IL CONTO DI UNA SINGOLA ATTIVITÀ.
//  Entrate e uscite in due colonne, una riga per movimento, e in cima il
//  saldo. È la pagina che si apre quando il quadro d'insieme ha già detto
//  «questa è in perdita» e si vuole sapere PERCHÉ: senza le voci una per
//  una, il numero rosso non porta da nessuna parte.
//
//  I movimenti si scrivono qui: Analisi non legge lo scadenziario, e
//  questo è l'unico posto in cui un costo o un ricavo entra in un'attività.
// ============================================================
import { caricaTutto, centri as storeCentri, movimenti as storeMovimenti } from '../data/store.js';
import { vociDi, totaliDi, anni, perAnno, perMese, perCategoria, categorieUsate } from '../calc.js';
import { el, clear, esc, toast, fmtEuro, fmtDate, confirmDialog } from '../../lib/ui.js';
import { barraPeriodo, intervallo, nomePeriodo } from './periodo.js';
import { graficoAndamento, graficoCategorie, tabellaAnni, MESI_BREVI, nomeMese } from './grafici.js';
import { apriSchedaCentro } from './scheda.js';
import { apriSchedaMovimento } from './movimento.js';
import { periodoDi } from './centri.js';

export async function renderCentro(view, id, ctx) {
  const admin = ctx.ruolo === 'admin';
  const stato = { anno: '', da: '', a: '' };

  const zona = el('<div><div class="spinner" style="margin-top:60px"></div></div>');
  view.appendChild(zona);

  let dati;
  try { dati = await caricaTutto(); }
  catch (e) {
    clear(zona);
    zona.appendChild(el(`<div class="empty-state"><div class="big">⚠️</div>
      <p><b>Non è stato possibile leggere i dati</b></p><p>${esc(e.message)}</p></div>`));
    return;
  }

  const centro = dati.centri.find(c => c.id === id);
  if (!centro) {
    clear(zona);
    zona.appendChild(el(`<div class="empty-state"><div class="big">🔎</div>
      <p><b>Attività non trovata</b></p>
      <p>Può essere stata eliminata da un collega. <a href="#/analisi/centri">Torna all’elenco</a>.</p></div>`));
    return;
  }

  const testa = el('<div class="page-head"></div>');
  const barra = barraPeriodo(anni(dati.movimenti.filter(m => m.centro_id === id)), stato, disegna);
  const stats = el('<div class="grid stats" style="margin:0 0 20px"></div>');
  const quadroAnni = el('<div class="card" style="margin-bottom:18px"><div class="card-b"></div></div>');
  const grafici = el('<div class="an-quadro"></div>');
  const colonne = el('<div class="cc-colonne"></div>');

  clear(zona);
  zona.append(testa, barra, stats, quadroAnni, grafici, colonne);

  // Cliccare un anno nella tabella fa la stessa cosa della tendina in cima,
  // e la tendina lo deve mostrare: due comandi che dicono due periodi
  // diversi sarebbero peggio di uno solo.
  function scegliAnno(anno) {
    const sel = barra.querySelector('#f-anno');
    if (anno && ![...sel.options].some(o => o.value === anno)) {
      sel.appendChild(el(`<option value="${esc(anno)}">${esc(anno)}</option>`));
    }
    stato.anno = anno;
    Object.assign(stato, intervallo(anno));
    sel.value = anno;
    disegna();
  }

  async function nuovoMovimento(tipo) {
    const creato = await apriSchedaMovimento(centro, null, tipo, categorieUsate(dati.movimenti));
    if (!creato) return;
    dati.movimenti.push(creato);
    disegna();
  }

  function disegnaTesta() {
    clear(testa);
    testa.append(
      el(`<div>
        <h1>${esc(centro.nome)}${centro.chiuso ? ' <span class="chip">conclusa</span>' : ''}</h1>
        <p>${esc(centro.descrizione || periodoDi(centro))}</p>
      </div>`),
      el(`<div class="actions">
        <a class="btn" href="#/analisi/centri">← Centri di costo</a>
        ${admin ? `<button class="btn" data-chiudi>${centro.chiuso ? '↩︎ Riapri' : '✓ Concludi'}</button>` : ''}
        ${admin ? '<button class="btn" data-mod>✏️ Modifica</button>' : ''}
        <button class="btn primary" data-nuovo-mov>➕ Nuovo movimento</button>
      </div>`),
    );

    testa.querySelector('[data-nuovo-mov]').addEventListener('click', () => nuovoMovimento('uscita'));
    testa.querySelector('[data-mod]')?.addEventListener('click', async () => {
      const agg = await apriSchedaCentro(centro);
      if (!agg) return;
      Object.assign(centro, agg);
      disegna();
    });
    testa.querySelector('[data-chiudi]')?.addEventListener('click', async () => {
      const ora = !centro.chiuso;
      if (ora && !await confirmDialog(
        `Segnare «${centro.nome}» come conclusa? I conti restano leggibili e si possono ancora aggiungere movimenti.`,
        { okLabel: 'Concludi' })) return;
      try { Object.assign(centro, await storeCentri.chiudi(centro.id, ora)); }
      catch (e) { toast('Non è riuscito: ' + e.message, 'err'); return; }
      toast(ora ? 'Attività conclusa' : 'Attività riaperta', 'ok');
      disegna();
    });
  }

  function disegna() {
    disegnaTesta();
    const voci = vociDi(centro.id, dati.movimenti, stato);
    const t = totaliDi(voci);
    const quanti = n => `${n} ${n === 1 ? 'movimento' : 'movimenti'} ${nomePeriodo(stato.anno)}`;

    clear(stats);
    stats.append(
      card('ok', 'Entrate', fmtEuro(t.entrate), quanti(t.nEntrate)),
      card('warn', 'Uscite', fmtEuro(t.uscite), quanti(t.nUscite)),
      card(t.saldo < 0 ? 'danger' : 'ok', 'Saldo', fmtEuro(t.saldo), t.saldo < 0 ? 'l’attività è in perdita' : 'entrate meno uscite'),
    );

    // Il confronto fra gli anni si fa sempre su tutti, anche quando sopra
    // ne è scelto uno: la riga scelta è evidenziata, le altre restano lì
    // come termine di paragone.
    const tutte = vociDi(centro.id, dati.movimenti);
    const conEntrate = tutte.some(v => v.tipo === 'entrata');
    const corpoAnni = quadroAnni.querySelector('.card-b');
    clear(corpoAnni);
    quadroAnni.hidden = !tutte.length;
    if (tutte.length) corpoAnni.appendChild(tabellaAnni(perAnno(tutte), stato.anno, scegliAnno, { mostraEntrate: conEntrate }));

    clear(grafici);
    grafici.hidden = !voci.length;
    if (voci.length) {
      // Un anno scelto si guarda mese per mese; tutti gli anni, anno per
      // anno — dodici mesi di tre anni diversi messi in fila non si leggono.
      const andamento = stato.anno
        ? perMese(voci, stato.anno).map(m => ({
          etichetta: MESI_BREVI[m.mese], titolo: `${nomeMese(m.mese)} ${stato.anno}`, entrate: m.entrate, uscite: m.uscite,
        }))
        : perAnno(tutte).filter(r => r.anno).reverse().map(r => ({
          etichetta: r.anno, titolo: r.anno, entrate: r.entrate, uscite: r.uscite,
        }));
      const sinistra = el('<div class="card"><div class="card-b"></div></div>');
      sinistra.firstElementChild.appendChild(graficoAndamento(andamento, {
        // Con una serie sola la legenda non serve: la dice il titolo.
        titolo: `${conEntrate ? 'Entrate e uscite' : 'Uscite'} ${stato.anno ? `mese per mese, ${stato.anno}` : 'per anno'}`,
        mostraEntrate: conEntrate,
      }));
      const destra = el('<div class="card"><div class="card-b"></div></div>');
      const catU = perCategoria(voci, 'uscita');
      const catE = perCategoria(voci, 'entrata');
      if (catU.length) destra.firstElementChild.appendChild(graficoCategorie(catU, { titolo: `Uscite per categoria ${nomePeriodo(stato.anno)}` }));
      if (catE.length) destra.firstElementChild.appendChild(graficoCategorie(catE, { titolo: `Entrate per categoria ${nomePeriodo(stato.anno)}`, tipo: 'entrata' }));
      grafici.append(sinistra, destra);
    }

    clear(colonne);
    colonne.append(
      colonna('Entrate', 'entrata', voci.filter(v => v.tipo === 'entrata'), t.entrate),
      colonna('Uscite', 'uscita', voci.filter(v => v.tipo !== 'entrata'), t.uscite),
    );
  }

  function card(classe, k, v, s) {
    return el(`<div class="stat ${classe}"><div class="k">${esc(k)}</div>
      <div class="v">${esc(v)}</div><div class="s">${esc(s)}</div></div>`);
  }

  function colonna(titolo, tipo, voci, totale) {
    const c = el(`<div class="card"><div class="card-h" style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <span>${esc(titolo)} — ${esc(fmtEuro(totale))}</span>
        <button class="btn ghost sm" data-agg title="Aggiungi ${tipo === 'entrata' ? 'un’entrata' : 'un’uscita'}">➕</button>
      </div>
      <div class="card-b"><div class="cc-voci"></div></div></div>`);
    c.querySelector('[data-agg]').addEventListener('click', () => nuovoMovimento(tipo));
    const dentro = c.querySelector('.cc-voci');
    if (!voci.length) {
      dentro.appendChild(el(`<p class="muted" style="font-size:13px;margin:0">Nessun movimento ${esc(nomePeriodo(stato.anno))}.</p>`));
      return c;
    }
    // Con tutti gli anni l'elenco si divide per anno, ognuno col suo
    // totale: trenta righe di fila non dicono dove finisce un anno.
    let annoCorrente = null;
    for (const v of voci) {
      const anno = v.data ? v.data.slice(0, 4) : '';
      if (!stato.anno && anno !== annoCorrente) {
        annoCorrente = anno;
        const sub = voci.filter(x => (x.data ? x.data.slice(0, 4) : '') === anno);
        const somma = sub.reduce((s, x) => s + Math.round(Number(x.importo) * 100), 0) / 100;
        dentro.appendChild(el(`<div class="cc-anno"><span>${anno ? esc(anno) : 'Senza data'} · ${sub.length}</span><b>${esc(fmtEuro(somma))}</b></div>`));
      }
      dentro.appendChild(voce(v));
    }
    return c;
  }

  function voce(v) {
    const titolo = v.descrizione || v.controparte || v.documento || '—';
    const sotto = [
      v.data ? fmtDate(v.data) : 'senza data',
      v.descrizione && v.controparte ? v.controparte : '',
      v.documento || '',
    ].filter(Boolean).join(' · ');
    const r = el(`<div class="cc-voce">
      <div class="cc-voce-chi">
        <div class="cc-voce-nome">${esc(titolo)}${v.categoria ? `<span class="cc-voce-cat">${esc(v.categoria)}</span>` : ''}</div>
        <div class="cc-voce-sotto">${esc(sotto)}</div>
        ${v.note ? `<div class="cc-voce-sotto">${esc(v.note)}</div>` : ''}
      </div>
      <div class="cc-voce-euro"><b>${esc(fmtEuro(Number(v.importo)))}</b></div>
      <div class="cc-voce-azioni">
        <button class="btn ghost sm" data-mod title="Modifica il movimento">✏️</button>
        <button class="btn ghost sm" data-del title="Elimina il movimento">✕</button>
      </div>
    </div>`);

    r.querySelector('[data-mod]').addEventListener('click', async () => {
      const agg = await apriSchedaMovimento(centro, v, v.tipo, categorieUsate(dati.movimenti));
      if (!agg) return;
      const i = dati.movimenti.findIndex(m => m.id === v.id);
      if (i >= 0) dati.movimenti[i] = agg;
      disegna();
    });
    r.querySelector('[data-del]').addEventListener('click', async () => {
      if (!await confirmDialog(
        `Eliminare «${titolo}» da ${fmtEuro(Number(v.importo))}? Il movimento non si recupera.`,
        { danger: true, okLabel: 'Elimina' })) return;
      try { await storeMovimenti.remove(v.id); }
      catch (e) { toast('Non è riuscito: ' + e.message, 'err'); return; }
      dati.movimenti = dati.movimenti.filter(m => m.id !== v.id);
      toast('Movimento eliminato', 'ok');
      disegna();
    });
    return r;
  }

  disegna();
}
