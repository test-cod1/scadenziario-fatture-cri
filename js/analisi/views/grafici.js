// ============================================================
//  I GRAFICI DELLA SEZIONE ANALISI — disegnati a mano in SVG.
//  La CSP del portale non ammette librerie da CDN, e per due grafici una
//  libreria intera sarebbe peso inutile.
//
//  Regole di casa, valide per tutti e due:
//  - due colori soli, sempre con lo stesso significato: blu = entrate,
//    arancio = uscite (coppia verificata per daltonismo e contrasto).
//    Il rosso CRI resta all'identità del portale e agli allarmi;
//  - ogni barra ha il suo valore al passaggio del mouse e col tasto Tab,
//    e ogni numero sta comunque anche in una tabella o in chiaro: il
//    grafico aiuta a vedere, non è l'unico posto dove leggere;
//  - il grafico si ridisegna alla larghezza vera del riquadro, così le
//    scritte restano leggibili anche sul telefono invece di rimpicciolire
//    con tutto il disegno.
// ============================================================
import { el, esc } from '../../lib/ui.js';
import { fmtEuro } from '../formato.js';

export const MESI_BREVI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
const MESI_LUNGHI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
export const nomeMese = i => MESI_LUNGHI[i];

const SVG = 'http://www.w3.org/2000/svg';
const nodo = (tag, attr = {}) => {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attr)) n.setAttribute(k, v);
  return n;
};

// Euro senza decimali per gli assi: «1.200 €» si legge, «1.200,00 €» su
// un'asse è rumore.
const euroAsse = v => `${Math.round(v).toLocaleString('it-IT', { useGrouping: 'always' })} €`;

// Il massimo dell'asse arrotondato a un numero «tondo» (1, 2, 2,5, 5 × 10^n),
// con quattro tacche: le linee di griglia cadono su cifre che si leggono.
function scala(max) {
  if (max <= 0) return { top: 100, passi: [0, 25, 50, 75, 100] };
  const grezzo = max / 4;
  const pot = 10 ** Math.floor(Math.log10(grezzo));
  const passo = [1, 2, 2.5, 5, 10].map(m => m * pot).find(p => p >= grezzo);
  return { top: passo * 4, passi: [0, 1, 2, 3, 4].map(i => i * passo) };
}

// Una barra con gli angoli arrotondati solo in cima: la base poggia
// sull'asse, e un angolo tondo anche lì la farebbe sembrare sospesa.
function barra(x, y, w, h, r = 4) {
  if (h <= 0) return '';
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

// ---------- il riquadro del valore al passaggio ----------
function tooltip(contenitore) {
  const t = el('<div class="an-tip" role="status" aria-live="polite" hidden></div>');
  contenitore.appendChild(t);
  return {
    mostra(titolo, righe, x, y) {
      t.replaceChildren();
      const h = document.createElement('div');
      h.className = 'an-tip-t';
      h.textContent = titolo;
      t.appendChild(h);
      for (const r of righe) {
        const riga = document.createElement('div');
        riga.className = 'an-tip-r';
        if (r.colore) {
          const k = document.createElement('i');
          k.style.background = r.colore;
          riga.appendChild(k);
        }
        const v = document.createElement('b');
        v.textContent = r.valore;
        const e = document.createElement('span');
        e.textContent = r.etichetta;
        riga.append(v, e);
        t.appendChild(riga);
      }
      t.hidden = false;
      // Dentro il riquadro, mai fuori dal bordo destro.
      const w = t.offsetWidth, W = contenitore.clientWidth;
      t.style.left = `${Math.max(0, Math.min(W - w, x - w / 2))}px`;
      t.style.top = `${Math.max(0, y - t.offsetHeight - 10)}px`;
    },
    nascondi() { t.hidden = true; },
  };
}

// Ridisegna alla larghezza vera del contenitore, e di nuovo quando cambia.
function aLarghezza(contenitore, disegna) {
  let ultima = 0;
  const vai = () => {
    const w = contenitore.clientWidth;
    if (!w || w === ultima) return;
    ultima = w;
    disegna(w);
  };
  if (typeof ResizeObserver === 'function') new ResizeObserver(vai).observe(contenitore);
  else window.addEventListener('resize', vai);
  // Il primo disegno con un setTimeout e non con requestAnimationFrame: in
  // una scheda in secondo piano il secondo non scatta finché la scheda non
  // torna davanti, e il grafico restava vuoto.
  setTimeout(vai, 0);
}

// ---------- entrate e uscite affiancate ----------
// `punti`: [{ etichetta, titolo, entrate, uscite }]. Un gruppo di due barre
// per punto; la zona sensibile è tutta la colonna del punto, non la sola
// barra — si punta a «marzo», non a una barra larga otto pixel.
export function graficoAndamento(punti, { titolo = '', mostraEntrate = true } = {}) {
  const box = el(`<div class="an-graf">
    <div class="an-graf-testa">
      <div class="an-graf-titolo">${esc(titolo)}</div>
      ${mostraEntrate ? `<div class="an-legenda">
        <span><i class="entrate"></i>Entrate</span>
        <span><i class="uscite"></i>Uscite</span>
      </div>` : ''}
    </div>
    <div class="an-graf-area"></div>
  </div>`);
  const area = box.querySelector('.an-graf-area');
  const tip = tooltip(area);
  const serie = mostraEntrate ? ['entrate', 'uscite'] : ['uscite'];

  aLarghezza(area, W => {
    area.querySelector('svg')?.remove();
    tip.nascondi();
    const H = 200, alto = 10, basso = 26;
    const strette = W < 520;
    const sinistra = strette ? 52 : 64;
    const max = Math.max(0, ...punti.flatMap(p => serie.map(s => p[s])));
    const { top, passi } = scala(max);
    const larg = W - sinistra - 4;
    const slot = larg / punti.length;
    const gap = 2;
    const barW = Math.max(3, Math.min(28, (slot * 0.72 - gap * (serie.length - 1)) / serie.length));
    const y = v => alto + H - (v / top) * H;

    const svg = nodo('svg', { width: W, height: H + alto + basso, role: 'img', 'aria-label': titolo });
    for (const p of passi) {
      svg.appendChild(nodo('line', { x1: sinistra, x2: W - 4, y1: y(p), y2: y(p), class: p ? 'an-griglia' : 'an-asse' }));
      const t = nodo('text', { x: sinistra - 8, y: y(p) + 4, 'text-anchor': 'end', class: 'an-asse-t' });
      t.textContent = euroAsse(p);
      svg.appendChild(t);
    }
    punti.forEach((p, i) => {
      const x0 = sinistra + i * slot;
      const gruppoW = barW * serie.length + gap * (serie.length - 1);
      serie.forEach((s, j) => {
        const v = p[s];
        if (v <= 0.005) return;
        const h = Math.max(1, H - (y(v) - alto));
        svg.appendChild(nodo('path', { d: barra(x0 + (slot - gruppoW) / 2 + j * (barW + gap), y(v), barW, h), class: `an-barra ${s}`, 'data-i': i }));
      });
      // Le etichette dei mesi: sul telefono una sì e una no, se non ci stanno.
      if (!strette || punti.length <= 6 || i % 2 === 0) {
        const t = nodo('text', { x: x0 + slot / 2, y: alto + H + 18, 'text-anchor': 'middle', class: 'an-asse-t' });
        t.textContent = p.etichetta;
        svg.appendChild(t);
      }
      const zona = nodo('rect', { x: x0, y: alto, width: slot, height: H, class: 'an-zona', tabindex: 0,
        'aria-label': `${p.titolo}: ${serie.map(s => `${s} ${fmtEuro(p[s])}`).join(', ')}` });
      const accendi = () => {
        svg.querySelectorAll('.an-barra').forEach(b => b.classList.toggle('spenta', b.dataset.i !== String(i)));
        tip.mostra(p.titolo, serie.map(s => ({ colore: `var(--an-${s})`, valore: fmtEuro(p[s]), etichetta: s === 'entrate' ? 'Entrate' : 'Uscite' })),
          x0 + slot / 2, Math.min(...serie.map(s => y(p[s]))));
      };
      const spegni = () => { svg.querySelectorAll('.an-barra').forEach(b => b.classList.remove('spenta')); tip.nascondi(); };
      zona.addEventListener('pointerenter', accendi);
      zona.addEventListener('pointerleave', spegni);
      zona.addEventListener('focus', accendi);
      zona.addEventListener('blur', spegni);
      svg.appendChild(zona);
    });
    area.prepend(svg);
  });
  return box;
}

// ---------- dove vanno i soldi: una barra per categoria ----------
// Barre orizzontali di un colore solo: l'identità la dà il nome scritto
// accanto, non il colore. Ogni riga porta importo e quota in chiaro.
export function graficoCategorie(righe, { titolo = '', tipo = 'uscita' } = {}) {
  const box = el(`<div class="an-graf">
    <div class="an-graf-testa"><div class="an-graf-titolo">${esc(titolo)}</div></div>
    <div class="an-cat"></div>
  </div>`);
  const lista = box.querySelector('.an-cat');
  const max = Math.max(0.01, ...righe.map(r => r.importo));
  for (const r of righe) {
    const w = Math.max(0.5, (r.importo / max) * 100);
    const riga = el(`<div class="an-cat-r${r.senza ? ' senza' : ''}" tabindex="0">
      <span class="an-cat-n"></span>
      <span class="an-cat-b"><i class="${tipo === 'entrata' ? 'entrate' : 'uscite'}" style="width:${w.toFixed(1)}%"></i></span>
      <b class="an-cat-v">${esc(fmtEuro(r.importo))}</b>
      <span class="an-cat-q">${(r.quota * 100).toLocaleString('it-IT', { maximumFractionDigits: 1 })}%</span>
    </div>`);
    riga.querySelector('.an-cat-n').textContent = r.categoria;
    riga.title = `${r.categoria}: ${fmtEuro(r.importo)} · ${r.n} ${r.n === 1 ? 'movimento' : 'movimenti'}`;
    lista.appendChild(riga);
  }
  return box;
}

// ---------- la tabella anno per anno ----------
// Ogni riga è cliccabile e porta il filtro su quell'anno: è il modo più
// corto per passare dal confronto al dettaglio.
export function tabellaAnni(righe, annoScelto, alClic, { mostraEntrate = true } = {}) {
  const pct = v => v == null ? '—'
    : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v * 100).toLocaleString('it-IT', { maximumFractionDigits: 0 })}%`;
  const box = el(`<div class="an-graf">
    <div class="an-graf-testa"><div class="an-graf-titolo">Anno per anno</div></div>
    <div class="an-anni-wrap"><table class="tbl an-anni">
      <thead><tr><th>Anno</th>${mostraEntrate ? '<th class="num">Entrate</th>' : ''}<th class="num">Uscite</th>
        <th class="num" title="Uscite rispetto all'anno prima">Uscite vs anno prima</th>
        ${mostraEntrate ? '<th class="num">Saldo</th>' : ''}<th class="num">Movimenti</th></tr></thead>
      <tbody></tbody>
    </table></div>
  </div>`);
  const corpo = box.querySelector('tbody');
  for (const r of righe) {
    const tr = el(`<table><tr class="${r.anno && r.anno === annoScelto ? 'scelto' : ''}${r.anno ? ' cliccabile' : ''}"
        ${r.anno ? 'tabindex="0"' : ''} title="${r.anno ? `Mostra solo il ${esc(r.anno)}` : 'Movimenti a cui manca la data'}">
      <td><b>${r.anno ? esc(r.anno) : 'Senza data'}</b></td>
      ${mostraEntrate ? `<td class="num">${esc(fmtEuro(r.entrate))}</td>` : ''}
      <td class="num">${esc(fmtEuro(r.uscite))}</td>
      <td class="num muted">${pct(r.varUscite)}</td>
      ${mostraEntrate ? `<td class="num${r.saldo < 0 ? ' neg' : ''}">${esc(fmtEuro(r.saldo))}</td>` : ''}
      <td class="num">${r.nEntrate + r.nUscite}</td>
    </tr></table>`).querySelector('tr');
    if (r.anno) {
      const vai = () => alClic(r.anno === annoScelto ? '' : r.anno);
      tr.addEventListener('click', vai);
      tr.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); vai(); } });
    }
    corpo.appendChild(tr);
  }
  return box;
}

// ---------- l'intestazione di un anno nell'elenco dei movimenti ----------
// L'anno in grande, quanti movimenti a parole («8 movimenti», non «· 8»,
// che non si capiva cosa contasse) e il totale allineato a destra. La usa
// anche la pagina pubblica del link, così le due restano uguali.
export function intestazioneAnno(anno, n, somma) {
  return el(`<div class="cc-anno">
    <span class="cc-anno-a">${anno ? esc(anno) : 'Senza data'}</span>
    <span class="cc-anno-n">${n} ${n === 1 ? 'movimento' : 'movimenti'}</span>
    <b class="cc-anno-t">${esc(fmtEuro(somma))}</b>
  </div>`);
}
