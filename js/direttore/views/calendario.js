// ============================================================
//  IL CALENDARIO DEGLI IMPEGNI.
//  L'elenco risponde a «cosa faccio adesso»: mette in cima quello che
//  pesa di più e del resto non dice quando cade. Questa pagina risponde
//  all'altra domanda, quella che viene prima di prendere un impegno
//  nuovo: «quella settimana com'è messa?». Sono due sguardi sugli stessi
//  dati, e nessuno dei due sostituisce l'altro.
//
//  Il mese si sfoglia senza cambiare rotta: le frecce si premono a
//  ripetizione — avanti tre mesi, indietro due — e far ripartire il
//  router ad ogni colpo vorrebbe dire rileggere il database ogni volta e
//  riempire la cronologia di passi indietro che nessuno vuole
//  ripercorrere. L'indirizzo col mese (#/direttore/calendario/2026-10)
//  resta valido in entrata, per arrivarci diretti da un link.
//
//  Sotto al mese c'è il giorno scelto, scritto per esteso. Non è solo
//  comodità da telefono, dove nella casella non ci sta nulla: è il posto
//  dove si dà la spunta senza perdere di vista la settimana.
// ============================================================
import { impegni as store } from '../data/store.js';
import {
  GIORNI_SETTIMANA, grigliaMese, perGiorno, meseDi, meseValido, spostaMese,
  nomeMese, nomeGiorno, oggiISO, livelloDi, etichettaScadenza, giorniAllaScadenza,
} from '../calc.js';
import { el, clear, esc, toast, rendiCliccabile, fmtDate } from '../../lib/ui.js';

// Quante ne stanno in una casella prima di riassumerle in «+n». Tre righe
// è quanto si legge con un colpo d'occhio: oltre, la casella diventa un
// elenco e il mese smette di vedersi tutto insieme.
const PER_CASELLA = 3;

export async function renderCalendario(view, ctx, mese) {
  const oggi = oggiISO();
  let corrente = meseValido(mese) ? mese : meseDi(oggi);
  let scelto = corrente === meseDi(oggi) ? oggi : null;
  let mostraFatti = false;
  const elenco = await store.list();

  view.appendChild(el(`<div class="page-head">
    <div>
      <h1>Calendario</h1>
      <p>Le scadenze che hai fissato, mese per mese</p>
    </div>
    <div class="actions">
      <a class="btn" href="#/direttore/impegni">🗒️ Elenco</a>
      <a class="btn primary" href="#/direttore/nuovo">➕ Nuovo impegno</a>
    </div>
  </div>`));

  const barra = el(`<div class="dir-cal-barra">
    <div class="dir-cal-mese">
      <button class="btn ghost sm" data-prec title="Mese precedente" aria-label="Mese precedente">‹</button>
      <b data-nome>&nbsp;</b>
      <button class="btn ghost sm" data-succ title="Mese successivo" aria-label="Mese successivo">›</button>
    </div>
    <button class="btn sm" data-oggi>Oggi</button>
    <label class="dir-cal-fatti"><input type="checkbox" id="f-fatti"> Mostra anche i fatti</label>
  </div>`);
  view.appendChild(barra);

  const griglia = el('<div class="dir-cal"></div>');
  view.appendChild(griglia);

  const pannello = el('<div class="dir-cal-giorno"></div>');
  view.appendChild(pannello);

  const coda = el('<div class="dir-cal-coda"></div>');
  view.appendChild(coda);

  // Un impegno fatto resta nel calendario solo se lo si chiede: il mese
  // serve a vedere cosa viene, e dopo qualche settimana di lavoro le
  // caselle passate sarebbero piene di roba già chiusa.
  const visibili = () => elenco.filter(i => mostraFatti || !i.fatto);

  // Come si colora una scadenza: contano prima lo stato (fatto, scaduto)
  // e poi l'importanza. Sono gli stessi colori dell'elenco, così il rosso
  // vuol dire la stessa cosa nelle due pagine.
  function classeDi(i) {
    if (i.fatto) return 'fatta';
    const g = giorniAllaScadenza(i.scadenza, oggi);
    if (g !== null && g < 0) return 'scaduta';
    return `liv-${i.importanza}`;
  }

  function disegnaGriglia() {
    const mappa = perGiorno(visibili(), oggi);
    barra.querySelector('[data-nome]').textContent = nomeMese(corrente);
    clear(griglia);

    const testa = el('<div class="dir-cal-testa"></div>');
    for (const g of GIORNI_SETTIMANA) {
      testa.appendChild(el(`<div${['sabato', 'domenica'].includes(g) ? ' class="festivo"' : ''}><abbr title="${esc(g)}">${esc(g.slice(0, 3))}</abbr></div>`));
    }
    griglia.appendChild(testa);

    const celle = el('<div class="dir-cal-celle"></div>');
    for (const c of grigliaMese(corrente, oggi)) {
      const del = mappa.get(c.iso) || [];
      const cella = el(`<div class="dir-cal-gio${c.nelMese ? '' : ' fuori'}${c.oggi ? ' oggi' : ''}${c.iso === scelto ? ' scelto' : ''}"
        aria-label="${esc(nomeGiorno(c.iso))}${del.length ? `, ${del.length} in scadenza` : ''}">
        <span class="n">${c.giorno}</span>
        <span class="pallini" aria-hidden="true"></span>
        <span class="voci"></span>
      </div>`);

      const voci = cella.querySelector('.voci');
      const pallini = cella.querySelector('.pallini');
      for (const i of del.slice(0, PER_CASELLA)) {
        voci.appendChild(el(`<span class="dir-cal-voce ${classeDi(i)}" title="${esc(i.titolo)}">${esc(i.titolo)}</span>`));
      }
      if (del.length > PER_CASELLA) {
        voci.appendChild(el(`<span class="dir-cal-altri">+${del.length - PER_CASELLA} altri</span>`));
      }
      // Sul telefono la casella è larga un dito e nessun titolo ci sta:
      // al posto delle righe restano dei pallini, che dicono comunque
      // quello che il mese deve dire — dove si accumulano le cose.
      for (const i of del.slice(0, 4)) pallini.appendChild(el(`<i class="${classeDi(i)}"></i>`));

      rendiCliccabile(cella, () => {
        scelto = c.iso;
        // Cliccare una coda di mese — il 30 settembre che sbuca in cima a
        // ottobre — porta dov'è quel giorno: altrimenti il pannello sotto
        // parlerebbe di un giorno che nella griglia non si sa più dov'è.
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
      pannello.appendChild(el('<p class="dir-cal-invito">Scegli un giorno per vedere che cosa scade, o per aggiungerci un impegno.</p>'));
      return;
    }
    const del = perGiorno(visibili(), oggi).get(scelto) || [];
    pannello.appendChild(el(`<div class="dir-cal-giorno-testa">
      <h2>${esc(nomeGiorno(scelto))}${scelto === oggi ? ' <span class="chip info">oggi</span>' : ''}</h2>
      <a class="btn sm" href="#/direttore/nuovo/${esc(scelto)}">➕ Impegno in questa data</a>
    </div>`));

    if (!del.length) {
      pannello.appendChild(el('<p class="dir-cal-invito">Nessuna scadenza in questo giorno.</p>'));
      return;
    }
    const lista = el('<div class="dir-lista"></div>');
    for (const i of del) lista.appendChild(riga(i));
    pannello.appendChild(lista);
  }

  // La riga del giorno scelto è quella dell'elenco senza il cestino: qui
  // si viene per guardare e per spuntare, non per fare pulizia — e
  // un'eliminazione data da una casella del calendario è il genere di
  // clic che si scopre di aver dato il mese dopo.
  function riga(i) {
    const sca = etichettaScadenza(i.scadenza, oggi);
    const u = livelloDi(i.urgenza), imp = livelloDi(i.importanza);
    const r = el(`<div class="dir-riga ${i.fatto ? 'fatta' : ''}">
      <button class="dir-spunta" type="button" role="checkbox" aria-checked="${i.fatto ? 'true' : 'false'}"
        title="${i.fatto ? 'Segna come da fare' : 'Segna come fatto'}">${i.fatto ? '✔' : ''}</button>
      <div class="dir-corpo">
        <div class="dir-titolo">${esc(i.titolo)}</div>
        ${i.dettagli ? `<div class="dir-dettagli">${esc(i.dettagli)}</div>` : ''}
        <div class="dir-chip">
          <span class="chip liv-${esc(i.importanza)}" title="Quanto pesa il risultato">Importanza ${esc(imp.label.toLowerCase())}</span>
          <span class="chip liv-${esc(i.urgenza)}" title="Quanto preme il tempo">Urgenza ${esc(u.label.toLowerCase())}</span>
          <span class="chip sca-${esc(sca.stato)}" title="${esc(fmtDate(i.scadenza))}">${esc(sca.testo)}</span>
          ${i.fatto && i.fatto_il ? `<span class="chip ok">fatto il ${esc(fmtDate(i.fatto_il.slice(0, 10)))}</span>` : ''}
        </div>
      </div>
      <div class="dir-azioni">
        <button class="btn ghost sm" data-mod title="Apri">✏️</button>
      </div>
    </div>`);

    r.querySelector('.dir-spunta').addEventListener('click', async () => {
      const eraFatto = !!i.fatto;
      try {
        const agg = await store.segna(i.id, !eraFatto);
        Object.assign(i, agg);
      } catch (e) { toast('Non è riuscito: ' + e.message, 'err'); return; }
      // Senza «mostra anche i fatti» la riga sparisce da sotto le dita, ma
      // il giorno scelto resta e la casella qui sopra si alleggerisce: si
      // vede che è successo qualcosa, e dove.
      toast(eraFatto ? 'Rimesso fra le cose da fare' : 'Segnato come fatto', 'ok');
      disegna();
    });
    r.querySelector('[data-mod]').addEventListener('click', () => ctx.go(`#/direttore/impegno/${i.id}`));
    rendiCliccabile(r.querySelector('.dir-corpo'), () => ctx.go(`#/direttore/impegno/${i.id}`));
    return r;
  }

  // Gli impegni senza data non hanno una casella dove stare, ma esistono:
  // dirlo qui evita di leggere un mese vuoto come «non c'è niente da fare».
  function disegnaCoda() {
    clear(coda);
    const senza = elenco.filter(i => !i.fatto && !i.scadenza).length;
    if (!senza) return;
    coda.appendChild(el(`<p class="dir-cal-invito">${senza === 1
      ? 'C’è <b>un impegno senza scadenza</b>, che non compare in nessun giorno.'
      : `Ci sono <b>${senza} impegni senza scadenza</b>, che non compaiono in nessun giorno.`}
      <a href="#/direttore/impegni">Vedili nell’elenco</a>.</p>`));
  }

  function disegna() { disegnaGriglia(); disegnaPannello(); disegnaCoda(); }

  barra.querySelector('[data-prec]').addEventListener('click', () => { corrente = spostaMese(corrente, -1); disegna(); });
  barra.querySelector('[data-succ]').addEventListener('click', () => { corrente = spostaMese(corrente, +1); disegna(); });
  barra.querySelector('[data-oggi]').addEventListener('click', () => { corrente = meseDi(oggi); scelto = oggi; disegna(); });
  barra.querySelector('#f-fatti').addEventListener('change', (e) => { mostraFatti = e.target.checked; disegna(); });

  disegna();
}
