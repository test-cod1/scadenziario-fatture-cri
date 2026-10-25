// ============================================================
//  CLIENTI — le grafie dei nomi, e come unificarle.
//
//  Il nome del cliente sulle fatture attive è un campo di testo libero, e
//  va bene così: si registra una fattura con il documento in mano, non
//  scegliendo da un'anagrafica che qualcuno deve tenere aggiornata. Il
//  prezzo di quella libertà è che lo stesso ente, in tre anni e in quattro
//  mani, finisce scritto in tre modi — e ogni conto per cliente si spezza
//  in tre.
//
//  Questa pagina è il posto dove quel prezzo si paga tutto insieme, una
//  volta ogni tanto: mostra le grafie che con ogni probabilità sono lo
//  stesso ente e le riscrive uguali.
//
//  Due cautele, che sono il motivo per cui la pagina è fatta così:
//
//  1. NON SI UNISCE NIENTE DA SOLI. Ogni gruppo dice quanto è sicuro, e
//     solo quelli identici a meno di maiuscole e spazi si possono spuntare
//     in blocco. «COMUNE DI GENOVA» e «COMUNE DI GENOVA ATS 41» possono
//     essere lo stesso ufficio scritto due volte o due centri di spesa
//     distinti, e questa differenza la sa solo chi ci lavora.
//
//  2. SI RIMEDIA. Unificare riscrive un campo di testo su n fatture, e il
//     trigger di audit conserva il prima di ognuna: nessuna fattura viene
//     spostata, unita o cancellata, e dal registro modifiche si può sempre
//     vedere com'era scritta prima.
// ============================================================
import { fattureAttive } from '../data/storeAttive.js';
import { svuotaCacheNomi } from '../data/store.js';
import { variantiDi, gruppiDoppi, chiaveCliente } from '../lib/nomiClienti.js';
import {
  el, clear, esc, fmtEuro, fmtDate, toast, confirmDialog, debounce, openModal,
} from '../lib/ui.js';

export async function renderClientiAttive(view, ctx) {
  const admin = ctx.user?.ruolo === 'admin';

  view.appendChild(el(`<div class="page-head">
    <div>
      <h1>Clienti</h1>
      <p>Le grafie dei nomi sulle fatture emesse, e quelle da unificare</p>
    </div>
  </div>`));

  const zona = el('<div><div class="spinner" style="margin-top:60px"></div></div>');
  view.appendChild(zona);

  let fatture = [];
  try { fatture = await fattureAttive.list(); }
  catch (e) {
    clear(zona);
    zona.appendChild(el(`<div class="empty-state"><div class="big">⚠️</div>
      <p><b>Non è stato possibile leggere le fatture</b></p><p>${esc(e.message)}</p></div>`));
    return;
  }

  const stato = { cerca: '' };
  const intro = el('<div class="cli-intro"></div>');
  const zonaDoppi = el('<div></div>');
  const zonaTutti = el('<div></div>');
  clear(zona);
  zona.append(intro, zonaDoppi, zonaTutti);

  disegna();

  // ------------------------------------------------------------
  function disegna() {
    const varianti = variantiDi(fatture);
    const gruppi = gruppiDoppi(varianti);
    disegnaIntro(varianti, gruppi);
    disegnaDoppi(gruppi);
    disegnaTutti(varianti);
  }

  function disegnaIntro(varianti, gruppi) {
    clear(intro);
    const sicuri = gruppi.filter(g => g.certezza === 'identico');
    const daVedere = gruppi.filter(g => g.certezza !== 'identico');
    const enti = varianti.length - gruppi.reduce((s, g) => s + g.membri.length - 1, 0);

    intro.appendChild(el(`<div class="grid stats" style="margin:0 0 18px">
      <div class="stat"><div class="k">Grafie in archivio</div><div class="v">${varianti.length}</div>
        <div class="s">su ${fatture.length} fatture emesse</div></div>
      <div class="stat ${gruppi.length ? 'warn' : 'ok'}"><div class="k">Da unificare</div><div class="v">${gruppi.length}</div>
        <div class="s">${gruppi.length ? `${sicuri.length} sicuri · ${daVedere.length} da leggere` : 'nessun nome doppio'}</div></div>
      <div class="stat ok"><div class="k">Clienti dopo la pulizia</div><div class="v">${enti}</div>
        <div class="s">${gruppi.length ? `oggi ne risultano ${varianti.length}` : 'l’archivio è già pulito'}</div></div>
    </div>`));

    if (!admin) {
      intro.appendChild(el(`<p class="hint">Unificare i nomi è un'operazione da <b>amministratore dello
        scadenziario</b>: riscrive il cliente su tutte le fatture che portano quella grafia. Qui la pagina è in
        sola lettura — se vedi un doppione, segnalalo a chi amministra la sezione.</p>`));
    }
  }

  // ---------- i gruppi da unificare ----------
  function disegnaDoppi(gruppi) {
    clear(zonaDoppi);
    if (!gruppi.length) {
      zonaDoppi.appendChild(el(`<div class="card" style="margin-bottom:22px"><div class="card-b">
        <div class="empty-state"><div class="big">✅</div>
        <p><b>Nessun nome doppio</b></p>
        <p>Ogni cliente compare con una grafia sola. Vale la pena ripassare di qui<br>
        dopo un import o dopo qualche mese di registrazioni.</p></div></div></div>`));
      return;
    }

    const sicuri = gruppi.filter(g => g.certezza === 'identico');
    const card = el(`<div class="card" style="margin-bottom:22px">
      <div class="card-h">
        <span>Nomi da unificare</span>
        ${admin && sicuri.length > 1
          ? `<button class="btn primary sm" data-tutti>Unifica i ${sicuri.length} sicuri</button>` : ''}
      </div>
      <div class="card-b cli-gruppi" data-lista></div>
    </div>`);
    const lista = card.querySelector('[data-lista]');
    for (const g of gruppi) lista.appendChild(rigaGruppo(g));

    card.querySelector('[data-tutti]')?.addEventListener('click', async () => {
      // Il numero di fatture toccate va detto PRIMA: «unifica i 6 sicuri»
      // sembra un gesto piccolo e può riscrivere cento righe.
      const quante = sicuri.reduce((s, g) => s + g.fatture, 0);
      const ok = await confirmDialog(
        `Unificare ${sicuri.length} gruppi di nomi identici a meno di maiuscole e spazi? `
        + `Cambia il nome del cliente su ${quante} fatture. Ogni modifica resta nel registro, e il nome scelto `
        + 'è quello già usato di più in ciascun gruppo.',
        { okLabel: 'Unifica' });
      if (!ok) return;
      // Si va avanti anche se un gruppo fallisce (gli altri sono
      // indipendenti), ma il messaggio finale conta solo quelli riusciti
      // e riporta il primo errore, invece di annunciare un successo pieno.
      let riusciti = 0, toccate = 0;
      const falliti = [];
      for (const g of sicuri) {
        const esito = await unifica(g, g.proposta, { silenzioso: true });
        toccate += esito.toccate;
        if (esito.errore || esito.nonTrovate.length) falliti.push(esito.errore || `«${g.proposta}»: nessuna fattura trovata`);
        else riusciti++;
      }
      if (!falliti.length) toast(`${riusciti} nomi unificati · ${toccate} fatture aggiornate`, 'ok');
      else {
        toast(`${riusciti} su ${sicuri.length} gruppi unificati; ${falliti.length} non riusciti. ${falliti[0]}`, 'err');
      }
      disegna();
    });

    zonaDoppi.appendChild(card);
  }

  function rigaGruppo(g) {
    const f = el(`<div class="cli-gruppo cli-${esc(g.certezza.replace(' ', '-'))}">
      <div class="cli-testa">
        <span class="chip ${g.certezza === 'identico' ? 'ok' : g.certezza === 'probabile' ? 'warn' : ''}">${esc(g.certezza)}</span>
        <span class="cli-peso">${g.membri.length} grafie · ${g.fatture} ${g.fatture === 1 ? 'fattura' : 'fatture'} · ${fmtEuro(g.importo)}</span>
      </div>
      <div class="cli-varianti" data-varianti></div>
      ${admin ? `<div class="cli-azione">
        <label class="cli-eti" for="n-${esc(g.id)}">Tieni questo nome</label>
        <input type="text" id="n-${esc(g.id)}" value="${esc(g.proposta)}" data-nome autocomplete="off">
        <button class="btn primary sm" data-unifica>Unifica</button>
      </div>` : ''}
    </div>`);

    const dove = f.querySelector('[data-varianti]');
    for (const m of g.membri) {
      const riga = el(`<div class="cli-variante">
        ${admin ? `<button class="btn ghost sm" data-scegli title="Usa questa grafia per tutto il gruppo">↑</button>` : ''}
        <span class="cli-nome">${esc(m.nome)}</span>
        <span class="cli-n">${m.n} ${m.n === 1 ? 'fattura' : 'fatture'}</span>
        <span class="cli-imp">${fmtEuro(m.importo)}</span>
        <span class="cli-ult">${m.ultima ? `ultima ${fmtDate(m.ultima)}` : ''}</span>
      </div>`);
      riga.querySelector('[data-scegli]')?.addEventListener('click', () => {
        f.querySelector('[data-nome]').value = m.nome;
      });
      dove.appendChild(riga);
    }

    // Un gruppo «da vedere» porta scritto il dubbio, invece di lasciarlo
    // indovinare dall'etichetta: è l'unico caso in cui unire può essere
    // sbagliato, e va detto dove si sta per premere il pulsante.
    if (g.certezza === 'da vedere') {
      f.insertBefore(el(`<p class="cli-dubbio">Un nome è l’inizio dell’altro. Possono essere lo stesso ente
        scritto due volte, oppure due uffici distinti dello stesso comune: se non sei sicuro, lascia stare —
        due clienti separati per sbaglio si correggono, due uniti per sbaglio non si separano più.</p>`),
      f.querySelector('.cli-azione'));
    }

    f.querySelector('[data-unifica]')?.addEventListener('click', async () => {
      const nome = f.querySelector('[data-nome]').value.trim();
      if (!nome) { toast('Scrivi il nome da tenere.', 'err'); return; }
      const quante = g.membri.filter(m => m.nome !== nome).reduce((s, m) => s + m.n, 0);
      if (!quante) { toast('Le fatture portano già questo nome.', ''); return; }
      // Le grafie che stanno per sparire si elencano per esteso nel
      // messaggio: «unifica 3 grafie» non dice quali, e quale sia la terza
      // è esattamente la cosa da controllare prima di premere. La finestra
      // di conferma mostra una riga sola, quindi si scrivono in fila.
      const vanno = g.membri.filter(m => m.nome !== nome);
      const ok = await confirmDialog(
        `Riscrivere «${nome}» su ${quante} ${quante === 1 ? 'fattura' : 'fatture'}? `
        + `Spariscono queste grafie: ${vanno.map(m => `«${m.nome}» (${m.n})`).join(', ')}. `
        + 'Le fatture restano tutte dove sono, e il registro modifiche conserva com’erano scritte.',
        { okLabel: 'Unifica' });
      if (!ok) return;
      await unifica(g, nome);
      disegna();
    });

    return f;
  }

  // Riscrive una grafia alla volta, perché una alla volta è quello che
  // l'utente ha visto in elenco: un solo UPDATE "a meno di maiuscole"
  // avrebbe potuto prendere anche righe che in quell'elenco non c'erano.
  //
  // Restituisce com'è andata ({ toccate, errore, nonTrovate }), perché chi
  // unifica più gruppi di fila deve poter dire alla fine quanti sono
  // riusciti: prima l'errore compariva e subito dopo lo copriva un
  // «N nomi unificati» che non era vero.
  async function unifica(g, nome, { silenzioso = false } = {}) {
    const esito = { toccate: 0, errore: null, nonTrovate: [] };
    for (const m of g.membri) {
      // Si rinominano le grafie grezze del membro, non il nome ripulito
      // che si vede in elenco: vedi `grafie` in variantiDi.
      for (const gr of m.grafie || [{ valore: m.nome }]) {
        if (gr.valore === nome) continue;
        try {
          const righe = await fattureAttive.rinominaCliente(gr.valore, nome);
          esito.toccate += righe.length;
          // Zero righe aggiornate senza errore vuol dire che il valore
          // cercato non c'è più (l'ha cambiato qualcun altro nel frattempo)
          // o che le policy non lasciano scrivere: in entrambi i casi non è
          // un successo, e va detto invece di contarlo come tale.
          if (!righe.length) esito.nonTrovate.push(m.nome);
          // L'elenco in memoria si aggiorna qui e non si ricarica tutto da
          // capo: sono le stesse righe appena scritte, e una rilettura di
          // qualche migliaio di fatture per cambiare una parola sarebbe
          // un'attesa che non serve a niente.
          else for (const fx of fatture) if ((fx.cliente ?? null) === gr.valore) fx.cliente = nome;
        } catch (e) {
          esito.errore = `«${m.nome}» non è stato rinominato: ${e.message}`;
          break;
        }
      }
      if (esito.errore) break;
    }
    // Anche un'unificazione a metà ha già scritto delle righe: la cache dei
    // nomi per l'autocompletamento va buttata comunque, o continuerebbe a
    // proporre le grafie appena tolte.
    if (esito.toccate) svuotaCacheNomi();
    if (!silenzioso) {
      if (esito.errore) toast(esito.errore, 'err');
      else if (esito.nonTrovate.length) {
        toast(`Nessuna fattura trovata per ${esito.nonTrovate.map(n => `«${n}»`).join(', ')}: ricarica la pagina e riprova.`, 'err');
      } else toast(`${esito.toccate} ${esito.toccate === 1 ? 'fattura aggiornata' : 'fatture aggiornate'}`, 'ok');
    }
    return esito;
  }

  // ---------- l'elenco completo ----------
  function disegnaTutti(varianti) {
    clear(zonaTutti);
    const q = stato.cerca.trim().toLowerCase();
    const righe = q ? varianti.filter(v => v.nome.toLowerCase().includes(q)) : varianti;

    const card = el(`<div class="card">
      <div class="card-h">
        <span>Tutti i clienti</span>
        <div class="search" style="flex:none;min-width:220px">
          <span class="search-icon">🔎</span>
          <input type="text" id="cli-cerca" placeholder="Cerca cliente…" value="${esc(stato.cerca)}">
        </div>
      </div>
      <div class="card-b tbl-wrap" data-lista></div>
    </div>`);

    const cerca = card.querySelector('#cli-cerca');
    cerca.addEventListener('input', debounce(() => {
      stato.cerca = cerca.value;
      disegnaTutti(varianti);
      // Il campo si ridisegna insieme alla tabella: senza rimetterci
      // dentro il fuoco, scrivere una parola vorrebbe dire cliccare prima
      // di ogni lettera.
      const nuovo = zonaTutti.querySelector('#cli-cerca');
      nuovo.focus();
      nuovo.setSelectionRange(nuovo.value.length, nuovo.value.length);
    }, 250));

    const dove = card.querySelector('[data-lista]');
    if (!righe.length) {
      dove.appendChild(el(`<div class="empty-state"><div class="big">🔎</div>
        <p>Nessun cliente trovato per "${esc(stato.cerca)}".</p></div>`));
    } else {
      const t = el(`<table class="tbl"><thead><tr>
        <th>Cliente</th><th>Fatture</th><th class="money-col">Fatturato</th>
        <th>Ultima</th>${admin ? '<th></th>' : ''}
      </tr></thead><tbody></tbody></table>`);
      const tb = t.querySelector('tbody');
      for (const v of righe) {
        const tr = el(`<tr>
          <td>${esc(v.nome)}</td>
          <td>${v.n}</td>
          <td class="money money-col">${fmtEuro(v.importo)}</td>
          <td>${v.ultima ? esc(fmtDate(v.ultima)) : '—'}</td>
          ${admin ? '<td class="cli-rinomina"><button class="btn ghost sm" data-rin title="Rinomina su tutte le sue fatture">✏️</button></td>' : ''}
        </tr>`);
        tr.querySelector('[data-rin]')?.addEventListener('click', () => rinomina(v));
        tb.appendChild(tr);
      }
      dove.appendChild(t);
    }
    zonaTutti.appendChild(card);
  }

  // La rinomina di un cliente solo: serve per correggere un refuso che
  // nessuna regola può riconoscere come tale («CAORSI ALLESANDRO»), e per
  // fondere due grafie che le tre regole non hanno accostato.
  async function rinomina(v) {
    const nome = await chiediNome(v);
    if (nome === null) return;
    const pulito = nome.trim();
    // Lo stesso nome ripulito non basta per fermarsi: se in archivio c'è
    // anche «NOME » con lo spazio in coda, riscriverlo è proprio la pulizia.
    const grafie = v.grafie || [{ valore: v.nome }];
    if (!pulito || grafie.every(gr => gr.valore === pulito)) return;

    // Scrivere il nome di un cliente che esiste già è il modo legittimo di
    // fondere due grafie che le regole non hanno accostato: non è un
    // errore, ma va detto prima, perché da fuori sembra una rinomina e
    // invece è una fusione.
    const esistente = variantiDi(fatture).find(x => x.nome !== v.nome && chiaveCliente(x.nome) === chiaveCliente(pulito));
    const avviso = esistente
      // Niente esc() qui: confirmDialog il testo lo fa già sicuro da sé, e
      // un secondo passaggio mostrava «L&#39;ANCORA» al posto dell'apostrofo.
      ? `«${v.nome}» confluisce in «${esistente.nome}», che ha già ${esistente.n} ${esistente.n === 1 ? 'fattura' : 'fatture'}: da qui in poi saranno un cliente solo.`
      : `Il cliente verrà rinominato su ${v.n} ${v.n === 1 ? 'fattura' : 'fatture'}.`;
    if (!await confirmDialog(avviso, { okLabel: esistente ? 'Unisci' : 'Rinomina' })) return;

    // Stessa strada dell'unificazione: una grafia grezza alla volta, la
    // cache dei nomi svuotata e zero righe dette come tali.
    const esito = await unifica({ membri: [v] }, pulito);
    if (esito.toccate) disegna();
  }
}

// La finestrella per il nome nuovo. Un `prompt()` del browser avrebbe
// fatto la stessa cosa in una riga, ma è l'unico punto dell'applicazione
// che si sarebbe messo a parlare con la grafica del sistema operativo —
// e su qualche browser non compare affatto.
function chiediNome(v) {
  return new Promise(res => {
    let esito = null;
    const body = el(`<div class="field">
      <label for="cli-nuovo">Nome del cliente</label>
      <input type="text" id="cli-nuovo" value="${esc(v.nome)}" autocomplete="off">
      <div class="hint">Cambia su tutte le sue ${v.n} ${v.n === 1 ? 'fattura' : 'fatture'}.
      Se scrivi il nome di un cliente che esiste già, i due diventano un cliente solo.</div>
    </div>`);
    const foot = el(`<div style="display:flex;gap:10px;justify-content:flex-end">
      <button class="btn" data-annulla>Annulla</button>
      <button class="btn primary" data-ok>Continua</button>
    </div>`);
    const { close } = openModal({ title: 'Rinomina cliente', body, footer: foot, onClose: () => res(esito) });
    const campo = body.querySelector('#cli-nuovo');
    const conferma = () => { esito = campo.value; close(); };
    foot.querySelector('[data-annulla]').addEventListener('click', () => close());
    foot.querySelector('[data-ok]').addEventListener('click', conferma);
    campo.addEventListener('keydown', e => { if (e.key === 'Enter') conferma(); });
    campo.focus();
    campo.select();
  });
}
