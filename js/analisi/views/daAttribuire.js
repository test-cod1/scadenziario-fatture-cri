// ============================================================
//  DA ATTRIBUIRE — l'arretrato, e il posto dove si smaltisce.
//  Elenca le fatture che nessuna attività ha ancora preso in carico, in
//  tutto o in parte. È la pagina che rende usabile la sezione il primo
//  giorno: senza, i centri di costo funzionerebbero solo per le fatture
//  registrate da domani in poi, e tutto lo storico resterebbe fuori.
//
//  La quota parte già compilata con quanto resta: il caso normale è «è
//  tutta di questa attività», e farlo scrivere ogni volta vorrebbe dire
//  far digitare a mano un numero che sta già a schermo. Chi deve
//  ripartire la fattura cambia la cifra e ripassa sulla stessa riga: la
//  riga resta lì finché c'è un resto, e si vede scendere.
//
//  In cima c'è un'attività "di lavoro": chi sistema l'arretrato lo fa
//  quasi sempre un'attività alla volta («adesso cerco tutto il corso
//  BLSD»), e sceglierla in ogni riga sarebbe lo stesso clic ripetuto
//  cinquanta volte.
// ============================================================
import { caricaTutto, imputazioni as storeImputazioni } from '../data/store.js';
import { documenti, imputazioniPerFattura, daAttribuire } from '../calc.js';
import { el, clear, esc, toast, fmtEuro, fmtDate, debounce } from '../../lib/ui.js';
import { CAMPO_DECIMALE, testoDecimale, leggiDecimale } from '../../lib/importi.js';

export async function renderDaAttribuire(view, ctx) {
  view.appendChild(el(`<div class="page-head">
    <div>
      <h1>Da attribuire</h1>
      <p>Le fatture che nessuna attività ha ancora preso in carico</p>
    </div>
    <div class="actions">
      <a class="btn" href="#/analisi/centri">🎯 Centri di costo</a>
    </div>
  </div>`));

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

  const docs = documenti(dati.passive, dati.attive);
  const aperti = dati.centri.filter(c => !c.chiuso);
  let perFattura = imputazioniPerFattura(dati.imputazioni);

  // Non basta che esista un centro: deve essercene uno APERTO, perché è da
  // quelli che si sceglie. Con tutte le attività concluse — cosa che
  // succede a fine anno — la pagina si disegnava con la tendina vuota e
  // ogni clic su «Attribuisci» finiva in un errore, senza che niente
  // dicesse che bisognava riaprire o creare un'attività.
  if (!aperti.length) {
    clear(zona);
    zona.appendChild(el(`<div class="empty-state"><div class="big">🎯</div>
      <p><b>${dati.centri.length ? 'Nessuna attività aperta' : 'Prima servono le attività'}</b></p>
      <p>${dati.centri.length
        ? 'Le attività ci sono ma sono tutte concluse, e a un’attività conclusa non si attribuiscono fatture nuove.<br>Riaprine una o creane un’altra in <a href="#/analisi/centri">Centri di costo</a>.'
        : 'Non c’è ancora nessun centro di costo a cui attribuire una fattura.<br><a href="#/analisi/centri">Creane uno</a> e torna qui.'}</p></div>`));
    return;
  }

  const toolbar = el(`<div class="toolbar">
    <div class="search"><span class="search-icon" aria-hidden="true">🔍</span>
      <input type="text" id="q" placeholder="Cerca fornitore, cliente o numero…"></div>
    <select id="f-tipo" aria-label="Entrate o uscite">
      <option value="">Entrate e uscite</option>
      <option value="uscita">Solo uscite (fatture fornitori)</option>
      <option value="entrata">Solo entrate (fatture clienti)</option>
    </select>
    <label class="an-lavoro">Attribuisci a
      <select id="f-centro" aria-label="Attività su cui stai lavorando">
        ${aperti.map(c => `<option value="${esc(c.id)}">${esc(c.nome)}</option>`).join('')}
      </select>
    </label>
  </div>`);

  const lista = el('<div class="att-lista"></div>');
  const conteggio = el('<p class="hint"></p>');

  clear(zona);
  zona.append(toolbar, conteggio, lista);

  toolbar.querySelector('#q').addEventListener('input', debounce(disegna, 200));
  toolbar.querySelector('#f-tipo').addEventListener('change', disegna);

  function centroScelto() {
    const id = toolbar.querySelector('#f-centro').value;
    return aperti.find(c => c.id === id) || null;
  }

  function disegna() {
    const righe = daAttribuire(docs, perFattura, {
      tipo: toolbar.querySelector('#f-tipo').value,
      cerca: toolbar.querySelector('#q').value,
    });
    clear(lista);
    const totale = righe.reduce((s, d) => s + d.resto, 0);
    conteggio.innerHTML = righe.length
      ? `<b>${righe.length}</b> ${righe.length === 1 ? 'fattura' : 'fatture'} da attribuire, per ${esc(fmtEuro(totale))} complessivi.`
      : 'Niente da attribuire con questi filtri.';

    if (!righe.length) {
      lista.appendChild(el(`<div class="empty-state"><div class="big">✅</div>
        <p><b>Tutto attribuito</b></p><p>Ogni fattura è stata assegnata a un’attività.</p></div>`));
      return;
    }
    // Si disegnano le prime cento: oltre, la pagina diventa lenta e
    // illeggibile — e chi ha mille fatture da sistemare usa la ricerca e
    // i filtri, non lo scorrimento.
    for (const d of righe.slice(0, 100)) lista.appendChild(riga(d));
    if (righe.length > 100) {
      lista.appendChild(el(`<p class="hint" style="text-align:center">Mostrate le prime 100 di ${righe.length}.
        Usa la ricerca o i filtri per arrivare alle altre.</p>`));
    }
  }

  function riga(d) {
    const parziale = d.resto < d.lordo - 0.005;
    const r = el(`<div class="att-riga ${d.tipo}">
      <div class="att-chi">
        <div class="att-nome">${esc(d.controparte)}
          <span class="chip ${d.tipo === 'entrata' ? 'ok' : 'warn'}">${d.tipo === 'entrata' ? 'entrata' : 'uscita'}</span></div>
        <div class="att-sotto">${d.data ? esc(fmtDate(d.data)) : 'senza data'}${d.numero ? ` · n. ${esc(d.numero)}` : ''}
          · fattura da ${esc(fmtEuro(d.lordo))}${parziale ? ` · già attribuiti ${esc(fmtEuro(d.lordo - d.resto))}` : ''}</div>
      </div>
      <div class="att-quota">
        <label class="sr-solo" for="q-${esc(d.id)}">Quota da attribuire</label>
        <input ${CAMPO_DECIMALE} id="q-${esc(d.id)}" value="${testoDecimale(d.resto)}" aria-label="Quota in euro">
      </div>
      <button class="btn primary sm" data-ok>Attribuisci</button>
    </div>`);

    r.querySelector('[data-ok]').addEventListener('click', async () => {
      const centro = centroScelto();
      if (!centro) { toast('Scegli l’attività a cui attribuire', 'err'); return; }
      const importo = leggiDecimale(r.querySelector('input').value);
      if (!importo || importo <= 0) { toast('Scrivi una quota maggiore di zero', 'err'); return; }
      if (importo > d.resto + 0.005) {
        toast(`Di questa fattura restano ${fmtEuro(d.resto)} da attribuire`, 'err');
        return;
      }
      const btn = r.querySelector('[data-ok]');
      btn.disabled = true;
      let creata;
      try {
        creata = await storeImputazioni.add({
          centroId: centro.id, fatturaId: d.id, attiva: d.tipo === 'entrata', importo,
        });
      } catch (e) { toast(e.message, 'err'); btn.disabled = false; return; }

      dati.imputazioni.push(creata);
      perFattura = imputazioniPerFattura(dati.imputazioni);
      toast(`${fmtEuro(importo)} attribuiti a ${centro.nome}`, 'ok');
      disegna();
    });
    return r;
  }

  disegna();
}

