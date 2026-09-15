// ============================================================
//  CENTRI DI COSTO — il quadro d'insieme.
//  Una riga per attività: quanto è entrato, quanto è uscito, quanto
//  resta. In cima ai numeri c'è quello che sta FUORI da ogni attività,
//  che in una pagina del genere è la cosa che si dimentica più
//  facilmente: senza, la somma delle righe sembrerebbe il bilancio del
//  Comitato, e non lo è.
//
//  L'ordine mette in alto le attività in perdita. Non è un giudizio: è
//  che un elenco alfabetico costringe a leggerlo tutto per trovare la
//  riga per cui si è aperta la pagina.
// ============================================================
import { caricaTutto, centri as storeCentri } from '../data/store.js';
import {
  documenti, imputazioniPerFattura, quadro, vociDi, fuoriDaiCentri, anni,
} from '../calc.js';
import { el, clear, esc, toast, fmtEuro, fmtDate, rendiCliccabile, confirmDialog } from '../../lib/ui.js';
import { barraPeriodo, intervallo, nomePeriodo } from './periodo.js';
import { apriSchedaCentro } from './scheda.js';

export async function renderCentri(view, ctx) {
  const admin = ctx.ruolo === 'admin';
  const stato = { anno: String(new Date().getFullYear()), da: '', a: '' };
  Object.assign(stato, intervallo(stato.anno));

  view.appendChild(el(`<div class="page-head">
    <div>
      <h1>Centri di costo</h1>
      <p>Entrate e uscite, attività per attività</p>
    </div>
    <div class="actions">
      <a class="btn" href="#/analisi/da-attribuire">📥 Da attribuire</a>
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

  const docs = documenti(dati.passive, dati.attive);
  const perFattura = imputazioniPerFattura(dati.imputazioni);

  const barra = barraPeriodo(anni(docs), stato, disegna);
  const stats = el('<div class="grid stats" style="margin:0 0 20px"></div>');
  const lista = el('<div class="cc-lista"></div>');
  const nota = el('<div class="an-nota"></div>');

  clear(zona);
  zona.append(barra, stats, lista, nota);

  if (admin) {
    view.querySelector('[data-nuovo]').addEventListener('click', async () => {
      const creato = await apriSchedaCentro(null);
      if (!creato) return;
      dati.centri.push(creato);
      disegna();
    });
  }

  function disegna() {
    const righe = quadro(dati.centri, docs, dati.imputazioni, stato);
    const complessivi = righe.reduce((t, r) => ({
      entrate: t.entrate + r.entrate, uscite: t.uscite + r.uscite,
    }), { entrate: 0, uscite: 0 });
    const fuori = fuoriDaiCentri(docs, perFattura, stato);

    barra.querySelector('[data-nota]').textContent =
      `${righe.length} ${righe.length === 1 ? 'attività' : 'attività'} · ${dati.passive.length + dati.attive.length} fatture in archivio`;

    clear(stats);
    stats.append(
      card('ok', 'Entrate attribuite', fmtEuro(complessivi.entrate), `alle attività, ${nomePeriodo(stato.anno)}`),
      card('warn', 'Uscite attribuite', fmtEuro(complessivi.uscite), `alle attività, ${nomePeriodo(stato.anno)}`),
      card(complessivi.entrate - complessivi.uscite < 0 ? 'danger' : 'ok', 'Saldo', fmtEuro(complessivi.entrate - complessivi.uscite),
        'entrate meno uscite'),
      // Il quarto riquadro è il più importante della pagina: dice quanta
      // parte dei soldi del Comitato questi conti NON stanno guardando.
      cardCliccabile(fuori.documenti ? '' : 'ok', 'Fuori dalle attività', String(fuori.documenti),
        fuori.documenti ? 'fatture da attribuire — clicca' : 'tutto attribuito',
        fuori.documenti ? () => ctx.go('#/analisi/da-attribuire') : null),
    );

    clear(lista);
    if (!dati.centri.length) {
      lista.appendChild(el(`<div class="empty-state"><div class="big">🎯</div>
        <p><b>Nessuna attività</b></p>
        <p>Un centro di costo è un'attività di cui vuoi sapere quanto è costata e quanto ha reso:<br>
        un corso, un'assistenza a un evento, un mezzo, un servizio.<br>
        ${admin ? 'Creane uno e comincia ad attribuirgli le fatture.'
                : 'Chiedi a un amministratore della sezione di crearne uno.'}</p></div>`));
      clear(nota);
      return;
    }
    for (const r of righe) lista.appendChild(riga(r));

    clear(nota);
    if (fuori.documenti) {
      nota.appendChild(el(`<p class="hint"><b>Attenzione a come si leggono questi numeri.</b>
        Ci sono ${fuori.documenti} fatture ancora non attribuite (o attribuite solo in parte), per
        ${fmtEuro(fuori.entrate)} di entrate e ${fmtEuro(fuori.uscite)} di uscite: il totale qui sopra
        è quello delle attività seguite, non il bilancio del Comitato.
        <a href="#/analisi/da-attribuire">Vedi che cosa manca</a>.</p>`));
    } else {
      nota.appendChild(el('<p class="hint">Tutte le fatture del periodo sono attribuite a un\'attività.</p>'));
    }
  }

  function card(classe, k, v, s) {
    return el(`<div class="stat ${classe}"><div class="k">${esc(k)}</div>
      <div class="v">${esc(v)}</div><div class="s">${esc(s)}</div></div>`);
  }
  function cardCliccabile(classe, k, v, s, alClic) {
    const c = card(classe, k, v, s);
    if (alClic) { c.classList.add('stat-clickable'); rendiCliccabile(c, alClic); }
    return c;
  }

  function riga(r) {
    const c = r.centro;
    const movimenti = r.nEntrate + r.nUscite;
    const f = el(`<div class="cc-riga${c.chiuso ? ' chiusa' : ''}">
      <div class="cc-chi">
        <div class="cc-nome">${esc(c.nome)}${c.chiuso ? ' <span class="chip">chiusa</span>' : ''}</div>
        <div class="cc-sotto">${esc(periodoDi(c))}${movimenti
          ? ` · ${movimenti} ${movimenti === 1 ? 'fattura' : 'fatture'}`
          : ' · nessuna fattura attribuita'}</div>
      </div>
      <div class="cc-num entrate"><span class="e">Entrate</span><b>${fmtEuro(r.entrate)}</b></div>
      <div class="cc-num uscite"><span class="e">Uscite</span><b>${fmtEuro(r.uscite)}</b></div>
      <div class="cc-num saldo ${r.saldo < 0 ? 'neg' : ''}"><span class="e">Saldo</span><b>${fmtEuro(r.saldo)}</b></div>
      <div class="cc-azioni">
        ${admin ? '<button class="btn ghost sm" data-mod title="Modifica l\'attività">✏️</button>' : ''}
        ${admin ? '<button class="btn ghost sm" data-del title="Elimina l\'attività">🗑️</button>' : ''}
      </div>
    </div>`);

    rendiCliccabile(f.querySelector('.cc-chi'), () => ctx.go(`#/analisi/centro/${c.id}`));
    f.querySelector('[data-mod]')?.addEventListener('click', async () => {
      const agg = await apriSchedaCentro(c);
      if (!agg) return;
      Object.assign(c, agg);
      disegna();
    });
    f.querySelector('[data-del]')?.addEventListener('click', async () => {
      // Il numero di quote che si perdono va detto PRIMA: eliminare un
      // centro con dentro trenta fatture attribuite è mezz'ora di lavoro
      // che se ne va, e da fuori il pulsante è identico a quello di un
      // centro vuoto.
      const quante = vociDi(c.id, docs, dati.imputazioni).length;
      const avviso = quante
        ? `Eliminare «${c.nome}»? Le ${quante} attribuzioni fatte su questa attività vanno perse (le fatture restano tutte, tornano solo a non essere attribuite).`
        : `Eliminare «${c.nome}»? Non ha nessuna fattura attribuita.`;
      if (!await confirmDialog(avviso, { danger: true, okLabel: 'Elimina' })) return;
      try { await storeCentri.remove(c.id); }
      catch (e) { toast('Eliminazione non riuscita: ' + e.message, 'err'); return; }
      dati.centri = dati.centri.filter(x => x.id !== c.id);
      dati.imputazioni = dati.imputazioni.filter(i => i.centro_id !== c.id);
      toast('Attività eliminata', 'ok');
      disegna();
    });
    return f;
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

