// ============================================================
//  STAMPA / PDF del preventivo assistenze.
//  Apre una finestra con il documento impaginato sulla carta intestata
//  (ricostruita in HTML dalle immagini e dai testi del .dotx) e lancia la
//  stampa: da lì si salva in PDF o si stampa su carta.
//
//  Intestazione e piè di pagina sono in position:fixed, così il browser li
//  ripete su ogni pagina; i margini di @page lasciano loro lo spazio.
// ============================================================
import { costruisciBlocchi, nomeFile } from './documento.js';
import { caricaCarta } from './carta.js';

const esc = (s) => s == null ? '' : String(s).replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Il documento come pagina HTML completa. È separato dalla stampa vera e
// propria perché così lo si può anche mostrare in anteprima (o verificare
// fuori dal browser) senza aprire una finestra.
export async function htmlPreventivo(prev, imp) {
  const carta = await caricaCarta();
  const { blocchi } = costruisciBlocchi(prev, imp);
  return `<!doctype html><html lang="it"><head><meta charset="utf-8">
<title>${esc(nomeFile(prev, 'pdf').replace(/\.pdf$/, ''))}</title>
<style>
  @page { size: A4; margin: 42mm 18mm 32mm; }
  * { box-sizing: border-box; }
  /* Il documento è su carta bianca: senza dichiararlo, un browser impostato
     sul tema scuro lo mostra a fondo nero (e chi annulla la stampa si trova
     davanti una pagina illeggibile). */
  html { color-scheme: light; background: #fff; }
  /* Un font solo per tutto il documento, ed è quello della carta intestata
     (l'intestazione e il piè di pagina del modello Word sono in Arial): così
     PDF e Word si somigliano e la pagina non mescola due caratteri. */
  body { margin:0; background:#fff; font-family: Arial, Helvetica, sans-serif; font-size: 11pt; line-height: 1.45; color: #000; }

  /* Ripetuti su ogni pagina: stanno fuori dal flusso e occupano il margine
     lasciato libero da @page. */
  .intestazione { position: fixed; top: -34mm; left: 0; right: 0; display: flex; align-items: flex-start; gap: 10mm; }
  .intestazione img { height: 26mm; }
  .intestazione .uff { margin-left: auto; text-align: right; font-size: 9pt; color: #444; padding-top: 4mm; }
  .piede { position: fixed; bottom: -26mm; left: 0; right: 0; border-top: 1px solid #c9ced3;
           padding-top: 2mm; display: flex; align-items: flex-end; gap: 6mm; font-size: 7.5pt; color: #555; }
  .piede .righe { flex: 1; }
  .piede img { height: 9mm; }

  p { margin: 0 0 3.2mm; }
  p.piccolo { font-size: 9.5pt; }
  p.destra { text-align: right; }
  .spazio { height: 4mm; }
  h2 { font-size: 11pt; margin: 6mm 0 2.5mm; text-transform: uppercase; letter-spacing: .03em; color: #a4161a; }

  table { width: 100%; border-collapse: collapse; margin: 2mm 0 4mm; font-size: 10pt; }
  th, td { border: 1px solid #b9c0c6; padding: 1.6mm 2.2mm; vertical-align: top; }
  th { background: #f0f2f4; font-weight: 700; text-align: left; }
  td.dx, th.dx { text-align: right; white-space: nowrap; }
  td.centro, th.centro { text-align: center; }
  tr.totale td { background: #f7f8f9; }
  tr.totale.forte td { font-weight: 700; }
  /* Una tabella lunga si spezza fra le pagine ripetendo l'intestazione. */
  thead { display: table-header-group; }
  tr { break-inside: avoid; }

  /* Blocco firma rientrato a destra ma con le righe allineate a sinistra fra
     loro, come nella versione rivista del documento. */
  .firma { margin: 12mm 0 0 100mm; line-height: 1.5; }
  .firma .nome { font-weight: 700; }

  /* A schermo (chi annulla la stampa, o vuole solo rileggere il documento)
     intestazione e piè di pagina tornano nel flusso; in stampa restano nei
     margini, ripetuti su ogni pagina. Queste regole vanno DOPO quelle sopra:
     hanno la stessa specificità, quindi vince l'ultima scritta. */
  @media screen {
    body { max-width: 210mm; margin: 0 auto; padding: 10mm 14mm 14mm; }
    .intestazione, .piede { position: static; }
    .intestazione { margin-bottom: 8mm; }
    .piede { margin-top: 12mm; }
  }
</style></head><body>
<div class="intestazione">
  <img src="${carta.logo}" alt="Croce Rossa Italiana — Comitato di Genova">
  <div class="uff">Uffici amministrativi<br>${esc(carta.piede.find(r => r.includes('crigenova')) || '')}</div>
</div>
${blocchi.map(bloccoHtml).join('\n')}
<div class="piede">
  <div class="righe">${carta.piede.filter(r => !/^www\./i.test(r)).map(esc).join('<br>')}</div>
  ${carta.logoPiede ? `<img src="${carta.logoPiede}" alt="Un'Italia che aiuta">` : ''}
</div>
</body></html>`;
}

export async function stampaPreventivo(prev, imp) {
  const html = await htmlPreventivo(prev, imp);
  const finestra = window.open('', '_blank');
  if (!finestra) throw new Error('Il browser ha bloccato la finestra di stampa: consenti i popup per questo sito.');
  finestra.document.open();
  finestra.document.write(html);
  finestra.document.close();

  // La stampa si lancia da qui e non con uno <script> dentro la pagina
  // generata: la finestra eredita la CSP del portale, che gli script inline
  // non li esegue. Si aspetta il caricamento delle immagini, altrimenti la
  // prima pagina esce senza logo.
  const avvia = () => { try { finestra.focus(); finestra.print(); } catch { /* finestra chiusa dall'utente */ } };
  if (finestra.document.readyState === 'complete') setTimeout(avvia, 300);
  else finestra.addEventListener('load', () => setTimeout(avvia, 300));
}

function bloccoHtml(b) {
  if (b.t === 'spazio') return '<div class="spazio"></div>';
  if (b.t === 'titolo') return `<h2>${esc(b.testo)}</h2>`;
  if (b.t === 'p') {
    const classi = [b.piccolo ? 'piccolo' : '', b.allineamento === 'destra' ? 'destra' : ''].filter(Boolean).join(' ');
    const testo = esc(b.testo);
    return `<p${classi ? ` class="${classi}"` : ''}>${b.grassetto ? `<b>${testo}</b>` : testo}</p>`;
  }
  if (b.t === 'firma') {
    const [ruolo, nome] = [b.righe[0] || '', b.righe[1] || ''];
    return `<div class="firma"><div>${esc(ruolo)}</div><div class="nome">${esc(nome)}</div></div>`;
  }
  if (b.t === 'tabella') {
    const cl = (i) => b.allineamenti?.[i] === 'dx' ? ' class="dx"' : b.allineamenti?.[i] === 'centro' ? ' class="centro"' : '';
    const larg = (i) => b.larghezze?.[i] ? ` style="width:${b.larghezze[i]}%"` : '';
    const thead = `<thead><tr>${b.intestazioni.map((h, i) => `<th${cl(i)}${larg(i)}>${esc(h)}</th>`).join('')}</tr></thead>`;
    const righe = b.righe.map(r => `<tr>${r.map((c, i) => `<td${cl(i)}>${esc(c)}</td>`).join('')}</tr>`).join('');
    const piede = (b.piede || []).map(p =>
      `<tr class="totale${p.forte ? ' forte' : ''}">${p.celle.map((c, i) => `<td${cl(i)}>${esc(c)}</td>`).join('')}</tr>`).join('');
    return `<table>${thead}<tbody>${righe}${piede}</tbody></table>`;
  }
  return '';
}
