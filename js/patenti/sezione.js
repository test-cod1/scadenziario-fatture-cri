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

const DOMINIO_UFFICIALE = 'https://amministrazione.crigenova.it';

// Il messaggio proposto per mandare il link: si può modificare prima di
// copiarlo o inviarlo.
const messaggioPredefinito = (link) => `Ciao! Per richiedere una nuova patente CRI o rinnovare la tua, compila questo modulo: bastano pochi minuti e trovi anche le risposte alle domande più frequenti.

👉 ${link}`;

function renderLink(view) {
  // L'indirizzo corto, senza .html, sul dominio ufficiale: anche se il
  // portale è aperto da amministrazione-crigenova.pages.dev (o dal Worker),
  // ai volontari va il dominio del Comitato. In locale resta quello locale,
  // così il link si prova.
  const locale = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const link = `${locale ? location.origin : DOMINIO_UFFICIALE}/patenti`;
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
      <div class="pt-link-testa">
        <div class="pt-link-ico" aria-hidden="true">🪪</div>
        <div>
          <h2>Link da mandare ai volontari</h2>
          <p class="hint">Si apre senza accedere al portale, anche dal telefono. Su WhatsApp e Telegram compare con titolo e descrizione.</p>
        </div>
      </div>

      <div class="pt-link-indirizzo">
        <a href="${esc(link)}" target="_blank" rel="noopener">${esc(link.replace(/^https?:\/\//, ''))}</a>
        <button class="btn sm" type="button" data-copia-link>Copia link</button>
      </div>

      <label class="pt-link-etichetta" for="pt-messaggio">Messaggio da inviare</label>
      <textarea id="pt-messaggio" rows="4">${esc(messaggioPredefinito(link))}</textarea>
      <div class="pt-link-azioni">
        <button class="btn primary" type="button" data-copia-messaggio>📋 Copia messaggio</button>
        <a class="btn pt-whatsapp" data-whatsapp target="_blank" rel="noopener">WhatsApp</a>
        <a class="btn" data-email>✉️ Email</a>
        <a class="btn" href="${esc(link)}" target="_blank" rel="noopener">Apri il modulo ↗</a>
      </div>
    </div></div>

    <div class="card pt-passaggi" style="margin-top:16px"><div class="card-b">
      <h2 style="margin:0 0 12px;font-size:16px">I passaggi del modulo</h2>
      <ol style="margin:0;padding-left:20px;line-height:1.7">
        <li><b>Nome</b>: nome e cognome.</li>
        <li><b>Richiesta</b>: ottenere una nuova patente CRI o rinnovare quella che si ha.</li>
        <li><b>Patente</b>: quale (da 1 a 8), la più alta; per una nuova, con la patente civile di partenza.</li>
        <li><b>Documenti</b>: una domanda per documento, «Sì» o «No, mi serve supporto» —
          <ul style="margin:2px 0 4px">${DOCUMENTI_GAIA.map(d => `<li>${esc(d.breve)}</li>`).join('')}<li>solo per il rinnovo: ${esc(FOTO_PATENTE_CRI.breve)}</li></ul>
          Con un «No» la richiesta arriva segnata «serve supporto», con un'email di avviso.</li>
        <li><b>Test dei riflessi</b>: solo per le patenti 5, 6, 7 e 8, da confermare prima dell'invio.</li>
        <li><b>Procedura</b>: la spiegazione di come si prosegue, in base al percorso della patente.</li>
      </ol>
      <h3 style="margin:18px 0 8px;font-size:14px">Percorsi</h3>
      <ul style="margin:0;padding-left:20px;line-height:1.7">
        ${perPercorso.map(p => `<li><b>${esc(p.etichetta)}</b>: patenti ${p.patenti.join(', ')}</li>`).join('')}
      </ul>
    </div></div>
  </div>`);

  const testo = pagina.querySelector('#pt-messaggio');
  const whatsapp = pagina.querySelector('[data-whatsapp]');
  const email = pagina.querySelector('[data-email]');
  // I tasti WhatsApp ed Email portano il messaggio così com'è scritto in
  // quel momento.
  const aggiornaInvii = () => {
    whatsapp.href = `https://wa.me/?text=${encodeURIComponent(testo.value)}`;
    email.href = `mailto:?subject=${encodeURIComponent('Patenti CRI: richiesta e rinnovo')}&body=${encodeURIComponent(testo.value)}`;
  };
  testo.addEventListener('input', aggiornaInvii);
  aggiornaInvii();

  const copia = async (valore, cosa, campo) => {
    try { await navigator.clipboard.writeText(valore); toast(`${cosa} copiato`, 'ok'); }
    catch { campo?.select(); toast('Copia non riuscita: selezionalo e copialo a mano', 'err'); }
  };
  pagina.querySelector('[data-copia-link]').addEventListener('click', () => copia(link, 'Link'));
  pagina.querySelector('[data-copia-messaggio]').addEventListener('click', () => copia(testo.value, 'Messaggio', testo));
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
