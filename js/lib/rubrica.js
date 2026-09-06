// ============================================================
//  LA RUBRICA, UNA VOLTA SOLA
//  Assistenze sanitarie e formazione esterna hanno la stessa identica
//  rubrica: elenco filtrabile, scheda in un riquadro, riquadro per scegliere
//  un destinatario mentre si scrive un preventivo. Erano due copie di 166
//  righe che differivano soltanto nelle parole — «cliente» contro
//  «committente», «Enti e società» contro «Aziende ed enti» — e in nient'altro.
//
//  Qui c'è il comportamento; le parole le porta ogni sezione, insieme al
//  proprio store. Il perché di quel `testi` invece di un unico vocabolario
//  neutro: in italiano il genere si porta dietro articoli e participi («un
//  cliente aggiunto», «un'azienda aggiunta»), e una frase costruita a pezzi
//  suonerebbe come una traduzione automatica.
//
//  Quello che questo file NON fa è unire i dati: le due sezioni restano su
//  due tabelle separate, con permessi separati — chi è abilitato solo alla
//  formazione non vede i clienti delle assistenze. Fonderle sarebbe un'altra
//  cosa: una migrazione, i doppioni da riconciliare e una decisione su chi
//  può vedere cosa.
//
//  In ogni caso, i dati del destinatario restano COPIATI dentro ogni
//  preventivo: correggere una scheda qui non cambia i documenti già mandati.
// ============================================================
import { el, clear, esc, toast, confirmDialog, openModal } from './ui.js';

// Tutte le parole che questo file stampa. Averle elencate serve al controllo
// qui sotto: aggiungerne una senza darla a una delle due sezioni finirebbe
// altrimenti in pagina come "undefined", ed è il tipo di errore che si scopre
// dal cliente. `npm test` importa entrambe le sezioni apposta per farlo
// saltare fuori prima.
export const TESTI_RICHIESTI = [
  'titolo', 'sottotitolo', 'unoNuovo', 'unoModifica', 'colonnaNome', 'campoNome',
  'esempioNome', 'cerca', 'filtra', 'vuota', 'vuotaDaPreventivo', 'nessunRisultato',
  'mancaNome', 'aggiunto', 'aggiornato', 'eliminato',
];

// `clienti` è lo store della sezione (list/save/remove), `testi` le parole.
// Restituisce le tre funzioni che la sezione espone: l'elenco, la scheda e
// il riquadro di scelta dal preventivo.
export function creaRubrica({ clienti, testi }) {
  const mancanti = TESTI_RICHIESTI.filter(k => !testi?.[k]);
  if (mancanti.length) throw new Error(`Rubrica: mancano i testi ${mancanti.join(', ')}`);

  // ----------------------------------------------------------------
  //  L'ELENCO
  // ----------------------------------------------------------------
  async function renderRubrica(view) {
    const elenco = await clienti.list();

    view.appendChild(el(`<div class="page-head">
      <div><h1>${esc(testi.titolo)}</h1><p>${esc(testi.sottotitolo)}</p></div>
      <button class="btn primary" id="nuovo">➕ ${esc(testi.unoNuovo)}</button>
    </div>`));

    const toolbar = el(`<div class="toolbar">
      <div class="search"><span class="search-icon" aria-hidden="true">🔍</span>
        <input type="text" id="q" placeholder="${esc(testi.cerca)}"></div>
    </div>`);
    view.appendChild(toolbar);

    const card = el(`<div class="card"><div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>${esc(testi.colonnaNome)}</th><th>Codice fiscale / P.IVA</th><th>Indirizzo</th><th>Referente</th><th></th></tr></thead>
      <tbody></tbody></table></div></div>`);
    view.appendChild(card);
    const tbody = card.querySelector('tbody');

    function disegna() {
      const q = toolbar.querySelector('#q').value.toLowerCase().trim();
      clear(tbody);
      const righe = elenco.filter(c => !q || cercabile(c).includes(q));

      if (!righe.length) {
        tbody.appendChild(el(`<tr><td colspan="5" class="muted" style="text-align:center;padding:26px">
          ${elenco.length ? 'Nessun risultato' : esc(testi.vuota)}</td></tr>`));
        return;
      }

      for (const c of righe) {
        const tr = el(`<tr>
          <td><b>${esc(c.nome)}</b>${c.note ? `<div class="mini">${esc(c.note)}</div>` : ''}</td>
          <td>${esc(c.cf || '—')}</td>
          <td>${esc(c.indirizzo || '—')}</td>
          <td>${esc(c.referente || '—')}${c.referente_telefono ? `<div class="mini">${esc(c.referente_telefono)}</div>` : ''}</td>
          <td style="white-space:nowrap;text-align:right">
            <button class="btn ghost sm" data-mod title="Modifica">✎</button>
            <button class="btn ghost sm" data-del title="Elimina">🗑️</button>
          </td>
        </tr>`);
        tr.addEventListener('click', (e) => { if (!e.target.closest('button')) apriScheda(c); });
        tr.querySelector('[data-mod]').addEventListener('click', () => apriScheda(c));
        tr.querySelector('[data-del]').addEventListener('click', async () => {
          if (!await confirmDialog(`Togliere "${c.nome}" dalla rubrica? I preventivi già fatti non cambiano.`,
            { danger: true, okLabel: 'Elimina' })) return;
          try {
            await clienti.remove(c.id);
            elenco.splice(elenco.indexOf(c), 1);
            toast(testi.eliminato, 'ok');
            disegna();
          } catch (e) { toast('Errore: ' + e.message, 'err'); }
        });
        tbody.appendChild(tr);
      }
    }

    toolbar.querySelector('#q').addEventListener('input', disegna);
    view.querySelector('#nuovo').addEventListener('click', () => apriScheda(null));
    disegna();

    // La scheda si apre in un riquadro sopra l'elenco: si aggiunge una scheda
    // senza perdere di vista quelle che ci sono già — che è il modo per
    // accorgersi che c'è di già, scritta in un altro modo.
    function apriScheda(cliente) {
      schedaCliente(cliente, (salvato) => {
        const i = elenco.findIndex(c => c.id === salvato.id);
        if (i >= 0) elenco[i] = salvato; else elenco.push(salvato);
        elenco.sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
        disegna();
      });
    }
  }

  // ----------------------------------------------------------------
  //  LA SCHEDA
  //  La usa sia la rubrica sia l'editor del preventivo, dove arriva già
  //  compilata con quello che si è scritto lì.
  // ----------------------------------------------------------------
  function schedaCliente(cliente, onSalvato) {
    const c = cliente || {};
    const corpo = el(`<div>
      <div class="field"><label>${esc(testi.campoNome)} *</label>
        <input type="text" id="r-nome" value="${esc(c.nome || '')}" placeholder="${esc(testi.esempioNome)}"></div>
      <div class="form-row">
        <div class="field"><label>Codice fiscale / P.IVA</label><input type="text" id="r-cf" value="${esc(c.cf || '')}"></div>
        <div class="field"><label>Indirizzo</label><input type="text" id="r-indirizzo" value="${esc(c.indirizzo || '')}"></div>
      </div>
      <div class="form-row three">
        <div class="field"><label>Referente</label><input type="text" id="r-referente" value="${esc(c.referente || '')}"></div>
        <div class="field"><label>Email</label><input type="text" id="r-email" value="${esc(c.referente_email || '')}"></div>
        <div class="field"><label>Telefono</label><input type="text" id="r-telefono" value="${esc(c.referente_telefono || '')}"></div>
      </div>
      <div class="field"><label>Note</label>
        <textarea id="r-note" rows="2" placeholder="Promemoria per noi: non compaiono nel preventivo">${esc(c.note || '')}</textarea></div>
    </div>`);

    const piede = el(`<div style="display:flex;gap:10px">
      <button class="btn" data-no>Annulla</button>
      <button class="btn primary" data-ok>💾 Salva</button>
    </div>`);

    // Dall'editor del preventivo arriva una scheda già compilata ma senza id:
    // è una scheda nuova, non una modifica. A dirlo è l'id, non il fatto che i
    // campi siano pieni.
    const esistente = !!c.id;
    const { close } = openModal({ title: esistente ? testi.unoModifica : testi.unoNuovo, body: corpo, footer: piede });
    corpo.querySelector('#r-nome').focus();

    piede.querySelector('[data-no]').addEventListener('click', () => close());
    piede.querySelector('[data-ok]').addEventListener('click', async () => {
      const btn = piede.querySelector('[data-ok]'); const testoPrima = btn.innerHTML;
      const dati = {
        id: c.id,
        nome: corpo.querySelector('#r-nome').value.trim(),
        cf: corpo.querySelector('#r-cf').value.trim(),
        indirizzo: corpo.querySelector('#r-indirizzo').value.trim(),
        referente: corpo.querySelector('#r-referente').value.trim(),
        referente_email: corpo.querySelector('#r-email').value.trim(),
        referente_telefono: corpo.querySelector('#r-telefono').value.trim(),
        note: corpo.querySelector('#r-note').value.trim(),
      };
      if (!dati.nome) { toast(testi.mancaNome, 'err'); corpo.querySelector('#r-nome').focus(); return; }
      btn.disabled = true; btn.innerHTML = '<span class="spinner sm"></span> Salvo…';
      try {
        const salvato = await clienti.save(dati);
        toast(esistente ? testi.aggiornato : testi.aggiunto, 'ok');
        close();
        onSalvato?.(salvato);
      } catch (e) {
        toast(e.message, 'err');
        btn.disabled = false; btn.innerHTML = testoPrima;
      }
    });
  }

  // ----------------------------------------------------------------
  //  SCEGLI DALLA RUBRICA
  //  Un riquadro con l'elenco e un filtro: si apre quando lo si chiede, non
  //  mentre si scrive. Restituisce la scheda scelta, o null se si chiude
  //  senza scegliere.
  // ----------------------------------------------------------------
  async function scegliCliente() {
    let elenco;
    try {
      elenco = await clienti.list();
    } catch (e) {
      toast('Rubrica non disponibile: ' + e.message, 'err');
      return null;
    }

    return new Promise((risolvi) => {
      let scelto = null;

      const corpo = el(`<div>
        <div class="search" style="margin-bottom:12px">
          <span class="search-icon" aria-hidden="true">🔍</span>
          <input type="text" id="cerca" placeholder="${esc(testi.filtra)}">
        </div>
        <div class="rubrica-elenco"></div>
      </div>`);
      const zona = corpo.querySelector('.rubrica-elenco');

      function disegna() {
        const q = corpo.querySelector('#cerca').value.toLowerCase().trim();
        clear(zona);
        const righe = elenco.filter(c => !q || cercabile(c).includes(q));

        if (!righe.length) {
          zona.appendChild(el(`<p class="muted" style="text-align:center;padding:18px">
            ${elenco.length ? esc(testi.nessunRisultato) : esc(testi.vuotaDaPreventivo)}</p>`));
          return;
        }
        for (const c of righe) {
          const riga = el(`<button class="rb-voce" type="button">
            <span class="rb-nome">${esc(c.nome)}</span>
            <span class="rb-dati">${esc([c.cf, c.indirizzo].filter(Boolean).join(' · ') || 'nessun altro dato')}</span>
          </button>`);
          riga.addEventListener('click', () => { scelto = c; chiudi(); });
          zona.appendChild(riga);
        }
      }

      corpo.querySelector('#cerca').addEventListener('input', disegna);
      disegna();

      const { close } = openModal({
        title: 'Scegli dalla rubrica',
        body: corpo,
        onClose: () => risolvi(scelto),
      });
      const chiudi = close;
      corpo.querySelector('#cerca').focus();
    });
  }

  return { renderRubrica, schedaCliente, scegliCliente };
}

// Su cosa cerca il filtro: le stesse quattro cose in entrambi i riquadri.
function cercabile(c) {
  return [c.nome, c.cf, c.referente, c.indirizzo].filter(Boolean).join(' ').toLowerCase();
}
