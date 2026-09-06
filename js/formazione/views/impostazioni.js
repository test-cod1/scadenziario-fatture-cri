import { impostazioni } from '../data/store.js';
import { el, clear, esc, toast } from '../../lib/ui.js';
import { sorvegliaUscita, armaGuardiaIndietro } from '../../lib/uscita.js';

// ============================================================
//  IMPOSTAZIONI DELLA FORMAZIONE ESTERNA
//  Tre cose: il catalogo dei corsi (quelli che si possono mettere in un
//  preventivo, con durata, attestazione e prezzo di listino), la firma e i
//  testi fissi del documento. Stanno insieme perché sono tutti "come
//  facciamo i preventivi", e li tocca la stessa persona.
// ============================================================

const ETICHETTE_TESTI = {
  premessa: ['Premessa', 'La frase che introduce la tabella dei corsi.'],
  sede_nostra: ['Sede — presso di noi', 'Compare quando il preventivo indica la nostra sede.'],
  sede_cliente: ['Sede — presso il committente', 'Compare quando il corso si tiene dal cliente; dopo questa frase viene aggiunto l\'indirizzo scritto nel preventivo.'],
  voce_trasferta: ['Voce di trasferta', 'Come si chiama la maggiorazione nella tabella, quando c\'è.'],
  oneri: ['Oneri di segreteria', ''],
  iva_esente: ['IVA — esente', 'Riga sotto il totale quando il preventivo è esente.'],
  iva_soggetto: ['IVA — soggetto', 'Riga sotto il totale quando il preventivo è soggetto a IVA.'],
  validita: ['Validità dell\'offerta', 'La riga che dice per quanto tempo vale il preventivo.'],
  chiusura: ['Chiusura', 'I saluti finali, prima della firma.'],
};

export async function renderImpostazioni(view, ctx) {
  const imp = structuredClone(ctx.imp);

  // Tutta la pagina dentro un contenitore suo: gli ascoltatori qui sotto se
  // ne vanno con lui quando il router disegna un'altra vista, mentre su #view
  // — che il router riempie e svuota ma non rimuove mai — resterebbero
  // attaccati per sempre, uno in più a ogni visita.
  const pagina = el('<div></div>');
  view.appendChild(pagina);

  // Si lavora su una copia in memoria fino al clic su "Salva": senza
  // sorveglianza, cambiare i prezzi del catalogo e passare ai preventivi
  // butterebbe via tutto in silenzio.
  let sporco = false;
  const modificato = () => { sporco = true; armaGuardiaIndietro(); };
  pagina.addEventListener('input', modificato);
  pagina.addEventListener('change', modificato);

  pagina.appendChild(el(`<div class="page-head">
    <div><h1>Impostazioni</h1><p>Catalogo dei corsi e testi del preventivo</p></div>
    <button class="btn primary" id="save">💾 Salva impostazioni</button>
  </div>`));

  // ---------- catalogo dei corsi ----------
  const cCat = el(`<div class="card" style="margin-bottom:18px">
    <div class="card-h">Catalogo dei corsi</div>
    <div class="card-b">
      <p class="hint" style="margin:0 0 14px">I corsi che si possono mettere in un preventivo. Il <b>prezzo</b> è quello di listino, a discente: dentro il singolo preventivo resta modificabile, e accanto c'è il prezzo riservato al cliente. L'<b>attestazione</b> è quello che si rilascia a fine corso e finisce nel documento sotto la tabella: cambia da corso a corso. La <b>sigla</b> serve solo a proporre l'oggetto del preventivo («PREVENTIVO CORSI BLSD»).</p>
      <div id="corsi"></div>
      <button class="btn sm" id="add-corso" type="button" style="margin-top:12px">➕ Aggiungi corso</button>
    </div></div>`);
  pagina.appendChild(cCat);

  function disegnaCorsi() {
    const zona = cCat.querySelector('#corsi');
    clear(zona);
    imp.corsi.forEach((c, i) => {
      const riga = el(`<div class="mezzo-row">
        <div class="field"><label>Denominazione del corso</label>
          <input type="text" data-k="nome" value="${esc(c.nome || '')}"></div>
        <div class="form-row three">
          <div class="field"><label>Durata</label><input type="text" data-k="durata" value="${esc(c.durata || '')}" placeholder="es. 12 ore"></div>
          <div class="field"><label>Sigla (per l'oggetto)</label><input type="text" data-k="sigla" value="${esc(c.sigla || '')}" placeholder="es. BLSD"></div>
          <div class="field"><label>Prezzo di listino a discente (€)</label>
            <input type="number" min="0" step="0.5" data-k="prezzo" value="${Number(c.prezzo) || 0}"></div>
        </div>
        <div class="field"><label>Attestazione rilasciata</label>
          <input type="text" data-k="attestato" value="${esc(c.attestato || '')}" placeholder="es. Rilascio di attestazione — validità 3 anni"></div>
        <button class="rm btn ghost sm" type="button">✕ Rimuovi corso</button>
      </div>`);
      riga.querySelectorAll('[data-k]').forEach(input => {
        input.addEventListener('input', () => {
          const k = input.dataset.k;
          c[k] = k === 'prezzo' ? (Number(input.value) || 0) : input.value;
        });
      });
      riga.querySelector('.rm').addEventListener('click', () => { imp.corsi.splice(i, 1); modificato(); disegnaCorsi(); });
      zona.appendChild(riga);
    });
    if (!imp.corsi.length) zona.appendChild(el('<p class="muted">Nessun corso: aggiungine almeno uno.</p>'));
  }
  disegnaCorsi();
  cCat.querySelector('#add-corso').addEventListener('click', () => {
    imp.corsi.push({ id: 'c' + Date.now(), nome: 'Nuovo corso', durata: '', sigla: '', attestato: '', prezzo: 0 });
    modificato();
    disegnaCorsi();
  });

  // ---------- trasferta ----------
  pagina.appendChild(el(`<div class="card" style="margin-bottom:18px">
    <div class="card-h">Corsi presso il committente</div><div class="card-b">
      <p class="hint" style="margin:0 0 14px">Quanto si aggiunge, di norma, quando il corso non si tiene nella nostra sede. È solo la proposta: nel singolo preventivo la cifra si cambia o si azzera, se la trasferta è già compresa nel prezzo concordato.</p>
      <div class="field" style="max-width:260px"><label>Maggiorazione proposta (€)</label>
        <input type="number" min="0" step="5" id="f-trasferta" value="${Number(imp.trasferta_predefinita) || 0}"></div>
    </div></div>`));
  pagina.querySelector('#f-trasferta').addEventListener('input', (e) => {
    imp.trasferta_predefinita = Number(e.target.value) || 0;
  });

  // ---------- firma ----------
  pagina.appendChild(el(`<div class="card" style="margin-bottom:18px">
    <div class="card-h">Firma</div><div class="card-b">
      <p class="hint" style="margin:0 0 14px">Le due righe in fondo al preventivo, sopra lo spazio per la firma. Lasciando vuoto il nome resta la sola qualifica, come nei preventivi scritti finora.</p>
      <div class="form-row">
        <div class="field"><label>Ruolo</label><input type="text" id="f-ruolo" value="${esc(imp.firma.ruolo || '')}"></div>
        <div class="field"><label>Nome</label><input type="text" id="f-nome" value="${esc(imp.firma.nome || '')}"></div>
      </div>
    </div></div>`));
  for (const [campo, chiave] of [['f-ruolo', 'ruolo'], ['f-nome', 'nome']]) {
    pagina.querySelector('#' + campo).addEventListener('input', (e) => { imp.firma[chiave] = e.target.value; });
  }

  // ---------- testi ----------
  const cTesti = el(`<div class="card" id="testi"><div class="card-h">Testi fissi del documento</div><div class="card-b"></div></div>`);
  pagina.appendChild(cTesti);
  const corpo = cTesti.querySelector('.card-b');
  for (const [chiave, [etichetta, aiuto]] of Object.entries(ETICHETTE_TESTI)) {
    const campo = el(`<div class="field">
      <label>${esc(etichetta)}</label>
      <textarea rows="2">${esc(imp.testi[chiave] || '')}</textarea>
      ${aiuto ? `<div class="hint">${esc(aiuto)}</div>` : ''}
    </div>`);
    campo.querySelector('textarea').addEventListener('input', (e) => { imp.testi[chiave] = e.target.value; });
    corpo.appendChild(campo);
  }

  // ---------- salvataggio ----------
  pagina.querySelector('#save').addEventListener('click', async () => {
    const btn = pagina.querySelector('#save'); const old = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<span class="spinner sm"></span> Salvo…';
    try {
      await impostazioni.save(imp);
      await ctx.reloadImp();
      sporco = false;
      toast('Impostazioni salvate', 'ok');
    } catch (e) {
      toast('Errore: ' + e.message, 'err');
    } finally { btn.disabled = false; btn.innerHTML = old; }
  });

  sorvegliaUscita(pagina, () => sporco);
}
