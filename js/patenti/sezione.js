// ============================================================
//  SEZIONE PATENTI — punto di ingresso.
//  Tre pagine: le richieste arrivate dal modulo pubblico (patenti.html),
//  il link da mandare ai volontari con il riepilogo di cosa troveranno, e
//  le domande e risposte (le stesse che leggono i volontari nel modulo).
// ============================================================
import { el, esc, toast } from '../lib/ui.js';
import { PATENTI, PERCORSI, DOCUMENTI_GAIA, FOTO_PATENTE_CRI } from '../lib/patenti.mjs';
import { htmlFaq, filtraFaq, FONTE_TU } from '../lib/faqPatenti.mjs';

export async function renderPatenti(view, ctx, sub, param) {
  if (sub === 'domande') return renderDomande(view);
  if (sub !== 'link') {
    const { renderRichieste } = await import('./views/richieste.js');
    return renderRichieste(view, { user: ctx.user, ruolo: ctx.user?.ruolo, go: ctx.go, filtro: param });
  }
  return renderLink(view);
}

function renderLink(view) {
  const link = `${location.origin}/patenti.html`;
  const perPercorso = Object.entries(PERCORSI).map(([id, pr]) => ({
    ...pr,
    patenti: PATENTI.filter(p => p.percorso === id).map(p => p.numero),
  }));

  const pagina = el(`<div>
    <div class="page-head"><div>
      <h1>Patenti CRI</h1>
      <p>Il modulo che accompagna i volontari nella procedura di emissione o rinnovo della patente.</p>
    </div></div>

    <div class="card pt-link"><div class="card-b">
      <h2 style="margin:0 0 8px;font-size:16px">Link da mandare ai volontari</h2>
      <p class="hint" style="margin:0 0 12px">Si apre senza accedere al portale, anche dal telefono.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <input readonly value="${esc(link)}" style="flex:1;min-width:220px" aria-label="Link del modulo">
        <button class="btn primary" type="button" data-copia>Copia link</button>
        <a class="btn" href="${esc(link)}" target="_blank" rel="noopener">Apri anteprima ↗</a>
      </div>
    </div></div>

    <div class="card pt-passaggi" style="margin-top:16px"><div class="card-b">
      <h2 style="margin:0 0 12px;font-size:16px">I passaggi del modulo</h2>
      <ol style="margin:0;padding-left:20px;line-height:1.7">
        <li><b>I tuoi dati</b>: nome, cognome e patente richiesta (da 1 a 8).</li>
        <li><b>Documenti su Gaia</b>: una domanda per documento, Sì o No —
          <ul style="margin:2px 0 4px">${DOCUMENTI_GAIA.map(d => `<li>${esc(d.breve)}</li>`).join('')}<li>solo per il rinnovo: ${esc(FOTO_PATENTE_CRI.breve)}</li></ul>
          Con tutti Sì la richiesta parte; con un No il volontario può chiedere <b>supporto</b>, e la richiesta arriva segnata «serve supporto».</li>
        <li><b>Procedura</b>: la spiegazione di come si prosegue, in base al percorso della patente.</li>
      </ol>
      <h3 style="margin:18px 0 8px;font-size:14px">Percorsi</h3>
      <ul style="margin:0;padding-left:20px;line-height:1.7">
        ${perPercorso.map(p => `<li><b>${esc(p.etichetta)}</b>: patenti ${p.patenti.join(', ')}</li>`).join('')}
      </ul>
    </div></div>
  </div>`);

  pagina.querySelector('[data-copia]').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(link); toast('Link copiato', 'ok'); }
    catch { pagina.querySelector('input').select(); toast('Copia non riuscita: selezionalo e copialo a mano', 'err'); }
  });
  view.appendChild(pagina);
}

function renderDomande(view) {
  const pagina = el(`<div>
    <div class="page-head"><div>
      <h1>Domande e risposte</h1>
      <p>Le stesse che i volontari trovano in fondo al modulo. Fonti: ${esc(FONTE_TU)}; note CRI sulle patenti digitali dell'11 e del 18/06/2025.</p>
    </div></div>
    <div class="card"><div class="card-b">
      <div class="search faq-cerca"><span class="search-icon" aria-hidden="true">🔍</span>
        <input type="search" placeholder="Cerca: visita medica, rinnovo, ambulanza…" aria-label="Cerca nelle domande"></div>
      <div class="faq-elenco">${htmlFaq(esc)}</div>
      <p class="faq-vuoto" hidden>Nessuna domanda trovata.</p>
    </div></div>
  </div>`);
  const elenco = pagina.querySelector('.faq-elenco');
  pagina.querySelector('input').addEventListener('input', (e) => {
    pagina.querySelector('.faq-vuoto').hidden = filtraFaq(elenco, e.target.value) > 0;
  });
  view.appendChild(pagina);
}
