// ---------- DOM ----------
export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
export function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

// ---------- Formatting ----------
export function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00'); if (isNaN(d)) return iso;
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
export function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso); if (isNaN(d)) return iso;
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' +
    d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}
export function fmtEuro(nv, dash = '—') {
  if (nv === null || nv === undefined || nv === '' || (typeof nv === 'number' && !Number.isFinite(nv))) return dash;
  return Number(nv).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}
export function todayISO() { return new Date().toISOString().slice(0, 10); }
export function giorniDa(iso) {
  if (!iso) return null;
  const d = new Date(iso + 'T00:00:00');
  const oggi = new Date(todayISO() + 'T00:00:00');
  return Math.round((d - oggi) / 86400000);
}

// ---------- Toast ----------
let toastT;
export function toast(msg, kind = '') {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = el(`<div class="toast ${kind}">${esc(msg)}</div>`);
  document.body.appendChild(t);
  clearTimeout(toastT);
  toastT = setTimeout(() => t.remove(), 3000);
}

// ---------- Modal ----------
// onClose viene invocata su OGNI via di uscita (pulsante ✕, tasto Esc, click
// sullo sfondo, o close() chiamata dal codice) e una sola volta: è lì che il
// chiamante può, per esempio, ricaricare i dati se nel frattempo ha scritto
// qualcosa sul database. Senza, chiudendo con la ✕ la dashboard sottostante
// restava ferma ai valori precedenti.
export function openModal({ title, body, footer, wide, onClose }) {
  const back = el(`<div class="modal-back"></div>`);
  const modal = el(`<div class="modal" ${wide ? 'style="max-width:860px"' : ''}>
    <div class="m-h"><h3>${esc(title)}</h3><button class="btn ghost sm" data-x>✕</button></div>
    <div class="m-b"></div>
    <div class="m-f"></div>
  </div>`);
  modal.querySelector('.m-b').append(body);
  if (footer) modal.querySelector('.m-f').append(footer); else modal.querySelector('.m-f').remove();
  back.appendChild(modal);

  let chiuso = false;
  // Esc chiude solo il modale in cima alla pila: con una conferma aperta sopra
  // l'editor, prima si chiudeva anche l'editor sottostante.
  const onKey = (e) => {
    if (e.key !== 'Escape') return;
    const aperti = document.querySelectorAll('.modal-back');
    if (aperti[aperti.length - 1] !== back) return;
    close();
  };
  const close = () => {
    if (chiuso) return;            // close() può arrivare da più strade: agisci una volta sola
    chiuso = true;
    document.removeEventListener('keydown', onKey);
    back.remove();
    if (onClose) onClose();
  };
  back.addEventListener('click', e => { if (e.target === back) close(); });
  modal.querySelector('[data-x]').addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  document.body.appendChild(back);
  return { close, modal, back };
}

// ---------- confirm ----------
// La Promise si risolve su QUALUNQUE chiusura: prima solo i due pulsanti la
// risolvevano, quindi chiudendo la conferma con Esc, con la ✕ o cliccando sullo
// sfondo restava pending per sempre e il codice in attesa (eliminazione di una
// fattura o di un pagamento) non riprendeva più fino al ricaricamento pagina.
export function confirmDialog(msg, { danger, okLabel } = {}) {
  return new Promise(res => {
    let esito = false;   // ogni uscita che non sia "Conferma" vale come annullamento
    const body = el(`<p style="margin:0">${esc(msg)}</p>`);
    const foot = el(`<div style="display:flex;gap:10px">
      <button class="btn" data-no>Annulla</button>
      <button class="btn ${danger ? 'danger' : 'primary'}" data-yes>${esc(okLabel || 'Conferma')}</button></div>`);
    const { close } = openModal({ title: 'Conferma', body, footer: foot, onClose: () => res(esito) });
    foot.querySelector('[data-no]').onclick = () => close();
    foot.querySelector('[data-yes]').onclick = () => { esito = true; close(); };
  });
}

// ---------- debounce ----------
export function debounce(fn, ms = 300) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

// ---------- parsing importi in stile italiano ("1.234,56" -> 1234.56) ----------
// La versione precedente toglieva i punti solo se seguiti da tre cifre e da una
// virgola: su "1.234.567,89" ne sopravviveva uno e il risultato era 1.234567.
// Qui si individua esplicitamente il separatore decimale (il più a destra fra
// virgola e punto, con le regole tipiche di entrambe le notazioni) e si
// trattano tutti gli altri come separatori delle migliaia.
export function parseEuro(s) {
  if (s === null || s === undefined || s === "") return null;
  if (typeof s === "number") return Number.isFinite(s) ? s : null;

  let clean = String(s).replace(/[^0-9,.-]/g, "");
  const negativo = clean.startsWith("-");
  clean = clean.replace(/-/g, "");
  if (!clean) return null;

  const iVirgola = clean.lastIndexOf(",");
  const iPunto = clean.lastIndexOf(".");
  let decimale = -1;
  if (iVirgola >= 0 && iPunto >= 0) {
    decimale = Math.max(iVirgola, iPunto);        // il più a destra è il decimale
  } else if (iVirgola >= 0) {
    decimale = clean.indexOf(",") === iVirgola ? iVirgola : -1;   // più virgole = migliaia
  } else if (iPunto >= 0) {
    const unico = clean.indexOf(".") === iPunto;
    const cifreDopo = clean.length - iPunto - 1;
    // Un solo punto seguito da esattamente tre cifre ("2.500") in un importo
    // scritto all'italiana indica le migliaia, non i decimali.
    decimale = (unico && cifreDopo !== 3) ? iPunto : -1;
  }

  const intero = (decimale >= 0 ? clean.slice(0, decimale) : clean).replace(/[.,]/g, "");
  const decimali = decimale >= 0 ? clean.slice(decimale + 1).replace(/[.,]/g, "") : "";
  const n = parseFloat((intero || "0") + (decimali ? "." + decimali : ""));
  if (!Number.isFinite(n)) return null;
  return negativo ? -n : n;
}
