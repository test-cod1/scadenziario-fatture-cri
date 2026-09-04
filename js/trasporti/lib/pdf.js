// ============================================================
//  GENERAZIONE PREVENTIVO STAMPABILE (PDF via stampa del browser)
//  Apre una finestra con il documento formattato e lancia la stampa:
//  l'utente può salvarlo come PDF o stamparlo su carta.
// ============================================================
import { calcola } from '../calc.js';
import { CONFIG } from '../config.js';

const euro = (n) => (n === null || n === undefined || !Number.isFinite(Number(n)))
  ? '—' : Number(n).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const num = (n, d = 0) => Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d });
const esc = (s) => s == null ? '' : String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dt = (iso) => { if (!iso) return ''; const d = new Date(iso); return isNaN(d) ? iso : d.toLocaleDateString('it-IT'); };

export function stampaPreventivo(prev, imp, { intestazione } = {}) {
  const r = calcola(prev.input || {}, imp);
  const inp = prev.input || {};

  // andata_ritorno è una colonna di `prev`, non un campo di `prev.input`: la
  // riga "Km totali" lo leggeva da `inp`, dove è sempre undefined, e il
  // documento consegnato al cliente diceva "(a/r)" anche per una sola andata
  // — mentre l'itinerario, che lo legge dal posto giusto, non riportava il
  // rientro. Si ricava una volta sola qui, così le due parti non possono più
  // raccontare cose diverse.
  const andataRitorno = prev.andata_ritorno !== false;

  // Itinerario completo: partenza -> tappe -> (rientro se a/r)
  const part = prev.partenza || (prev.input && prev.input.partenza) || CONFIG.partenza;
  const dest = (prev.tappe || []).filter(t => t && t.label);
  const itinerario = [{ label: part.label }, ...dest];
  if (andataRitorno) itinerario.push({ label: part.label + ' (rientro)' });

  const righeTappe = itinerario.map((t, i) =>
    `<tr><td>${i === 0 ? 'Partenza' : (i === itinerario.length - 1 ? 'Arrivo' : 'Tappa ' + i)}</td><td>${esc(t.label)}</td></tr>`
  ).join('');

  const righeMateriale = (inp.materiale || []).filter(m => m.desc || m.importo)
    .map(m => `<tr><td>${esc(m.desc || 'Materiale')}</td><td class="r">${euro(m.importo)}</td></tr>`).join('');

  const voce = (label, val, show = true) => show ? `<tr><td>${label}</td><td class="r">${euro(val)}</td></tr>` : '';

  const html = `<!doctype html><html lang="it"><head><meta charset="utf-8">
<title>Preventivo ${esc(prev.titolo || '')}</title>
<style>
  @page { margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color:#1c2024; font-size:12px; line-height:1.5; }
  .head { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #e30613; padding-bottom:12px; margin-bottom:18px; }
  .logo { width:44px;height:44px;background:#e30613;color:#fff;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:800; }
  h1 { font-size:19px; margin:0 0 2px; }
  .muted { color:#5a6570; }
  .org { text-align:right; font-size:11px; color:#5a6570; }
  h2 { font-size:13px; text-transform:uppercase; letter-spacing:.04em; color:#b10410; margin:20px 0 8px; border-bottom:1px solid #e4e8ec; padding-bottom:4px;}
  table { width:100%; border-collapse:collapse; }
  td { padding:5px 6px; border-bottom:1px solid #eef1f4; vertical-align:top; }
  td.r { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
  .grid2 { display:flex; gap:24px; }
  .grid2 > div { flex:1; }
  .tot { display:flex; gap:14px; margin-top:8px; }
  .tot .box { flex:1; border:1px solid #e4e8ec; border-radius:10px; padding:12px 14px; }
  .tot .box.addebito { border-color:#1c2024; background:#1c2024; }
  .tot .k { font-size:10.5px; text-transform:uppercase; letter-spacing:.03em; color:#5a6570; }
  .tot .v { font-size:22px; font-weight:800; margin-top:3px; }
  .tot .box.addebito .k { color:rgba(255,255,255,.75); }
  .tot .box.addebito .v { color:#fff; font-size:26px; }
  .foot { margin-top:26px; font-size:10.5px; color:#5a6570; border-top:1px solid #e4e8ec; padding-top:10px; }
  .note { white-space:pre-wrap; }
</style></head><body>
  <div class="head">
    <div style="display:flex;gap:12px;align-items:center">
      <div class="logo">✚</div>
      <div>
        <h1>Preventivo trasporto sanitario</h1>
        <div class="muted">${esc(prev.titolo || 'Servizio fuori Genova')}</div>
      </div>
    </div>
    <div class="org">
      <b>${esc(intestazione?.nome || 'Croce Rossa Italiana')}</b><br>
      ${esc(intestazione?.riga2 || 'Corso Aldo Gastaldi 11, Genova')}<br>
      Data: ${dt(prev.created_at || new Date().toISOString())}
    </div>
  </div>

  <div class="grid2">
    <div>
      <h2>Dati servizio</h2>
      <table>
        <tr><td class="muted">Km totali</td><td>${num(inp.kmTotali)} km${andataRitorno ? ' (a/r)' : ' (sola andata)'}</td></tr>
        <tr><td class="muted">Mezzo</td><td>${esc(mezzoNome(inp, imp))} · ${num(r.consumo, 1)} km/l · ${esc(inp.alimentazione || '')}</td></tr>
        <tr><td class="muted">Equipaggio</td><td>${num(inp.persone)} persone</td></tr>
        ${inp.notti ? `<tr><td class="muted">Pernottamento</td><td>${num(inp.notti)} notti</td></tr>` : ''}
      </table>
    </div>
    <div>
      <h2>Itinerario</h2>
      <table>${righeTappe || '<tr><td class="muted">Nessuna tappa indicata</td></tr>'}</table>
    </div>
  </div>

  <h2>Dettaglio costi</h2>
  <table>
    ${voce(`Carburante — ${num(r.litri, 1)} l × ${euro(inp.prezzoCarburante)}/l`, r.carburante, r.carburante > 0)}
    ${voce(`Pasti — ${num(inp.persone)}×${num(inp.pastiPersona)} × ${euro(inp.pastoCosto)}`, r.pasti, r.pasti > 0)}
    ${voce('Pernottamento', r.pernottamento, r.pernottamento > 0)}
    ${voce('Pedaggi / vignette (estero)', r.pedaggi, r.pedaggi > 0)}
    ${voce(inp.medicoOre ? `Medico — ${num(inp.medicoOre, 1)} h × ${euro(inp.medicoOraria)}/h` : 'Medico', r.medico, r.medico > 0)}
    ${voce(inp.medicoOre ? `Infermiere — ${num(inp.medicoOre, 1)} h × ${euro(inp.infermiereOraria)}/h` : 'Infermiere', r.infermiere, r.infermiere > 0)}
    ${righeMateriale}
    <tr><td><b>Spesa reale (costo vivo)</b></td><td class="r"><b>${euro(r.spesaReale)}</b></td></tr>
  </table>

  <h2>Importo richiesto</h2>
  <table>
    <tr><td>Percorrenza — ${num(inp.kmTotali)} km × ${euro(inp.tariffaKm)}/km</td><td class="r">${euro(r.addebitoKm)}</td></tr>
    <tr><td>Voci a rimborso (pasti, pernottamento, ecc.)</td><td class="r">${euro(r.passthrough)}</td></tr>
  </table>
  <div class="tot">
    <div class="box"><div class="k">Spesa reale</div><div class="v">${euro(r.spesaReale)}</div></div>
    <div class="box addebito"><div class="k">Totale</div><div class="v">${euro(r.addebito)}</div></div>
  </div>

  ${prev.note ? `<h2>Note</h2><div class="note">${esc(prev.note)}</div>` : ''}

  <div class="foot">
    Preventivo indicativo. I prezzi del carburante sono medie nazionali di riferimento e possono variare.
    Documento generato il ${new Date().toLocaleString('it-IT')}.
  </div>
</body></html>`;

  const w = window.open('', '_blank');
  if (!w) { alert('Consenti le finestre popup per stampare il preventivo.'); return; }
  w.document.open();
  w.document.write(html);
  w.document.close();
  // La stampa si lancia da qui e NON da uno <script> dentro la pagina
  // generata: la finestra aperta con window.open('') eredita la Content
  // Security Policy del portale, che non esegue script inline — quel
  // `<script>window.onload = () => window.print()</script>` veniva bloccato in
  // silenzio e la finestra di stampa non si apriva mai. È lo stesso
  // accorgimento già preso in js/lib/export.js e nella stampa delle
  // assistenze; qui era rimasto indietro.
  const avvia = () => { try { w.focus(); w.print(); } catch { /* finestra chiusa dall'utente */ } };
  if (w.document.readyState === 'complete') setTimeout(avvia, 300);
  else w.addEventListener('load', () => setTimeout(avvia, 300));
}

function mezzoNome(inp, imp) {
  const m = (imp.mezzi || []).find(x => x.id === inp.mezzoId);
  return m ? m.nome : (inp.mezzoId || '');
}
