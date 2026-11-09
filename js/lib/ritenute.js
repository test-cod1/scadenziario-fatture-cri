// ============================================================
//  RITENUTE D'ACCONTO — i conti, senza pagina e senza database
// ------------------------------------------------------------
//  Quando paghiamo una fattura con ritenuta d'acconto, la ritenuta non va al
//  fornitore: la tratteniamo noi e la versiamo all'Erario con l'F24 entro il
//  16 del mese DOPO quello del pagamento. Conta quindi la data del
//  pagamento, non quella della fattura: una fattura di marzo pagata a maggio
//  si versa entro il 16 giugno.
//
//  L'importo della fattura, nello scadenziario, è il NETTO da pagare (vedi
//  js/lib/xmlFattura.js). Pagata a rate, la ritenuta matura un po' a ogni
//  rata, in proporzione: metà del netto pagato a maggio e metà a giugno
//  vuol dire metà della ritenuta versata a giugno e metà a luglio. L'ultima
//  rata, quella che salda, prende il resto al centesimo, così la somma
//  delle quote torna sempre identica alla ritenuta del documento.
// ============================================================

const cent = (n) => Math.round((Number(n) || 0) * 100);

export const CODICE_TRIBUTO_DEFAULT = '1040';

// I codici tributo che capitano davvero a un Comitato: suggerimenti per il
// campo, non un elenco chiuso.
export const CODICI_TRIBUTO = [
  { codice: '1040', descrizione: 'lavoro autonomo (professionisti, prestazioni occasionali)' },
  { codice: '1038', descrizione: 'provvigioni (agenti e rappresentanti)' },
  { codice: '1019', descrizione: 'condominio: appalti, 4% IRPEF' },
  { codice: '1020', descrizione: 'condominio: appalti, 4% IRES' },
];

export const MESI_ESTESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

export function nomeMese(mese) {   // 'YYYY-MM' → 'maggio 2026'
  const [y, m] = mese.split('-').map(Number);
  return `${MESI_ESTESI[m - 1]} ${y}`;
}

// ------------------------------------------------------------
//  Scadenza del versamento
//  Il 16 del mese successivo; se è sabato, domenica o festivo slitta al
//  primo giorno lavorativo. Per i pagamenti di luglio il termine è il 20
//  agosto (la «proroga di Ferragosto», art. 3-quater DL 16/2012), che a sua
//  volta slitta se cade nel fine settimana.
// ------------------------------------------------------------
export function scadenzaVersamento(mese) {
  const [y, m] = mese.split('-').map(Number);   // m = 1..12, mese dei pagamenti
  const anno = m === 12 ? y + 1 : y;
  const meseDopo = m === 12 ? 1 : m + 1;
  const giorno = meseDopo === 8 ? 20 : 16;
  let d = new Date(Date.UTC(anno, meseDopo - 1, giorno));
  while (!lavorativo(d)) d = new Date(d.getTime() + 86400000);
  return d.toISOString().slice(0, 10);
}

function lavorativo(d) {
  const dow = d.getUTCDay();
  if (dow === 0 || dow === 6) return false;
  const mmdd = d.toISOString().slice(5, 10);
  if (FESTIVI_FISSI.has(mmdd)) return false;
  const pasquetta = pasqua(d.getUTCFullYear());
  pasquetta.setUTCDate(pasquetta.getUTCDate() + 1);
  return d.toISOString().slice(0, 10) !== pasquetta.toISOString().slice(0, 10);
}

const FESTIVI_FISSI = new Set(['01-01', '01-06', '04-25', '05-01', '06-02', '08-15', '11-01', '12-08', '12-25', '12-26']);

// Domenica di Pasqua (calendario gregoriano, algoritmo di Meeus/Jones/Butcher).
function pasqua(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mese = Math.floor((h + l - 7 * m + 114) / 31), giorno = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(y, mese - 1, giorno));
}

// ------------------------------------------------------------
//  Quote di ritenuta, una per pagamento
//  Ritorna [{ fattura, pagamento, mese: 'YYYY-MM', quota }] per tutte le
//  fatture con ritenuta che hanno almeno un pagamento.
// ------------------------------------------------------------
export function quoteRitenute(fatture) {
  const out = [];
  for (const f of fatture || []) {
    const rit = cent(f.ritenuta);
    const netto = cent(f.importo);
    if (rit <= 0 || netto <= 0) continue;
    const pagamenti = [...(f.pagamenti || [])]
      .filter(p => p.data_pagamento && cent(p.importo) > 0)
      .sort((a, b) => a.data_pagamento.localeCompare(b.data_pagamento) || String(a.id).localeCompare(String(b.id)));
    if (!pagamenti.length) continue;
    const pagatoTot = pagamenti.reduce((s, p) => s + cent(p.importo), 0);
    const saldata = pagatoTot >= netto;
    let assegnata = 0;
    pagamenti.forEach((p, i) => {
      let q;
      if (saldata && i === pagamenti.length - 1) q = rit - assegnata;   // l'ultima rata chiude il conto al centesimo
      else q = Math.round(rit * Math.min(cent(p.importo), netto) / netto);
      q = Math.max(0, Math.min(q, rit - assegnata));
      assegnata += q;
      out.push({ fattura: f, pagamento: p, mese: p.data_pagamento.slice(0, 7), quota: q / 100 });
    });
  }
  return out;
}

// ------------------------------------------------------------
//  Riepilogo per mese
//  Un elemento per ogni mese con pagamenti (o con un versamento segnato),
//  dal più recente: le righe, il totale, il totale per codice tributo, la
//  scadenza, il versamento eventualmente registrato e lo stato.
//  Stati: 'in_corso'  il mese non è ancora finito: possono arrivare altri pagamenti
//         'da_versare' mese chiuso, scadenza non ancora passata
//         'scaduto'   scadenza passata e nessun versamento segnato
//         'versato'   versamento segnato, e l'importo torna
//         'differenza' versamento segnato, ma l'importo non torna più
//                      (es. un pagamento registrato dopo, o corretto)
// ------------------------------------------------------------
export function riepilogoMesi(fatture, versamenti, oggi) {
  const mesi = new Map();
  const prendi = (mese) => {
    if (!mesi.has(mese)) mesi.set(mese, { mese, righe: [], totaleCent: 0, perCodice: {} });
    return mesi.get(mese);
  };
  for (const q of quoteRitenute(fatture)) {
    const m = prendi(q.mese);
    m.righe.push(q);
    m.totaleCent += cent(q.quota);
    const codice = q.fattura.ritenuta_codice_tributo || CODICE_TRIBUTO_DEFAULT;
    m.perCodice[codice] = (m.perCodice[codice] || 0) + cent(q.quota);
  }
  const perMese = new Map((versamenti || []).map(v => [String(v.mese).slice(0, 7), v]));
  for (const mese of perMese.keys()) prendi(mese);

  const meseOggi = oggi.slice(0, 7);
  return [...mesi.values()]
    .sort((a, b) => b.mese.localeCompare(a.mese))
    .map(m => {
      const versamento = perMese.get(m.mese) || null;
      const scadenza = scadenzaVersamento(m.mese);
      let stato;
      if (versamento) stato = cent(versamento.importo) === m.totaleCent ? 'versato' : 'differenza';
      else if (m.totaleCent === 0) stato = 'versato';
      else if (m.mese >= meseOggi) stato = 'in_corso';
      else stato = oggi > scadenza ? 'scaduto' : 'da_versare';
      m.righe.sort((a, b) => a.pagamento.data_pagamento.localeCompare(b.pagamento.data_pagamento)
        || String(a.fattura.fornitore).localeCompare(String(b.fattura.fornitore)));
      return {
        mese: m.mese,
        righe: m.righe,
        totale: m.totaleCent / 100,
        perCodice: Object.fromEntries(Object.entries(m.perCodice).sort().map(([k, v]) => [k, v / 100])),
        scadenza,
        versamento,
        stato,
      };
    });
}

// ------------------------------------------------------------
//  Ritenuta scritta solo nelle note
//  Prima di questa pagina la ritenuta letta dall'XML finiva soltanto nelle
//  note («… meno ritenuta d'acconto 200.00€: importo da pagare …»), e
//  quella letta dall'AI pure, a parole sue. Qui la si ripesca, perché
//  quelle fatture possano essere segnate con un clic invece che a mano.
//  Ritorna l'importo, o null se le note non ne indicano uno chiaro.
// ------------------------------------------------------------
export function ritenutaDaNote(note) {
  const m = String(note || '').match(/ritenuta(?:\s+d['’]\s*acconto)?\s*(?:di|pari a|:)?\s*(?:€|eur(?:o)?)?\s*(\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:€|eur)?/i);
  if (!m) return null;
  let t = m[1].replace(/\s/g, '');
  // "1.234,56" all'italiana, oppure "1234.56" come lo scrive l'XML
  if (/,\d{1,2}$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

// Il primo giorno del mese, nella forma che la tabella ritenute_versamenti
// vuole ('2026-05' → '2026-05-01').
export function primoDelMese(mese) { return `${mese.slice(0, 7)}-01`; }
