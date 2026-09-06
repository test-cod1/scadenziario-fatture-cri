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
