// ============================================================
//  CENTRI DI COSTO — il quadro d'insieme.
//  Una riga per attività: quanto è entrato, quanto è uscito, quanto
//  resta. I numeri sono i movimenti registrati in Analisi, che è staccata
//  dallo scadenziario: la somma delle righe è quello che si sta seguendo,
//  non il bilancio del Comitato, e la pagina lo dice.
//
//  L'ordine mette in alto le attività in perdita. Non è un giudizio: è
//  che un elenco alfabetico costringe a leggerlo tutto per trovare la
//  riga per cui si è aperta la pagina.
// ============================================================
import { caricaTutto, centri as storeCentri } from '../data/store.js';
import { quadro, vociDi, anni, perAnno } from '../calc.js';
import { el, clear, esc, toast, fmtDate, rendiCliccabile, confirmDialog } from '../../lib/ui.js';
import { fmtEuro } from '../formato.js';
import { barraPeriodo, intervallo, nomePeriodo } from './periodo.js';
import { apriSchedaCentro } from './scheda.js';
import { tabellaAnni } from './grafici.js';

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

  const barra = barraPeriodo(anni(dati.movimenti), stato, disegna);
  const stats = el('<div class="grid stats" style="margin:0 0 20px"></div>');
  const anniBox = el('<div class="card" style="margin-bottom:18px"><div class="card-b"></div></div>');
  const lista = el('<div class="cc-lista"></div>');
  const nota = el('<div class="an-nota"></div>');

  clear(zona);
  zona.append(barra, stats, anniBox, lista, nota);

  // Come nella pagina del singolo centro: un clic su un anno della tabella
  // sposta anche la tendina, e tutta la pagina guarda quell'anno.
  function scegliAnno(anno) {
    stato.anno = anno;
    Object.assign(stato, intervallo(anno));
    barra.querySelector('#f-anno').value = anno;
    disegna();
  }

  if (admin) {
    view.querySelector('[data-nuovo]').addEventListener('click', async () => {
      const creato = await apriSchedaCentro(null);
      if (!creato) return;
      dati.centri.push(creato);
      disegna();
    });
  }

  function disegna() {
    const righe = quadro(dati.centri, dati.movimenti, stato);
    const tot = righe.reduce((t, r) => ({
      entrate: t.entrate + r.entrate, uscite: t.uscite + r.uscite,
    }), { entrate: 0, uscite: 0 });

    barra.querySelector('[data-nota]').textContent =
      `${righe.length} attività · ${dati.movimenti.length} ${dati.movimenti.length === 1 ? 'movimento' : 'movimenti'} registrati`;

    clear(stats);
    stats.append(
      card('ok', 'Entrate', fmtEuro(tot.entrate), `delle attività, ${nomePeriodo(stato.anno)}`),
      card('warn', 'Uscite', fmtEuro(tot.uscite), `delle attività, ${nomePeriodo(stato.anno)}`),
      card(tot.entrate - tot.uscite < 0 ? 'danger' : 'ok', 'Saldo', fmtEuro(tot.entrate - tot.uscite),
        'entrate meno uscite'),
    );

    // Tutti i centri insieme, anno per anno: il confronto si fa sempre su
    // tutti gli anni, e quello scelto sopra è evidenziato.
    const corpoAnni = anniBox.querySelector('.card-b');
    clear(corpoAnni);
    anniBox.hidden = !dati.movimenti.length;
    if (dati.movimenti.length) {
      corpoAnni.appendChild(tabellaAnni(perAnno(dati.movimenti), stato.anno, scegliAnno,
        { mostraEntrate: dati.movimenti.some(m => m.tipo === 'entrata') }));
    }

    clear(lista);
    clear(nota);
    if (!dati.centri.length) {
      lista.appendChild(el(`<div class="empty-state"><div class="big">🎯</div>
        <p><b>Nessuna attività</b></p>
        <p>Un centro di costo è un'attività di cui vuoi sapere quanto è costata e quanto ha reso:<br>
        un corso, un'assistenza a un evento, un mezzo, un servizio.<br>
        ${admin ? 'Creane uno e registra le sue entrate e uscite.'
                : 'Chiedi a un amministratore della sezione di crearne uno.'}</p></div>`));
      return;
    }
    for (const r of righe) lista.appendChild(riga(r));
    nota.appendChild(el(`<p class="hint">I totali sono la somma dei movimenti registrati nelle attività:
      quello che si sta seguendo, non il bilancio del Comitato.</p>`));
  }

  function card(classe, k, v, s) {
    return el(`<div class="stat ${classe}"><div class="k">${esc(k)}</div>
      <div class="v">${esc(v)}</div><div class="s">${esc(s)}</div></div>`);
  }

  function riga(r) {
    const c = r.centro;
    const n = r.nEntrate + r.nUscite;
    const f = el(`<div class="cc-riga${c.chiuso ? ' chiusa' : ''}">
      <div class="cc-chi">
        <div class="cc-nome">${esc(c.nome)}${c.chiuso ? ' <span class="chip">chiusa</span>' : ''}</div>
        <div class="cc-sotto">${esc(periodoDi(c))}${n
          ? ` · ${n} ${n === 1 ? 'movimento' : 'movimenti'}`
          : ' · nessun movimento'}</div>
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
