// ============================================================
//  IL CONTO DI UNA SINGOLA ATTIVITÀ.
//  Entrate e uscite in due colonne, una riga per fattura, e in fondo il
//  saldo. È la pagina che si apre quando il quadro d'insieme ha già detto
//  «questa è in perdita» e si vuole sapere PERCHÉ: senza i documenti uno
//  per uno, il numero rosso non porta da nessuna parte.
//
//  Qui le quote si correggono e si tolgono, ma non se ne aggiungono: si
//  attribuisce da «Da attribuire», che è l'unico posto che sa che cosa è
//  ancora libero, o dalla scheda della fattura mentre la si registra.
//  Due porte, non tre.
// ============================================================
import { caricaTutto, centri as storeCentri, imputazioni as storeImputazioni } from '../data/store.js';
import { documenti, vociDi, totaliDi, anni } from '../calc.js';
import { el, clear, esc, toast, fmtEuro, fmtDate, confirmDialog, openModal } from '../../lib/ui.js';
import { CAMPO_DECIMALE, testoDecimale, leggiDecimale } from '../../lib/importi.js';
import { barraPeriodo, intervallo, nomePeriodo } from './periodo.js';
import { apriSchedaCentro } from './scheda.js';
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

  const docs = documenti(dati.passive, dati.attive);

  const testa = el('<div class="page-head"></div>');
  const barra = barraPeriodo(anni(docs), stato, disegna);
  const stats = el('<div class="grid stats" style="margin:0 0 20px"></div>');
  const colonne = el('<div class="cc-colonne"></div>');

  clear(zona);
  zona.append(testa, barra, stats, colonne);

  function disegnaTesta() {
    clear(testa);
    testa.append(
      el(`<div>
        <h1>${esc(centro.nome)}${centro.chiuso ? ' <span class="chip">conclusa</span>' : ''}</h1>
        <p>${esc(centro.descrizione || periodoDi(centro))}</p>
      </div>`),
      el(`<div class="actions">
        <a class="btn" href="#/analisi/centri">← Centri di costo</a>
        <a class="btn" href="#/analisi/da-attribuire">📥 Attribuisci fatture</a>
        ${admin ? `<button class="btn" data-chiudi>${centro.chiuso ? '↩︎ Riapri' : '✓ Concludi'}</button>` : ''}
        ${admin ? '<button class="btn primary" data-mod>✏️ Modifica</button>' : ''}
      </div>`),
    );

    testa.querySelector('[data-mod]')?.addEventListener('click', async () => {
      const agg = await apriSchedaCentro(centro);
      if (!agg) return;
      Object.assign(centro, agg);
      disegna();
    });
    testa.querySelector('[data-chiudi]')?.addEventListener('click', async () => {
      const ora = !centro.chiuso;
      if (ora && !await confirmDialog(
        `Segnare «${centro.nome}» come conclusa? I conti restano leggibili, ma l’attività sparisce dalle tendine di chi registra una fattura nuova.`,
        { okLabel: 'Concludi' })) return;
      try { Object.assign(centro, await storeCentri.chiudi(centro.id, ora)); }
      catch (e) { toast('Non è riuscito: ' + e.message, 'err'); return; }
      toast(ora ? 'Attività conclusa' : 'Attività riaperta', 'ok');
      disegna();
    });
  }

  function disegna() {
    disegnaTesta();
    const voci = vociDi(centro.id, docs, dati.imputazioni, stato);
    const t = totaliDi(voci);

    clear(stats);
    stats.append(
      card('ok', 'Entrate', fmtEuro(t.entrate), `${t.nEntrate} ${t.nEntrate === 1 ? 'fattura' : 'fatture'} ${nomePeriodo(stato.anno)}`),
      card('warn', 'Uscite', fmtEuro(t.uscite), `${t.nUscite} ${t.nUscite === 1 ? 'fattura' : 'fatture'} ${nomePeriodo(stato.anno)}`),
      card(t.saldo < 0 ? 'danger' : 'ok', 'Saldo', fmtEuro(t.saldo), t.saldo < 0 ? 'l’attività è in perdita' : 'entrate meno uscite'),
    );

    clear(colonne);
    colonne.append(
      colonna('Entrate', voci.filter(v => v.doc.tipo === 'entrata'), t.entrate),
      colonna('Uscite', voci.filter(v => v.doc.tipo === 'uscita'), t.uscite),
    );
  }

  function card(classe, k, v, s) {
    return el(`<div class="stat ${classe}"><div class="k">${esc(k)}</div>
      <div class="v">${esc(v)}</div><div class="s">${esc(s)}</div></div>`);
  }

  function colonna(titolo, voci, totale) {
    const c = el(`<div class="card"><div class="card-h">${esc(titolo)} — ${esc(fmtEuro(totale))}</div>
      <div class="card-b"><div class="cc-voci"></div></div></div>`);
    const dentro = c.querySelector('.cc-voci');
    if (!voci.length) {
      dentro.appendChild(el(`<p class="muted" style="font-size:13px;margin:0">Nessuna fattura attribuita ${esc(nomePeriodo(stato.anno))}.</p>`));
      return c;
    }
    for (const v of voci) dentro.appendChild(voce(v));
    return c;
  }

  function voce(v) {
    // Quando la fattura è stata stornata in parte, la quota vale meno di
    // quello che c'è scritto: si mostrano tutti e due i numeri, altrimenti
    // il totale della colonna non torna con la somma delle righe che si
    // leggono sotto — ed è il genere di differenza che fa perdere un
    // pomeriggio a cercare l'errore.
    const ridotta = Math.abs(v.netta - v.quota) > 0.005;
    const r = el(`<div class="cc-voce">
      <div class="cc-voce-chi">
        <div class="cc-voce-nome">${esc(v.doc.controparte)}</div>
        <div class="cc-voce-sotto">${v.doc.data ? esc(fmtDate(v.doc.data)) : 'senza data'}${v.doc.numero ? ` · n. ${esc(v.doc.numero)}` : ''}
          · fattura da ${esc(fmtEuro(v.doc.lordo))}${v.quota < v.doc.lordo - 0.005 ? ' (quota)' : ''}</div>
      </div>
      <div class="cc-voce-euro">
        <b>${esc(fmtEuro(v.netta))}</b>
        ${ridotta ? `<span class="cc-voce-nota" title="La fattura è stata stornata in parte: la quota vale meno di quanto scritto">${esc(fmtEuro(v.quota))} − nota di credito</span>` : ''}
      </div>
      <div class="cc-voce-azioni">
        <button class="btn ghost sm" data-quota title="Correggi la quota">✏️</button>
        <button class="btn ghost sm" data-del title="Togli questa fattura dall’attività">✕</button>
      </div>
    </div>`);

    r.querySelector('[data-quota]').addEventListener('click', () => correggi(v));
    r.querySelector('[data-del]').addEventListener('click', async () => {
      if (!await confirmDialog(
        `Togliere questa fattura da «${centro.nome}»? La fattura resta dov’è: torna solo a non essere attribuita.`,
        { danger: true, okLabel: 'Togli' })) return;
      try { await storeImputazioni.remove(v.id); }
      catch (e) { toast('Non è riuscito: ' + e.message, 'err'); return; }
      dati.imputazioni = dati.imputazioni.filter(i => i.id !== v.id);
      toast('Fattura tolta dall’attività', 'ok');
      disegna();
    });
    return r;
  }

  function correggi(v) {
    const body = el(`<div>
      <p style="margin:0 0 12px">${esc(v.doc.controparte)}${v.doc.numero ? ` · n. ${esc(v.doc.numero)}` : ''}
        — fattura da <b>${esc(fmtEuro(v.doc.lordo))}</b>.</p>
      <div class="field" style="margin:0">
        <label for="cq-importo">Quota su «${esc(centro.nome)}» (€)</label>
        <input ${CAMPO_DECIMALE} id="cq-importo" value="${testoDecimale(v.quota)}">
        <div class="hint">Quanto di questa fattura pesa su questa attività. Il resto può restare
        non attribuito o andare su un’altra: la somma non può superare l’importo della fattura.</div>
      </div>
    </div>`);
    const foot = el(`<div style="display:flex;gap:10px;justify-content:flex-end">
      <button class="btn" data-annulla>Annulla</button>
      <button class="btn primary" data-ok>Salva</button></div>`);
    const { close } = openModal({ title: 'Correggi la quota', body, footer: foot });

    foot.querySelector('[data-annulla]').addEventListener('click', () => close());
    foot.querySelector('[data-ok]').addEventListener('click', async () => {
      const importo = leggiDecimale(body.querySelector('#cq-importo').value);
      if (!importo || importo <= 0) { toast('Scrivi una quota maggiore di zero', 'err'); return; }
      const btn = foot.querySelector('[data-ok]');
      btn.disabled = true;
      let agg;
      try { agg = await storeImputazioni.setImporto(v.id, importo); }
      catch (e) { toast(e.message, 'err'); btn.disabled = false; return; }
      const i = dati.imputazioni.find(x => x.id === v.id);
      if (i) i.importo = agg.importo;
      toast('Quota aggiornata', 'ok');
      close();
      disegna();
    });
  }

  disegna();
}
