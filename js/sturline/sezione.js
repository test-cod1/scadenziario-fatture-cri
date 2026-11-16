// ============================================================
//  SEZIONE PROGETTO STURLINE — punto di ingresso.
//  Il recupero delle due ville di Via Sturla: le idee su chi contattare
//  e dove cercare i fondi, ordinate per argomento. È una sezione da
//  leggere, senza dati sul database: i contenuti stanno in ./dati.js.
//
//  Ogni pagina ha la sua ricerca; quella della Panoramica cerca in tutto.
// ============================================================
import { el, esc } from '../lib/ui.js';
import { CAPITOLI, PAGINE, contaVoci } from './dati.js';

const capitolo = (id) => CAPITOLI.find(c => c.id === id);

export async function renderSturline(view, ctx, sub) {
  const pagina = PAGINE.find(p => p.id === sub) || PAGINE[0];
  if (pagina.id === 'panoramica') return renderPanoramica(view, pagina);
  return renderPagina(view, pagina);
}

// Testo su cui cerca il filtro: nome, descrizione e sottovoci, senza
// maiuscole né accenti.
const normalizza = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function htmlVoce([nome, testo, sotto]) {
  const cerca = normalizza([nome, testo, ...(sotto || []).flat()].join(' '));
  return `<li class="stl-voce" data-cerca="${esc(cerca)}">
    <b>${esc(nome)}</b><span class="stl-testo">${esc(testo)}</span>
    ${sotto ? `<ul class="stl-sotto">${sotto.map(([n, t]) => `<li data-cerca="${esc(normalizza(n + ' ' + t))}"><b>${esc(n)}</b> — ${esc(t)}</li>`).join('')}</ul>` : ''}
  </li>`;
}

function htmlCapitolo(c) {
  return `<section class="card stl-capitolo" id="stl-${esc(c.id)}"><div class="card-b">
    <h2>${esc(c.titolo)} <span class="chip">${contaVoci(c)}</span></h2>
    ${c.nota ? `<p class="hint stl-nota">${esc(c.nota)}</p>` : ''}
    ${c.gruppi.map(g => `<div class="stl-gruppo">
      ${g.titolo ? `<h3>${esc(g.titolo)}</h3>` : ''}
      <ul class="stl-voci">${g.voci.map(htmlVoce).join('')}</ul>
    </div>`).join('')}
  </div></section>`;
}

const htmlCerca = (segnaposto) => `<div class="search stl-cerca"><span class="search-icon" aria-hidden="true">🔍</span>
  <input type="search" placeholder="${esc(segnaposto)}" aria-label="Cerca"></div>`;

// Nasconde voci, gruppi e capitoli che non contengono tutte le parole
// cercate. Una sottovoce che corrisponde tiene visibile la voce madre e,
// se la ricerca è attiva, nasconde le sorelle che non c'entrano.
function filtra(radice, testo) {
  const parole = normalizza(testo).split(/\s+/).filter(Boolean);
  const ok = (s) => parole.every(p => s.includes(p));
  let trovate = 0;
  for (const cap of radice.querySelectorAll('.stl-capitolo')) {
    let visibiliCap = 0;
    for (const g of cap.querySelectorAll('.stl-gruppo')) {
      let visibiliGr = 0;
      for (const v of g.querySelectorAll('.stl-voce')) {
        const sotto = [...v.querySelectorAll('.stl-sotto li')];
        const testaOk = ok(normalizza(v.querySelector('b').textContent + ' ' + v.querySelector('.stl-testo').textContent));
        let sottoOk = 0;
        for (const s of sotto) {
          const vis = !parole.length || testaOk || ok(s.dataset.cerca);
          s.hidden = !vis;
          if (vis) sottoOk++;
        }
        const vis = !parole.length || testaOk || sottoOk > 0;
        v.hidden = !vis;
        if (vis) { visibiliGr++; trovate++; }
      }
      g.hidden = !visibiliGr;
      visibiliCap += visibiliGr;
    }
    cap.hidden = !visibiliCap;
  }
  return trovate;
}

function collegaRicerca(pagina, radice, quandoCambia) {
  const input = pagina.querySelector('.stl-cerca input');
  const vuoto = pagina.querySelector('.stl-vuoto');
  input.addEventListener('input', () => {
    const attiva = input.value.trim() !== '';
    quandoCambia?.(attiva);
    vuoto.hidden = filtra(radice, input.value) > 0;
  });
}

function renderPagina(view, pagina) {
  const capitoli = pagina.capitoli.map(capitolo);
  const indice = capitoli.length > 1
    ? `<nav class="stl-indice" aria-label="Capitoli">${capitoli.map(c => `<a href="#" data-vai="stl-${esc(c.id)}">${esc(c.titolo)}</a>`).join('')}</nav>`
    : '';
  const nodo = el(`<div>
    <div class="page-head"><div>
      <h1>${esc(pagina.label)}</h1>
      <p>${esc(pagina.intro)}</p>
    </div></div>
    ${htmlCerca('Cerca un nome o una parola…')}
    ${indice}
    <div class="stl-capitoli">${capitoli.map(htmlCapitolo).join('')}</div>
    <p class="stl-vuoto empty-state" hidden>Nessuna voce trovata.</p>
  </div>`);
  // I collegamenti dell'indice scorrono al capitolo senza toccare
  // l'indirizzo, che il router usa per le rotte.
  nodo.querySelectorAll('[data-vai]').forEach(a => a.addEventListener('click', (e) => {
    e.preventDefault();
    nodo.querySelector('#' + a.dataset.vai)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
  collegaRicerca(nodo, nodo.querySelector('.stl-capitoli'));
  view.appendChild(nodo);
}

function renderPanoramica(view, pagina) {
  const altre = PAGINE.filter(p => p.id !== 'panoramica');
  const totale = CAPITOLI.reduce((n, c) => n + contaVoci(c), 0);
  const nodo = el(`<div>
    <div class="page-head"><div>
      <h1>Progetto Sturline</h1>
      <p>${esc(pagina.intro)} ${totale} voci in ${CAPITOLI.length} capitoli.</p>
    </div></div>
    ${htmlCerca('Cerca in tutto il progetto: Gaslini, Art Bonus, Rotary…')}
    <div class="stl-riepilogo">
      ${htmlCapitolo(capitolo('contatti'))}
      <div class="stl-mappa">
        ${altre.map(p => {
          const caps = p.capitoli.map(capitolo);
          const n = caps.reduce((s, c) => s + contaVoci(c), 0);
          return `<a class="card stl-tessera" href="#/sturline/${esc(p.id)}">
            <span class="stl-tessera-ico" aria-hidden="true">${p.icon}</span>
            <span class="stl-tessera-testo"><b>${esc(p.label)}</b>
              <span>${esc(p.intro)}</span>
              <span class="stl-tessera-n">${n} voci${caps.length > 1 ? ` · ${caps.length} capitoli` : ''}</span></span>
          </a>`;
        }).join('')}
      </div>
    </div>
    <div class="stl-capitoli stl-tutti" hidden>${CAPITOLI.map(htmlCapitolo).join('')}</div>
    <p class="stl-vuoto empty-state" hidden>Nessuna voce trovata.</p>
  </div>`);
  // Con la ricerca attiva la panoramica lascia il posto a tutti i capitoli
  // filtrati; svuotandola torna com'era.
  const riepilogo = nodo.querySelector('.stl-riepilogo');
  const tutti = nodo.querySelector('.stl-tutti');
  collegaRicerca(nodo, tutti, (attiva) => { riepilogo.hidden = attiva; tutti.hidden = !attiva; });
  view.appendChild(nodo);
}
