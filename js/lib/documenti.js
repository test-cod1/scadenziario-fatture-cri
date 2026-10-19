// ============================================================
//  Helper condivisi fra l'editor delle fatture PASSIVE (views/fattura.js) e
//  quello delle fatture ATTIVE (views/fatturaAttiva.js).
// ------------------------------------------------------------
//  Erano copiati identici nei due file: una correzione applicata a uno solo
//  dei due lasciava l'altra sezione col difetto (è già successo con
//  l'anteprima e con l'avviso di sovrapagamento). Qui c'è un'unica copia.
// ============================================================
import { el, esc, confirmDialog, fmtEuro, toast } from './ui.js';
import { METODI } from './xmlFattura.js';

// Callback "ricarica il record e ridisegna", da passare come `onSaved` a una
// finestra modale. Il catch non è un di più: quelle callback vengono invocate
// senza che nessuno ne aspetti la promise, quindi un intoppo di rete diventava
// un rifiuto non gestito — nessun messaggio, e pagamenti o note di credito
// fermi a prima dell'operazione, come se non fosse stata registrata.
export function aggiornaDopo(carica, onChange) {
  return async () => {
    try { onChange(await carica()); }
    catch (e) { toast('Aggiornamento non riuscito: ' + e.message + ' — riapri la fattura.', 'err'); }
  };
}

// Riporta un valore qualsiasi dentro la lista dei metodi ammessi: così un
// metodo non previsto diventa "altro" invece di sparire senza dire nulla.
export function metodoAmmesso(v) {
  if (!v) return '';
  return METODI.includes(v) ? v : 'altro';
}

// Id generato lato client, così l'insert della fattura resta una sola
// operazione (una sola riga nel registro modifiche) anche quando il record
// viene composto in più passaggi.
export function nuovoIdFattura() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  // Fallback per browser datati o contesti non sicuri (dove randomUUID manca).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// Avviso non bloccante quando un pagamento/incasso supera il residuo: un
// errore di battitura (un importo con uno zero di troppo) altrimenti registra
// un "sovrapagamento" che sparisce silenziosamente, perché il residuo resta
// clampato a 0 (vedi withResiduo nei data layer) invece di segnalare l'anomalia.
// `rileggi` (facoltativo): funzione che ricarica la fattura dal database.
// Le finestre di pagamento lavorano sulla riga caricata quando si è aperta la
// pagina: se nel frattempo un collega ha già registrato il saldo, il residuo
// a schermo è vecchio e il secondo pagamento passava senza alcun avviso.
// Con `rileggi` il confronto si fa sul residuo vero di adesso, e se è
// cambiato lo si dice.
export async function confermaSeSuperaResiduo(importo, residuo, rileggi) {
  let attuale = residuo;
  let cambiato = false;
  if (rileggi) {
    try {
      const fresca = await rileggi();
      if (fresca && Number.isFinite(fresca._residuo)) {
        cambiato = Math.abs(fresca._residuo - residuo) > 0.005;
        attuale = fresca._residuo;
      }
    } catch { /* rilettura non riuscita: si confronta con il residuo che si ha */ }
  }
  const premessa = cambiato
    ? `Nel frattempo la fattura è stata aggiornata: il residuo era ${fmtEuro(residuo)}, ora è ${fmtEuro(attuale)}. `
    : '';
  if (importo <= attuale + 0.005) {
    if (!cambiato) return true;
    return confirmDialog(premessa + `Registrare comunque ${fmtEuro(importo)}?`, { okLabel: 'Registra' });
  }
  return confirmDialog(
    premessa + `L'importo (${fmtEuro(importo)}) supera il residuo della fattura (${fmtEuro(attuale)}). Registrare comunque?`,
    { danger: true, okLabel: 'Registra comunque' });
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ============================================================
//  Anteprima del file caricato — solo lato client (URL.createObjectURL):
//  il file non viene mai inviato altrove né conservato, serve solo per
//  confrontare a colpo d'occhio il documento originale con i campi letti.
//  Il chiamante è responsabile di revocare l'url (URL.revokeObjectURL)
//  quando l'anteprima non serve più, per non trattenere il file in memoria.
// ============================================================
export function renderAnteprimaFile(file) {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  const isImg = /^image\//.test(file.type);
  if (isPdf || isImg) {
    const url = URL.createObjectURL(file);
    const node = isPdf
      ? el(`<iframe class="fp-frame" src="${esc(url)}" title="Anteprima ${esc(file.name)}"></iframe>`)
      : el(`<img class="fp-img" src="${esc(url)}" alt="Anteprima ${esc(file.name)}">`);
    return { node, url };
  }
  return {
    node: el(`<div class="fp-empty">📄 ${esc(file.name)}<br>Anteprima non disponibile per questo formato: verifica i campi qui a fianco.</div>`),
    url: null,
  };
}

// ============================================================
//  Autocompletamento su fornitore / cliente
// ------------------------------------------------------------
//  Fornitore e cliente sono campi di testo libero: senza suggerimenti,
//  "Enel SpA" ed "ENEL S.p.A." diventano due soggetti distinti e il Report
//  spezza in due il totale di quel fornitore. Un <datalist> collegato al
//  campo propone i nomi già usati mentre si scrive, così la grafia resta la
//  stessa senza dover introdurre una vera tabella anagrafica.
//
//  I nomi si caricano DOPO l'apertura della finestra (l'editor non aspetta la
//  query) e il campo resta comunque libero: il datalist suggerisce, non
//  vincola, e un fornitore nuovo si scrive normalmente.
let _seqDatalist = 0;
export function collegaAutocompletamento(input, caricaNomi) {
  if (!input) return;
  const id = 'nomi-noti-' + (++_seqDatalist);
  const lista = el(`<datalist id="${id}"></datalist>`);
  input.setAttribute('list', id);
  input.after(lista);
  caricaNomi().then(nomi => {
    for (const n of nomi) lista.appendChild(el(`<option value="${esc(n)}"></option>`));
  }).catch(() => { /* senza suggerimenti il campo resta comunque utilizzabile */ });
}

// Cosa ha fatto l'abbinamento automatico di una nota di credito letta da XML
// (abbinaNotaCredito in lib/soggetti.js): quali fatture ha spuntato, e quali
// fra quelle dichiarate nel documento vanno scelte a mano, e perché.
export function bannerAbbinamento({ abbinate, mancanti, ambigue }) {
  const righe = [];
  if (abbinate.length) {
    righe.push('Abbinata in automatico a ' + abbinate.map(a =>
      `n. <span style="font-weight:700">${esc(a.fattura.numero_fattura || '—')}</span> (${fmtEuro(a.importo)})`).join(', ') + '. Controlla gli importi prima di registrare.');
    const oltre = abbinate.filter(a => a.importo > (Number(a.fattura._residuo) || 0) + 0.005);
    if (oltre.length) righe.push('Lo storno supera il residuo di ' + oltre.map(a => 'n. ' + esc(a.fattura.numero_fattura || '—')).join(', ') + ': la fattura risulterà pagata più del dovuto.');
  }
  if (mancanti.length) righe.push(`Non trovata fra le fatture registrate: n. ${mancanti.map(esc).join(', ')}. Cercala qui sotto.`);
  if (ambigue.length) righe.push(`Più fatture con il numero ${ambigue.map(esc).join(', ')}: scegli tu quella giusta qui sotto.`);
  const tutto = abbinate.length && !mancanti.length && !ambigue.length;
  return el(`<div class="banner ${tutto ? 'ok' : 'warn'}" style="margin-bottom:10px">
    <div class="bi">${tutto ? '🔗' : '🔎'}</div>
    <div class="small">${righe.join('<br>')}</div>
  </div>`);
}

// Errore di lettura (quota AI esaurita, formato non riconosciuto, ecc.):
// un banner ben visibile invece di una riga di testo grigia, che passava
// facilmente inosservata mescolata agli altri messaggi di stato.
export function bannerErroreLettura(messaggio) {
  return el(`<div class="banner warn" style="margin:10px 0 0">
    <div class="bi">⚠️</div>
    <div><b>Lettura automatica non riuscita</b><div class="small">${esc(messaggio)} Compila i campi a mano, confrontando con l'anteprima.</div></div>
  </div>`);
}
