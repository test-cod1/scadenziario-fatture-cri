// ============================================================
//  Helper di interfaccia per la sezione TRASPORTI.
//  Il grosso arriva tale e quale da js/lib/ui.js del portale (stesse
//  funzioni, stesso comportamento): qui si aggiunge soltanto ciò che il
//  portale non aveva e che le viste dei preventivi usano ovunque. Così i file
//  arrivati dal vecchio gestionale hanno potuto tenere i loro import
//  "../lib/ui.js" senza essere riscritti riga per riga.
//
//  Le definizioni locali hanno la precedenza su quelle di `export *`: è il
//  modo previsto dai moduli ES per sovrascrivere un singolo helper.
// ============================================================
export * from '../../lib/ui.js';

export function fmtNum(nv, dec = 0) {
  if (nv === null || nv === undefined || nv === '' || !Number.isFinite(Number(nv))) return '—';
  return Number(nv).toLocaleString('it-IT', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export function fmtKm(nv) {
  if (nv === null || nv === undefined || nv === '') return '—';
  return fmtNum(nv, 0) + ' km';
}

// Qui le date arrivano sia come giorno secco (data_servizio) sia come
// timestamp completo (created_at): quella del portale accetta solo il primo
// formato (ci aggiunge "T00:00:00" apposta, per non farsi spostare il giorno
// dal fuso orario) e su un timestamp restituirebbe la stringa grezza.
export function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(String(iso).length === 10 ? iso + 'T00:00:00' : iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
