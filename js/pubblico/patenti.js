// ============================================================
//  MODULO PUBBLICO PATENTI CRI (patenti.html)
//  Lo apre il volontario dal link che gli manda la segreteria, senza
//  accedere al portale. Lo accompagna nella richiesta, un passaggio alla
//  volta: ognuno è un cancello, e si va avanti solo dopo averlo superato.
//    1. nome e cognome;
//    2. rinnovare la patente CRI o ottenerne una nuova;
//    3. quale patente;
//    4. i documenti su Gaia: per ognuno «Sì» o «No, mi serve supporto»;
//    5. la visita medica: entrare nel gruppo WhatsApp e chiedere di
//       prenotarla, da confermare;
//    6. solo per la 5, 6, 7 o 8 (nuova o rinnovo): il test dei riflessi, da
//       confermare;
//    7. come prosegue (oppure, se ha chiesto supporto, cosa succede ora).
//
//  La richiesta si invia dall'ultimo passaggio prima della fine (visita
//  medica, o test dei riflessi quando c'è): va a /api/patenti, che
//  ricontrolla i dati con le stesse regole (js/lib/patenti.mjs) e la salva
//  per la segreteria. L'ultimo passaggio si apre solo a invio riuscito.
//
//  Sotto ogni passaggio ci sono tutte le domande e risposte
//  (js/lib/faqPatenti.mjs), con la ricerca.
// ============================================================
import { PATENTI, PERCORSI, TIPI_RICHIESTA, documentiRichiesti, RINNOVO, TEST_RIFLESSI, VISITA_MEDICA, patente, tipoRichiesta, servonoRiflessi, controllaRichiesta } from '../lib/patenti.mjs';
import { htmlFaq, filtraFaq } from '../lib/faqPatenti.mjs';

const zona = document.getElementById('modulo');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// I passaggi dipendono dalle scelte: dopo i documenti tutti hanno la
// visita medica, e chi ottiene o rinnova la patente 5 o una superiore anche
// il test dei riflessi. La richiesta si invia dall'ultimo passaggio prima
// della fine.
function passi() {
  return [
    { id: 'nome', etichetta: 'Nome', disegna: passoNome },
    { id: 'tipo', etichetta: 'Richiesta', disegna: passoTipo },
    { id: 'patente', etichetta: 'Patente', disegna: passoPatente },
    { id: 'gaia', etichetta: 'Documenti', disegna: passoGaia },
    { id: 'visita', etichetta: 'Visita', disegna: passoVisita },
    ...(servonoRiflessi(stato.patente) ? [{ id: 'riflessi', etichetta: 'Riflessi', disegna: passoRiflessi }] : []),
    { id: 'fine', etichetta: 'Procedura', disegna: () => (stato.supporto ? passoSupporto() : passoProcedura()) },
  ];
}
const passoCorrente = () => passi()[stato.passo]?.id;
// Da quale passaggio parte l'invio: quello subito prima della fine.
const passoDiInvio = () => passi().at(-2).id;

const stato = {
  passo: 0,
  nome: '',
  cognome: '',
  tipo: '',          // 'nuova' | 'rinnovo'
  patente: '',
  // Per documento: true (Sì), false (No, mi serve supporto) o null (non ancora risposto).
  gaia: Object.fromEntries(documentiRichiesti('rinnovo').map(d => [d.id, null])),
  visita: false,     // confermato di aver capito come prenotare la visita medica
  riflessi: false,   // confermato di aver letto le indicazioni sul test dei riflessi
  supporto: false,
};

const rinnovo = () => stato.tipo === 'rinnovo';
// I documenti da confermare: per il rinnovo c'è in più la foto della
// patente CRI mandata per email.
const documenti = () => documentiRichiesti(stato.tipo);

function stepper() {
  return `<ol class="pt-passi" aria-label="Avanzamento">
    ${passi().map((p, i) => `<li class="${i < stato.passo ? 'fatto' : i === stato.passo ? 'attivo' : ''}" ${i === stato.passo ? 'aria-current="step"' : ''}>
      <span class="n">${i < stato.passo ? '✓' : i + 1}</span><span class="t">${esc(p.etichetta)}</span></li>`).join('')}
  </ol>`;
}

function disegna() {
  zona.innerHTML = `
    <div class="card pp-card"><div class="card-b">
      <h1 class="pp-titolo">Patenti CRI</h1>
      <p class="pp-sotto">Segui questi passaggi per richiedere una nuova patente CRI o rinnovare la tua.
        Hai un dubbio? Le domande e risposte sono in fondo alla pagina.</p>
      ${stepper()}
    </div></div>
    <form class="card pp-card" novalidate><div class="card-b">${passi()[stato.passo].disegna()}</div></form>`;
  collega();
}

const azioni = (avanti = 'Avanti', indietro = true) => `<div class="pp-azioni pt-azioni">
  ${indietro ? '<button class="btn" type="button" data-indietro>← Indietro</button>' : ''}
  <button class="btn primary" type="submit">${esc(avanti)}</button></div>`;

// --- 1. Nome e cognome -------------------------------------------------------
function passoNome() {
  return `
    <h2 class="pp-gruppo" style="margin-top:0">Chi sei</h2>
    <div class="form-row">
      <div class="field" data-campo="nome"><label for="f-nome">Nome</label>
        <input type="text" id="f-nome" name="nome" value="${esc(stato.nome)}" autocomplete="given-name">
        <div class="pp-errore" role="alert"></div></div>
      <div class="field" data-campo="cognome"><label for="f-cognome">Cognome</label>
        <input type="text" id="f-cognome" name="cognome" value="${esc(stato.cognome)}" autocomplete="family-name">
        <div class="pp-errore" role="alert"></div></div>
    </div>
    ${azioni('Avanti', false)}`;
}

// --- 2. Rinnovo o nuova patente --------------------------------------------
function passoTipo() {
  return `
    <div class="field" data-campo="tipo">
      <fieldset class="pp-tipi"><legend>Che cosa vuoi fare?</legend>
        <div class="pt-scelte">
          ${TIPI_RICHIESTA.map(t => `<label class="pp-tipo pt-scelta">
            <input type="radio" name="tipo" value="${t.id}" ${stato.tipo === t.id ? 'checked' : ''}>
            <span><b>${esc(t.etichetta)}</b><small>${t.id === 'rinnovo'
              ? 'Hai già una patente CRI e sta per scadere (o è scaduta).'
              : 'Vuoi una patente CRI che non hai ancora.'}</small></span></label>`).join('')}
        </div>
      </fieldset>
      <div class="pp-errore" role="alert"></div>
    </div>
    ${azioni()}`;
}

// --- 3. Quale patente --------------------------------------------------------
function passoPatente() {
  return `
    <div class="field" data-campo="patente">
      <fieldset class="pp-tipi"><legend>${rinnovo() ? 'Quale patente vuoi rinnovare?' : 'Quale patente vuoi ottenere?'}</legend>
        <p class="pt-nota">Seleziona una sola patente: <b>la più alta</b> che devi ${rinnovo() ? 'rinnovare' : 'ottenere'}.</p>
        <div class="pt-patenti">
          ${PATENTI.map(p => `<label class="pp-tipo pt-patente">
            <input type="radio" name="patente" value="${p.numero}" ${String(stato.patente) === String(p.numero) ? 'checked' : ''}>
            <span><b>Patente ${p.numero}</b>${rinnovo() ? '' : `<small>${esc(PERCORSI[p.percorso].etichetta)}</small>
              <small class="pt-civile">${esc(p.civile)}</small>`}</span></label>`).join('')}
        </div>
      </fieldset>
      <div class="pp-errore" role="alert"></div>
    </div>
    <div class="pt-percorso" aria-live="polite">${riquadroPercorso()}</div>
    ${azioni()}`;
}

function percorsoScelto() {
  if (rinnovo()) return patente(stato.patente) ? RINNOVO : null;
  const p = patente(stato.patente);
  return p ? PERCORSI[p.percorso] : null;
}

// Il riquadro con il percorso compare solo per una nuova patente: per il
// rinnovo non aggiunge niente a quello che il volontario ha già scelto.
function riquadroPercorso() {
  const pr = percorsoScelto();
  if (!pr || rinnovo()) return '';
  return `<div class="banner info" style="margin:4px 0 0"><div class="bi">ℹ️</div><div>
    <b>Patente ${esc(stato.patente)}: ${esc(pr.etichetta.toLowerCase())}</b>
    <div class="small">${esc(pr.breve)}</div></div></div>`;
}

// --- 4. Documenti su Gaia -----------------------------------------------------
// Una domanda per documento: «Sì» oppure «No, mi serve supporto». Si va
// avanti solo dopo aver risposto a tutte e tre; con almeno un «No» la
// richiesta parte come richiesta di supporto (e la segreteria riceve
// un'email e un avviso nel portale).
// La richiesta non parte da qui: dopo i documenti ci sono la visita medica
// e (per le patenti dalla 5) il test dei riflessi, da confermare prima.
const inviaDaQui = (id) => passoDiInvio() === id;

// Trappola per i programmi che compilano i moduli da soli: le persone non
// la vedono. Sta nel passaggio da cui parte l'invio.
const trappola = () => '<div class="pt-trappola" aria-hidden="true"><label>Sito web <input name="sito" tabindex="-1" autocomplete="off"></label></div>';

const etichettaInvio = () => (documenti().some(d => stato.gaia[d.id] === false) ? 'Invia e chiedi supporto' : 'Invia la richiesta');

// I tasti in fondo a un passaggio: «Invia» se è quello da cui parte la
// richiesta, altrimenti «Avanti».
const tastiPassaggio = (id) => (inviaDaQui(id)
  ? `${trappola()}${azioni(etichettaInvio())}<div class="pp-esito" role="status"></div>`
  : azioni('Avanti'));

function passoGaia() {
  return `
    <h2 class="pp-gruppo" style="margin-top:0">Documenti</h2>
    <p class="pp-sotto">Rispondi a tutte le domande. Se non riesci a caricare un documento su Gaia${rinnovo() ? ' o a inviare la foto della patente' : ''},
      rispondi «No, mi serve supporto»: la segreteria ti aiuterà.</p>
    <div class="pt-domande">
      ${documenti().map(d => `<fieldset class="pt-domanda">
        <legend>${d.domanda}</legend>
        <div class="pt-sino">
          <label class="pp-tipo"><input type="radio" name="${d.id}" value="si" ${stato.gaia[d.id] === true ? 'checked' : ''}> <span>Sì</span></label>
          <label class="pp-tipo"><input type="radio" name="${d.id}" value="no" ${stato.gaia[d.id] === false ? 'checked' : ''}> <span>No, mi serve supporto</span></label>
        </div></fieldset>`).join('')}
    </div>
    <div class="banner warn pt-supporto" hidden style="margin:14px 0 0"><div class="bi">🤝</div><div>
      <b>Chiederai supporto alla segreteria</b>
      <div class="small">Inviando, la segreteria riceve la tua richiesta con i documenti che mancano e ti aiuta a completarla.</div>
    </div></div>
    ${tastiPassaggio('gaia')}`;
}

// --- Visita medica (per tutti) ---------------------------------------------
// Si prenota scrivendo nel gruppo WhatsApp: il modulo dà il link al gruppo e
// un messaggio già pronto da copiare. Va confermato prima di andare avanti.
const messaggioVisita = () => `Ciao, sono ${stato.nome} ${stato.cognome}. Vorrei prenotare la visita medica per ${rinnovo() ? 'il rinnovo della' : 'ottenere la'} patente CRI ${stato.patente}.`;

function passoVisita() {
  return `
    <h2 class="pp-gruppo" style="margin-top:0">Visita medica</h2>
    <div class="banner warn" style="margin:0 0 16px"><div class="bi">🩺</div><div>
      <b>Prenota la visita medica nel gruppo WhatsApp</b>
      <div class="small">Entra nel gruppo e manda un messaggio chiedendo di prenotare la visita medica.</div>
    </div></div>
    <a class="btn pt-gruppo-wa" href="${esc(VISITA_MEDICA.gruppoWhatsapp)}" target="_blank" rel="noopener">Entra nel gruppo WhatsApp</a>

    <label class="pt-link-etichetta" for="pt-msg-visita" style="margin-top:16px">Messaggio da mandare nel gruppo</label>
    <div class="pt-msg-visita">
      <p id="pt-msg-visita">${esc(messaggioVisita())}</p>
      <button class="btn sm" type="button" data-copia-visita>Copia</button>
    </div>

    <div class="field" data-campo="visita" style="margin:16px 0 0">
      <label class="pp-tipo pt-conferma"><input type="checkbox" name="visita" ${stato.visita ? 'checked' : ''}>
        <span>Ho capito: sono entrato nel gruppo WhatsApp e chiederò di prenotare la <b>visita medica</b>.</span></label>
      <div class="pp-errore" role="alert"></div>
    </div>
    ${tastiPassaggio('visita')}`;
}

// --- Test dei riflessi (patenti 5, 6, 7 e 8, nuove o da rinnovare) -----------
// Viene prima dell'invio: il volontario legge che cosa deve fare, lo
// conferma, e solo allora manda la richiesta.
function passoRiflessi() {
  const t = TEST_RIFLESSI;
  return `
    <h2 class="pp-gruppo" style="margin-top:0">Test dei riflessi</h2>
    <div class="banner warn" style="margin:0 0 16px"><div class="bi">📞</div><div>
      <b>Per ${rinnovo() ? 'rinnovare' : 'ottenere'} la patente ${esc(stato.patente)} devi fare il test dei riflessi</b>
      <div class="small">Chiama il <strong>Comitato Regionale Liguria</strong> al
        <a href="tel:${t.telefonoLink}" class="pt-telefono">${esc(t.telefono)}</a>
        e chiedi di effettuare il test dei riflessi.</div>
    </div></div>

    <h3 class="pt-sottotitolo">Come leggere i risultati</h3>
    <p class="pt-testo">Il test ha quattro prove: <b>ottico semplice</b>, <b>ottico complesso</b>, <b>acustico semplice</b> e
      <b>acustico complesso</b>. Per ognuna lo scontrino riporta due valori, <b>Rapidità</b> e <b>Regolarità</b>: è il numero
      dopo il trattino, quello cerchiato nell'esempio.</p>
    <ul class="pt-testo">
      <li>Sei <b>idoneo</b> se tutti gli otto valori sono <b>pari o superiori a ${t.sogliaMinima}</b>.</li>
      <li>Se anche uno solo è più basso, <b>chiedi di ripetere il test</b>: il risultato può dipendere da fattori esterni o dal
        fatto di non conoscere ancora la prova al primo tentativo.</li>
    </ul>
    <figure class="pt-esempio">
      <img src="img/patenti/test-riflessi-esempio.webp" width="1260" height="1440" loading="lazy"
        alt="Esempio di risultati del test dei riflessi: quattro scontrini (ottico semplice, ottico complesso, acustico semplice, acustico complesso), ognuno con i valori di Rapidità e Regolarità cerchiati.">
      <figcaption>Esempio: tutti i valori cerchiati sono pari o superiori a ${t.sogliaMinima} (il più basso è 05), quindi l'esito è idoneo.</figcaption>
    </figure>

    <div class="field" data-campo="riflessi" style="margin:16px 0 0">
      <label class="pp-tipo pt-conferma pt-conferma-riflessi"><input type="checkbox" name="riflessi" ${stato.riflessi ? 'checked' : ''}>
        <span>Ho letto: chiamerò il Comitato Regionale Liguria per fare il <b>test dei riflessi</b>.</span></label>
      <div class="pp-errore" role="alert"></div>
    </div>
    ${tastiPassaggio('riflessi')}`;
}

// --- 5. Fine -------------------------------------------------------------------
function riepilogo(righe) {
  return `<div class="pp-rif">
    <div><span>Volontario</span><b>${esc(stato.nome)} ${esc(stato.cognome)}</b></div>
    <div><span>Richiesta</span><b>${esc(tipoRichiesta(stato.tipo)?.etichetta || '')}</b></div>
    <div><span>Patente</span><b>Patente ${esc(stato.patente)}</b></div>
    ${righe}
  </div>`;
}

function passoSupporto() {
  const mancanti = documenti().filter(d => stato.gaia[d.id] !== true);
  return `
    <div class="banner ok" style="margin:0 0 14px"><div class="bi">✓</div><div>
      <b>Richiesta di supporto inviata</b><div class="small">La segreteria l'ha ricevuta e ti aiuterà a caricare i documenti che mancano.</div></div></div>
    ${riepilogo(`<div><span>Documenti da caricare</span><b>${mancanti.map(d => esc(d.breve)).join('<br>')}</b></div>`)}
    <p style="margin:14px 0 0">Non serve compilare di nuovo il modulo: la tua richiesta è già registrata. Se nel frattempo riesci a caricare
      i documenti su Gaia, avvisa la segreteria del tuo Comitato.</p>`;
}

function passoProcedura() {
  const pr = percorsoScelto();
  return `
    <div class="banner ok" style="margin:0 0 14px"><div class="bi">✓</div><div>
      <b>Richiesta inviata</b><div class="small">La segreteria l'ha ricevuta. Ecco come prosegue la procedura.</div></div></div>
    ${riepilogo(`${rinnovo() ? '' : `<div><span>Percorso</span><b>${esc(pr.etichetta)}</b></div>`}
      <div><span>Documenti</span><b>✓ tutti confermati</b></div>`)}
    <h2 class="pp-gruppo">Come prosegue la procedura</h2>
    ${pr.spiegazione
      ? `<div class="pt-testo">${pr.spiegazione}</div>`
      : `<div class="banner warn" style="margin:0"><div class="bi">📝</div><div>
          <b>Testo di spiegazione da inserire</b>
          <div class="small">Qui comparirà la spiegazione della procedura per ${rinnovo() ? 'il rinnovo' : `la ${esc(pr.etichetta.toLowerCase())}`}.</div></div></div>`}`;
}

// --- Comportamento -------------------------------------------------------------
function collega() {
  const form = zona.querySelector('form');
  form.querySelector('[data-indietro]')?.addEventListener('click', () => vai(stato.passo - 1));

  const qui = passoCorrente();
  if (qui === 'nome') {
    ['nome', 'cognome'].forEach(k => form[k].addEventListener('input', () => segna(form, k, '')));
  }
  if (qui === 'tipo') {
    form.querySelectorAll('input[name=tipo]').forEach(r => r.addEventListener('change', () => {
      // Cambiando da nuova a rinnovo (o viceversa) la patente scelta prima
      // va riguardata: si azzera, così la si sceglie di nuovo sapendo cosa.
      if (stato.tipo && stato.tipo !== r.value) stato.patente = '';
      stato.tipo = r.value;
      segna(form, 'tipo', '');
    }));
  }
  if (qui === 'patente') {
    form.querySelectorAll('input[name=patente]').forEach(r => r.addEventListener('change', () => {
      stato.patente = r.value;
      form.querySelector('.pt-percorso').innerHTML = riquadroPercorso();
      // La barra dei passaggi cambia subito se compare (o sparisce) il test
      // dei riflessi.
      zona.querySelector('.pt-passi').outerHTML = stepper();
      segna(form, 'patente', '');
    }));
  }
  if (qui === 'gaia') {
    const avanti = form.querySelector('button[type=submit]');
    const supporto = form.querySelector('.pt-supporto');
    const aggiorna = () => {
      documenti().forEach(d => {
        const v = form.querySelector(`input[name="${d.id}"]:checked`)?.value;
        stato.gaia[d.id] = v === 'si' ? true : v === 'no' ? false : null;
      });
      const serve = documenti().some(d => stato.gaia[d.id] === false);
      avanti.disabled = !documenti().every(d => stato.gaia[d.id] !== null);
      avanti.textContent = inviaDaQui('gaia') ? etichettaInvio() : 'Avanti';
      supporto.hidden = !serve;
    };
    form.querySelectorAll('.pt-domanda input').forEach(c => c.addEventListener('change', aggiorna));
    aggiorna();
  }
  if (qui === 'visita') {
    form.visita.addEventListener('change', () => { stato.visita = form.visita.checked; segna(form, 'visita', ''); });
    form.querySelector('[data-copia-visita]').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      try { await navigator.clipboard.writeText(messaggioVisita()); btn.textContent = 'Copiato ✓'; }
      catch { btn.textContent = 'Selezionalo e copialo'; }
      setTimeout(() => { btn.textContent = 'Copia'; }, 2500);
    });
  }
  if (qui === 'riflessi') {
    form.riflessi.addEventListener('change', () => { stato.riflessi = form.riflessi.checked; segna(form, 'riflessi', ''); });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (qui === 'nome') {
      stato.nome = form.nome.value.trim();
      stato.cognome = form.cognome.value.trim();
      segna(form, 'nome', stato.nome ? '' : 'Scrivi il tuo nome.');
      segna(form, 'cognome', stato.cognome ? '' : 'Scrivi il tuo cognome.');
    }
    if (qui === 'tipo') segna(form, 'tipo', tipoRichiesta(stato.tipo) ? '' : 'Scegli se vuoi rinnovare la patente o ottenerne una nuova.');
    if (qui === 'patente') segna(form, 'patente', patente(stato.patente) ? '' : (rinnovo() ? 'Scegli la patente da rinnovare.' : 'Scegli la patente che vuoi ottenere.'));
    if (qui === 'visita') segna(form, 'visita', stato.visita ? '' : 'Conferma di essere entrato nel gruppo WhatsApp.');
    if (qui === 'riflessi') segna(form, 'riflessi', stato.riflessi ? '' : 'Conferma di aver letto le indicazioni sul test dei riflessi.');
    const primo = form.querySelector('.pp-sbagliato');
    if (primo) { primo.scrollIntoView({ block: 'center', behavior: 'smooth' }); primo.querySelector('input')?.focus({ preventScroll: true }); return; }

    if (qui === 'gaia' && documenti().some(d => stato.gaia[d.id] === null)) return;
    // L'invio parte dall'ultimo passaggio prima della fine: la visita
    // medica, o il test dei riflessi quando c'è.
    if (inviaDaQui(qui)) {
      const supporto = documenti().some(d => stato.gaia[d.id] === false);
      if (!await invia(form, { supporto })) return;
      stato.supporto = supporto;
    }
    vai(stato.passo + 1);
  });
}

async function invia(form, { supporto = false } = {}) {
  const corpo = { nome: stato.nome, cognome: stato.cognome, tipo: stato.tipo, patente: stato.patente, documenti_gaia: stato.gaia, sito: form.sito.value, supporto };
  if (!controllaRichiesta(corpo).ok) return false;
  const btn = form.querySelector('button[type=submit]');
  const testo = btn.textContent;
  const esito = form.querySelector('.pp-esito');
  btn.disabled = true; btn.textContent = 'Invio in corso…'; esito.innerHTML = '';
  let r;
  try {
    const res = await fetch('/api/patenti', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
    let dati = {};
    try { dati = await res.json(); } catch { /* risposta non JSON: vale lo stato */ }
    r = { ok: res.ok, ...dati };
  } catch { r = { ok: false, error: 'Connessione assente: riprova fra un momento.' }; }
  btn.disabled = false; btn.textContent = testo;
  if (r.ok) return true;
  esito.innerHTML = `<div class="banner danger" style="margin:14px 0 0"><div class="bi">⚠️</div><div>${esc(r.error || 'Invio non riuscito.')}</div></div>`;
  return false;
}

function segna(form, campo, msg) {
  const f = form.querySelector(`[data-campo="${campo}"]`);
  if (!f) return;
  f.classList.toggle('pp-sbagliato', !!msg);
  f.querySelector('.pp-errore').textContent = msg;
}

function vai(passo) {
  stato.passo = Math.max(0, Math.min(passi().length - 1, passo));
  disegna();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- Domande e risposte, sotto ogni passaggio ------------------------------
// Tutte le domande, raggruppate e chiuse: si apre quella che interessa. La
// ricerca le filtra parola per parola. Il riquadro sta fuori dal modulo, così
// cambiando passaggio non si richiude e la ricerca resta.
function disegnaFaq() {
  const box = document.getElementById('faq');
  if (!box) return;
  box.innerHTML = `<div class="card-b">
    <h2 class="pp-titolo" id="faq-titolo">Domande e risposte</h2>
    <p class="pp-sotto">Requisiti, visita medica, prova pratica, rinnovo e patente digitale, dal Testo Unico CRI sulla circolazione dei veicoli.</p>
    <div class="search faq-cerca"><span class="search-icon" aria-hidden="true">🔍</span>
      <input type="search" placeholder="Cerca: rinnovo, visita, ambulanza, età…" aria-label="Cerca nelle domande e risposte"></div>
    <p class="faq-nota" aria-live="polite"></p>
    <div class="faq-elenco">${htmlFaq(esc)}</div>
  </div>`;
  const elenco = box.querySelector('.faq-elenco');
  const nota = box.querySelector('.faq-nota');
  box.querySelector('input').addEventListener('input', (e) => {
    const q = e.target.value.trim();
    const n = filtraFaq(elenco, q);
    nota.textContent = !q ? '' : n
      ? `${n} ${n === 1 ? 'risposta trovata' : 'risposte trovate'}`
      : 'Nessuna risposta trovata. Prova con un\'altra parola, o chiedi alla segreteria del tuo Comitato.';
  });
}

disegnaFaq();
disegna();
