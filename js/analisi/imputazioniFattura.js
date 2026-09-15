// ============================================================
//  IL BLOCCO «CENTRI DI COSTO» DENTRO LA SCHEDA DI UNA FATTURA.
//  Vive nella sezione Analisi ma si vede nello scadenziario: è lì che si
//  attribuisce una fattura nel momento in cui lo si sa davvero, cioè
//  mentre la si registra col documento in mano. Rimandare quel gesto a
//  una pagina di analisi significa farlo fare a qualcuno che, tre mesi
//  dopo, dovrà indovinare a quale corso apparteneva una fattura di
//  materiale didattico.
//
//  Sta in js/analisi/ e non in js/views/ perché è roba di Analisi
//  ospitata altrove: il giorno in cui la sezione cambia idea su come si
//  imputa, si cambia qui dentro e lo scadenziario non se ne accorge.
//
//  Come i pagamenti, scrive subito: non aspetta il "Salva" della scheda.
//  Una quota è un fatto a sé — la fattura esiste già — e legarla al
//  salvataggio avrebbe voluto dire perderla chiudendo con la ✕.
// ============================================================
import { centri as storeCentri, imputazioni as storeImputazioni } from './data/store.js';
import { el, clear, esc, toast, fmtEuro, confirmDialog } from '../lib/ui.js';
import { CAMPO_DECIMALE, testoDecimale, leggiDecimale } from '../lib/importi.js';

const CENT = 0.005;

// node: il contenitore in cui disegnare. attiva: true per una fattura
// cliente (entrata), false per una fornitore (uscita).
export async function renderImputazioni(node, { fatturaId, attiva, importo }) {
  clear(node);
  // L'importo è quello con cui la fattura è stata aperta: se lo si cambia
  // e si salva senza richiudere la scheda, il "da attribuire" qui sotto
  // resta indietro di un giro. Non si rincorre il campo perché finché non
  // si salva quel numero non esiste per nessuno, e l'autorità su quanto
  // sia attribuibile è comunque il trigger sul database, che risponde con
  // la cifra giusta.
  const lordo = Number(importo || 0);

  const wrap = el(`<div class="card" style="margin-top:14px">
    <div class="card-h">Centri di costo</div>
    <div class="card-b"><div class="spinner sm"></div> Lettura delle attività…</div>
  </div>`);
  node.appendChild(wrap);
  const corpo = wrap.querySelector('.card-b');

  let elenco = [];
  let quote = [];
  try {
    [elenco, quote] = await Promise.all([
      storeCentri.list(),
      storeImputazioni.perFattura(fatturaId, attiva),
    ]);
  } catch (e) {
    // Senza la sezione Analisi installata (patch non eseguita) o senza
    // permesso, questo blocco non deve rompere la scheda della fattura:
    // il lavoro di chi registra viene prima.
    clear(corpo);
    corpo.appendChild(el(`<p class="muted" style="font-size:13px;margin:0">
      Attribuzione non disponibile: ${esc(e.message)}</p>`));
    return;
  }

  function disegna() {
    clear(corpo);
    const attribuito = quote.reduce((s, q) => s + Number(q.importo || 0), 0);
    const resto = Math.max(0, lordo - attribuito);
    const nome = (id) => elenco.find(c => c.id === id)?.nome || 'attività eliminata';

    const lista = el('<div class="imp-lista"></div>');
    for (const q of quote) {
      const r = el(`<div class="pag-row">
        <span><b>${esc(nome(q.centro_id))}</b> · ${esc(fmtEuro(q.importo))}</span>
        <button class="rm" title="Togli questa attribuzione">✕</button>
      </div>`);
      r.querySelector('.rm').addEventListener('click', async () => {
        if (!await confirmDialog(`Togliere questa fattura da «${nome(q.centro_id)}»?`,
          { danger: true, okLabel: 'Togli' })) return;
        try { await storeImputazioni.remove(q.id); }
        catch (e) { toast('Non è riuscito: ' + e.message, 'err'); return; }
        quote = quote.filter(x => x.id !== q.id);
        toast('Attribuzione tolta', 'ok');
        disegna();
      });
      lista.appendChild(r);
    }
    if (!quote.length) {
      lista.appendChild(el('<div class="muted" style="font-size:13px">Questa fattura non è attribuita a nessuna attività.</div>'));
    }
    corpo.appendChild(lista);

    corpo.appendChild(el(`<div class="residuo-box">
      <span>Attribuito: <b>${esc(fmtEuro(attribuito))}</b></span>
      <span>Da attribuire: <b>${esc(fmtEuro(resto))}</b></span>
    </div>`));

    // Un'attività conclusa non si propone per una fattura nuova, ma se una
    // quota ce l'ha già deve restare leggibile: per quello il nome si
    // cerca in TUTTO l'elenco e solo la tendina è filtrata.
    const scegliibili = elenco.filter(c => !c.chiuso && !quote.some(q => q.centro_id === c.id));

    if (resto <= CENT) {
      corpo.appendChild(el('<p class="hint" style="margin:10px 0 0">Tutto l’importo è attribuito.</p>'));
      return;
    }
    if (!elenco.length) {
      corpo.appendChild(el(`<p class="hint" style="margin:10px 0 0">Non c’è ancora nessuna attività da
        scegliere: le crea un amministratore della sezione <b>Analisi</b>.</p>`));
      return;
    }
    if (!scegliibili.length) {
      corpo.appendChild(el(`<p class="hint" style="margin:10px 0 0">Le attività aperte sono già tutte
        attribuite su questa fattura: correggi una quota qui sopra, o apri un’altra attività in
        <b>Analisi</b>.</p>`));
      return;
    }

    const form = el(`<div class="imp-nuova">
      <div class="field" style="margin:0">
        <label for="imp-centro">Attività</label>
        <select id="imp-centro">${scegliibili.map(c => `<option value="${esc(c.id)}">${esc(c.nome)}</option>`).join('')}</select>
      </div>
      <div class="field" style="margin:0">
        <label for="imp-quota">Quota (€)</label>
        <input ${CAMPO_DECIMALE} id="imp-quota" value="${testoDecimale(resto)}">
      </div>
      <button class="btn sm" data-ok>Attribuisci</button>
    </div>`);
    corpo.appendChild(form);
    corpo.appendChild(el(`<p class="hint" style="margin:8px 0 0">La quota parte da quanto resta: se la
      fattura riguarda più attività, abbassala e ripeti l’operazione per l’altra.</p>`));

    form.querySelector('[data-ok]').addEventListener('click', async () => {
      const quota = leggiDecimale(form.querySelector('#imp-quota').value);
      if (!quota || quota <= 0) { toast('Scrivi una quota maggiore di zero', 'err'); return; }
      if (quota > resto + CENT) { toast(`Di questa fattura restano ${fmtEuro(resto)} da attribuire`, 'err'); return; }
      const btn = form.querySelector('[data-ok]');
      btn.disabled = true;
      let creata;
      try {
        creata = await storeImputazioni.add({
          centroId: form.querySelector('#imp-centro').value, fatturaId, attiva, importo: quota,
        });
      } catch (e) { toast(e.message, 'err'); btn.disabled = false; return; }
      quote.push(creata);
      toast('Fattura attribuita', 'ok');
      disegna();
    });
  }

  disegna();
}
