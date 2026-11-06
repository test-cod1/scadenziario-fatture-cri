// ============================================================
//  AVVISO DELLE RICHIESTE DI SUPPORTO (Patenti)
//  Quante richieste di patente chiedono supporto e nessuno ha ancora preso
//  in mano: stato «Nuova» e almeno un documento su Gaia mancante. Basta
//  segnarle «In lavorazione» perché l'avviso si spenga.
//  Lo mostrano il menu laterale (un numero accanto a Patenti) e la home
//  (un riquadro in cima), solo a chi ha accesso alla sezione.
// ============================================================
import { documentiMancanti } from '../lib/patenti.mjs';

export async function contaSupportoDaGestire() {
  const { getSupabase } = await import('../lib/supabase.js');
  const sb = await getSupabase();
  const { data, error } = await sb.from('richieste_patenti').select('documenti_gaia,tipo').eq('stato', 'nuova').limit(1000);
  if (error) throw error;
  return (data || []).filter(r => documentiMancanti(r.documenti_gaia, r.tipo).length > 0).length;
}

// Il numerino accanto a «Patenti» nel menu laterale.
export function segnaNelMenu(n) {
  const dentro = location.hash.startsWith('#/patenti');
  const posti = [...document.querySelectorAll('[data-nav-sezione="patenti"]'), ...(dentro ? document.querySelectorAll('.sez-titolo') : [])];
  posti.forEach(a => {
    a.querySelector('.nav-avviso')?.remove();
    if (!n) return;
    const b = document.createElement('span');
    b.className = 'nav-avviso';
    b.title = `${n} ${n === 1 ? 'richiesta chiede' : 'richieste chiedono'} supporto`;
    b.textContent = String(n);
    a.appendChild(b);
  });
}
