// ============================================================
//  CALCOLI DELLA SEZIONE SCADENZE
//  Una scadenza ha una data e un preavviso: da quel numero di giorni prima
//  comincia a "chiamare". Lo stato a parole («scaduta da 3 giorni», «fra
//  12 giorni») e l'ordine dell'elenco nascono da qui, come la data della
//  scadenza successiva quando una ricorrente viene segnata fatta.
// ============================================================

export const RICORRENZE = [
  { id: 'nessuna', label: 'Non si ripete', mesi: 0 },
  { id: 'mensile', label: 'Ogni mese', mesi: 1 },
  { id: 'bimestrale', label: 'Ogni 2 mesi', mesi: 2 },
  { id: 'trimestrale', label: 'Ogni 3 mesi', mesi: 3 },
  { id: 'semestrale', label: 'Ogni 6 mesi', mesi: 6 },
  { id: 'annuale', label: 'Ogni anno', mesi: 12 },
  { id: 'biennale', label: 'Ogni 2 anni', mesi: 24 },
  { id: 'triennale', label: 'Ogni 3 anni', mesi: 36 },
  { id: 'quinquennale', label: 'Ogni 5 anni', mesi: 60 },
];
export function ricorrenzaDi(id) { return RICORRENZE.find(r => r.id === id) || RICORRENZE[0]; }

// Le categorie che si propongono quando non ce ne sono ancora di proprie:
// la categoria resta un testo libero, queste sono solo suggerimenti.
export const CATEGORIE_SUGGERITE = [
  'Assicurazioni', 'Bollo auto', 'Revisione mezzi', 'Manutenzione mezzi', 'Contratti',
  'Abbonamenti e licenze', 'Certificazioni', 'Sicurezza sul lavoro', 'Formazione obbligatoria',
  'Adempimenti fiscali', 'Utenze', 'Affitti', 'Privacy', 'Altro',
];

export function oggiISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Giorni da `da` a `iso`: negativo se la data è passata. Mezzogiorno UTC,
// così il cambio dell'ora legale non sposta il risultato.
export function giorniA(iso, da = oggiISO()) {
  if (!iso) return null;
  const t = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10), 12);
  const g = Math.round((t(iso) - t(da)) / 86400000);
  return Number.isFinite(g) ? g : null;
}

// La data della scadenza successiva. I mesi si sommano tenendo il giorno,
// e se quel giorno nel mese d'arrivo non c'è si prende l'ultimo: un
// contratto che scade il 31 gennaio, mensile, scade poi il 28 (o 29)
// febbraio, e non il 3 marzo. Dal 28 febbraio annuale si arriva al 28.
export function prossimaData(iso, ricorrenza) {
  const mesi = ricorrenzaDi(ricorrenza).mesi;
  if (!mesi || !iso) return null;
  const y = +iso.slice(0, 4), m = +iso.slice(5, 7) - 1, d = +iso.slice(8, 10);
  const totale = m + mesi;
  const anno = y + Math.floor(totale / 12);
  const mese = totale % 12;
  const ultimo = new Date(Date.UTC(anno, mese + 1, 0)).getUTCDate();
  return `${anno}-${String(mese + 1).padStart(2, '0')}-${String(Math.min(d, ultimo)).padStart(2, '0')}`;
}

// Lo stato di una scadenza, per colore e filtri:
//   fatta · scaduta · oggi · preavviso (dentro i giorni di preavviso) · futura
export function stato(s, da = oggiISO()) {
  if (s.fatta) return 'fatta';
  const g = giorniA(s.data_scadenza, da);
  if (g === null) return 'futura';
  if (g < 0) return 'scaduta';
  if (g === 0) return 'oggi';
  if (g <= (Number(s.preavviso_giorni) || 0)) return 'preavviso';
  return 'futura';
}

// L'etichetta a parole, con la classe del chip (le stesse del Direttore).
export function etichetta(s, da = oggiISO()) {
  const g = giorniA(s.data_scadenza, da);
  const st = stato(s, da);
  if (st === 'fatta') return { testo: 'fatta', classe: 'ok' };
  if (g === null) return { testo: 'senza data', classe: 'sca-nessuna' };
  if (g < -1) return { testo: `scaduta da ${-g} giorni`, classe: 'sca-scaduto' };
  if (g === -1) return { testo: 'scaduta ieri', classe: 'sca-scaduto' };
  if (g === 0) return { testo: 'scade oggi', classe: 'sca-oggi' };
  const testo = g === 1 ? 'scade domani'
    : g <= 60 ? `fra ${g} giorni`
    : Math.round(g / 30) < 24 ? `fra ${Math.round(g / 30)} mesi`
    : `fra ${Math.round(g / 365)} anni`;
  return { testo, classe: st === 'preavviso' ? 'sca-vicino' : 'sca-lontano' };
}

// Elenco: prima le aperte per data (le scadute in cima, perché la data è
// più vecchia), poi le fatte, le più recenti per prime.
export function ordina(elenco) {
  return [...(elenco || [])].sort((a, b) => {
    if (!!a.fatta !== !!b.fatta) return a.fatta ? 1 : -1;
    if (a.fatta) return String(b.fatta_il || '').localeCompare(String(a.fatta_il || ''));
    const d = String(a.data_scadenza || '').localeCompare(String(b.data_scadenza || ''));
    return d || String(a.titolo || '').localeCompare(String(b.titolo || ''), 'it');
  });
}

export function totali(elenco, da = oggiISO()) {
  const t = { aperte: 0, scadute: 0, preavviso: 0, mese: 0, fatte: 0 };
  for (const s of elenco || []) {
    const st = stato(s, da);
    if (st === 'fatta') { t.fatte++; continue; }
    t.aperte++;
    if (st === 'scaduta') t.scadute++;
    if (st === 'oggi' || st === 'preavviso') t.preavviso++;
    const g = giorniA(s.data_scadenza, da);
    if (g !== null && g >= 0 && g <= 30) t.mese++;
  }
  return t;
}

// La scadenza che nasce quando si segna fatta una ricorrente: stessi dati,
// data spostata in avanti, di nuovo da fare.
export function successiva(s) {
  const data = prossimaData(s.data_scadenza, s.ricorrenza);
  if (!data) return null;
  const { id, created_at, updated_at, created_by, fatta, fatta_il, ...resto } = s;
  return { ...resto, data_scadenza: data, fatta: false, fatta_il: null, precedente_id: id };
}
