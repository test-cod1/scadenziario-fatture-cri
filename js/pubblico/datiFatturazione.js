// ============================================================
//  MODULO PUBBLICO DEI DATI DI FATTURAZIONE (dati-fatturazione.html)
//  Lo apre il cliente dal link che trova nel preventivo, senza accedere
//  al portale. Il codice del link sta dopo il # («…/dati-fatturazione.html#
//  codice»): la parte dopo il # non viene mai mandata al server con la
//  pagina, quindi il codice non finisce nei log di chi la serve né nel
//  Referer; lo spedisce solo questo script, nel corpo della richiesta.
//
//  Le regole dei campi sono quelle di js/lib/datiFatturazione.mjs, le stesse
//  che applica il server: qui servono a dire subito al cliente cosa
//  correggere, la decisione resta a /api/dati-fatturazione.
// ============================================================
import { TIPI, controllaDati, FORMA_TOKEN } from '../lib/datiFatturazione.mjs';

const zona = document.getElementById('modulo');
const token = decodeURIComponent(location.hash.replace(/^#/, ''));

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtData = (iso) => iso ? new Date(String(iso).length === 10 ? iso + 'T00:00:00' : iso)
  .toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';

async function chiama(corpo) {
  const res = await fetch('/api/dati-fatturazione', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, ...corpo }),
  });
  let dati = {};
  try { dati = await res.json(); } catch { /* risposta non JSON: vale lo stato */ }
  return { ok: res.ok, status: res.status, ...dati };
}

function errore(titolo, testo) {
  zona.innerHTML = `<div class="card pp-card"><div class="card-b">
    <h1 class="pp-titolo">${esc(titolo)}</h1><p>${esc(testo)}</p></div></div>`;
}

async function avvia() {
  if (!FORMA_TOKEN.test(token)) {
    errore('Link non valido', 'Il link è incompleto. Copialo per intero dal preventivo, oppure chiedine uno nuovo a chi te lo ha mandato.');
    return;
  }
  let r;
  try { r = await chiama({ azione: 'leggi' }); }
  catch { errore('Modulo non raggiungibile', 'Controlla la connessione e ricarica la pagina.'); return; }
  if (!r.ok) { errore('Link non disponibile', r.error || 'Il link non è valido o è scaduto.'); return; }
  disegna(r.intestazione, r.dati || {}, r.inviato_il);
}

function campo(nome, etichetta, valore, { aiuto = '', segnaposto = '', tipo = 'text', extra = '' } = {}) {
  return `<div class="field" data-campo="${nome}"><label for="f-${nome}">${esc(etichetta)}</label>
    <input type="${tipo}" id="f-${nome}" name="${nome}" value="${esc(valore)}" placeholder="${esc(segnaposto)}" ${extra}>
    ${aiuto ? `<div class="hint">${esc(aiuto)}</div>` : ''}<div class="pp-errore" role="alert"></div></div>`;
}

function disegna(int, d, inviatoIl) {
  const tipo = d.tipo || 'azienda';
  zona.innerHTML = `
    <div class="card pp-card"><div class="card-b">
      <h1 class="pp-titolo">Dati per la fattura</h1>
      <p class="pp-sotto">Ti chiediamo i dati con cui emettere la fattura elettronica per questo servizio. Bastano due minuti.</p>
      <div class="pp-rif">
        <div><span>Servizio</span><b>${esc(int.servizio)}</b></div>
        ${int.oggetto ? `<div><span>Oggetto</span><b>${esc(int.oggetto)}</b></div>` : ''}
        ${int.data ? `<div><span>Preventivo del</span><b>${esc(fmtData(int.data))}${int.protocollo ? ` · Prot. n. ${esc(int.protocollo)}` : ''}</b></div>` : ''}
      </div>
      ${inviatoIl ? `<div class="banner ok" style="margin:16px 0 0"><div class="bi">✓</div><div><b>Dati già ricevuti il ${esc(fmtData(inviatoIl))}</b>
        <div class="small">Se qualcosa è cambiato, correggilo qui sotto e invia di nuovo: vale l'ultimo invio.</div></div></div>` : ''}
    </div></div>

    <form class="card pp-card" novalidate><div class="card-b">
      <fieldset class="pp-tipi"><legend>Chi riceve la fattura</legend>
        ${TIPI.map(([v, l]) => `<label class="pp-tipo"><input type="radio" name="tipo" value="${v}" ${tipo === v ? 'checked' : ''}> <span>${esc(l)}</span></label>`).join('')}
      </fieldset>

      <h2 class="pp-gruppo">Intestatario</h2>
      ${campo('ragione_sociale', 'Denominazione', d.ragione_sociale, { segnaposto: 'es. Omnia Service s.r.l.', extra: 'autocomplete="organization"' })}
      <div class="form-row">
        ${campo('partita_iva', 'Partita IVA', d.partita_iva, { segnaposto: '11 cifre', extra: 'inputmode="numeric" maxlength="13"' })}
        ${campo('codice_fiscale', 'Codice fiscale', d.codice_fiscale, { segnaposto: 'se diverso dalla partita IVA', extra: 'maxlength="16" style="text-transform:uppercase"' })}
      </div>

      <h2 class="pp-gruppo">Sede legale</h2>
      ${campo('indirizzo', 'Via e numero civico', d.indirizzo, { extra: 'autocomplete="street-address"' })}
      <div class="form-row pp-tre">
        ${campo('cap', 'CAP', d.cap, { extra: 'inputmode="numeric" maxlength="5" autocomplete="postal-code"' })}
        ${campo('comune', 'Comune', d.comune, { extra: 'autocomplete="address-level2"' })}
        ${campo('provincia', 'Provincia', d.provincia, { segnaposto: 'GE', extra: 'maxlength="2" style="text-transform:uppercase"' })}
      </div>
      <input type="hidden" name="nazione" value="${esc(d.nazione || 'IT')}">

      <div data-gruppo="sdi">
        <h2 class="pp-gruppo">Fattura elettronica</h2>
        <div class="form-row">
          ${campo('codice_destinatario', 'Codice destinatario', d.codice_destinatario, { aiuto: '7 caratteri, te lo dà il tuo commercialista o il gestionale. Oppure indica la PEC.', extra: 'maxlength="7" style="text-transform:uppercase"' })}
          ${campo('pec', 'PEC', d.pec, { tipo: 'email', segnaposto: 'nome@pec.it' })}
        </div>
      </div>

      <div data-gruppo="pa">
        <h2 class="pp-gruppo">Pubblica Amministrazione</h2>
        <div class="form-row">
          ${campo('codice_destinatario_pa', 'Codice univoco ufficio', d.tipo === 'ente_pubblico' ? d.codice_destinatario : '', { aiuto: '6 caratteri, si trova su indicepa.gov.it.', extra: 'maxlength="6" style="text-transform:uppercase"' })}
          ${campo('riferimento_ordine', 'Determina / ordine', d.riferimento_ordine, { segnaposto: 'es. Det. n. 123 del 10/10/2026' })}
        </div>
        <div class="form-row">
          ${campo('cig', 'CIG', d.cig, { aiuto: 'Se previsto: 10 caratteri.', extra: 'maxlength="10" style="text-transform:uppercase"' })}
          ${campo('cup', 'CUP', d.cup, { aiuto: 'Se previsto: 15 caratteri.', extra: 'maxlength="15" style="text-transform:uppercase"' })}
        </div>
        <label class="chk"><input type="checkbox" name="split_payment" ${d.split_payment ? 'checked' : ''}> Ente soggetto a scissione dei pagamenti (split payment)</label>
      </div>

      <h2 class="pp-gruppo">Contatti per la fattura</h2>
      <div class="form-row">
        ${campo('email_amministrazione', 'Email dell\'amministrazione', d.email_amministrazione, { tipo: 'email', aiuto: 'Per mandarti una copia di cortesia della fattura.' })}
        ${campo('telefono', 'Telefono', d.telefono, { tipo: 'tel', extra: 'autocomplete="tel"' })}
      </div>
      ${campo('referente', 'Referente amministrativo', d.referente, { extra: 'autocomplete="name"' })}
      <div class="field"><label for="f-note">Note per chi emette la fattura</label>
        <textarea id="f-note" name="note" rows="3" maxlength="1000" placeholder="es. riportare il numero d'ordine interno…">${esc(d.note)}</textarea></div>

      <div class="field" data-campo="privacy">
        <label class="chk pp-privacy"><input type="checkbox" name="privacy" ${d.privacy ? 'checked' : ''}>
          <span>Acconsento al trattamento di questi dati da parte della Croce Rossa Italiana — Comitato di Genova per la sola emissione e gestione della fattura relativa al servizio, ai sensi del Regolamento UE 2016/679.</span></label>
        <div class="pp-errore" role="alert"></div>
      </div>

      <div class="pp-azioni"><button class="btn primary" type="submit">Invia i dati</button></div>
      <div class="pp-esito" role="status"></div>
    </div></form>`;

  const form = zona.querySelector('form');
  const mostraGruppi = () => {
    const t = form.tipo.value;
    form.querySelector('[data-gruppo="sdi"]').hidden = t !== 'azienda';
    form.querySelector('[data-gruppo="pa"]').hidden = t !== 'ente_pubblico';
    form.querySelector('[data-campo="partita_iva"]').hidden = t === 'privato';
    form.querySelector('[data-campo="ragione_sociale"] label').textContent = t === 'privato' ? 'Nome e cognome' : 'Denominazione';
  };
  form.querySelectorAll('input[name=tipo]').forEach(r => r.addEventListener('change', mostraGruppi));
  mostraGruppi();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const grezzi = Object.fromEntries(fd.entries());
    grezzi.split_payment = form.split_payment.checked;
    grezzi.privacy = form.privacy.checked;
    // Per la PA il codice destinatario è il codice ufficio, in un campo suo.
    if (grezzi.tipo === 'ente_pubblico') grezzi.codice_destinatario = grezzi.codice_destinatario_pa;
    delete grezzi.codice_destinatario_pa;

    const esito = controllaDati(grezzi);
    mostraErrori(form, esito.errori);
    if (!esito.ok) { primoErrore(form); return; }

    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Invio in corso…';
    let r;
    try { r = await chiama({ azione: 'invia', dati: esito.dati }); }
    catch { r = { ok: false, error: 'Connessione assente: riprova fra un momento.' }; }
    btn.disabled = false; btn.textContent = 'Invia i dati';
    if (r.ok) { grazie(); return; }
    if (r.errori) { mostraErrori(form, r.errori); primoErrore(form); }
    form.querySelector('.pp-esito').innerHTML = `<div class="banner danger" style="margin:14px 0 0"><div class="bi">⚠️</div><div>${esc(r.error || 'Invio non riuscito.')}</div></div>`;
  });
}

function mostraErrori(form, errori) {
  form.querySelectorAll('[data-campo]').forEach(f => {
    const nome = f.dataset.campo === 'codice_destinatario_pa' ? 'codice_destinatario' : f.dataset.campo;
    // Il codice destinatario ha due campi (privati e PA): l'errore va su
    // quello visibile.
    const msg = f.offsetParent !== null ? (errori[nome] || '') : '';
    f.classList.toggle('pp-sbagliato', !!msg);
    const box = f.querySelector('.pp-errore');
    if (box) box.textContent = msg;
  });
  form.querySelector('.pp-esito').innerHTML = '';
}

function primoErrore(form) {
  const f = form.querySelector('.pp-sbagliato');
  f?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  f?.querySelector('input')?.focus({ preventScroll: true });
}

function grazie() {
  zona.innerHTML = `<div class="card pp-card"><div class="card-b pp-grazie">
    <div class="pp-spunta" aria-hidden="true">✓</div>
    <h1 class="pp-titolo">Grazie, dati ricevuti</h1>
    <p>Li useremo per emettere la fattura. Se devi correggere qualcosa, riapri lo stesso link: vale l'ultimo invio.</p>
  </div></div>`;
  window.scrollTo({ top: 0 });
}

avvia();
