// ============================================================
//  CALCOLI DELLA SEZIONE STRAORDINARI
//  Nessuna moneta: qui si contano ore. Il conto vero è uno solo — il SALDO
//  del mese per dipendente, cioè straordinari meno recuperi — ed è quello che
//  sul foglio di carta si otteneva sommando a mano una riga "EXTRA" piena di
//  numeri positivi e negativi.
// ============================================================

export const TIPI = [
  { id: 'straordinario', label: 'Straordinario', emoji: '⏱️', segno: +1,
    descrizione: 'Ore in più rispetto al turno.' },
  { id: 'cambio_turno', label: 'Cambio turno', emoji: '🔄', segno: +1,
    descrizione: 'Ore in più per aver coperto il turno di un collega.' },
  { id: 'recupero', label: 'Recupero', emoji: '➖', segno: -1,
    descrizione: 'Ore restituite al dipendente, che scalano dal saldo.' },
];

export function tipoDi(id) { return TIPI.find(t => t.id === id) || TIPI[0]; }

// Ore con il segno del tipo: è il numero da sommare, mai `r.ore` da solo.
// Ogni riga conta: nel registro si scrive solo ciò che è già stato fatto,
// quindi non esistono righe da escludere dai totali.
export function oreConSegno(r) {
  return tipoDi(r.tipo).segno * (Number(r.ore) || 0);
}

// ---------- orari ----------
export function minuti(hhmm) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || '').trim());
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

// Durata fra due orari. A cavallo della mezzanotte (22:00 → 01:00, che in
// centrale capita spesso) la differenza è negativa: si aggiunge un giro di
// orologio invece di restituire un numero senza senso.
export function durataOre(dalle, alle) {
  const a = minuti(dalle), b = minuti(alle);
  if (a === null || b === null) return null;
  let diff = b - a;
  if (diff <= 0) diff += 24 * 60;
  return Math.round((diff / 60) * 100) / 100;
}

// "7,5" e "7.5" sono la stessa cosa per chi scrive di fretta; "7:30" pure,
// ed è come lo direbbe a voce un dipendente.
export function parseOre(s) {
  if (s === null || s === undefined || s === '') return null;
  if (typeof s === 'number') return Number.isFinite(s) ? s : null;
  const t = String(s).trim().replace(',', '.');
  const oreMinuti = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (oreMinuti) return Number(oreMinuti[1]) + Number(oreMinuti[2]) / 60;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// Ore in cifre, come le scrive l'ufficio personale: "7,5" e non "7.5".
export function fmtOre(n, { segno = false } = {}) {
  const v = Number(n) || 0;
  const testo = Math.abs(v).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  if (!segno) return testo + ' h';
  if (v > 0) return '+' + testo + ' h';
  if (v < 0) return '−' + testo + ' h';
  return '0 h';
}

// ---------- mesi ----------
export function meseCorrente() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
export function meseDi(dataISO) { return String(dataISO || '').slice(0, 7); }
export function primoGiorno(mese) { return `${mese}-01`; }
export function ultimoGiorno(mese) {
  const [y, m] = mese.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}
export function giorniDelMese(mese) {
  const [y, m] = mese.split('-').map(Number);
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const giorni = [];
  for (let g = 1; g <= n; g++) {
    const iso = `${mese}-${String(g).padStart(2, '0')}`;
    const dow = new Date(iso + 'T00:00:00Z').getUTCDay();   // 0 = domenica
    giorni.push({ iso, numero: g, dow, festivo: dow === 0 || dow === 6 });
  }
  return giorni;
}
export function etichettaMese(mese) {
  const [y, m] = mese.split('-').map(Number);
  const nome = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('it-IT', { month: 'long', timeZone: 'UTC' });
  return nome.charAt(0).toUpperCase() + nome.slice(1) + ' ' + y;
}
export function meseSpostato(mese, delta) {
  const [y, m] = mese.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// ---------- riepiloghi ----------
// Totali di un insieme di righe: quello che va in testa al registro.
export function totali(righe) {
  const t = { positive: 0, recuperi: 0, saldo: 0, righe: righe.length };
  for (const r of righe) {
    const ore = oreConSegno(r);
    if (ore > 0) t.positive += ore; else t.recuperi += -ore;
  }
  t.saldo = arrotonda(t.positive - t.recuperi);
  t.positive = arrotonda(t.positive);
  t.recuperi = arrotonda(t.recuperi);
  return t;
}

// Una riga per dipendente, con il dettaglio giorno per giorno: è la griglia del
// riepilogo mensile, cioè il foglio di carta rifatto in modo che i totali si
// calcolino da soli. `dipendenti` serve a tenere in elenco anche chi nel mese
// non ha fatto straordinari (il foglio li aveva tutti, e vedere gli zeri è
// il modo per accorgersi di chi si sta caricando di ore e chi no).
export function riepilogoMensile(righe, dipendenti, mese) {
  const perDipendente = new Map();
  const aggiungi = (id, nome, oreContratto) => {
    if (!perDipendente.has(id)) perDipendente.set(id, { id, nome, oreContratto, giorni: {}, positive: 0, recuperi: 0, saldo: 0, righe: 0 });
    return perDipendente.get(id);
  };
  for (const a of dipendenti || []) {
    if (a.attivo) aggiungi(a.id, nominativo(a), a.ore_contratto);
  }
  for (const r of righe) {
    if (meseDi(r.data) !== mese) continue;
    const a = (dipendenti || []).find(x => x.id === r.dipendente_id);
    // Un dipendente disattivato a metà mese resta nel riepilogo di quel mese: le
    // ore che ha fatto vanno comunque pagate.
    const riga = aggiungi(r.dipendente_id, a ? nominativo(a) : r.dipendente_nome, a?.ore_contratto);
    riga.righe++;
    const ore = oreConSegno(r);
    if (ore > 0) riga.positive += ore; else riga.recuperi += -ore;
    const g = riga.giorni[r.data] || (riga.giorni[r.data] = { ore: 0, dettagli: [] });
    g.ore += ore;
    g.dettagli.push(r);
  }
  const elenco = [...perDipendente.values()].map(r => ({
    ...r,
    positive: arrotonda(r.positive),
    recuperi: arrotonda(r.recuperi),
    saldo: arrotonda(r.positive - r.recuperi),
  }));
  elenco.sort((a, b) => b.saldo - a.saldo || a.nome.localeCompare(b.nome, 'it'));
  return elenco;
}

// Totale per giorno del mese: la riga in fondo alla griglia. Serve a vedere
// in quali giornate la centrale ha dovuto chiedere ore a più persone —
// tipicamente i giorni da cui poi nasce una richiesta di personale in più.
export function totaliPerGiorno(riepilogo, mese) {
  const per = {};
  for (const g of giorniDelMese(mese)) per[g.iso] = 0;
  for (const r of riepilogo) {
    for (const [data, g] of Object.entries(r.giorni)) {
      if (per[data] === undefined) per[data] = 0;
      per[data] += g.ore;
    }
  }
  for (const k of Object.keys(per)) per[k] = arrotonda(per[k]);
  return per;
}

export function nominativo(a) {
  if (!a) return '';
  return [a.cognome, a.nome].filter(Boolean).join(' ').trim();
}

export function arrotonda(n) { return Math.round((Number(n) || 0) * 100) / 100; }

// ---------- impostazioni ----------
// Causali di partenza: sono i motivi che in centrale si ripetono ogni mese.
// Restano modificabili (Impostazioni), ma partire da un elenco vuoto avrebbe
// solo prodotto un campo libero scritto ogni volta in modo diverso — cioè il
// motivo per cui dal foglio di carta non si capiva mai perché.
export const IMPOSTAZIONI_DEFAULT = {
  causali: [
    'Emergenza / servizio urgente',
    'Copertura turno scoperto',
    'Malattia di un collega',
    'Servizio programmato in più',
    'Prolungamento del servizio',
    'Trasporto lungo',
    'Assistenza / manifestazione',
    'Formazione',
  ],
  // Oltre questa soglia il riepilogo evidenzia il dipendente: non è un divieto,
  // è il promemoria che sul foglio non c'era e che faceva scoprire a fine
  // anno che le ore erano sempre sulle stesse due persone.
  sogliaMensile: 20,
  // Ore oltre le quali una singola richiesta chiede conferma: un 8 al posto
  // di un 0,8 è l'errore di battitura tipico di questo registro.
  sogliaSingola: 8,
};

export function mergeImpostazioni(dati) {
  const d = dati && typeof dati === 'object' ? dati : {};
  const causali = Array.isArray(d.causali) ? d.causali.map(c => String(c).trim()).filter(Boolean) : null;
  return {
    causali: causali && causali.length ? causali : [...IMPOSTAZIONI_DEFAULT.causali],
    sogliaMensile: Number.isFinite(Number(d.sogliaMensile)) && Number(d.sogliaMensile) > 0
      ? Number(d.sogliaMensile) : IMPOSTAZIONI_DEFAULT.sogliaMensile,
    sogliaSingola: Number.isFinite(Number(d.sogliaSingola)) && Number(d.sogliaSingola) > 0
      ? Number(d.sogliaSingola) : IMPOSTAZIONI_DEFAULT.sogliaSingola,
  };
}
