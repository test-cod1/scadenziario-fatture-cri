import { el, esc } from '../lib/ui.js';

// ============================================================
//  Segnaposto per le sezioni non ancora sviluppate.
//  Esistono già come rotta e sono protette dai permessi esattamente come le
//  altre: quando il contenuto sarà pronto basterà sostituire questa vista
//  nel router, senza toccare né menu né autorizzazioni.
// ============================================================

// Sezione "esterna": il gestionale è già online per conto suo. Dalla home la
// card lo apre direttamente in una scheda nuova; questa pagina si vede solo
// arrivandoci da un link diretto, e serve a non lasciare un vicolo cieco.
export async function renderSezioneEsterna(view, ctx, sezione) {
  view.appendChild(el(`<div>
    <div class="page-head"><div>
      <h1>${esc(sezione.label)}</h1>
      <p>${esc(sezione.descrizione)}</p>
    </div></div>
    <div class="card"><div class="card-b">
      <p>Questa sezione ha un gestionale dedicato, ospitato su un altro indirizzo.</p>
      <p><a class="btn primary" href="${esc(sezione.url)}" target="_blank" rel="noopener noreferrer">Apri ${esc(sezione.label)} ↗</a></p>
      <p class="hint" style="margin-top:12px">L'accesso a quel gestionale ha credenziali proprie: qui il portale registra soltanto chi è autorizzato a usarlo.</p>
    </div></div>
  </div>`));
}

export async function renderSezioneVuota(view, ctx, sezione) {
  const ruolo = ctx.ruoloSezione === 'admin' ? 'amministratore' : 'operatore';
  view.appendChild(el(`<div>
    <div class="page-head"><div>
      <h1>${esc(sezione.label)}</h1>
      <p>${esc(sezione.descrizione)}</p>
    </div></div>
    <div class="card"><div class="card-b">
      <div class="empty-state">
        <div class="big">🚧</div>
        <p><b>Sezione in costruzione</b></p>
        <p>Qui non c'è ancora nulla da fare: il contenuto di questa sezione verrà sviluppato
        più avanti. L'accesso però è già attivo e tu vi entri come <b>${esc(ruolo)}</b>.</p>
      </div>
    </div></div>
  </div>`));
}
