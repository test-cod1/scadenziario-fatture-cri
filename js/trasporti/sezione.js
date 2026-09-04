// ============================================================
//  SEZIONE TRASPORTI — punto di ingresso unico.
//  Fa quello che nel vecchio gestionale autonomo faceva startApp(): carica le
//  impostazioni (parametri di calcolo, mezzi, prezzi carburante), aggiorna il
//  prezzo medio italiano dalla fonte ufficiale e poi smista alla vista
//  giusta. Sta qui e non in js/app.js perché il router del portale non deve
//  sapere come funziona una singola sezione.
// ============================================================
import { impostazioni } from './data/store.js';
import { fetchPrezzoItaliaLive, applicaPrezzoItaliaLive } from './data/fuel-prices.js';
import { renderDashboard } from './views/dashboard.js';
import { renderPreventivo } from './views/preventivo.js';
import { renderImpostazioni } from './views/impostazioni.js';

// Le impostazioni restano in memoria per tutta la sessione: sono un'unica
// riga che cambia di rado, e ricaricarla ad ogni cambio di pagina della
// sezione aggiungeva un viaggio al database per nulla.
let _imp = null;

async function caricaImpostazioni() {
  const imp = await impostazioni.get();
  // Prezzo Italia aggiornato dai dati ufficiali MISE: se la fonte non
  // risponde entro pochi secondi si procede con i valori di riferimento
  // salvati, senza bloccare l'apertura della sezione.
  const live = await Promise.race([
    fetchPrezzoItaliaLive().catch(() => null),
    new Promise(res => setTimeout(() => res(null), 4000)),
  ]);
  imp._prezzoItaliaLiveAl = applicaPrezzoItaliaLive(imp, live) ? live.aggiornatoAl : null;
  return imp;
}

export async function renderTrasporti(view, ctx, sub, param) {
  if (!_imp) _imp = await caricaImpostazioni();

  const ctxT = {
    user: ctx.user,
    imp: _imp,
    go: ctx.go,
    // Si rilegge passando da caricaImpostazioni() e non da impostazioni.get():
    // quest'ultima restituisce solo ciò che sta su Supabase, quindi dopo un
    // salvataggio delle impostazioni il prezzo italiano tornava al valore
    // salvato, perdendo la media MISE del giorno applicata all'ingresso nella
    // sezione (e con essa la data di aggiornamento).
    reloadImp: async () => { _imp = await caricaImpostazioni(); ctxT.imp = _imp; },
  };

  if (sub === 'nuovo') return renderPreventivo(view, null, ctxT);
  if (sub === 'preventivo' && param) return renderPreventivo(view, param, ctxT);
  if (sub === 'impostazioni') return renderImpostazioni(view, ctxT);
  return renderDashboard(view, ctxT);
}
