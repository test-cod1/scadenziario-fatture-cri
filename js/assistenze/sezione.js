// ============================================================
//  SEZIONE ASSISTENZE SANITARIE — punto di ingresso.
//  Carica una volta sola il tariffario e i testi (cambiano di rado) e smista
//  alla vista giusta, come fa la sezione trasporti.
// ============================================================
import { impostazioni } from './data/store.js';
import { renderDashboard } from './views/dashboard.js';
import { renderPreventivo } from './views/preventivo.js';
import { renderImpostazioni } from './views/impostazioni.js';

let _imp = null;

export async function renderAssistenze(view, ctx, sub, param) {
  if (!_imp) _imp = await impostazioni.get();

  const ctxA = {
    user: ctx.user,
    imp: _imp,
    go: ctx.go,
    reloadImp: async () => { _imp = await impostazioni.get(); ctxA.imp = _imp; },
  };

  if (sub === 'nuovo') return renderPreventivo(view, null, ctxA);
  if (sub === 'preventivo' && param) return renderPreventivo(view, param, ctxA);
  if (sub === 'impostazioni') return renderImpostazioni(view, ctxA);
  return renderDashboard(view, ctxA);
}
