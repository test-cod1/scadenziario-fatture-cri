// I documenti consegnati al cliente: PDF (HTML di stampa) e Word.
// Qui non si controlla l'impaginazione — quella si guarda con gli occhi — ma
// le cose che devono essere vere sempre: che ci sia la carta intestata, che i
// totali scritti siano quelli calcolati, che il .docx sia un file valido e
// che dentro NON finisca quello che il cliente non deve leggere.
import { gruppo, prova, uguale, vero, falso, preparaAmbienteDocumenti, soloTesto, RADICE } from './aiuto.mjs';
import { pathToFileURL } from 'node:url';
import zlib from 'node:zlib';

preparaAmbienteDocumenti();
const mod = (p) => import(pathToFileURL(RADICE + p).href);

// Legge le voci di uno zip (il .docx) senza librerie: serve solo a verificare
// che il file sia davvero uno zip con dentro le parti che ci aspettiamo.
function vociZip(buf) {
  const voci = {};
  let i = buf.length - 22;
  while (i > 0 && buf.readUInt32LE(i) !== 0x06054b50) i--;
  const n = buf.readUInt16LE(i + 10);
  let off = buf.readUInt32LE(i + 16);
  for (let k = 0; k < n; k++) {
    const lNome = buf.readUInt16LE(off + 28), lExtra = buf.readUInt16LE(off + 30), lComm = buf.readUInt16LE(off + 32);
    const nome = buf.toString('utf8', off + 46, off + 46 + lNome);
    const localOff = buf.readUInt32LE(off + 42);
    const metodo = buf.readUInt16LE(off + 10);
    const dim = buf.readUInt32LE(off + 20);
    const inizio = localOff + 30 + buf.readUInt16LE(localOff + 26) + buf.readUInt16LE(localOff + 28);
    const dati = buf.subarray(inizio, inizio + dim);
    voci[nome] = metodo === 8 ? zlib.inflateRawSync(dati) : dati;
    off += 46 + lNome + lExtra + lComm;
  }
  return voci;
}

// Tag aperti e chiusi in pari: un XML sbilanciato fa aprire a Word la
// finestra "il file è danneggiato".
function xmlBilanciato(xml) {
  const pila = [];
  const re = /<(\/?)([A-Za-z0-9:_.-]+)([^>]*?)(\/?)>/g;
  let m;
  while ((m = re.exec(xml))) {
    if (m[2].startsWith('?') || m[2].startsWith('!') || m[4] === '/') continue;
    if (m[1] === '/') { if (pila.pop() !== m[2]) return false; } else pila.push(m[2]);
  }
  return pila.length === 0;
}

// ------------------------------------------------------------------
gruppo('Documento — formazione esterna');

const fPrev = {
  cliente: 'Omnia Service s.r.l.', cliente_indirizzo: 'Via Cornigliano 34, Genova', cliente_cf: '01234567890',
  referente: 'Stefano Salvetti', protocollo: '1234/2026', oggetto: 'PREVENTIVO CORSI BLSD',
  data_documento: '2026-09-06',
  righe: [
    { id: 'blsd', nome: 'Corso BLSD', durata: '5 ore', attestato: 'Autorizzazione all\'uso del DAE', discenti: 8, listino: 60, prezzo: 55 },
    { id: 'ret', nome: 'Retraining BLSD', durata: '2 ore', attestato: 'Autorizzazione all\'uso del DAE', discenti: 4, listino: 40, prezzo: 35 },
  ],
  sede_tipo: 'cliente', sede: 'Via Cornigliano 34, Genova', trasferta: 50,
  regime_iva: 'esente', sconto_percentuale: 5,
};

prova('riporta destinatario, protocollo e oggetto', async () => {
  const { htmlPreventivo } = await mod('/js/formazione/lib/stampa.js');
  const { DEFAULT_IMPOSTAZIONI } = await mod('/js/formazione/calc.js');
  const t = soloTesto(await htmlPreventivo(fPrev, DEFAULT_IMPOSTAZIONI));
  vero(t.includes('Spett.le'), 'manca la formula di apertura');
  vero(t.includes('Omnia Service s.r.l.'));
  vero(t.includes('Alla c.a. Stefano Salvetti'));
  vero(t.includes('Prot. n. 1234/2026'));
  vero(t.includes('OGGETTO: PREVENTIVO CORSI BLSD'));
});

prova('il totale scritto è quello calcolato, anche in lettere', async () => {
  const { htmlPreventivo } = await mod('/js/formazione/lib/stampa.js');
  const { DEFAULT_IMPOSTAZIONI, calcola, inLettere } = await mod('/js/formazione/calc.js');
  const r = calcola(fPrev);
  uguale(r.totale, 598.5);
  const t = soloTesto(await htmlPreventivo(fPrev, DEFAULT_IMPOSTAZIONI));
  vero(t.includes('598,50'), 'il totale non compare nel documento');
  vero(t.includes(inLettere(r.totale)), 'manca l\'importo in lettere');
});

prova('mostra il listino solo dove è più alto del prezzo riservato', async () => {
  const { htmlPreventivo } = await mod('/js/formazione/lib/stampa.js');
  const { DEFAULT_IMPOSTAZIONI } = await mod('/js/formazione/calc.js');
  const conSconto = soloTesto(await htmlPreventivo(fPrev, DEFAULT_IMPOSTAZIONI));
  vero(conSconto.includes('Listino a discente'), 'con un prezzo riservato la colonna del listino serve');

  const senza = { ...fPrev, righe: fPrev.righe.map(r => ({ ...r, listino: r.prezzo })) };
  const t = soloTesto(await htmlPreventivo(senza, DEFAULT_IMPOSTAZIONI));
  falso(t.includes('Listino a discente'), 'senza sconto, la colonna ripeterebbe quella accanto');
});

prova('elenca le attestazioni corso per corso', async () => {
  const { htmlPreventivo } = await mod('/js/formazione/lib/stampa.js');
  const { DEFAULT_IMPOSTAZIONI } = await mod('/js/formazione/calc.js');
  const t = soloTesto(await htmlPreventivo(fPrev, DEFAULT_IMPOSTAZIONI));
  vero(/ATTESTAZIONI RILASCIATE/i.test(t));
  vero(t.includes('Autorizzazione all\'uso del DAE'));
});

// ------------------------------------------------------------------
gruppo('Documento — trasporti lunghi');

const tPrev = {
  titolo: 'Torino', cliente: 'Ospedali Galliera', data_servizio: '2026-10-14',
  andata_ritorno: true, partenza: { label: 'Corso Gastaldi 11, Genova' },
  tappe: [{ label: 'Molinette, Torino' }], created_at: '2026-09-06T09:00:00Z',
  input: {
    kmTotali: 640, mezzoId: 'ambulanza', prezzoCarburante: 1.75, tariffaKm: 1.2,
    persone: 3, pastiOn: true, pastiPersona: 2, pastoCosto: 25,
    sanitariOn: true, medicoOn: true, medicoOre: 12, medicoOraria: 50, medico: 600,
    _documento: { referente: 'Dott.ssa Bianchi', protocollo: '882/2026', data_documento: '2026-09-06' },
  },
};

prova('NON mostra al cliente la spesa viva né il margine', async () => {
  const { htmlPreventivo } = await mod('/js/trasporti/lib/stampa.js');
  const { DEFAULT_IMPOSTAZIONI } = await mod('/js/trasporti/calc.js');
  const t = soloTesto(await htmlPreventivo(tPrev, DEFAULT_IMPOSTAZIONI));
  falso(/spesa reale/i.test(t), 'il costo vivo del servizio non deve finire nel documento');
  falso(/costo vivo/i.test(t));
  falso(/margine/i.test(t));
});

prova('il carburante non è una voce a sé (è dentro la tariffa al km)', async () => {
  const { htmlPreventivo } = await mod('/js/trasporti/lib/stampa.js');
  const { DEFAULT_IMPOSTAZIONI, calcola } = await mod('/js/trasporti/calc.js');
  const t = soloTesto(await htmlPreventivo(tPrev, DEFAULT_IMPOSTAZIONI));
  falso(/Carburante/i.test(t), 'elencarlo significherebbe farlo pagare due volte');
  const r = calcola(tPrev.input, DEFAULT_IMPOSTAZIONI);
  uguale(r.addebito, 1518, 'percorrenza 768 + pasti 150 + medico 600');
  vero(t.includes('1518,00'), 'il totale non compare nel documento');
});

prova('riporta itinerario e dati del servizio', async () => {
  const { htmlPreventivo } = await mod('/js/trasporti/lib/stampa.js');
  const { DEFAULT_IMPOSTAZIONI } = await mod('/js/trasporti/calc.js');
  const t = soloTesto(await htmlPreventivo(tPrev, DEFAULT_IMPOSTAZIONI));
  vero(t.includes('Molinette, Torino'));
  vero(t.includes('Rientro'), 'un andata e ritorno deve dirlo');
  vero(t.includes('14/10/2026'), 'la data del servizio');
});

// ------------------------------------------------------------------
gruppo('Documento — carta intestata e file Word');

prova('la carta intestata del .dotx finisce nella stampa di tutte le sezioni', async () => {
  const { DEFAULT_IMPOSTAZIONI: impF } = await mod('/js/formazione/calc.js');
  const { DEFAULT_IMPOSTAZIONI: impT } = await mod('/js/trasporti/calc.js');
  const pagine = [
    await (await mod('/js/formazione/lib/stampa.js')).htmlPreventivo(fPrev, impF),
    await (await mod('/js/trasporti/lib/stampa.js')).htmlPreventivo(tPrev, impT),
  ];
  for (const html of pagine) {
    vero(html.includes('data:image/jpeg;base64'), 'manca il logo');
    vero(soloTesto(html).includes('Croce Rossa Italiana'), 'manca l\'intestazione');
    vero(soloTesto(html).includes('C.F. 95171100100'), 'manca il piè di pagina dell\'ente');
  }
});

prova('il .docx è un file valido, con dentro il modello del Comitato', async () => {
  const { generaDocx } = await mod('/js/formazione/lib/docx.js');
  const { DEFAULT_IMPOSTAZIONI } = await mod('/js/formazione/calc.js');
  const { blob, nome } = await generaDocx(fPrev, DEFAULT_IMPOSTAZIONI);
  const buf = Buffer.from(await blob.arrayBuffer());
  const voci = vociZip(buf);

  vero(!!voci['word/document.xml'], 'manca il corpo del documento');
  vero(!!voci['word/header1.xml'], 'manca l\'intestazione della carta');
  vero(Object.keys(voci).some(n => n.startsWith('word/media/')), 'mancano i loghi');

  const tipi = voci['[Content_Types].xml'].toString('utf8');
  falso(tipi.includes('wordprocessingml.template.main+xml'), 'è rimasto un modello: Word lo aprirebbe senza nome');
  vero(tipi.includes('wordprocessingml.document.main+xml'));

  const doc = voci['word/document.xml'].toString('utf8');
  vero(xmlBilanciato(doc), 'XML sbilanciato: Word direbbe che il file è danneggiato');
  vero(doc.includes('<w:sectPr'), 'senza le proprietà di sezione si perdono margini e piè di pagina');
  vero(nome.endsWith('.docx'));
});

// ------------------------------------------------------------------
gruppo('Documento — casi limite (27/09/2026)');

prova('formazione: con un corso da definire il totale è dichiarato parziale', async () => {
  const { htmlPreventivo } = await mod('/js/formazione/lib/stampa.js');
  const { DEFAULT_IMPOSTAZIONI } = await mod('/js/formazione/calc.js');
  const prev = {
    cliente: 'Prova s.r.l.', data_documento: '2026-09-06', regime_iva: 'esente',
    righe: [
      { id: 'blsd', nome: 'Corso BLSD', durata: '5 ore', discenti: null, listino: 60, prezzo: 60 },
      { id: 'ps', nome: 'Primo soccorso', durata: '12 ore', discenti: 5, listino: 100, prezzo: 100 },
    ],
  };
  const t = soloTesto(await htmlPreventivo(prev, DEFAULT_IMPOSTAZIONI));
  falso(t.includes('Importo complessivo'), 'un totale senza il BLSD non è l\'importo complessivo');
  vero(t.includes('Importo parziale: 500,00'), 'manca l\'importo parziale');
  vero(/parziale, esclusi i corsi da definire/.test(t), 'il piede della tabella deve dirlo');
});

prova('formazione: senza nessun numero di discenti non si stampa nessun totale', async () => {
  const { htmlPreventivo } = await mod('/js/formazione/lib/stampa.js');
  const { DEFAULT_IMPOSTAZIONI } = await mod('/js/formazione/calc.js');
  const prev = {
    cliente: 'Prova s.r.l.', data_documento: '2026-09-06', sconto_percentuale: 10,
    righe: [{ id: 'blsd', nome: 'Corso BLSD', durata: '5 ore', discenti: null, listino: 60, prezzo: 60 }],
  };
  const t = soloTesto(await htmlPreventivo(prev, DEFAULT_IMPOSTAZIONI));
  falso(t.includes('zero/00'), 'niente "euro zero/00"');
  falso(t.includes('Importo complessivo'));
  vero(t.includes('numero effettivo dei partecipanti'));
  vero(t.includes('sconto del 10%'), 'lo sconto concordato va comunque scritto');
});

prova('trasporti: "ore × tariffa" solo se il totale del medico non è stato corretto a mano', async () => {
  const { htmlPreventivo } = await mod('/js/trasporti/lib/stampa.js');
  const { DEFAULT_IMPOSTAZIONI } = await mod('/js/trasporti/calc.js');
  const auto = soloTesto(await htmlPreventivo(tPrev, DEFAULT_IMPOSTAZIONI));
  vero(/12,0 h × 50,00/.test(auto), 'col totale automatico il dettaglio orario serve');
  const aMano = { ...tPrev, input: { ...tPrev.input, medico: 450, _medicoTotAuto: false } };
  const t = soloTesto(await htmlPreventivo(aMano, DEFAULT_IMPOSTAZIONI));
  falso(/12,0 h × 50,00/.test(t), '12 h × 50 € accanto a 450 € non torna');
  vero(t.includes('450,00'));
});

prova('trasporti: il nome del file usa la data locale, come il documento', async () => {
  const { nomeFile, fmtData } = await mod('/js/trasporti/lib/documento.js');
  const created_at = '2026-09-06T22:30:00Z';
  const d = new Date(created_at);
  const locale = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const nome = nomeFile({ cliente: 'Galliera', created_at, input: {} }, 'pdf');
  uguale(nome, `Preventivo trasporto - Galliera - ${locale}.pdf`);
  uguale(fmtData(created_at), locale.split('-').reverse().join('/'));
});

prova('assistenze: il calendario sta nella pagina anche con dieci voci', async () => {
  const { costruisciBlocchi } = await mod('/js/assistenze/lib/documento.js');
  const { DEFAULT_IMPOSTAZIONI } = await mod('/js/assistenze/calc.js');
  const voci = Array.from({ length: 10 }, (_, i) => ({ id: 'v' + i, nome: 'Voce ' + i, tipo: 'oraria', prezzo: 10 }));
  const qta = Object.fromEntries(voci.map(v => [v.id, 1]));
  const prev = { cliente: 'Prova', voci, calendario: [{ data: '2026-10-10', dalle: '09:00', alle: '12:00', qta }] };
  const { blocchi } = costruisciBlocchi(prev, DEFAULT_IMPOSTAZIONI);
  const cal = blocchi.filter(b => b.t === 'tabella').at(-1);
  const somma = cal.larghezze.reduce((s, w) => s + w, 0);
  vero(Math.abs(somma - 100) < 0.1, `le colonne sommano a ${somma}%, non a 100`);
});

prova('i caratteri di controllo non finiscono nel Word né nell\'Excel', async () => {
  const { generaDocx } = await mod('/js/formazione/lib/docx.js');
  const { DEFAULT_IMPOSTAZIONI } = await mod('/js/formazione/calc.js');
  const sporco = { ...fPrev, cliente: 'Omnia\u0001 Service\u000B s.r.l.\u001F', note: 'riga\u0008 con\tun tab' };
  const { blob } = await generaDocx(sporco, DEFAULT_IMPOSTAZIONI);
  const doc = vociZip(Buffer.from(await blob.arrayBuffer()))['word/document.xml'].toString('utf8');
  falso(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(doc), 'un carattere di controllo rende il .docx illeggibile');
  vero(doc.includes('Omnia Service s.r.l.'), 'il testo attorno resta');

  const { escXml } = await mod('/js/lib/xlsx.js');
  uguale(escXml('A\u0001B & <C>\tD\nE'), 'AB &amp; &lt;C&gt;\tD\nE');
});

prova('gli a capo scritti a mano restano a capo nel Word', async () => {
  const { generaDocx } = await mod('/js/formazione/lib/docx.js');
  const { DEFAULT_IMPOSTAZIONI } = await mod('/js/formazione/calc.js');
  // La premessa delle impostazioni arriva al documento come un blocco solo.
  const imp = { ...DEFAULT_IMPOSTAZIONI, testi: { ...DEFAULT_IMPOSTAZIONI.testi, premessa: 'prima riga\nseconda riga' } };
  const { blob } = await generaDocx(fPrev, imp);
  const doc = vociZip(Buffer.from(await blob.arrayBuffer()))['word/document.xml'].toString('utf8');
  vero(doc.includes('>prima riga</w:t><w:br/><w:t xml:space="preserve">seconda riga<'), 'le due righe non sono separate da un a capo');
});
