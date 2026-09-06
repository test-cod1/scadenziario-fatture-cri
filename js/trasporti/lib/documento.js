// ============================================================
//  IL PREVENTIVO DI TRASPORTO COME MODELLO DI BLOCCHI
//  Come per le assistenze e la formazione, il contenuto del documento si
//  costruisce una volta sola qui, in blocchi neutri, e poi
//  js/lib/stampaBlocchi.js lo rende in HTML (stampa/PDF) e
//  js/lib/docxBlocchi.js in Word sulla carta intestata ufficiale.
//
//  Prima questa sezione aveva una stampa tutta sua, con un'intestazione
//  disegnata in CSS che imitava il logo: usciva un documento che non
//  assomigliava a nessun altro del Comitato e che in Word non si poteva
//  nemmeno aprire.
//
//  Una cosa in meno, rispetto a quella stampa: la SPESA REALE (il costo vivo
//  del servizio) non compare più. Era scritta due volte nel foglio
//  consegnato al cliente, che quindi si ricavava in un attimo il margine del
//  Comitato. Resta dov'è utile — nell'editor e nell'elenco — ma fuori dal
//  documento, come già avviene nelle altre due sezioni.
//
//  Tipi di blocco: 'p' (paragrafo), 'titolo', 'tabella', 'firma', 'spazio'.
// ============================================================
import { calcola } from '../calc.js';
import { inLettere } from '../../lib/numeri.js';

const euro = (n) => Number(n || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const num = (n, d = 0) => Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d });

export function fmtData(iso) {
  if (!iso) return '';
  const d = new Date(String(iso).length === 10 ? iso + 'T00:00:00' : iso);
  return isNaN(d) ? String(iso) : d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// I dati del destinatario e del protocollo non hanno colonne dedicate nella
// tabella `preventivi`: vivono dentro `input`, insieme alla partenza e ai
// flag dell'interfaccia, che stanno lì per lo stesso motivo. Il nome del
// cliente e la data del servizio hanno invece colonne loro.
export function documentoDi(prev) {
  return (prev?.input?._documento) || {};
}

export function costruisciBlocchi(prev, imp) {
  const inp = prev.input || {};
  const r = calcola(inp, imp);
  const doc = documentoDi(prev);
  const testi = imp?.testi || {};
  const firma = imp?.firma || {};
  const blocchi = [];

  // ---- destinatario ----
  blocchi.push({ t: 'p', testo: 'Spett.le' });
  const dest = [prev.cliente || '—', doc.indirizzo, doc.cf ? `C.F./P.I. ${doc.cf}` : ''].filter(Boolean);
  for (const [i, riga] of dest.entries()) blocchi.push({ t: 'p', testo: riga, grassetto: i === 0 });
  if (doc.referente) blocchi.push({ t: 'p', testo: `Alla c.a. ${doc.referente}` });

  // ---- protocollo e data ----
  blocchi.push({ t: 'spazio' });
  if (doc.protocollo) blocchi.push({ t: 'p', testo: `Prot. n. ${doc.protocollo}` });
  blocchi.push({
    t: 'p',
    testo: `Genova, ${fmtData(doc.data_documento || prev.created_at || new Date().toISOString())}`,
    allineamento: 'destra',
  });

  // ---- oggetto ----
  const dove = prev.titolo ? ` — ${prev.titolo}` : '';
  blocchi.push({ t: 'p', testo: `OGGETTO: PREVENTIVO PER SERVIZIO DI TRASPORTO SANITARIO${dove}`.toUpperCase(), grassetto: true });
  blocchi.push({ t: 'spazio' });

  if (testi.premessa) blocchi.push({ t: 'p', testo: testi.premessa });

  // ---- itinerario ----
  // andata_ritorno è una colonna di `prev`, non un campo di `input`: letta dal
  // posto sbagliato, il documento diceva "(a/r)" anche per una sola andata.
  const andataRitorno = prev.andata_ritorno !== false;
  const partenza = prev.partenza || inp.partenza || {};
  const tappe = (prev.tappe || []).filter(t => t && t.label);
  const itinerario = [
    { ruolo: 'Partenza', label: partenza.label || '' },
    ...tappe.map((t, i) => ({ ruolo: i === tappe.length - 1 ? 'Destinazione' : `Tappa ${i + 1}`, label: t.label })),
    ...(andataRitorno ? [{ ruolo: 'Rientro', label: partenza.label || '' }] : []),
  ].filter(t => t.label);

  if (itinerario.length) {
    blocchi.push({ t: 'titolo', testo: 'Itinerario' });
    blocchi.push({
      t: 'tabella',
      intestazioni: ['', 'Località'],
      allineamenti: ['sx', 'sx'],
      larghezze: [24, 76],
      righe: itinerario.map(t => [t.ruolo, t.label]),
    });
  }

  // ---- dati del servizio ----
  const mezzo = (imp?.mezzi || []).find(m => m.id === inp.mezzoId);
  const datiServizio = [
    ['Data del servizio', prev.data_servizio ? fmtData(prev.data_servizio) : 'da concordare'],
    ['Percorrenza', `${num(inp.kmTotali, 1)} km ${andataRitorno ? '(andata e ritorno)' : '(sola andata)'}`],
    ['Mezzo impiegato', mezzo?.nome || inp.mezzoId || '—'],
    ['Equipaggio', `${num(inp.persone)} ${Number(inp.persone) === 1 ? 'persona' : 'persone'}`],
  ];
  if (inp.pernottamentoOn && Number(inp.notti) > 0) {
    datiServizio.push(['Pernottamento', `${num(inp.notti)} ${Number(inp.notti) === 1 ? 'notte' : 'notti'}`]);
  }
  if (r.sanitari > 0) {
    const chi = [r.medico > 0 ? 'medico' : '', r.infermiere > 0 ? 'infermiere' : ''].filter(Boolean).join(' e ');
    datiServizio.push(['Personale sanitario', chi]);
  }
  blocchi.push({ t: 'titolo', testo: 'Dati del servizio' });
  blocchi.push({
    t: 'tabella',
    intestazioni: ['', ''],
    allineamenti: ['sx', 'sx'],
    larghezze: [34, 66],
    righe: datiServizio,
  });

  // ---- importo richiesto ----
  // Il carburante NON è una voce a sé: è compreso nella tariffa chilometrica,
  // ed elencarlo qui significherebbe farlo pagare due volte.
  const righe = [];
  const voce = (nome, dettaglio, importo) => { if (importo > 0) righe.push([nome, dettaglio, euro(importo)]); };

  voce('Percorrenza', `${num(inp.kmTotali, 1)} km × ${euro(inp.tariffaKm)}/km`, r.addebitoKm);
  voce('Pasti', `${num(inp.persone)} × ${num(inp.pastiPersona)} × ${euro(inp.pastoCosto)}`, r.pasti);
  voce('Pernottamento', `${num(inp.notti)} ${Number(inp.notti) === 1 ? 'notte' : 'notti'}`, r.pernottamento);
  voce('Medico', inp.medicoOre ? `${num(inp.medicoOre, 1)} h × ${euro(inp.medicoOraria)}/h` : '', r.medico);
  voce('Infermiere', inp.medicoOre ? `${num(inp.medicoOre, 1)} h × ${euro(inp.infermiereOraria)}/h` : '', r.infermiere);
  voce('Pedaggi e vignette (estero)', '', r.pedaggi);
  if (inp.materialeOn) {
    for (const m of (inp.materiale || [])) {
      voce(m.desc || 'Materiale di consumo', '', Number(m.importo) || 0);
    }
  }

  blocchi.push({ t: 'titolo', testo: 'Importo richiesto' });
  blocchi.push({
    t: 'tabella',
    intestazioni: ['Voce', 'Dettaglio', 'Importo'],
    allineamenti: ['sx', 'sx', 'dx'],
    larghezze: [40, 36, 24],
    righe: righe.length ? righe : [['Da definire', '', euro(0)]],
    piede: [{ celle: ['Totale', '', euro(r.addebito)], forte: true }],
  });
  blocchi.push({
    t: 'p',
    testo: `Importo complessivo: ${euro(r.addebito)} (euro ${inLettere(r.addebito)}).`,
    grassetto: true,
  });
  if (testi.iva) blocchi.push({ t: 'p', testo: testi.iva });

  // ---- avvertenza, note, chiusura, firma ----
  if (testi.avvertenza) {
    blocchi.push({ t: 'spazio' });
    blocchi.push({ t: 'p', testo: testi.avvertenza, piccolo: true });
  }
  if (prev.note) {
    blocchi.push({ t: 'spazio' });
    for (const riga of String(prev.note).split('\n')) if (riga.trim()) blocchi.push({ t: 'p', testo: riga.trim() });
  }
  if (testi.chiusura) {
    blocchi.push({ t: 'spazio' });
    blocchi.push({ t: 'p', testo: testi.chiusura });
  }
  blocchi.push({ t: 'firma', ruolo: firma.ruolo || '', nome: firma.nome || '' });

  return { blocchi, calcolo: r };
}

// Nome del file (PDF o Word) proposto al salvataggio.
export function nomeFile(prev, estensione) {
  const data = documentoDi(prev).data_documento || (prev.created_at || '').slice(0, 10);
  const pezzi = ['Preventivo trasporto', prev.cliente || prev.titolo, data].filter(Boolean);
  return pezzi.join(' - ').replace(/[\\/:*?"<>|]/g, '-') + '.' + estensione;
}
