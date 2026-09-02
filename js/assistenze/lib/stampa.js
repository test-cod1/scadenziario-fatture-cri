// ============================================================
//  STAMPA / PDF del preventivo assistenze.
//  Apre una finestra con il documento impaginato sulla carta intestata
//  (ricostruita in HTML dalle immagini e dai testi del .dotx) e lancia la
//  stampa: da lì si salva in PDF o si stampa su carta.
//
//  Intestazione e piè di pagina si ripetono su ogni foglio perché il
//  documento è dentro un'unica tabella e stanno nel suo thead/tfoot: è
//  l'unico modo che i browser rispettano davvero in stampa (vedi il commento
//  nel CSS).
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
  /* Margini della carta ufficiale: intestazione e piè arrivano più vicini al
     bordo (8 mm) di quanto faccia il testo, che rientra di altri 7 mm — così
     il logo e i dati dell'ente stanno dove stanno sulla carta stampata. */
  @page { size: A4; margin: 6mm 8mm 8mm; }
  * { box-sizing: border-box; }
  /* Il documento è su carta bianca: senza dichiararlo, un browser impostato
     sul tema scuro lo mostra a fondo nero (e chi annulla la stampa si trova
     davanti una pagina illeggibile). */
  html { color-scheme: light; background: #fff; }
  /* Un font solo per tutto il documento, ed è quello della carta intestata
     (l'intestazione e il piè di pagina del modello Word sono in Arial): così
     PDF e Word si somigliano e la pagina non mescola due caratteri. */
  body { margin:0; background:#fff; font-family: Arial, Helvetica, sans-serif; font-size: 11pt; line-height: 1.45; color: #000; }

  /* Carta intestata ripetuta su ogni pagina.
     Prima intestazione e piè erano in position:fixed dentro i margini di
     @page: a schermo si vedevano, in stampa il browser li tagliava — il PDF
     usciva senza carta intestata. La via che i browser rispettano davvero è
     l'intestazione di tabella: il contenuto sta in un'unica tabella che
     occupa la pagina, e thead/tfoot vengono ripetuti in cima e in fondo a
     ogni foglio, riservandosi anche lo spazio (cosa che un elemento fixed
     non fa, e per questo si sovrapponeva al testo). */
  table.foglio { width: 100%; border-collapse: collapse; }
  table.foglio > thead { display: table-header-group; }
  table.foglio > tfoot { display: table-footer-group; }
  table.foglio > thead > tr > td,
  table.foglio > tbody > tr > td,
  table.foglio > tfoot > tr > td { border: 0; padding: 0; }
  table.foglio > tbody > tr > td { padding: 0 7mm; }

  /* Disposizione presa dalla carta intestata ufficiale del Comitato: in alto
     a destra il nome in grassetto con il logo alla sua destra; in basso a
     sinistra l'indirizzo del sito e il logo "Un'Italia che aiuta", a destra i
     dati dell'ente allineati a destra. */
  .intestazione { display: flex; align-items: center; justify-content: flex-end; gap: 4mm; padding-bottom: 9mm; }
  .intestazione .ente { text-align: right; font-weight: 700; font-size: 12pt; line-height: 1.3; }
  .intestazione img { height: 43mm; }
  .piede { margin-top: 10mm; display: flex; align-items: flex-end; gap: 8mm; font-size: 9pt; }
  .piede .sito { color: #cc0000; font-weight: 700; margin-bottom: 2mm; }
  .piede img { height: 9.5mm; display: block; }
  .piede .righe { flex: 1; text-align: right; line-height: 1.35; }

  p { margin: 0 0 3.2mm; }
  p.piccolo { font-size: 9.5pt; }
  p.destra { text-align: right; }
  .spazio { height: 4mm; }
  h2 { font-size: 11pt; margin: 6mm 0 2.5mm; text-transform: uppercase; letter-spacing: .03em; color: #a4161a; }

  /* table-layout:fixed è la ragione per cui adesso il calendario non esce
     più dal foglio: con la disposizione automatica, nove colonne (una per
     voce del tariffario) chiedevano più larghezza della pagina e in stampa
     venivano semplicemente tagliate, perché sulla carta non c'è nessuno
     scorrimento orizzontale. Così invece le colonne si comprimono e il testo
     va a capo. */
  table.dati { width: 100%; table-layout: fixed; border-collapse: collapse; margin: 2mm 0 4mm; font-size: 10pt; }
  table.dati th, table.dati td { border: 1px solid #b9c0c6; padding: 1.6mm 2.2mm; vertical-align: top; overflow-wrap: break-word; }
  /* Con quattro o più voci il calendario ha molte colonne: rimpicciolire il
     corpo costa meno che vedere "16/11/20 26" spezzato in due righe. */
  table.dati.compatta { font-size: 8.5pt; }
  table.dati.compatta th, table.dati.compatta td { padding: 1.2mm 1.4mm; }
  /* Le intestazioni sono i testi più lunghi della tabella (i nomi delle voci):
     un corpo più piccolo solo per loro evita che vengano spezzate a metà
     parola, senza toccare la leggibilità dei dati. */
  table.dati.compatta th { font-size: 7.5pt; }
  table.dati th { background: #f0f2f4; font-weight: 700; text-align: left; }
  table.dati td.dx, table.dati th.dx { text-align: right; }
  table.dati td.centro, table.dati th.centro { text-align: center; }
  table.dati tr.totale td { background: #f7f8f9; }
  table.dati tr.totale.forte td { font-weight: 700; }
  /* Una tabella lunga si spezza fra le pagine ripetendo l'intestazione. */
  table.dati thead { display: table-header-group; }
  table.dati tr { break-inside: avoid; }
  /* Gli sfondi delle intestazioni di tabella si stampano solo se lo si
     chiede: per impostazione predefinita il browser li omette. */
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  /* Blocco firma rientrato a destra ma con le righe allineate a sinistra fra
     loro, come nella versione rivista del documento. */
  .firma { margin: 12mm 0 0 100mm; line-height: 1.5; }
  .firma .nome { font-weight: 700; }

  /* A schermo (chi annulla la stampa, o vuole solo rileggere il documento) la
     pagina si comporta come un foglio A4 centrato. */
  @media screen {
    body { max-width: 210mm; margin: 0 auto; padding: 6mm 8mm 8mm; }
  }
</style></head><body>
<table class="foglio"><thead><tr><td>
  <div class="intestazione">
    <div class="ente">${carta.intestazione.map(esc).join('<br>')}</div>
    <img src="${carta.logo}" alt="Croce Rossa Italiana — Comitato di Genova">
  </div>
</td></tr></thead>
<tfoot><tr><td>
  <div class="piede">
    <div class="sinistra">
      <div class="sito">${esc(carta.sito)}</div>
      ${carta.logoPiede ? `<img src="${carta.logoPiede}" alt="Un'Italia che aiuta">` : ''}
    </div>
    <div class="righe">${carta.piede.map(esc).join('<br>')}</div>
  </div>
</td></tr></tfoot>
<tbody><tr><td>
${blocchi.map(bloccoHtml).join('\n')}
</td></tr></tbody></table>
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
    return `<table class="dati${b.compatta ? ' compatta' : ''}">${thead}<tbody>${righe}${piede}</tbody></table>`;
  }
  return '';
}
