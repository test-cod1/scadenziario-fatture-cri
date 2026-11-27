// ============================================================
//  CENTRI DI COSTO — la griglia da cui si sceglie l'attività.
//  Una card per centro, come le card delle sezioni nella home: ogni
//  centro è un conto a sé, e questa pagina non somma i centri fra loro.
//  Un totale di attività diverse, con periodi diversi, non risponde a
//  nessuna domanda e in cima alla pagina sembrava il bilancio del
//  Comitato. Entrate, uscite, saldo e grafici stanno dentro il centro,
//  dove valgono per quell'attività sola.
// ============================================================
import { caricaTutto, centri as storeCentri } from '../data/store.js';
import { vociDi, ultimaModifica } from '../calc.js';
import { el, clear, esc, toast, fmtDate, fmtDateTime, confirmDialog } from '../../lib/ui.js';
import { apriSchedaCentro } from './scheda.js';

// I colori delle card: toni pieni e scuri come quelli della home, perché
// il testo bianco si legga. Il colore di un centro dipende solo dal suo
// id, così non cambia quando se ne aggiunge o se ne toglie un altro.
const COLORI = [
  ['#1e40af', 'rgba(30,64,175,.22)'],
  ['#0f766e', 'rgba(15,118,110,.22)'],
  ['#9d174d', 'rgba(157,23,77,.22)'],
  ['#3f6212', 'rgba(63,98,18,.22)'],
  ['#92400e', 'rgba(146,64,14,.22)'],
  ['#0e7490', 'rgba(14,116,144,.22)'],
  ['#5b21b6', 'rgba(91,33,182,.22)'],
  ['#374151', 'rgba(0,0,0,.18)'],
];

export function coloreDi(id) {
  const t = String(id ?? '');
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
  return COLORI[h % COLORI.length];
}

// Una cartellina: un conto a sé, che si apre.
const ICONA = `<svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M3 9a3 3 0 0 1 3-3h8l4 4h12a3 3 0 0 1 3 3v15a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z"/><path d="M12 21h12"/></svg>`;

export async function renderCentri(view, ctx) {
  const admin = ctx.ruolo === 'admin';

  view.appendChild(el(`<div class="page-head">
    <div>
      <h1>Centri di costo</h1>
      <p>Ogni attività ha il suo conto: aprila per vederne entrate e uscite</p>
    </div>
    <div class="actions">
      ${admin ? '<button class="btn primary" data-nuovo>➕ Nuovo centro</button>' : ''}
    </div>
  </div>`));

  const zona = el('<div><div class="spinner" style="margin-top:60px"></div></div>');
  view.appendChild(zona);

  let dati;
  try { dati = await caricaTutto(); }
  catch (e) {
    clear(zona);
    zona.appendChild(el(`<div class="empty-state"><div class="big">⚠️</div>
      <p><b>Non è stato possibile leggere i dati</b></p><p>${esc(e.message)}</p></div>`));
    return;
  }

  const griglia = el('<div class="home-grid cc-griglia"></div>');
  clear(zona);
  zona.append(griglia);

  if (admin) {
    view.querySelector('[data-nuovo]').addEventListener('click', async () => {
      const creato = await apriSchedaCentro(null);
      if (!creato) return;
      dati.centri.push(creato);
      disegna();
    });
  }

  function disegna() {
    clear(griglia);
    if (!dati.centri.length) {
      griglia.appendChild(el(`<div class="empty-state" style="grid-column:1/-1"><div class="big">🎯</div>
        <p><b>Nessuna attività</b></p>
        <p>Un centro di costo è un'attività di cui vuoi sapere quanto è costata e quanto ha reso:<br>
        un corso, un'assistenza a un evento, un mezzo, un servizio.<br>
        ${admin ? 'Creane uno e registra le sue entrate e uscite.'
                : 'Chiedi a un amministratore della sezione di crearne uno.'}</p></div>`));
      return;
    }
    // Prima quelli in corso, poi i conclusi; dentro, in ordine di nome.
    const ordinati = [...dati.centri].sort((a, b) =>
      (a.chiuso === b.chiuso ? 0 : a.chiuso ? 1 : -1) ||
      String(a.nome).localeCompare(String(b.nome), 'it', { sensitivity: 'base' }));
    for (const c of ordinati) griglia.appendChild(admin ? cellaAdmin(c) : cardCentro(c));
  }

  function cardCentro(c) {
    const [colore, ombra] = coloreDi(c.id);
    const ultima = ultimaModifica(c, dati.movimenti);
    return el(`<a class="home-card cc-card${c.chiuso ? ' chiusa' : ''}" href="#/analisi/centro/${esc(c.id)}"
        style="--c:${colore};--o:${ombra}" title="${esc(c.descrizione || c.nome)}">
      <div class="hc-top">
        <span class="hc-ico">${ICONA}</span>
        ${c.chiuso ? '<span class="hc-badge">conclusa</span>' : ''}
      </div>
      <div class="hc-bot">
        <div class="hc-line"></div>
        <div class="hc-title">${esc(c.nome)}</div>
        <div class="cc-card-sotto">${esc(periodoDi(c))}</div>
        ${ultima ? `<div class="cc-card-modifica" title="Ultima modifica alla scheda o ai movimenti: ${fmtDateTime(ultima)}">Modificato il ${fmtDateTime(ultima).split(' ')[0]}</div>` : ''}
      </div>
    </a>`);
  }

  // Come l'occhio del super admin nella home: i pulsanti stanno sotto la
  // card e non dentro, perché la card è un link e un pulsante dentro un
  // link aprirebbe il centro invece di modificarlo.
  function cellaAdmin(c) {
    const cella = el('<div class="home-cella"></div>');
    const azioni = el(`<div class="cc-card-azioni">
      <button type="button" class="hc-occhio" data-mod title="Modifica l'attività">✏️ Modifica</button>
      <button type="button" class="hc-occhio" data-del title="Elimina l'attività" aria-label="Elimina «${esc(c.nome)}»">🗑️</button>
    </div>`);
    azioni.querySelector('[data-mod]').addEventListener('click', async () => {
      const agg = await apriSchedaCentro(c);
      if (!agg) return;
      Object.assign(c, agg);
      disegna();
    });
    azioni.querySelector('[data-del]').addEventListener('click', async () => {
      // Il numero di movimenti che si perdono va detto PRIMA: da fuori il
      // pulsante è identico a quello di un centro vuoto.
      const quanti = vociDi(c.id, dati.movimenti).length;
      const avviso = quanti === 0
        ? `Eliminare «${c.nome}»? Non ha nessun movimento.`
        : `Eliminare «${c.nome}»? ${quanti === 1 ? 'Il suo unico movimento va perso' : `I suoi ${quanti} movimenti vanno persi`}, e non si recuperano.`;
      if (!await confirmDialog(avviso, { danger: true, okLabel: 'Elimina' })) return;
      try { await storeCentri.remove(c.id); }
      catch (e) { toast('Eliminazione non riuscita: ' + e.message, 'err'); return; }
      dati.centri = dati.centri.filter(x => x.id !== c.id);
      dati.movimenti = dati.movimenti.filter(m => m.centro_id !== c.id);
      toast('Attività eliminata', 'ok');
      disegna();
    });
    cella.append(cardCentro(c), azioni);
    return cella;
  }

  disegna();
}

// Il periodo dell'attività a parole. Serve a distinguere due edizioni
// della stessa cosa («Corso BLSD» di marzo e di ottobre) senza aprirle.
export function periodoDi(c) {
  if (c.inizio && c.fine) return `${fmtDate(c.inizio)} – ${fmtDate(c.fine)}`;
  if (c.inizio) return `dal ${fmtDate(c.inizio)}`;
  if (c.fine) return `fino al ${fmtDate(c.fine)}`;
  return c.descrizione ? c.descrizione : 'senza periodo';
}
