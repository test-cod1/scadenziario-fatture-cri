// ============================================================
//  FATTURATO — la lettura d'insieme delle fatture emesse.
//
//  Nello scadenziario c'è già un Report delle attive: dice quanto ha
//  fatturato ogni cliente e come sono andati i mesi. Questa pagina non lo
//  rifà: parte da dove quello finisce e risponde alle domande che lì non
//  si possono porre —
//
//    · stiamo andando meglio o peggio dell'anno scorso, mese per mese;
//    · da quanti clienti dipendiamo davvero;
//    · quanto del fatturato è ancora un credito, e da quanto tempo;
//    · quanto di tutto questo sta dentro un centro di costo.
//
//  L'ordine dei riquadri è l'ordine in cui si leggono: prima quanto,
//  poi da chi, poi quanto ne abbiamo visto, poi quanto ne sappiamo.
//  Ogni blocco porta scritto sotto come va letto, perché sono numeri che
//  finiscono in un Consiglio e nessuno sarà lì a spiegarli.
// ============================================================
import { fattureAttive } from '../../data/storeAttive.js';
import { imputazioni as storeImputazioni } from '../data/store.js';
import { imputazioniPerFattura } from '../calc.js';
import {
  anniFatturato, nelPeriodoFatture, riepilogo, perCliente, concentrazione,
  livelloConcentrazione, perMese, perAnno, totaleAnno, taglioConfronto, tempiDiIncasso,
  anzianitaCredito, creditiVecchi, coperturaCentri, lacune,
} from '../fatturato.js';
import { puoAccedere } from '../../sezioni.js';
import {
  el, clear, esc, fmtEuro, fmtEuroCompatto, fmtDate, todayISO,
  rendiCliccabile, cellaCsv, toast,
} from '../../lib/ui.js';
import { barraPeriodo, intervallo, nomePeriodo } from './periodo.js';

const MESI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
// La stessa chiave che usa il Report dello scadenziario per aprirsi già
// filtrato su un cliente: cliccare una riga qui porta alle sue fatture.
const FILTRO_CLIENTE_KEY = 'reportAttive:filtroCliente';

const pct = (q, cifre = 0) => `${(q * 100).toFixed(cifre).replace('.', ',')}%`;

export async function renderFatturato(view, ctx) {
  const stato = { anno: String(new Date().getFullYear()), da: '', a: '' };
  Object.assign(stato, intervallo(stato.anno));
  const oggi = todayISO();
  // Righe cliccabili e collegamenti portano dentro lo scadenziario: a chi
  // ha solo Analisi il router risponderebbe «non autorizzato», quindi a lui
  // non si offrono affatto — una riga che promette un clic e porta a un
  // divieto è peggio di una riga ferma.
  const vediScadenziario = puoAccedere(ctx.user, 'scadenziario');

  view.appendChild(el(`<div class="page-head">
    <div>
      <h1>Fatturato</h1>
      <p>Le fatture emesse lette insieme: andamento, clienti, credito</p>
    </div>
    <div class="actions">
      <button class="btn" data-csv>📊 Esporta il report (CSV)</button>
    </div>
  </div>`));

  const zona = el('<div><div class="spinner" style="margin-top:60px"></div></div>');
  view.appendChild(zona);

  let attive = [];
  let perFattura = new Map();
  try {
    // Le imputazioni servono solo all'ultimo riquadro, ma partono insieme
    // alle fatture: in fila avrebbero sommato due attese di rete per una
    // pagina sola. Se la lettura delle quote non riesce (per esempio
    // perché l'utente non ha accesso ai centri), la pagina resta in piedi
    // senza quel riquadro invece di non aprirsi: il fatturato è la parte
    // che interessa quasi sempre.
    const [f, imp] = await Promise.all([
      fattureAttive.list(),
      storeImputazioni.list().catch(() => null),
    ]);
    attive = f;
    perFattura = imp ? imputazioniPerFattura(imp) : null;
  } catch (e) {
    clear(zona);
    zona.appendChild(el(`<div class="empty-state"><div class="big">⚠️</div>
      <p><b>Non è stato possibile leggere le fatture</b></p><p>${esc(e.message)}</p></div>`));
    return;
  }

  const barra = barraPeriodo(anniFatturato(attive), stato, disegna);
  const stats = el('<div class="grid stats" style="margin:0 0 20px"></div>');
  const corpo = el('<div class="fat-corpo"></div>');
  const nota = el('<div class="an-nota"></div>');

  clear(zona);
  zona.append(barra, stats, corpo, nota);

  view.querySelector('[data-csv]').addEventListener('click', () => esporta(righeDelPeriodo(), stato.anno));

  function righeDelPeriodo() { return nelPeriodoFatture(attive, stato); }

  function disegna() {
    const righe = righeDelPeriodo();
    const r = riepilogo(righe);
    const clienti = perCliente(righe);
    const conc = concentrazione(clienti);
    const tempi = tempiDiIncasso(righe);
    const eta = anzianitaCredito(righe, oggi);
    const copertura = perFattura ? coperturaCentri(righe, perFattura) : null;
    // Per l'anno in corso l'anno prima si ferma allo stesso giorno: da
    // gennaio a oggi contro da gennaio a oggi, non contro dodici mesi.
    const finoAl = taglioConfronto(stato.anno, oggi);
    const precedente = stato.anno ? totaleAnno(attive, String(Number(stato.anno) - 1), finoAl) : 0;

    barra.querySelector('[data-nota]').textContent =
      `${r.n} ${r.n === 1 ? 'fattura emessa' : 'fatture emesse'} ${nomePeriodo(stato.anno)} · ${attive.length} in archivio`;

    disegnaStats(r, precedente, finoAl);
    clear(corpo);
    corpo.append(
      cardAndamento(),
      cardClienti(clienti, conc),
      cardCredito(eta, righe),
      cardTempi(tempi),
      ...(copertura ? [cardCopertura(copertura)] : []),
    );
    disegnaNota(righe);
  }

  // ---------- i quattro numeri in cima ----------
  function disegnaStats(r, precedente, finoAl) {
    clear(stats);
    // La variazione sull'anno prima sta SOTTO il fatturato e non in un
    // riquadro a sé: da sola non vuol dire niente, e messa lì si legge
    // come parte dello stesso numero.
    const delta = stato.anno && precedente > 0.005
      ? (r.netto - precedente) / precedente
      : null;
    const segno = delta === null ? '' : delta >= 0 ? '+' : '−';
    const annoPrec = Number(stato.anno) - 1;
    // Il taglio va scritto: «sul 2025» da solo si leggerebbe come l'anno
    // intero, e il confronto sembrerebbe quello sbagliato di prima.
    const entro = finoAl ? ` entro il ${fmtDate(`${annoPrec}-${finoAl}`)}` : '';
    const confronto = delta === null
      ? (stato.anno ? `nessuna fattura nel ${annoPrec}${entro}` : 'tutti gli anni')
      : `${segno}${pct(Math.abs(delta), 1)} sul ${annoPrec}${entro} (${fmtEuroCompatto(precedente)})`;

    stats.append(
      riquadro('accent', 'Fatturato', fmtEuro(r.netto), confronto),
      riquadro('', 'Fatture emesse', String(r.n),
        r.n ? `mediana ${fmtEuro(r.mediano)} · media ${fmtEuro(r.medio)}` : 'nessuna nel periodo'),
      riquadro('ok', 'Incassato', fmtEuro(r.incassato),
        r.netto > 0.005 ? `${pct(r.quotaIncassata)} del fatturato` : '—'),
      riquadro(r.residuo > 0.005 ? 'warn' : 'ok', 'Ancora da incassare', fmtEuro(r.residuo),
        r.nAperte ? `${r.nAperte} ${r.nAperte === 1 ? 'fattura aperta' : 'fatture aperte'}` : 'tutto incassato'),
    );
    if (r.stornato > 0.005) {
      stats.appendChild(riquadro('', 'Note di credito', fmtEuro(r.stornato),
        `${pct(r.stornato / (r.netto + r.stornato), 1)} dell’emesso · ${r.nStornate} ${r.nStornate === 1 ? 'fattura' : 'fatture'}`));
    }
  }

  function riquadro(classe, k, v, s) {
    return el(`<div class="stat ${classe}"><div class="k">${esc(k)}</div>
      <div class="v">${esc(v)}</div><div class="s">${esc(s)}</div></div>`);
  }

  // ---------- andamento ----------
  function cardAndamento() {
    const c = el(`<div class="card">
      <div class="card-h">${stato.anno ? `Andamento ${esc(stato.anno)}, mese per mese` : 'Andamento per anno'}</div>
      <div class="card-b tbl-wrap" data-corpo></div>
      <div class="card-b fat-spiega" data-spiega></div>
    </div>`);
    const dove = c.querySelector('[data-corpo]');

    if (!stato.anno) {
      const anni = perAnno(attive);
      dove.appendChild(grafico(anni.map(a => ({
        etichetta: a.anno, valore: a.valore, precedente: null, cumulato: null,
      })), { legendaPrec: null }));
      c.querySelector('[data-spiega]').textContent =
        'Un anno per colonna. Le fatture senza data non compaiono qui: un mese, e nemmeno un anno, non ce l’hanno.';
      return c;
    }

    const mesi = perMese(attive, stato.anno);
    const annoPrec = String(Number(stato.anno) - 1);
    const conPrec = mesi.some(m => m.precedente > 0.005);
    dove.appendChild(grafico(mesi.map(m => ({
      etichetta: MESI[m.mese],
      valore: m.valore,
      precedente: conPrec ? m.precedente : null,
      cumulato: m.cumulato,
      variazione: m.variazione,
    })), { legendaPrec: conPrec ? annoPrec : null, legendaVal: stato.anno }));

    c.querySelector('[data-spiega]').innerHTML = conPrec
      ? `La colonna piena è il ${esc(stato.anno)}, quella chiara lo stesso mese del ${esc(annoPrec)}; la linea è il progressivo dell’anno.
         Una fattura stornata pesa sul mese in cui è stata <b>emessa</b>, non su quello della nota di credito:
         è fatturato che non c’è mai stato, non un buco che arriva dopo.`
      : `Non ci sono fatture del ${esc(annoPrec)} con cui confrontare: le colonne sono solo il ${esc(stato.anno)}, e la linea è il progressivo dell’anno.`;
    return c;
  }

  // ---------- clienti e concentrazione ----------
  function cardClienti(clienti, conc) {
    const liv = livelloConcentrazione(conc.hhi);
    const c = el(`<div class="card">
      <div class="card-h">
        <span>Da chi dipende il fatturato</span>
        <span class="chip liv-${esc(liv.chiave)}">${esc(liv.testo)}</span>
      </div>
      <div class="card-b" data-testa></div>
      <div class="card-b tbl-wrap" style="padding-top:0" data-tabella></div>
      <div class="card-b fat-spiega" data-spiega></div>
    </div>`);

    if (!clienti.length) {
      c.querySelector('[data-tabella]').appendChild(el(
        '<div class="empty-state"><div class="big">🧾</div><p>Nessuna fattura nel periodo selezionato.</p></div>'));
      c.querySelector('[data-spiega]').remove();
      return c;
    }

    c.querySelector('[data-testa]').appendChild(el(`<div class="fat-conc">
      <div class="fat-conc-v"><b>${esc(pct(conc.primi3))}</b><span>dai primi 3 clienti</span></div>
      <div class="fat-conc-v"><b>${esc(pct(conc.primi10))}</b><span>dai primi 10</span></div>
      <div class="fat-conc-v"><b>${conc.clientiPer80}</b><span>${conc.clientiPer80 === 1 ? 'cliente fa l’80%' : 'clienti fanno l’80%'}</span></div>
      <div class="fat-conc-v"><b>${conc.nClienti}</b><span>clienti in tutto</span></div>
    </div>`));

    // Le righe sono tutte, non le prime dieci: chi cerca un ente preciso
    // deve trovarlo, e un «mostra tutti» che apre una seconda schermata
    // per una tabella di quaranta righe è una cerimonia inutile.
    const t = el(`<table class="tbl"><thead><tr>
      <th>Cliente</th><th>Fatture</th><th class="money-col">Fatturato</th>
      <th class="money-col">Quota</th><th class="money-col">Cumulata</th>
      <th class="money-col">Da incassare</th><th>Tempo di incasso</th>
    </tr></thead><tbody></tbody></table>`);
    const tb = t.querySelector('tbody');
    for (const [i, g] of clienti.entries()) {
      const tr = el(`<tr${vediScadenziario ? ` title="Vedi le fatture di ${esc(g.cliente)}"` : ''}>
        <td>${esc(g.cliente)}</td>
        <td>${g.n}</td>
        <td class="money money-col">${fmtEuro(g.netto)}</td>
        <td class="money money-col">${esc(pct(g.quota, 1))}</td>
        <td class="money money-col fat-cum">${esc(pct(g.quotaCumulata, 1))}</td>
        <td class="money money-col">${g.residuo > 0.005 ? fmtEuro(g.residuo) : '—'}</td>
        <td>${g.giorniMediani !== null ? `${Math.round(g.giorniMediani)} gg` : '—'}</td>
      </tr>`);
      // La cumulata è la colonna per cui esiste questa tabella: la riga in
      // cui supera l'80% è il confine fra «i clienti che ci tengono in
      // piedi» e la coda. Si segna, invece di lasciarla cercare a occhio.
      // Si segnano esattamente le prime `clientiPer80` righe, cioè quelle
      // contate nel numero scritto sopra: con una soglia sulla cumulata la
      // riga che scavalca l'80% restava bianca, e la pagina diceva «2
      // clienti» evidenziandone uno.
      if (i < conc.clientiPer80) tr.classList.add('fat-dentro80');
      if (vediScadenziario) {
        rendiCliccabile(tr, () => {
          sessionStorage.setItem(FILTRO_CLIENTE_KEY, g.cliente === '—' ? '' : g.cliente);
          ctx.go('#/scadenziario/attive/fatture');
        });
      }
      tb.appendChild(tr);
    }
    c.querySelector('[data-tabella]').appendChild(t);

    const primo = conc.primo;
    c.querySelector('[data-spiega]').innerHTML =
      `Le righe evidenziate sono i clienti che, sommati, fanno l’80% del fatturato: sono
       <b>${conc.clientiPer80} su ${conc.nClienti}</b>.
       ${primo ? `Il primo da solo vale <b>${esc(pct(conc.primi1, 1))}</b> (${esc(primo.cliente)}).` : ''}
       Il tempo di incasso è la <b>mediana</b> dei giorni fra emissione e saldo delle sole fatture già chiuse:
       la media l’avrebbe spostata la singola fattura dimenticata per un anno.
       Nomi uguali a meno di maiuscole e spazi sono contati come un cliente solo;
       due grafie davvero diverse dello stesso ente restano due righe: si uniformano da ${vediScadenziario
         ? '<a href="#/scadenziario/attive/clienti">Scadenziario → Fatture Attive → Clienti</a>'
         : 'Scadenziario → Fatture Attive → Clienti, a cura di chi ha accesso allo scadenziario'}.`;
    return c;
  }

  // ---------- il credito ----------
  function cardCredito(eta, righe) {
    const c = el(`<div class="card">
      <div class="card-h"><span>Il credito aperto</span>
        <span class="chip">${fmtEuro(eta.totale)}</span></div>
      <div class="card-b" data-fasce></div>
      <div class="card-b tbl-wrap" style="padding-top:0" data-vecchi></div>
      <div class="card-b fat-spiega" data-spiega></div>
    </div>`);

    if (eta.totale <= 0.005) {
      c.querySelector('[data-fasce]').appendChild(el(
        '<div class="empty-state"><div class="big">✅</div><p><b>Nessun credito aperto nel periodo</b></p><p>Tutte le fatture emesse risultano incassate o stornate.</p></div>'));
      c.querySelector('[data-vecchi]').remove();
      c.querySelector('[data-spiega]').remove();
      return c;
    }

    const zona = c.querySelector('[data-fasce]');
    const max = Math.max(...eta.fasce.map(f => f.importo), 0.01);
    for (const f of eta.fasce) {
      zona.appendChild(el(`<div class="fat-fascia${f.chiave === '180+' && f.importo > 0.005 ? ' allarme' : ''}">
        <span class="fat-fascia-e">${esc(f.etichetta)}</span>
        <span class="fat-fascia-b"><i style="width:${(f.importo / max * 100).toFixed(1)}%"></i></span>
        <b>${f.importo > 0.005 ? fmtEuro(f.importo) : '—'}</b>
        <span class="fat-fascia-n">${f.n ? `${f.n} ${f.n === 1 ? 'fattura' : 'fatture'}` : ''}</span>
      </div>`));
    }
    if (eta.senzaData.n) {
      zona.appendChild(el(`<div class="fat-fascia">
        <span class="fat-fascia-e">senza data</span>
        <span class="fat-fascia-b"><i style="width:${(eta.senzaData.importo / max * 100).toFixed(1)}%"></i></span>
        <b>${fmtEuro(eta.senzaData.importo)}</b>
        <span class="fat-fascia-n">${eta.senzaData.n} da datare</span>
      </div>`));
    }

    const vecchi = creditiVecchi(righe, oggi, 10);
    if (vecchi.length) {
      const t = el(`<table class="tbl"><thead><tr>
        <th>Fattura</th><th>Cliente</th><th class="money-col">Residuo</th><th>Emessa da</th>
      </tr></thead><tbody></tbody></table>`);
      const tb = t.querySelector('tbody');
      for (const v of vecchi) {
        const tr = el(`<tr${vediScadenziario ? ' title="Vedi le fatture di questo cliente nello scadenziario"' : ''}>
          <td>${esc(v.f.numero_fattura || '—')}<span class="fat-sotto">${esc(fmtDate(v.f.data_fattura))}</span></td>
          <td>${esc(v.f.cliente || '—')}</td>
          <td class="money money-col">${fmtEuro(v.residuo)}</td>
          <td>${v.giorni} gg${v.f.data_sollecito ? `<span class="fat-sotto">sollecito ${esc(fmtDate(v.f.data_sollecito))}</span>` : ''}</td>
      </tr>`);
        // Si porta all'elenco delle fatture attive filtrato su quel
        // cliente, non alla scheda della fattura: la scheda si apre in una
        // finestra dello scadenziario, e da Analisi non si modifica nessuna
        // fattura — aprirla qui avrebbe offerto un salvataggio che le
        // policy del database rifiutano a chi ha solo questa sezione.
        if (vediScadenziario) {
          rendiCliccabile(tr, () => {
            sessionStorage.setItem(FILTRO_CLIENTE_KEY, v.f.cliente || '');
            ctx.go('#/scadenziario/attive/fatture');
          });
        }
        tb.appendChild(tr);
      }
      c.querySelector('[data-vecchi]').append(
        el('<div class="fat-sottotitolo">Le dieci aperte da più tempo</div>'), t);
    } else {
      c.querySelector('[data-vecchi]').remove();
    }

    c.querySelector('[data-spiega]').innerHTML =
      `L’anzianità si conta dalla <b>data della fattura</b>, non dalla scadenza: sulle fatture emesse
       la scadenza spesso non c’è, e un conto che sparisce quando manca un campo facoltativo non serve a niente.
       Per un ente pubblico «emessa da 200 giorni» è comunque la domanda giusta.
       ${vediScadenziario
         ? 'Cliccando una riga si va alle fatture di quel cliente nello scadenziario, dove si registra l’incasso o si segna il sollecito.'
         : 'L’incasso e il sollecito si registrano nello scadenziario, da chi vi ha accesso.'}`;
    return c;
  }

  // ---------- tempi di incasso ----------
  function cardTempi(t) {
    const c = el(`<div class="card">
      <div class="card-h">Quanto ci mettono a pagarci</div>
      <div class="card-b" data-corpo></div>
      <div class="card-b fat-spiega" data-spiega></div>
    </div>`);
    const zona = c.querySelector('[data-corpo]');

    if (!t.n) {
      zona.appendChild(el(`<div class="empty-state"><div class="big">⏱️</div>
        <p><b>Non ancora misurabile</b></p>
        <p>Il tempo di incasso si calcola sulle fatture già chiuse per intero:<br>
        nel periodo selezionato non ce ne sono.</p></div>`));
      c.querySelector('[data-spiega]').remove();
      return c;
    }

    zona.appendChild(el(`<div class="fat-conc">
      <div class="fat-conc-v"><b>${Math.round(t.mediana)} gg</b><span>mediana</span></div>
      <div class="fat-conc-v"><b>${Math.round(t.media)} gg</b><span>media</span></div>
      <div class="fat-conc-v"><b>${t.peggiore} gg</b><span>la più lenta</span></div>
      <div class="fat-conc-v"><b>${t.n}</b><span>${t.n === 1 ? 'fattura chiusa' : 'fatture chiuse'}</span></div>
    </div>`));

    const max = Math.max(...t.fasce.map(f => f.n), 1);
    for (const f of t.fasce) {
      zona.appendChild(el(`<div class="fat-fascia">
        <span class="fat-fascia-e">${esc(f.etichetta)}</span>
        <span class="fat-fascia-b"><i class="ok" style="width:${(f.n / max * 100).toFixed(1)}%"></i></span>
        <b>${f.n}</b>
        <span class="fat-fascia-n">${f.n ? pct(f.n / t.n) : ''}</span>
      </div>`));
    }

    c.querySelector('[data-spiega]').innerHTML =
      `La distribuzione dice quello che la media nasconde: 60 giorni medi possono voler dire «tutti a 60»
       oppure «metà subito e metà a un anno», e sono due situazioni che si gestiscono in modo diverso.
       Si contano solo le fatture <b>chiuse per intero</b> e solo gli incassi veri: una nota di credito chiude
       la partita ma non è un pagamento, e contarla accorcerebbe i tempi senza che sia entrato un euro.`;
    return c;
  }

  // ---------- il ponte con i centri di costo ----------
  function cardCopertura(cop) {
    const c = el(`<div class="card">
      <div class="card-h"><span>Quanto di questo fatturato è attribuito a un’attività</span>
        <span class="chip ${cop.quota >= 0.999 ? 'ok' : ''}">${esc(pct(cop.quota))}</span></div>
      <div class="card-b" data-corpo></div>
      <div class="card-b fat-spiega" data-spiega></div>
    </div>`);
    c.querySelector('[data-corpo]').appendChild(el(`<div class="fat-conc">
      <div class="fat-conc-v"><b>${fmtEuro(cop.attribuito)}</b><span>dentro un centro di costo</span></div>
      <div class="fat-conc-v"><b>${fmtEuro(cop.scoperto)}</b><span>fuori da ogni attività</span></div>
      <div class="fat-conc-v"><b>${cop.nScoperte}</b><span>${cop.nScoperte === 1 ? 'fattura scoperta' : 'fatture scoperte'}</span></div>
    </div>`));
    c.querySelector('[data-spiega]').innerHTML = cop.nScoperte
      ? `Finché questa quota non è vicina al 100%, i conti dei <a href="#/analisi/centri">centri di costo</a>
         sono una fotografia parziale del fatturato: quello che manca non è un errore — le entrate generiche
         esistono — ma va saputo prima di leggerli. <a href="#/analisi/da-attribuire">Attribuisci quello che manca</a>.`
      : `Tutto il fatturato del periodo è attribuito a un’attività: i conti dei
         <a href="#/analisi/centri">centri di costo</a> coprono per intero quello che si legge qui sopra.`;
    return c;
  }

  // ---------- quello che manca ----------
  function disegnaNota(righe) {
    clear(nota);
    const l = lacune(righe);
    const pezzi = [];
    if (l.senzaData) pezzi.push(`<b>${l.senzaData}</b> ${l.senzaData === 1 ? 'fattura è senza data' : 'fatture sono senza data'}: contano nei totali di ogni periodo, ma non compaiono nel grafico`);
    if (l.senzaNumero) pezzi.push(`<b>${l.senzaNumero}</b> ${l.senzaNumero === 1 ? 'è senza numero' : 'sono senza numero'}`);
    if (l.aZero) pezzi.push(`<b>${l.aZero}</b> ${l.aZero === 1 ? 'ha importo zero' : 'hanno importo zero'}`);
    if (!pezzi.length) return;
    nota.appendChild(el(`<p class="hint"><b>Da sapere prima di usare questi numeri.</b>
      ${pezzi.join('; ')}. Sono i punti in cui questa pagina è meno precisa di quanto sembri:
      si correggono nelle schede delle fatture, nello scadenziario.</p>`));
  }

  disegna();
}

// ============================================================
//  Il grafico: colonne piene per il periodo scelto, colonne chiare per lo
//  stesso periodo dell'anno prima, una linea per il progressivo. Disegnato
//  a mano in SVG come gli altri della casa: una libreria di grafici, per
//  tre disegni in tutta l'applicazione, sarebbe mezzo megabyte in più da
//  scaricare ogni volta.
// ============================================================
function grafico(punti, { legendaPrec = null, legendaVal = '' } = {}) {
  if (!punti.length) {
    return el('<div class="empty-state"><div class="big">📅</div><p>Nessun dato nel periodo selezionato.</p></div>');
  }
  const conPrec = punti.some(p => p.precedente !== null && p.precedente > 0.005);
  const conCum = punti.some(p => p.cumulato !== null);
  const slot = conPrec ? 62 : 54, barW = conPrec ? 22 : 28, gap = 4;
  const H = 200, padTop = 18, padBottom = 34, padX = 16;
  const W = punti.length * slot + padX * 2;
  const max = Math.max(0.01, ...punti.flatMap(p => [p.valore, p.precedente || 0]));
  const maxCum = Math.max(0.01, ...punti.map(p => p.cumulato || 0));
  const h = v => Math.round((v / max) * H);

  let corpo = '';
  const linea = [];
  punti.forEach((p, i) => {
    const x0 = padX + i * slot + (conPrec ? 0 : (slot - barW) / 2);
    const hv = h(p.valore);
    const varTxt = p.variazione === null || p.variazione === undefined ? ''
      : ` — ${p.variazione >= 0 ? '+' : '−'}${(Math.abs(p.variazione) * 100).toFixed(0)}%`;
    if (conPrec) {
      const hp = h(p.precedente || 0);
      corpo += `<rect x="${x0 + barW + gap}" y="${padTop + H - hp}" width="${barW}" height="${hp}" rx="3"
        fill="var(--line)"><title>${esc(p.etichetta)} ${esc(legendaPrec || '')} — ${esc(fmtEuro(p.precedente || 0))}</title></rect>`;
    }
    corpo += `<rect x="${x0}" y="${padTop + H - hv}" width="${barW}" height="${hv}" rx="3"
      fill="var(--cri-red)"><title>${esc(p.etichetta)} ${esc(legendaVal)} — ${esc(fmtEuro(p.valore))}${esc(varTxt)}</title></rect>`;
    if (p.valore > 0.005) {
      corpo += `<text x="${x0 + barW / 2}" y="${padTop + H - hv - 4}" text-anchor="middle"
        font-size="8.5" fill="var(--ink-soft)">${esc(fmtEuroCompatto(p.valore))}</text>`;
    }
    corpo += `<text x="${padX + i * slot + slot / 2 - (conPrec ? gap : 0)}" y="${padTop + H + 18}"
      text-anchor="middle" font-size="11" fill="var(--ink-soft)">${esc(p.etichetta)}</text>`;
    if (conCum) {
      linea.push([padX + i * slot + slot / 2 - (conPrec ? gap : 0),
        padTop + H - Math.round((p.cumulato / maxCum) * H)]);
    }
  });

  const tracciato = conCum
    ? `<polyline points="${linea.map(([x, y]) => `${x},${y}`).join(' ')}" fill="none"
        stroke="var(--ok)" stroke-width="2" stroke-linejoin="round" opacity=".85"/>`
    : '';

  const voce = (colore, testo) =>
    `<span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${colore};margin-right:5px;vertical-align:middle"></span>${esc(testo)}</span>`;

  return el(`<div>
    <div class="fat-legenda">
      ${voce('var(--cri-red)', legendaVal || 'Fatturato')}
      ${conPrec ? voce('var(--line)', legendaPrec) : ''}
      ${conCum ? voce('var(--ok)', 'Progressivo dell’anno') : ''}
    </div>
    <svg width="${W}" height="${H + padTop + padBottom}" style="display:block">
      <line x1="${padX}" y1="${padTop + H}" x2="${W - padX}" y2="${padTop + H}" stroke="var(--line)" stroke-width="1"/>
      ${corpo}${tracciato}
    </svg>
  </div>`);
}

// ============================================================
//  L'esportazione. Non la sola tabella dei clienti: un foglio unico con
//  dentro tutti i blocchi della pagina, perché chi lo apre lo apre per
//  rifare un conto o per allegarlo a una relazione, e con mezza pagina
//  dovrebbe tornare qui a copiare il resto a mano.
// ============================================================
function esporta(righe, anno) {
  const euro = n => Number(n || 0).toFixed(2).replace('.', ',');
  const r = riepilogo(righe);
  const clienti = perCliente(righe);
  const conc = concentrazione(clienti);
  const tempi = tempiDiIncasso(righe);
  const eta = anzianitaCredito(righe, todayISO());
  const righeCsv = [];
  const sez = (titolo) => { righeCsv.push(''); righeCsv.push(titolo); };
  const dato = (k, v) => righeCsv.push([k, v].map(cellaCsv).join(';'));

  righeCsv.push(`Report fatturato — ${anno || 'tutti gli anni'} — estratto il ${fmtDate(todayISO())}`);
  sez('RIEPILOGO');
  dato('Fatture emesse', r.n);
  dato('Fatturato (al netto delle note di credito)', euro(r.netto));
  dato('Note di credito', euro(r.stornato));
  dato('Incassato', euro(r.incassato));
  dato('Ancora da incassare', euro(r.residuo));
  dato('Valore mediano di una fattura', euro(r.mediano));
  dato('Valore medio di una fattura', euro(r.medio));

  sez('CONCENTRAZIONE');
  dato('Clienti', conc.nClienti);
  dato('Quota dei primi 3', pct(conc.primi3, 1));
  dato('Quota dei primi 10', pct(conc.primi10, 1));
  dato('Clienti che fanno l’80%', conc.clientiPer80);
  dato('Indice di Herfindahl (0–1)', conc.hhi.toFixed(3).replace('.', ','));

  sez('CLIENTI');
  righeCsv.push(['Cliente', 'Fatture', 'Fatturato', 'Quota', 'Quota cumulata', 'Incassato', 'Da incassare', 'Giorni mediani di incasso', 'Ultima fattura']
    .map(cellaCsv).join(';'));
  for (const g of clienti) {
    righeCsv.push([g.cliente, g.n, euro(g.netto), pct(g.quota, 1), pct(g.quotaCumulata, 1), euro(g.incassato), euro(g.residuo),
      g.giorniMediani !== null ? Math.round(g.giorniMediani) : '', g.ultima ? fmtDate(g.ultima) : '']
      .map(cellaCsv).join(';'));
  }

  sez('CREDITO APERTO PER ANZIANITÀ');
  righeCsv.push(['Fascia', 'Fatture', 'Importo'].map(cellaCsv).join(';'));
  for (const f of eta.fasce) righeCsv.push([f.etichetta, f.n, euro(f.importo)].map(cellaCsv).join(';'));
  if (eta.senzaData.n) righeCsv.push(['senza data', eta.senzaData.n, euro(eta.senzaData.importo)].map(cellaCsv).join(';'));

  sez('TEMPI DI INCASSO (solo fatture chiuse)');
  dato('Fatture considerate', tempi.n);
  dato('Giorni — mediana', tempi.mediana !== null ? Math.round(tempi.mediana) : '');
  dato('Giorni — media', tempi.media !== null ? Math.round(tempi.media) : '');
  righeCsv.push(['Fascia', 'Fatture'].map(cellaCsv).join(';'));
  for (const f of tempi.fasce) righeCsv.push([f.etichetta, f.n].map(cellaCsv).join(';'));

  // Il BOM iniziale serve a Excel per riconoscere l'UTF-8: senza, le
  // accentate arrivano storte (stesso accorgimento degli altri export).
  const blob = new Blob(['﻿' + righeCsv.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `report-fatturato-${anno || 'tutti'}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast('Report esportato', 'ok');
}

