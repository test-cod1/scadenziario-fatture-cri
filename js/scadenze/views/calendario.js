// ============================================================
//  IL CALENDARIO DELLE SCADENZE.
//  L'elenco dice cosa c'è da sistemare adesso; il mese dice come sono
//  distribuite le cose nel tempo: quale settimana è piena di rinnovi,
//  quando cade il prossimo bollo. Sono gli stessi dati visti in due modi.
//
//  La griglia è quella del calendario del Direttore (stesse classi, stessi
//  calcoli del mese), così le due sezioni si leggono allo stesso modo. In
//  più qui ci sono le ricorrenze: una scadenza che si ripete ha nel
//  database solo la prossima data, ma nel mese di qui a un anno si vuole
//  vederla lo stesso. Le ripetizioni previste si disegnano tratteggiate:
//  non sono righe vere, nascono quando si spunta quella prima.
//
//  Il mese si sfoglia senza cambiare rotta, come nel Direttore: le frecce
//  si premono a ripetizione e rileggere il database a ogni colpo non serve.
// ============================================================
import { scadenze as store } from '../data/store.js';
import { stato, etichetta, ordina, ricorrenzaDi, prossimaData, oggiISO } from '../calc.js';
import {
  GIORNI_SETTIMANA, grigliaMese, meseDi, meseValido, spostaMese, nomeMese, nomeGiorno,
} from '../../direttore/calc.js';
import { el, clear, esc, toast, rendiCliccabile, fmtDate, fmtEuro } from '../../lib/ui.js';

const PER_CASELLA = 3;
// Un tetto alle ripetizioni proiettate: una mensile vista fra dieci anni
// non deve far girare il ciclo all'infinito.
const MAX_RIPETIZIONI = 400;

export async function renderCalendario(view, ctx, mese) {
  const oggi = oggiISO();
  let corrente = meseValido(mese) ? mese : meseDi(oggi);
  let scelto = corrente === meseDi(oggi) ? oggi : null;
  let mostraFatte = false;
  const elenco = await store.list();

  view.appendChild(el(`<div class="page-head">
    <div><h1>Calendario delle scadenze</h1><p>Le scadenze mese per mese; quelle che si ripetono compaiono anche nei mesi a venire</p></div>
    <div class="actions">
      <a class="btn" href="#/scadenze/elenco">⏰ Elenco</a>
      <a class="btn primary" href="#/scadenze/nuova">➕ Nuova scadenza</a>
    </div>
  </div>`));

  const barra = el(`<div class="dir-cal-barra">
    <div class="dir-cal-mese">
      <button class="btn ghost sm" data-prec title="Mese precedente" aria-label="Mese precedente">‹</button>
      <b data-nome>&nbsp;</b>
      <button class="btn ghost sm" data-succ title="Mese successivo" aria-label="Mese successivo">›</button>
    </div>
    <button class="btn sm" data-oggi>Oggi</button>
    <select id="f-categoria" aria-label="Filtra per categoria"></select>
    <label class="dir-cal-fatti"><input type="checkbox" id="f-fatte"> Mostra anche le fatte</label>
  </div>`);
  view.appendChild(barra);

  const legenda = el(`<div class="sca-cal-legenda" aria-hidden="true">
    <span><i class="sca-scaduta"></i>scaduta</span>
    <span><i class="sca-preavviso"></i>in preavviso</span>
    <span><i class="sca-futura"></i>più avanti</span>
    <span><i class="sca-prevista"></i>ripetizione prevista</span>
  </div>`);
  view.appendChild(legenda);

  const griglia = el('<div class="dir-cal"></div>');
  view.appendChild(griglia);
  const pannello = el('<div class="dir-cal-giorno"></div>');
  view.appendChild(pannello);

  const $cat = barra.querySelector('#f-categoria');
  function aggiornaCategorie() {
    const scelta = $cat.value;
    const categorie = [...new Set(elenco.map(s => s.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'it'));
    $cat.innerHTML = `<option value="">Ogni categoria</option>` +
      categorie.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
    if (categorie.includes(scelta)) $cat.value = scelta;
    $cat.hidden = categorie.length < 2;
  }

  // Le voci del periodo [da, a]: le righe vere più le ripetizioni previste
  // delle ricorrenti ancora aperte. Una ricorrente già fatta ha la sua
  // successiva fra le righe vere, quindi non si proietta di nuovo.
  function vociFra(da, a) {
    const cat = $cat.value;
    const voci = [];
    for (const s of elenco) {
      if (cat && s.categoria !== cat) continue;
      if (!s.data_scadenza) continue;
      if (!s.fatta || mostraFatte) {
        if (s.data_scadenza >= da && s.data_scadenza <= a) voci.push({ s, data: s.data_scadenza, prevista: false });
      }
      if (s.fatta || !ricorrenzaDi(s.ricorrenza).mesi) continue;
      let d = s.data_scadenza;
      for (let n = 0; n < MAX_RIPETIZIONI; n++) {
        d = prossimaData(d, s.ricorrenza);
        if (!d || d > a) break;
        if (d >= da) voci.push({ s, data: d, prevista: true });
      }
    }
    return voci;
  }

  function perGiorno(voci) {
    const mappa = new Map();
    for (const v of voci) {
      if (!mappa.has(v.data)) mappa.set(v.data, []);
      mappa.get(v.data).push(v);
    }
    // Prima le vere nell'ordine dell'elenco, poi le previste per titolo.
    for (const righe of mappa.values()) {
      const vere = ordina(righe.filter(v => !v.prevista).map(v => v.s));
      righe.sort((x, y) => (x.prevista - y.prevista)
        || (x.prevista ? String(x.s.titolo).localeCompare(String(y.s.titolo), 'it') : vere.indexOf(x.s) - vere.indexOf(y.s)));
    }
    return mappa;
  }

  function classeDi(v) {
    if (v.prevista) return 'sca-prevista';
    const st = stato(v.s, oggi);
    return st === 'oggi' ? 'sca-preavviso' : `sca-${st}`;
  }

  let caselle = [];
  let mappa = new Map();

  function disegnaGriglia() {
    caselle = grigliaMese(corrente, oggi);
    mappa = perGiorno(vociFra(caselle[0].iso, caselle[caselle.length - 1].iso));
    barra.querySelector('[data-nome]').textContent = nomeMese(corrente);
    clear(griglia);

    const testa = el('<div class="dir-cal-testa"></div>');
    for (const g of GIORNI_SETTIMANA) {
      testa.appendChild(el(`<div${['sabato', 'domenica'].includes(g) ? ' class="festivo"' : ''}><abbr title="${esc(g)}">${esc(g.slice(0, 3))}</abbr></div>`));
    }
    griglia.appendChild(testa);

    const celle = el('<div class="dir-cal-celle"></div>');
    for (const c of caselle) {
      const del = mappa.get(c.iso) || [];
      const cella = el(`<div class="dir-cal-gio${c.nelMese ? '' : ' fuori'}${c.oggi ? ' oggi' : ''}${c.iso === scelto ? ' scelto' : ''}"
        aria-label="${esc(nomeGiorno(c.iso))}${del.length ? `, ${del.length} in scadenza` : ''}">
        <span class="n">${c.giorno}</span>
        <span class="pallini" aria-hidden="true"></span>
        <span class="voci"></span>
      </div>`);
      const voci = cella.querySelector('.voci');
      const pallini = cella.querySelector('.pallini');
      for (const v of del.slice(0, PER_CASELLA)) {
        voci.appendChild(el(`<span class="dir-cal-voce ${classeDi(v)}" title="${esc(v.s.titolo)}${v.prevista ? ' (ripetizione prevista)' : ''}">${esc(v.s.titolo)}</span>`));
      }
      if (del.length > PER_CASELLA) voci.appendChild(el(`<span class="dir-cal-altri">+${del.length - PER_CASELLA} altre</span>`));
      for (const v of del.slice(0, 4)) pallini.appendChild(el(`<i class="${classeDi(v)}"></i>`));

      rendiCliccabile(cella, () => {
        scelto = c.iso;
        if (!c.nelMese) corrente = c.iso.slice(0, 7);
        disegna();
      });
      celle.appendChild(cella);
    }
    griglia.appendChild(celle);
  }

  function disegnaPannello() {
    clear(pannello);
    if (!scelto) {
      pannello.appendChild(el('<p class="dir-cal-invito">Scegli un giorno per vedere che cosa scade, o per aggiungerci una scadenza.</p>'));
      return;
    }
    // Il giorno scelto può stare fuori dalla griglia disegnata (dopo «Oggi»
    // no, ma per sicurezza): in quel caso si calcola a parte.
    const del = (caselle.some(c => c.iso === scelto) ? mappa : perGiorno(vociFra(scelto, scelto))).get(scelto) || [];
    pannello.appendChild(el(`<div class="dir-cal-giorno-testa">
      <h2>${esc(nomeGiorno(scelto))}${scelto === oggi ? ' <span class="chip info">oggi</span>' : ''}</h2>
      <a class="btn sm" href="#/scadenze/nuova/${esc(scelto)}">➕ Scadenza in questa data</a>
    </div>`));
    if (!del.length) {
      pannello.appendChild(el('<p class="dir-cal-invito">Nessuna scadenza in questo giorno.</p>'));
      return;
    }
    const lista = el('<div class="dir-lista"></div>');
    for (const v of del) lista.appendChild(riga(v));
    pannello.appendChild(lista);
  }

  // Come nel Direttore, qui niente cestino: si guarda e si spunta. Una
  // ripetizione prevista non si spunta: non esiste ancora, nasce quando si
  // segna fatta quella vera.
  function riga(v) {
    const s = v.s;
    const ric = ricorrenzaDi(s.ricorrenza);
    const et = v.prevista ? null : etichetta(s, oggi);
    const r = el(`<div class="dir-riga ${s.fatta && !v.prevista ? 'fatta' : ''}${v.prevista ? ' sca-riga-prevista' : ''}">
      ${v.prevista
        ? '<span class="dir-spunta" aria-hidden="true" title="Ripetizione prevista">🔁</span>'
        : `<button class="dir-spunta" type="button" role="checkbox" aria-checked="${s.fatta ? 'true' : 'false'}"
            title="${s.fatta ? 'Segna come da fare' : 'Segna come fatta'}">${s.fatta ? '✔' : ''}</button>`}
      <div class="dir-corpo">
        <div class="dir-titolo">${esc(s.titolo)}</div>
        ${s.riferimento || s.responsabile ? `<div class="dir-dettagli">${[s.riferimento, s.responsabile ? 'a cura di ' + s.responsabile : ''].filter(Boolean).map(esc).join(' · ')}</div>` : ''}
        <div class="dir-chip">
          ${v.prevista
            ? `<span class="chip sca-nessuna" title="Nasce quando si segna fatta quella del ${esc(fmtDate(s.data_scadenza))}">ripetizione prevista · ${esc(ric.label.toLowerCase())}</span>`
            : `<span class="chip ${et.classe}">${esc(et.testo)}</span>`}
          <span class="chip">${esc(s.categoria)}</span>
          ${!v.prevista && ric.mesi ? `<span class="chip" title="Si ripete">🔁 ${esc(ric.label.toLowerCase())}</span>` : ''}
          ${s.importo != null ? `<span class="chip">${esc(fmtEuro(s.importo))}</span>` : ''}
        </div>
      </div>
      <div class="dir-azioni">
        <button class="btn ghost sm" data-mod title="${v.prevista ? 'Apri la scadenza da cui nasce' : 'Apri'}">✏️</button>
      </div>
    </div>`);

    const spunta = r.querySelector('button.dir-spunta');
    spunta?.addEventListener('click', async () => {
      if (spunta.disabled) return;
      spunta.disabled = true;
      const eraFatta = !!s.fatta;
      let esito;
      try { esito = await store.segna(s, !eraFatta); }
      catch (e) { spunta.disabled = false; toast('Non è riuscito: ' + e.message, 'err'); return; }
      for (const n of [esito.aggiornata, ...(esito.nuova ? [esito.nuova] : [])]) {
        const i = elenco.findIndex(x => x.id === n.id);
        if (i >= 0) elenco[i] = n; else elenco.push(n);
      }
      toast(eraFatta ? 'Rimessa fra le cose da fare'
        : esito.nuova ? `Fatta. La prossima: ${fmtDate(esito.nuova.data_scadenza)}` : 'Segnata come fatta', 'ok');
      disegna();
    });
    const apri = () => ctx.go(`#/scadenze/scadenza/${s.id}`);
    r.querySelector('[data-mod]').addEventListener('click', apri);
    rendiCliccabile(r.querySelector('.dir-corpo'), apri);
    return r;
  }

  function disegna() { disegnaGriglia(); disegnaPannello(); }

  barra.querySelector('[data-prec]').addEventListener('click', () => { corrente = spostaMese(corrente, -1); disegna(); });
  barra.querySelector('[data-succ]').addEventListener('click', () => { corrente = spostaMese(corrente, +1); disegna(); });
  barra.querySelector('[data-oggi]').addEventListener('click', () => { corrente = meseDi(oggi); scelto = oggi; disegna(); });
  barra.querySelector('#f-fatte').addEventListener('change', (e) => { mostraFatte = e.target.checked; disegna(); });
  $cat.addEventListener('change', disegna);

  aggiornaCategorie();
  disegna();
}
