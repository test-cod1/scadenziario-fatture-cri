// ============================================================
//  MODULO PUBBLICO PATENTI CRI (patenti.html)
//  Lo apre il volontario dal link che gli manda la segreteria, senza
//  accedere al portale. Lo accompagna nella richiesta, un passaggio alla
//  volta: ognuno è un cancello, e si va avanti solo dopo averlo superato.
//    1. nome e cognome;
//    2. rinnovare la patente CRI o ottenerne una nuova;
//    3. quale patente;
//    4. i documenti su Gaia: per ognuno «Sì» o «No, mi serve supporto»;
//    5. come prosegue (oppure, se ha chiesto supporto, cosa succede ora).
//
//  La richiesta si invia superando il passaggio 4: va a /api/patenti, che
//  ricontrolla i dati con le stesse regole (js/lib/patenti.mjs) e la salva
//  per la segreteria. L'ultimo passaggio si apre solo a invio riuscito.
//
//  Sotto ogni passaggio ci sono tutte le domande e risposte
//  (js/lib/faqPatenti.mjs), con la ricerca.
// ============================================================
import { PATENTI, PERCORSI, DOCUMENTI_GAIA, TIPI_RICHIESTA, RINNOVO, TEST_RIFLESSI, patente, tipoRichiesta, servonoRiflessi, controllaRichiesta } from '../lib/patenti.mjs';
import { htmlFaq, filtraFaq } from '../lib/faqPatenti.mjs';

const zona = document.getElementById('modulo');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// I passaggi dipendono dalle scelte: chi rinnova una patente superiore alla
// 5 ha in più il passaggio del test dei riflessi, dopo i documenti.
function passi() {
  return [
    { id: 'nome', etichetta: 'Nome', disegna: passoNome },
    { id: 'tipo', etichetta: 'Richiesta', disegna: passoTipo },
    { id: 'patente', etichetta: 'Patente', disegna: passoPatente },
    { id: 'gaia', etichetta: 'Documenti', disegna: passoGaia },
    ...(servonoRiflessi(stato.tipo, stato.patente) ? [{ id: 'riflessi', etichetta: 'Riflessi', disegna: passoRiflessi }] : []),
    { id: 'fine', etichetta: 'Procedura', disegna: () => (stato.supporto ? passoSupporto() : passoProcedura()) },
  ];
}
const passoCorrente = () => passi()[stato.passo]?.id;

const stato = {
  passo: 0,
  nome: '',
  cognome: '',
  tipo: '',          // 'nuova' | 'rinnovo'
  patente: '',
  // Per documento: true (Sì), false (No, mi serve supporto) o null (non ancora risposto).
  gaia: Object.fromEntries(DOCUMENTI_GAIA.map(d => [d.id, null])),
  supporto: false,
};

const rinnovo = () => stato.tipo === 'rinnovo';

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
function passoGaia() {
  return `
    <h2 class="pp-gruppo" style="margin-top:0">Documenti su Gaia</h2>
    <p class="pp-sotto">Rispondi a tutte e tre le domande. Se non riesci a caricare un documento su Gaia,
      rispondi «No, mi serve supporto»: la segreteria ti aiuterà.</p>
    <div class="pt-domande">
      ${DOCUMENTI_GAIA.map(d => `<fieldset class="pt-domanda">
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
    <!-- Trappola per i programmi che compilano i moduli da soli: le persone non la vedono. -->
    <div class="pt-trappola" aria-hidden="true"><label>Sito web <input name="sito" tabindex="-1" autocomplete="off"></label></div>
    ${azioni('Invia la richiesta')}
    <div class="pp-esito" role="status"></div>`;
}

// --- Test dei riflessi (rinnovo delle patenti 6, 7 e 8) ----------------------
// Arriva dopo l'invio: la richiesta è già partita, qui il volontario scopre
// che cosa deve fare in più. Non c'è «Indietro», perché tornando ai
// documenti si rimanderebbe la richiesta.
function passoRiflessi() {
  const t = TEST_RIFLESSI;
  return `
    <div class="banner ok" style="margin:0 0 14px"><div class="bi">✓</div><div>
      <b>${stato.supporto ? 'Richiesta di supporto inviata' : 'Richiesta inviata'}</b>
      <div class="small">Prima di andare avanti leggi questo passaggio: per il tuo rinnovo serve un test in più.</div></div></div>

    <h2 class="pp-gruppo" style="margin-top:0">Test dei riflessi</h2>
    <div class="banner warn" style="margin:0 0 16px"><div class="bi">📞</div><div>
      <b>Per rinnovare la patente ${esc(stato.patente)} devi fare il test dei riflessi</b>
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
    ${azioni('Ho capito, avanti', false)}`;
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
  const mancanti = DOCUMENTI_GAIA.filter(d => stato.gaia[d.id] !== true);
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
      <div><span>Documenti su Gaia</span><b>✓ tutti caricati</b></div>`)}
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
      segna(form, 'patente', '');
    }));
  }
  if (qui === 'gaia') {
    const avanti = form.querySelector('button[type=submit]');
    const supporto = form.querySelector('.pt-supporto');
    const aggiorna = () => {
      DOCUMENTI_GAIA.forEach(d => {
        const v = form.querySelector(`input[name="${d.id}"]:checked`)?.value;
        stato.gaia[d.id] = v === 'si' ? true : v === 'no' ? false : null;
      });
      const serve = DOCUMENTI_GAIA.some(d => stato.gaia[d.id] === false);
      avanti.disabled = !DOCUMENTI_GAIA.every(d => stato.gaia[d.id] !== null);
      avanti.textContent = serve ? 'Invia e chiedi supporto' : 'Invia la richiesta';
      supporto.hidden = !serve;
    };
    form.querySelectorAll('.pt-domanda input').forEach(c => c.addEventListener('change', aggiorna));
    aggiorna();
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
    const primo = form.querySelector('.pp-sbagliato');
    if (primo) { primo.scrollIntoView({ block: 'center', behavior: 'smooth' }); primo.querySelector('input')?.focus({ preventScroll: true }); return; }

    if (qui === 'gaia') {
      if (DOCUMENTI_GAIA.some(d => stato.gaia[d.id] === null)) return;
      const supporto = DOCUMENTI_GAIA.some(d => stato.gaia[d.id] === false);
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
