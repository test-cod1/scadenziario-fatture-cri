// ============================================================
//  Prove nate dalla revisione esterna dello scadenziario (15/11/2026):
//  codifica degli XML, importi con la virgola, bollo, partita IVA letta
//  dall'AI, rate F24 nel Report, clic sul fornitore, colonne dell'export.
//  Ognuna fallisce col codice di prima della correzione.
// ============================================================
import { gruppo, prova, uguale, vero, falso, RADICE } from './aiuto.mjs';
import { pathToFileURL } from 'node:url';

const mod = (p) => import(pathToFileURL(RADICE + p).href);
const { numero, leggiXmlFattura, parseFatturaXml, normalizzaPartitaIva } = await mod('/js/lib/xmlFattura.js');
const { separaF24, valoreFiltroSoggetto, leggiFiltroSoggetto, nelSoggetto } = await mod('/js/lib/filtriReport.js');
const { raggruppaPerSoggetto } = await mod('/js/lib/soggetti.js');
const { COLS, COLS_ATTIVE } = await mod('/js/lib/export.js');

// ------------------------------------------------------------
//  Un DOMParser quanto basta per parseFatturaXml in Node
// ------------------------------------------------------------
//  Il parser legge solo tag, testo e querySelector('parsererror'): qui un
//  albero minimo costruito con un'espressione regolare, sufficiente per i
//  documenti ben formati scritti sotto (niente attributi con ">" dentro).
class Nodo {
  constructor(tagName) { this.tagName = tagName; this.localName = tagName.split(':').pop(); this.figli = []; this.testo = ''; }
  get textContent() { return this.testo + this.figli.map(f => f.textContent).join(''); }
  discendenti() { return this.figli.flatMap(f => [f, ...f.discendenti()]); }
  getElementsByTagName() { return this.discendenti(); }
  getElementsByTagNameNS(_ns, nome) { return this.discendenti().filter(n => n.localName === nome); }
  querySelector() { return null; }
}
class MiniDOMParser {
  parseFromString(testo) {
    const radice = new Nodo('#document');
    const pila = [radice];
    const re = /<\?[\s\S]*?\?>|<(\/?)([\w:.-]+)[^>]*?(\/?)>|([^<]+)/g;
    let m;
    while ((m = re.exec(testo))) {
      if (m[4] !== undefined) { pila[pila.length - 1].testo += m[4].trim(); continue; }
      if (!m[2]) continue;
      if (m[1]) { pila.pop(); continue; }
      const n = new Nodo(m[2]);
      pila[pila.length - 1].figli.push(n);
      if (!m[3]) pila.push(n);
    }
    return radice;
  }
}
// Solo per la durata della chiamata: le altre prove non devono trovarsi un
// DOMParser finto in giro.
function analizza(xml) {
  const prima = globalThis.DOMParser;
  globalThis.DOMParser = MiniDOMParser;
  try { return parseFatturaXml(xml); } finally { globalThis.DOMParser = prima; }
}

const fatturaXml = ({ dichiarazione = '<?xml version="1.0" encoding="UTF-8"?>', denominazione = 'ACME SRL', totale = '', bollo = '', righe = '', riepilogo = '<DatiRiepilogo><ImponibileImporto>100.00</ImponibileImporto><Imposta>0.00</Imposta></DatiRiepilogo>' } = {}) =>
  `${dichiarazione}<p:FatturaElettronica><FatturaElettronicaHeader><CedentePrestatore><DatiAnagrafici>` +
  `<IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>01234567890</IdCodice></IdFiscaleIVA>` +
  `<Anagrafica><Denominazione>${denominazione}</Denominazione></Anagrafica></DatiAnagrafici></CedentePrestatore></FatturaElettronicaHeader>` +
  `<FatturaElettronicaBody><DatiGenerali><DatiGeneraliDocumento><TipoDocumento>TD01</TipoDocumento><Data>2026-10-01</Data><Numero>7</Numero>` +
  (bollo ? `<DatiBollo><BolloVirtuale>SI</BolloVirtuale><ImportoBollo>${bollo}</ImportoBollo></DatiBollo>` : '') +
  (totale ? `<ImportoTotaleDocumento>${totale}</ImportoTotaleDocumento>` : '') +
  `</DatiGeneraliDocumento></DatiGenerali><DatiBeniServizi>${righe}${riepilogo}</DatiBeniServizi></FatturaElettronicaBody></p:FatturaElettronica>`;

const fileDa = (bytes, name = 'fattura.xml') => ({ name, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });
const latin1 = (s) => Uint8Array.from(s, c => c.charCodeAt(0));

gruppo('Revisione scadenziario — XML FatturaPA');

prova('un XML dichiarato ISO-8859-1 si legge con la sua codifica', async () => {
  const xml = fatturaXml({ dichiarazione: '<?xml version="1.0" encoding="ISO-8859-1"?>', denominazione: 'Società Cooperativa Più' });
  const testo = await leggiXmlFattura(fileDa(latin1(xml)));
  vero(testo.includes('Società Cooperativa Più'), 'decodificato male: ' + testo.slice(100, 400));
  falso(testo.includes('�'), 'caratteri sostitutivi nel testo');
  uguale(analizza(testo).fornitore, 'Società Cooperativa Più');
});

prova('anche windows-1252, e senza dichiarazione resta UTF-8', async () => {
  const xml = fatturaXml({ dichiarazione: "<?xml version='1.0' encoding='windows-1252'?>", denominazione: 'Caffè €uro' });
  const bytes = latin1(xml.replace('€', '\x80'));   // 0x80 è l'euro in windows-1252
  vero((await leggiXmlFattura(fileDa(bytes))).includes('Caffè €uro'));
  const utf8 = new TextEncoder().encode(fatturaXml({ dichiarazione: '', denominazione: 'Società' }));
  vero((await leggiXmlFattura(fileDa(utf8))).includes('Società'));
});

prova('gli importi con la virgola e le migliaia non perdono cifre', () => {
  uguale(numero('1234.56'), 1234.56);
  uguale(numero('1.234,56'), 1234.56);
  uguale(numero('1234,56'), 1234.56);
  uguale(numero('1,234.56'), 1234.56);
  uguale(numero('1.234.567,8'), 1234567.8);
  uguale(numero(' 12.50 '), 12.5);
  uguale(numero('1.23456789'), 1.23456789);     // PrezzoUnitario: fino a 8 decimali
  uguale(numero(''), null);
  uguale(numero('abc'), null);
});

prova('ImportoTotaleDocumento "1.234,56" non diventa 1,23 €', () => {
  uguale(analizza(fatturaXml({ totale: '1.234,56' })).importo, 1234.56);
});

prova('senza ImportoTotaleDocumento il totale ricostruito comprende il bollo', () => {
  uguale(analizza(fatturaXml({ bollo: '2.00' })).importo, 102);
});

prova('il bollo già riaddebitato in una riga non si conta due volte', () => {
  const righe = '<DettaglioLinee><Descrizione>Rimborso imposta di bollo</Descrizione><PrezzoTotale>2.00</PrezzoTotale></DettaglioLinee>';
  const riepilogo = '<DatiRiepilogo><ImponibileImporto>102.00</ImponibileImporto><Imposta>0.00</Imposta></DatiRiepilogo>';
  uguale(analizza(fatturaXml({ bollo: '2.00', righe, riepilogo })).importo, 102);
  // Con il totale dichiarato vale quello, bollo o no.
  uguale(analizza(fatturaXml({ bollo: '2.00', totale: '102.00' })).importo, 102);
});

gruppo('Revisione scadenziario — partita IVA letta dall\'AI');

prova('normalizzaPartitaIva dà la stessa forma dell\'XML', () => {
  uguale(normalizzaPartitaIva('01234567890'), 'IT01234567890');
  uguale(normalizzaPartitaIva(' it 0123 4567 890 '), 'IT01234567890');
  uguale(normalizzaPartitaIva('IT01234567890'), 'IT01234567890');
  uguale(normalizzaPartitaIva('rssmra80a01d969z'), 'RSSMRA80A01D969Z');
  uguale(normalizzaPartitaIva('DE 123456789'), 'DE123456789');
  uguale(normalizzaPartitaIva(''), null);
  uguale(normalizzaPartitaIva(undefined), null);
});

// L'endpoint vero, con la rete finta: Supabase dice che l'utente c'è, ha
// accesso e non ha finito la quota; Gemini risponde una partita IVA senza
// paese e con gli spazi.
async function chiamaEstrazione(percorso, estrattiAI) {
  const { onRequestPost } = await mod(percorso);
  const fetchVero = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    const corpo = u.includes('/auth/v1/user') ? { id: 'u1' }
      : u.includes('ruolo_sezione') ? 'operatore'
      : u.includes('consuma_quota') ? 1
      : { candidates: [{ content: { parts: [{ text: JSON.stringify(estrattiAI) }] } }] };
    return new Response(JSON.stringify(corpo), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const request = new Request('https://esempio.test/api/x', {
      method: 'POST', headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({ mimeType: 'application/pdf', dataBase64: 'JVBERi0=' }),
    });
    const res = await onRequestPost({ request, env: { GEMINI_API_KEY: 'k' } });
    return await res.json();
  } finally { globalThis.fetch = fetchVero; }
}

prova('estrai-fattura restituisce la partita IVA normalizzata', async () => {
  const r = await chiamaEstrazione('/functions/api/estrai-fattura.js', { fornitore: 'ACME', importo: 10, partita_iva: '0123 4567 890' });
  uguale(r.estratti.partita_iva, 'IT01234567890');
});

prova('estrai-fattura-attiva restituisce la partita IVA normalizzata', async () => {
  const r = await chiamaEstrazione('/functions/api/estrai-fattura-attiva.js', { cliente: 'Comune', importo: 10, partita_iva: 'it00856930102' });
  uguale(r.estratti.partita_iva, 'IT00856930102');
});

gruppo('Revisione scadenziario — Report passive');

const righe = [
  { id: 1, fornitore: 'ENEL S.P.A.', partita_iva: 'IT00811720580', importo: 100, tipo_documento: null },
  { id: 2, fornitore: 'Enel SpA', partita_iva: 'IT00811720580', importo: 50, tipo_documento: null },
  { id: 3, fornitore: 'enel  spa', partita_iva: null, importo: 20 },               // vecchia, senza P.IVA
  { id: 4, fornitore: 'Altro Enel Srl', partita_iva: 'IT99999999999', importo: 5 }, // il testo "enel" c'è, il soggetto no
  { id: 5, fornitore: 'F24 IVA ottobre', importo: 900, tipo_documento: 'f24' },
];

prova('le rate F24 stanno fuori da fatturato e spesa per fornitore', () => {
  const { fatture, f24 } = separaF24(righe);
  uguale(f24.map(f => f.id), [5]);
  uguale(fatture.map(f => f.id), [1, 2, 3, 4]);
  const totale = fatture.reduce((s, f) => s + f.importo, 0);
  uguale(totale, 175);
  falso(raggruppaPerSoggetto(fatture, 'fornitore').some(g => g.nome === 'F24 IVA ottobre'), 'F24 fra i fornitori');
});

prova('il report usa separaF24 per stats, fornitori e grafico', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(RADICE + '/js/views/report.js', 'utf8');
  vero(/perFornitore\(separaF24\(filtrate\(\)\)\.fatture\)/.test(src), 'spesa per fornitore senza separaF24');
  vero(/const \{ fatture: righe, f24 \} = separaF24\(filtrate\(\)\)/.test(src), 'statistiche senza separaF24');
});

prova('il clic sul fornitore porta all\'elenco tutte le grafie del gruppo', () => {
  const [enel] = raggruppaPerSoggetto(separaF24(righe).fatture, 'fornitore').filter(g => g.partita_iva === 'IT00811720580');
  const filtro = leggiFiltroSoggetto(valoreFiltroSoggetto(enel, 'fornitore'));
  uguale(filtro.partita_iva, 'IT00811720580');
  const dentro = righe.filter(f => nelSoggetto(filtro, f, 'fornitore')).map(f => f.id);
  uguale(dentro, [1, 2, 3]);
});

prova('senza partita IVA il filtro resta il nome come testo (anche quelli vecchi)', () => {
  const [solo] = raggruppaPerSoggetto([{ fornitore: 'Idraulico Rossi', importo: 1 }], 'fornitore');
  uguale(valoreFiltroSoggetto(solo, 'fornitore'), 'Idraulico Rossi');
  uguale(leggiFiltroSoggetto('Idraulico Rossi'), { testo: 'Idraulico Rossi' });
  uguale(leggiFiltroSoggetto('{non json'), { testo: '{non json' });
});

gruppo('Revisione scadenziario — export Excel');

prova('le passive hanno partita IVA, ritenuta e codice tributo', () => {
  const intest = COLS.map(c => c.header);
  for (const h of ['Partita IVA', "Ritenuta d'acconto", 'Codice tributo']) vero(intest.includes(h), 'manca ' + h);
  const riga = { fornitore: 'Avv. Bianchi', partita_iva: 'IT01234567890', ritenuta: 200, ritenuta_codice_tributo: '1040' };
  const val = (h, r) => COLS.find(c => c.header === h).get(r);
  uguale(val('Partita IVA', riga), 'IT01234567890');
  uguale(val("Ritenuta d'acconto", riga), 200);
  uguale(val('Codice tributo', riga), '1040');
  uguale(val("Ritenuta d'acconto", { fornitore: 'x' }), '');
  uguale(val('Codice tributo', { fornitore: 'x', ritenuta_codice_tributo: '1040' }), '');
});

prova('le attive hanno la partita IVA', () => {
  const col = COLS_ATTIVE.find(c => c.header === 'Partita IVA');
  vero(col, 'manca la colonna');
  uguale(col.get({ partita_iva: 'IT00856930102' }), 'IT00856930102');
  uguale(col.get({}), '');
});
