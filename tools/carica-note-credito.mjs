// ============================================================
//  REGISTRA LE NOTE DI CREDITO EMESSE
//  Uso:  npm run note-credito -- supabase/note-<data>.csv
//        npm run note-credito -- supabase/note-<data>.csv --applica
//
//  Il CSV ha una riga per ogni STORNO, non per ogni nota: una nota di
//  credito può stornare più fatture insieme (nel registro 2026 la n.114 ne
//  storna due), ed è la forma che il database già prevede — una testata e
//  una riga per fattura. Le righe con lo stesso numero e la stessa data
//  fanno una nota sola.
//
//    N. nota ; Data ; N. fattura stornata ; Importo storno ; Causale
//
//  Le colonne si riconoscono dal nome, come nel registro delle fatture.
//  Senza `--applica` non scrive niente.
//
//  QUELLO CHE NON FA: non indovina a quale fattura si riferisce una nota.
//  Il collegamento sta scritto nel CSV, e chi lo prepara l'ha letto nella
//  causale del documento. Una nota attaccata alla fattura sbagliata
//  toglie soldi dal posto sbagliato, e a saldi chiusi non se ne accorge
//  più nessuno.
//
//  Serve la SERVICE ROLE KEY, come per `npm run backup`.
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chiave, campiCsv } from './allineamento.mjs';

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argomenti = process.argv.slice(2);
const APPLICA = argomenti.includes('--applica');
const NOME = argomenti.find(a => !a.startsWith('--'));
if (!NOME) {
  console.error(`
Manca il file delle note di credito.

    npm run note-credito -- supabase/note-<data>.csv
    npm run note-credito -- supabase/note-<data>.csv --applica

  Una riga per storno, colonne riconosciute dal nome:
    N. nota ; Data (gg/mm/aaaa) ; N. fattura stornata ; Importo storno ; Causale
`);
  process.exit(1);
}
const FILE = path.resolve(RADICE, NOME);
if (!fs.existsSync(FILE)) { console.error(`\nIl file non esiste: ${NOME}\n`); process.exit(1); }

try {
  for (const riga of fs.readFileSync(path.join(RADICE, '.dev.vars'), 'utf8').split('\n')) {
    const m = riga.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch { /* nessun .dev.vars */ }

const URL_SUPABASE = process.env.SUPABASE_URL || 'https://xmfqozojjplccnnttwxu.supabase.co';
const CHIAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!CHIAVE) {
  console.error('\nManca SUPABASE_SERVICE_ROLE_KEY in .dev.vars (vedi npm run backup).\n');
  process.exit(1);
}

async function chiedi(percorso, opzioni = {}) {
  const res = await fetch(`${URL_SUPABASE}/rest/v1/${percorso}`, {
    ...opzioni,
    headers: { apikey: CHIAVE, Authorization: `Bearer ${CHIAVE}`, 'Content-Type': 'application/json', ...(opzioni.headers || {}) },
  });
  const testo = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${testo.slice(0, 300)}`);
  return testo ? JSON.parse(testo) : null;
}
async function scarica(tabella, select) {
  const BLOCCO = 1000; const tutte = [];
  for (let da = 0; ; da += BLOCCO) {
    const b = await chiedi(`${tabella}?select=${select}&order=id.asc&limit=${BLOCCO}&offset=${da}`);
    tutte.push(...b);
    if (b.length < BLOCCO) break;
  }
  return tutte;
}

const eur = n => Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const data_it = d => (d ? String(d).split('-').reverse().join('/') : '—');
const titolo = t => console.log(`\n${t}\n${'─'.repeat(t.length)}`);
const iso = s => (/^\d{2}\/\d{2}\/\d{4}$/.test(s) ? s.split('/').reverse().join('-') : null);

// ---------- il file ----------
const linee = fs.readFileSync(FILE, 'utf8').replace(/^﻿/, '').split(/\r?\n/);
const intest = campiCsv(linee[0] || '').map(x => x.toLowerCase());
const dove = (...nomi) => intest.findIndex(h => nomi.some(n => h.includes(n)));
const iNota = dove('n. nota', 'nota');
const iData = dove('data');
const iFatt = dove('fattura');
const iImp = dove('importo');
const iCaus = dove('causale');
if (iNota < 0 || iData < 0 || iFatt < 0 || iImp < 0) {
  console.error('\nIl file non ha le colonne attese: N. nota, Data, N. fattura stornata, Importo storno.\n');
  process.exit(1);
}

const righe = [];
for (const linea of linee.slice(1)) {
  const c = campiCsv(linea);
  if (c.length <= iImp) continue;
  const data = iso(c[iData]);
  if (!c[iNota] || !data) continue;
  righe.push({
    nota: c[iNota], data, fattura: c[iFatt],
    importo: Number(String(c[iImp]).replace(/\./g, '').replace(',', '.')),
    causale: iCaus >= 0 ? c[iCaus] : '',
  });
}
console.log(`\nFile:      ${path.relative(RADICE, FILE)}`);
console.log(`           ${righe.length} storni`);

// ---------- l'archivio ----------
const [fatture, testate, esistenti] = await Promise.all([
  scarica('fatture_attive', 'id,numero_fattura,data_fattura,importo'),
  scarica('note_credito_attive', 'id,numero,data'),
  scarica('note_credito_attive_righe', 'id,nota_credito_attiva_id,fattura_attiva_id,importo'),
]);
const perChiave = new Map(fatture.map(f => [chiave(f.numero_fattura, f.data_fattura), f]));
const giaStornato = esistenti.reduce((m, r) => m.set(r.fattura_attiva_id, (m.get(r.fattura_attiva_id) || 0) + Number(r.importo)), new Map());
console.log(`Archivio:  ${fatture.length} fatture · ${testate.length} note di credito già presenti`);

// ---------- il piano ----------
const perNota = new Map();
const problemi = [];
for (const r of righe) {
  // L'anno dello storno è quello della nota: una nota del 2026 che cita
  // «fattura 47» parla della 47 del 2026.
  const k = chiave(r.fattura, r.data);
  const f = perChiave.get(k);
  if (!f) { problemi.push(`nota ${r.nota}: la fattura ${k} non è in archivio`); continue; }
  if (giaStornato.get(f.id)) { problemi.push(`nota ${r.nota}: la fattura ${k} ha già uno storno registrato`); continue; }
  if (r.importo > Number(f.importo) + 0.005) {
    problemi.push(`nota ${r.nota}: storno ${eur(r.importo)} maggiore della fattura ${k} (${eur(f.importo)})`);
    continue;
  }
  const idNota = `${r.nota}|${r.data}`;
  if (testate.some(t => String(t.numero) === r.nota && t.data === r.data)) {
    problemi.push(`nota ${r.nota} del ${data_it(r.data)}: è già registrata`);
    continue;
  }
  if (!perNota.has(idNota)) perNota.set(idNota, { numero: r.nota, data: r.data, causale: r.causale, righe: [] });
  perNota.get(idNota).righe.push({ f, importo: r.importo, numeroFattura: r.fattura });
}

titolo(`DA REGISTRARE: ${perNota.size} note, ${[...perNota.values()].reduce((s, n) => s + n.righe.length, 0)} storni`);
for (const n of perNota.values()) {
  console.log(`  NC ${String(n.numero).padStart(4)} del ${data_it(n.data)}  ${eur(n.righe.reduce((s, r) => s + r.importo, 0)).padStart(14)}`);
  for (const r of n.righe) {
    const totale = Math.abs(r.importo - Number(r.f.importo)) < 0.005;
    console.log(`       storna la fattura ${String(r.numeroFattura).padEnd(4)} del ${data_it(r.f.data_fattura)}  ${eur(r.importo).padStart(14)}  ${totale ? '(storno totale)' : `(parziale, la fattura è ${eur(r.f.importo)})`}`);
  }
}
if (problemi.length) {
  titolo(`NON REGISTRABILI: ${problemi.length}`);
  for (const p of problemi) console.log(`  · ${p}`);
}

if (!APPLICA) {
  console.log(`\n\nNon è stato scritto niente.${perNota.size ? `\n\n    npm run note-credito -- ${NOME.replace(/\\/g, '/')} --applica` : ''}\n`);
  process.exit(0);
}

// ---------- scrittura ----------
// Testata e righe non si possono scrivere in una transazione via REST:
// se le righe falliscono, la testata resta orfana e in elenco comparirebbe
// una nota di credito che non storna niente. Si fa quello che fa già
// noteCreditoAttive.create() in js/data/storeAttive.js — si cancella la
// testata appena scritta.
titolo('SCRITTURA');
let fatte = 0, storni = 0;
const errori = [];
for (const n of perNota.values()) {
  let testata;
  try {
    testata = await chiedi('note_credito_attive', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ numero: n.numero, data: n.data, note: n.causale || null }),
    });
  } catch (e) { errori.push(`nota ${n.numero}: ${e.message}`); continue; }
  const id = testata[0].id;
  try {
    await chiedi('note_credito_attive_righe', {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(n.righe.map(r => ({ nota_credito_attiva_id: id, fattura_attiva_id: r.f.id, importo: r.importo }))),
    });
    fatte++; storni += n.righe.length;
  } catch (e) {
    errori.push(`nota ${n.numero}: righe non scritte (${e.message}) — testata annullata`);
    await chiedi(`note_credito_attive?id=eq.${id}`, { method: 'DELETE' }).catch(() => {});
  }
}
console.log(`  note registrate: ${fatte}`);
console.log(`  storni:          ${storni}`);

const dopo = await scarica('fatture_attive', 'id,numero_fattura,data_fattura,stato');
const stornate = dopo.filter(f => f.stato === 'stornata');
titolo('VERIFICA');
console.log(`  note di credito in archivio: ${(await scarica('note_credito_attive', 'id')).length}`);
console.log(`  fatture passate a «stornata»: ${stornate.length}`);
if (errori.length) {
  console.log(`\n⚠️  ${errori.length} non riuscite:`);
  for (const e of errori) console.log(`   · ${e}`);
  process.exit(1);
}
console.log('\nFatto.\n');
