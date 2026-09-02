// ============================================================
//  IL PREVENTIVO COME MODELLO DI BLOCCHI
//  Un preventivo esce in due formati (PDF di stampa e Word sulla carta
//  intestata) che non hanno nulla in comune tecnicamente. Per non scrivere
//  due volte il documento — e non ritrovarsi con un PDF e un Word diversi —
//  il contenuto si costruisce una volta sola qui, come elenco di blocchi
//  neutri; poi stampa.js li rende in HTML e docx.js in OOXML.
//
//  Tipi di blocco: 'p' (paragrafo), 'titolo', 'tabella', 'firma', 'spazio'.
// ============================================================
import { calcola, inLettere } from '../calc.js';

const euro = (n) => Number(n || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const num = (n, d = 0) => Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d });

export function fmtData(iso) {
  if (!iso) return '';
  const d = new Date(String(iso).length === 10 ? iso + 'T00:00:00' : iso);
  return isNaN(d) ? String(iso) : d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Ore in forma leggibile: 9,5 → "9h 30'". Nei preventivi la mezz'ora scritta
// come "9,5 ore" si legge male e si presta a fraintendimenti.
export function fmtOre(ore) {
  const tot = Math.round((Number(ore) || 0) * 60);
  const h = Math.floor(tot / 60), m = tot % 60;
  return m ? `${h}h ${String(m).padStart(2, '0')}'` : `${h}h`;
}

export function costruisciBlocchi(prev, imp) {
  const r = calcola(prev);
  const testi = imp?.testi || {};
  const firma = imp?.firma || {};
  const blocchi = [];

  // ---- destinatario ----
  const dest = [prev.cliente, prev.cliente_indirizzo, prev.cliente_cf ? `C.F./P.I. ${prev.cliente_cf}` : '']
    .filter(Boolean);
  for (const [i, riga] of dest.entries()) {
    blocchi.push({ t: 'p', testo: riga, grassetto: i === 0 });
  }
  const rif = [
    prev.referente ? `Referente: ${prev.referente}` : '',
    prev.referente_email ? `Email: ${prev.referente_email}` : '',
    prev.referente_telefono ? `Telefono: ${prev.referente_telefono}` : '',
  ].filter(Boolean);
  for (const riga of rif) blocchi.push({ t: 'p', testo: riga, piccolo: true });

  // ---- data ----
  blocchi.push({ t: 'spazio' });
  blocchi.push({ t: 'p', testo: `Genova, ${fmtData(prev.data_documento)}`, allineamento: 'destra' });

  // ---- oggetto ----
  const luogo = prev.luogo ? `, presso ${prev.luogo}` : '';
  blocchi.push({
    t: 'p',
    testo: `Oggetto: preventivo di spesa per servizio di assistenza sanitaria — ${prev.oggetto || ''}${luogo}.`,
    grassetto: true,
  });
  blocchi.push({ t: 'spazio' });

  // ---- premessa e riepilogo economico ----
  if (testi.premessa) blocchi.push({ t: 'p', testo: testi.premessa });

  blocchi.push({
    t: 'tabella',
    intestazioni: ['Voce', 'Quantità', 'Prezzo', 'Importo'],
    allineamenti: ['sx', 'dx', 'dx', 'dx'],
    larghezze: [46, 20, 17, 17],
    righe: r.riepilogo.map(v => [
      v.nome,
      v.tipo === 'fissa' ? `n. ${num(v.quantita)}` : `${fmtOre(v.ore)} complessive`,
      v.tipo === 'fissa' ? `${euro(v.prezzo)} cad.` : `${euro(v.prezzo)}/ora`,
      euro(v.importo),
    ]),
    // Con uno sconto il piede si allunga: il totale pieno, una riga per ogni
    // sconto applicato (percentuale e/o importo fisso) e quanto resta da
    // pagare. Senza sconti resta una riga sola.
    piede: r.sconto > 0
      ? [
          { celle: ['Totale', '', '', euro(r.totaleLordo)] },
          ...r.sconti.map(s => ({
            celle: [etichettaSconto(s), '', '', '− ' + euro(s.importo)],
          })),
          { celle: ['Totale da corrispondere', '', '', euro(r.totale)], forte: true },
        ]
      : [{ celle: ['Totale', '', '', euro(r.totale)], forte: true }],
  });
  blocchi.push({ t: 'p', testo: `Importo complessivo: ${euro(r.totale)} (euro ${inLettere(r.totale)}).`, grassetto: true });
  if (testi.iva) blocchi.push({ t: 'p', testo: testi.iva });

  // ---- calendario ----
  if (r.righe.length) {
    blocchi.push({ t: 'titolo', testo: 'Calendario dell\'assistenza' });
    const vociUsate = r.riepilogo;
    blocchi.push({
      t: 'tabella',
      intestazioni: ['Data', 'Dalle', 'Alle', 'Durata', ...vociUsate.map(v => v.nome), 'Note'],
      allineamenti: ['sx', 'centro', 'centro', 'dx', ...vociUsate.map(() => 'centro'), 'sx'],
      righe: r.righe.map(riga => [
        fmtData(riga.data),
        riga.dalle || '',
        riga.alle || '',
        fmtOre(riga.ore),
        ...vociUsate.map(v => {
          const q = Number(riga.qta?.[v.id]) || 0;
          return q ? num(q) : '—';
        }),
        riga.note || '',
      ]),
    });
  }

  // ---- clausole e chiusura ----
  for (const chiave of ['banca', 'mezzi', 'privacy']) {
    if (testi[chiave]) {
      blocchi.push({ t: 'spazio' });
      // I testi lunghi possono contenere elenchi puntati scritti a capo: ogni
      // riga diventa un paragrafo, così l'impaginazione è la stessa nei due
      // formati.
      for (const riga of String(testi[chiave]).split('\n')) {
        if (riga.trim()) blocchi.push({ t: 'p', testo: riga.trim(), piccolo: chiave === 'privacy' });
      }
    }
  }
  if (prev.note) {
    blocchi.push({ t: 'spazio' });
    for (const riga of String(prev.note).split('\n')) if (riga.trim()) blocchi.push({ t: 'p', testo: riga.trim() });
  }
  if (testi.chiusura) {
    blocchi.push({ t: 'spazio' });
    blocchi.push({ t: 'p', testo: testi.chiusura });
  }

  // ---- firma ----
  blocchi.push({
    t: 'firma',
    righe: [firma.ruolo, firma.nome].filter(Boolean),
  });

  return { blocchi, calcolo: r };
}

// Come si legge uno sconto nel documento: la percentuale va scritta,
// altrimenti il cliente vede un importo sottratto senza sapere su cosa.
export function etichettaSconto(s) {
  if (s.tipo !== 'percentuale') return 'Sconto';
  return `Sconto ${num(s.percentuale, s.percentuale % 1 ? 1 : 0)}%`;
}

// Nome del file (PDF o Word) proposto al salvataggio.
export function nomeFile(prev, estensione) {
  const pezzi = ['Preventivo assistenza', prev.cliente, prev.data_documento].filter(Boolean);
  return pezzi.join(' - ').replace(/[\\/:*?"<>|]/g, '-') + '.' + estensione;
}
