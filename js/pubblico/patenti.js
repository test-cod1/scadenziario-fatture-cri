// ============================================================
//  MODULO PUBBLICO PATENTI CRI (patenti.html)
//  Lo apre il volontario dal link che gli manda la segreteria, senza
//  accedere al portale. Lo accompagna, un passo alla volta, nella
//  procedura di emissione o rinnovo della patente CRI:
//    1. chi è e quale patente chiede;
//    2. i documenti già caricati su Gaia (vanno confermati tutti);
//    3. come prosegue la procedura per quella patente.
//
//  La richiesta si invia confermando il passo 2: va a /api/patenti, che
//  ricontrolla i dati con le stesse regole (js/lib/patenti.mjs) e la salva
//  per la segreteria. Il passo 3 si apre solo a invio riuscito.
// ============================================================
import { PATENTI, PERCORSI, DOCUMENTI_GAIA, patente, percorsoDi, controllaRichiesta } from '../lib/patenti.mjs';
import { htmlFaq, filtraFaq } from '../lib/faqPatenti.mjs';

const zona = document.getElementById('modulo');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const PASSI = ['I tuoi dati', 'Documenti su Gaia', 'Procedura'];

const stato = {
  passo: 0,
  nome: '',
  cognome: '',
  patente: '',
  // Per documento: true (Sì), false (No) o null (non ancora risposto).
  gaia: Object.fromEntries(DOCUMENTI_GAIA.map(d => [d.id, null])),
  inviata: false,
  supporto: false,
};

function stepper() {
  return `<ol class="pt-passi" aria-label="Avanzamento">
    ${PASSI.map((t, i) => `<li class="${i < stato.passo ? 'fatto' : i === stato.passo ? 'attivo' : ''}" ${i === stato.passo ? 'aria-current="step"' : ''}>
      <span class="n">${i < stato.passo ? '✓' : i + 1}</span><span class="t">${esc(t)}</span></li>`).join('')}
  </ol>`;
}

function disegna() {
  const corpo = [passoDati, passoGaia, stato.supporto ? passoSupporto : passoProcedura][stato.passo]();
  zona.innerHTML = `
    <div class="card pp-card"><div class="card-b">
      <h1 class="pp-titolo">Patenti CRI</h1>
      <p class="pp-sotto">Segui questi passaggi per la richiesta di emissione o rinnovo della tua patente CRI.
        Hai un dubbio? <a href="#faq">Leggi le domande frequenti</a>.</p>
      ${stepper()}
    </div></div>
    <form class="card pp-card" novalidate><div class="card-b">${corpo}</div></form>`;
  collega();
}

// --- Passo 1: dati ---------------------------------------------------------
function passoDati() {
  return `
    <h2 class="pp-gruppo" style="margin-top:0">Chi sei</h2>
    <div class="form-row">
      <div class="field" data-campo="nome"><label for="f-nome">Nome</label>
        <input id="f-nome" name="nome" value="${esc(stato.nome)}" autocomplete="given-name">
        <div class="pp-errore" role="alert"></div></div>
      <div class="field" data-campo="cognome"><label for="f-cognome">Cognome</label>
        <input id="f-cognome" name="cognome" value="${esc(stato.cognome)}" autocomplete="family-name">
        <div class="pp-errore" role="alert"></div></div>
    </div>

    <div class="field" data-campo="patente">
      <fieldset class="pp-tipi"><legend>Patente richiesta</legend>
        <div class="pt-patenti">
          ${PATENTI.map(p => `<label class="pp-tipo pt-patente">
            <input type="radio" name="patente" value="${p.numero}" ${String(stato.patente) === String(p.numero) ? 'checked' : ''}>
            <span><b>Patente ${p.numero}</b><small>${esc(PERCORSI[p.percorso].etichetta)}</small></span></label>`).join('')}
        </div>
      </fieldset>
      <div class="pp-errore" role="alert"></div>
    </div>
    <div class="pt-percorso" aria-live="polite">${riquadroPercorso()}</div>

    <div class="pp-azioni"><button class="btn primary" type="submit">Avanti</button></div>`;
}

function riquadroPercorso() {
  const pr = percorsoDi(stato.patente);
  if (!pr) return '';
  return `<div class="banner info" style="margin:4px 0 0"><div class="bi">ℹ️</div><div>
    <b>Patente ${esc(stato.patente)}: ${esc(pr.etichetta.toLowerCase())}</b>
    <div class="small">${esc(pr.breve)}</div></div></div>`;
}

// --- Passo 2: documenti su Gaia ---------------------------------------------
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
    <div class="pp-azioni pt-azioni">
      <button class="btn" type="button" data-indietro>← Indietro</button>
      <button class="btn primary" type="submit">Invia la richiesta</button>
    </div>
    <div class="pp-esito" role="status"></div>`;
}

// --- Passo 3 per chi ha chiesto supporto ------------------------------------
function passoSupporto() {
  const mancanti = DOCUMENTI_GAIA.filter(d => stato.gaia[d.id] !== true);
  return `
    <div class="banner ok" style="margin:0 0 14px"><div class="bi">✓</div><div>
      <b>Richiesta di supporto inviata</b><div class="small">La segreteria l'ha ricevuta e ti aiuterà a caricare i documenti che mancano.</div></div></div>
    <div class="pp-rif">
      <div><span>Volontario</span><b>${esc(stato.nome)} ${esc(stato.cognome)}</b></div>
      <div><span>Patente richiesta</span><b>Patente ${esc(stato.patente)}</b></div>
      <div><span>Documenti da caricare</span><b>${mancanti.map(d => esc(d.breve)).join('<br>')}</b></div>
    </div>
    <p style="margin:14px 0 0">Non serve compilare di nuovo il modulo: la tua richiesta è già registrata. Se nel frattempo riesci a caricare
      i documenti su Gaia, avvisa la segreteria del tuo Comitato.</p>`;
}

// --- Passo 3: procedura ----------------------------------------------------
function passoProcedura() {
  const p = patente(stato.patente);
  const pr = PERCORSI[p.percorso];
  return `
    <div class="banner ok" style="margin:0 0 14px"><div class="bi">✓</div><div>
      <b>Richiesta inviata</b><div class="small">La segreteria l'ha ricevuta. Ecco come prosegue la procedura.</div></div></div>
    <div class="pp-rif">
      <div><span>Volontario</span><b>${esc(stato.nome)} ${esc(stato.cognome)}</b></div>
      <div><span>Patente richiesta</span><b>Patente ${p.numero}</b></div>
      <div><span>Percorso</span><b>${esc(pr.etichetta)}</b></div>
      <div><span>Documenti su Gaia</span><b>✓ tutti confermati</b></div>
    </div>
    <h2 class="pp-gruppo">Come prosegue la procedura</h2>
    ${pr.spiegazione
      ? `<div class="pt-testo">${pr.spiegazione}</div>`
      : `<div class="banner warn" style="margin:0"><div class="bi">📝</div><div>
          <b>Testo di spiegazione da inserire</b>
          <div class="small">Qui comparirà la spiegazione della procedura per la ${esc(pr.etichetta.toLowerCase())}.</div></div></div>`}`;
}

// --- Comportamento ---------------------------------------------------------
function collega() {
  const form = zona.querySelector('form');
  form.querySelector('[data-indietro]')?.addEventListener('click', () => vai(stato.passo - 1));

  if (stato.passo === 0) {
    ['nome', 'cognome'].forEach(k => form[k].addEventListener('input', () => segna(form, k, '')));
    form.querySelectorAll('input[name=patente]').forEach(r => r.addEventListener('change', () => {
      stato.patente = r.value;
      form.querySelector('.pt-percorso').innerHTML = riquadroPercorso();
      segna(form, 'patente', '');
    }));
  }

  if (stato.passo === 1) {
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
    if (stato.passo === 0) {
      stato.nome = form.nome.value.trim();
      stato.cognome = form.cognome.value.trim();
      const errori = {
        nome: stato.nome ? '' : 'Scrivi il tuo nome.',
        cognome: stato.cognome ? '' : 'Scrivi il tuo cognome.',
        patente: patente(stato.patente) ? '' : 'Scegli la patente che richiedi.',
      };
      Object.entries(errori).forEach(([k, v]) => segna(form, k, v));
      const primo = form.querySelector('.pp-sbagliato');
      if (primo) { primo.scrollIntoView({ block: 'center', behavior: 'smooth' }); primo.querySelector('input')?.focus({ preventScroll: true }); return; }
    }
    if (stato.passo === 1) {
      if (DOCUMENTI_GAIA.some(d => stato.gaia[d.id] === null)) return;
      const supporto = DOCUMENTI_GAIA.some(d => stato.gaia[d.id] === false);
      if (!await invia(form, { supporto })) return;
      stato.supporto = supporto;
    }
    vai(stato.passo + 1);
  });
}

async function invia(form, { supporto = false } = {}) {
  const corpo = { nome: stato.nome, cognome: stato.cognome, patente: stato.patente, documenti_gaia: stato.gaia, sito: form.sito.value, supporto };
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
  if (r.ok) { stato.inviata = true; return true; }
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
  stato.passo = Math.max(0, Math.min(PASSI.length - 1, passo));
  disegna();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- Domande e risposte -----------------------------------------------------
function disegnaFaq() {
  const box = document.getElementById('faq');
  if (!box) return;
  box.innerHTML = `<div class="card-b">
    <h2 class="pp-titolo" id="faq-titolo">Domande frequenti</h2>
    <p class="pp-sotto">Requisiti, visita medica, prova pratica, rinnovo e patente digitale, dal Testo Unico CRI sulla circolazione dei veicoli.</p>
    <div class="search faq-cerca"><span class="search-icon" aria-hidden="true">🔍</span>
      <input type="search" placeholder="Cerca: visita medica, rinnovo, ambulanza…" aria-label="Cerca nelle domande"></div>
    <div class="faq-elenco">${htmlFaq(esc)}</div>
    <p class="faq-vuoto" hidden>Nessuna domanda trovata. Prova con un'altra parola, o chiedi alla segreteria del tuo Comitato.</p>
  </div>`;
  const elenco = box.querySelector('.faq-elenco');
  box.querySelector('input').addEventListener('input', (e) => {
    box.querySelector('.faq-vuoto').hidden = filtraFaq(elenco, e.target.value) > 0;
  });
}

disegna();
disegnaFaq();
