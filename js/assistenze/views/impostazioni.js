import { impostazioni } from '../data/store.js';
import { el, clear, esc, toast } from '../../lib/ui.js';

// ============================================================
//  IMPOSTAZIONI DELLE ASSISTENZE
//  Due cose: il tariffario (le voci che si possono mettere in un preventivo)
//  e i testi fissi del documento. Stanno insieme perché sono entrambi "come
//  facciamo i preventivi", e li tocca la stessa persona.
// ============================================================

const ETICHETTE_TESTI = {
  premessa: ['Premessa', 'La frase che introduce l\'elenco delle voci.'],
  iva: ['Regime IVA', 'Riga che compare sotto il totale.'],
  banca: ['Riferimenti bancari', ''],
  mezzi: ['Mezzi e personale', 'Il paragrafo sui requisiti del servizio.'],
  privacy: ['Trattamento dei dati', 'Una riga per punto elenco: vanno a capo anche nel documento.'],
  chiusura: ['Chiusura', 'I saluti finali, prima della firma.'],
};

export async function renderImpostazioni(view, ctx) {
  const imp = structuredClone(ctx.imp);

  view.appendChild(el(`<div class="page-head">
    <div><h1>Impostazioni</h1><p>Tariffario e testi del preventivo di assistenza</p></div>
    <button class="btn primary" id="save">💾 Salva impostazioni</button>
  </div>`));

  // ---------- tariffario ----------
  const cTar = el(`<div class="card" style="margin-bottom:18px">
    <div class="card-h">Tariffario</div>
    <div class="card-b">
      <p class="hint" style="margin:0 0 14px">Le voci che si possono mettere in un preventivo. Una voce <b>a ore</b> si moltiplica per la durata dei turni; una <b>a prezzo fisso</b> vale una volta per turno, indipendentemente dalla durata (es. il gazebo). Il prezzo qui è quello proposto: dentro il singolo preventivo resta modificabile.</p>
      <div id="tariffe"></div>
      <button class="btn sm" id="add-voce" type="button" style="margin-top:12px">➕ Aggiungi voce</button>
    </div></div>`);
  view.appendChild(cTar);

  function disegnaTariffe() {
    const zona = cTar.querySelector('#tariffe');
    clear(zona);
    imp.tariffe.forEach((t, i) => {
      const riga = el(`<div class="mezzo-row">
        <div class="form-row three">
          <div class="field"><label>Nome</label><input type="text" value="${esc(t.nome)}"></div>
          <div class="field"><label>Tipo</label><select>
            <option value="oraria" ${t.tipo !== 'fissa' ? 'selected' : ''}>A ore (€/ora)</option>
            <option value="fissa" ${t.tipo === 'fissa' ? 'selected' : ''}>A prezzo fisso (€ per turno)</option>
          </select></div>
          <div class="field"><label>Prezzo (€)</label><input type="number" min="0" step="0.5" value="${t.prezzo}"></div>
        </div>
        <button class="rm btn ghost sm" type="button">✕ Rimuovi voce</button>
      </div>`);
      const [nome, prezzo] = riga.querySelectorAll('input');
      const tipo = riga.querySelector('select');
      nome.addEventListener('input', () => { t.nome = nome.value; });
      tipo.addEventListener('change', () => { t.tipo = tipo.value; });
      prezzo.addEventListener('input', () => { t.prezzo = Number(prezzo.value) || 0; });
      riga.querySelector('.rm').addEventListener('click', () => { imp.tariffe.splice(i, 1); disegnaTariffe(); });
      zona.appendChild(riga);
    });
    if (!imp.tariffe.length) zona.appendChild(el('<p class="muted">Nessuna voce: aggiungine almeno una.</p>'));
  }
  disegnaTariffe();
  cTar.querySelector('#add-voce').addEventListener('click', () => {
    imp.tariffe.push({ id: 'v' + Date.now(), nome: 'Nuova voce', tipo: 'oraria', prezzo: 0 });
    disegnaTariffe();
  });

  // ---------- firma ----------
  view.appendChild(el(`<div class="card" style="margin-bottom:18px">
    <div class="card-h">Firma</div><div class="card-b">
      <p class="hint" style="margin:0 0 14px">Le due righe in fondo al preventivo, sopra lo spazio per la firma.</p>
      <div class="form-row">
        <div class="field"><label>Ruolo</label><input type="text" id="f-ruolo" value="${esc(imp.firma.ruolo || '')}"></div>
        <div class="field"><label>Nome</label><input type="text" id="f-nome" value="${esc(imp.firma.nome || '')}"></div>
      </div>
    </div></div>`));
  for (const [campo, chiave] of [['f-ruolo', 'ruolo'], ['f-nome', 'nome']]) {
    view.querySelector('#' + campo).addEventListener('input', (e) => { imp.firma[chiave] = e.target.value; });
  }

  // ---------- testi ----------
  const cTesti = el(`<div class="card" id="testi"><div class="card-h">Testi fissi del documento</div><div class="card-b"></div></div>`);
  view.appendChild(cTesti);
  const corpo = cTesti.querySelector('.card-b');
  for (const [chiave, [etichetta, aiuto]] of Object.entries(ETICHETTE_TESTI)) {
    const campo = el(`<div class="field">
      <label>${esc(etichetta)}</label>
      <textarea rows="${chiave === 'privacy' ? 7 : 3}">${esc(imp.testi[chiave] || '')}</textarea>
      ${aiuto ? `<div class="hint">${esc(aiuto)}</div>` : ''}
    </div>`);
    campo.querySelector('textarea').addEventListener('input', (e) => { imp.testi[chiave] = e.target.value; });
    corpo.appendChild(campo);
  }

  // ---------- salvataggio ----------
  view.querySelector('#save').addEventListener('click', async () => {
    const btn = view.querySelector('#save'); const old = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<span class="spinner sm"></span> Salvo…';
    try {
      await impostazioni.save(imp);
      await ctx.reloadImp();
      toast('Impostazioni salvate', 'ok');
    } catch (e) {
      toast('Errore: ' + e.message, 'err');
    } finally { btn.disabled = false; btn.innerHTML = old; }
  });
}
