// ============================================================
//  ALLINEA LE FATTURE ATTIVE AL REGISTRO DI FATTURAZIONE
//  Uso:  npm run allinea-attive -- supabase/registro-<data>.csv
//        npm run allinea-attive -- supabase/registro-<data>.csv --applica
//
//  Il registro è un CSV con intestazione e colonne separate da punto e
//  virgola, riconosciute dal nome:
//    N. fattura ; Data ; Cliente ; Totale documento ; Incassata il
//  L'ultima è facoltativa: dov'è valorizzata, la fattura risulta incassata
//  per intero a quella data. Una riga finale di totali viene ignorata.
//
//  Il registro delle fatture emesse esce dal gestionale di fatturazione
//  come stampa, e ogni tanto lo si riversa qui. Riversarlo da capo
//  creerebbe un doppione per ogni fattura già presente: questo strumento
//  ALLINEA invece di importare — tiene quello che c'è già, corregge quello
//  che è cambiato, inserisce solo quello che manca.
//
//  Senza `--applica` non scrive niente: dice soltanto che cosa farebbe. È
//  il modo in cui va usato la prima volta, ed è il modo in cui va riletto
//  ogni volta prima di applicare.
//
//  LE REGOLE — quale riga è quale fattura, che cosa si cancella e che cosa
//  no — stanno in tools/allineamento.mjs, senza una riga di rete, e sono
//  provate da test/allineamento.prove.mjs. Qui c'è solo il mestiere:
//  credenziali, chiamate, stampa.
//
//  Serve la SERVICE ROLE KEY, come per `npm run backup`: si legge da
//  .dev.vars o dall'ambiente. È una chiave che scavalca tutti i permessi.
//
//  Ogni riga toccata finisce nel registro modifiche dell'applicazione
//  (trigger on_fatture_attive_log), con dentro il "prima": è quello che
//  rende l'operazione rimediabile.
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chiave, leggiRegistro, conStoria, pianifica } from './allineamento.mjs';

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const argomenti = process.argv.slice(2);
const APPLICA = argomenti.includes('--applica');
const SENZA_BACKUP = argomenti.includes('--senza-backup');
// Il registro si passa sempre per nome, senza un valore di ripiego: ogni
// riversamento ha il suo file, e un percorso predefinito avrebbe fatto
// scrivere sul database il registro della volta prima a chi si dimentica
// l'argomento.
const NOME_REGISTRO = argomenti.find(a => !a.startsWith('--'));
if (!NOME_REGISTRO) {
  console.error(`
Manca il registro da cui allineare.

    npm run allinea-attive -- supabase/registro-<data>.csv
    npm run allinea-attive -- supabase/registro-<data>.csv --applica

  Il file è un CSV con intestazione e colonne separate da punto e virgola,
  riconosciute dal nome:

    N. fattura ; Data (gg/mm/aaaa) ; Cliente ; Totale documento ; Incassata il

  L'ultima è facoltativa. Una riga finale di totali viene ignorata.
`);
  process.exit(1);
}
const FILE_REGISTRO = path.resolve(RADICE, NOME_REGISTRO);
if (!fs.existsSync(FILE_REGISTRO)) {
  console.error(`\nIl registro non esiste: ${NOME_REGISTRO}\n`);
  process.exit(1);
}

// Chiavi da .dev.vars, stesso formato dei secret di Cloudflare (come fanno
// server.js e tools/backup.mjs): quelle già nell'ambiente hanno la precedenza.
try {
  for (const riga of fs.readFileSync(path.join(RADICE, '.dev.vars'), 'utf8').split('\n')) {
    const m = riga.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch { /* nessun .dev.vars: si userà l'ambiente */ }

// L'indirizzo è quello del progetto, ma resta sovrascrivibile: è così che
// lo si può puntare a un database finto per collaudare lo strumento senza
// toccare le fatture vere (vedi tools/prova-allineamento.mjs).
const URL_SUPABASE = process.env.SUPABASE_URL || 'https://xmfqozojjplccnnttwxu.supabase.co';
const CHIAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!CHIAVE) {
  console.error(`
Manca la chiave di servizio.

  Prendila da Supabase → Project Settings → API → service_role key
  e mettila in un file .dev.vars nella cartella del progetto:

    SUPABASE_SERVICE_ROLE_KEY=la-chiave

  (.dev.vars non finisce nel repository: è già escluso da .gitignore)
`);
  process.exit(1);
}

// ---------- il database ----------
async function chiedi(percorso, opzioni = {}) {
  const res = await fetch(`${URL_SUPABASE}/rest/v1/${percorso}`, {
    ...opzioni,
    headers: {
      apikey: CHIAVE,
      Authorization: `Bearer ${CHIAVE}`,
      'Content-Type': 'application/json',
      ...(opzioni.headers || {}),
    },
  });
  const testo = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${testo.slice(0, 300)}`);
  return testo ? JSON.parse(testo) : null;
}

// PostgREST tronca ogni risposta a 1000 righe: stessa paginazione del resto
// del progetto (vedi js/data/store.js e tools/backup.mjs).
async function scarica(tabella, select, ordine = 'id.asc') {
  const BLOCCO = 1000;
  const tutte = [];
  for (let da = 0; ; da += BLOCCO) {
    const blocco = await chiedi(`${tabella}?select=${select}&order=${ordine}&limit=${BLOCCO}&offset=${da}`);
    tutte.push(...blocco);
    if (blocco.length < BLOCCO) break;
  }
  return tutte;
}

const eur = n => Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const data_it = d => d ? String(d).split('-').reverse().join('/') : 'senza data';
const titolo = (t) => console.log(`\n${t}\n${'─'.repeat(t.length)}`);

// ============================================================
console.log(`\nRegistro:  ${path.relative(RADICE, FILE_REGISTRO)}`);
const registro = leggiRegistro(fs.readFileSync(FILE_REGISTRO, 'utf8'));
if (!registro.length) { console.error('Il registro è vuoto o illeggibile.'); process.exit(1); }
console.log(`           ${registro.length} fatture, ${eur(registro.reduce((s, r) => s + r.importo, 0))}`);

// Un numero ripetuto DENTRO il registro sarebbe un errore di estrazione, e
// non va scoperto a metà scrittura.
if (new Set(registro.map(r => chiave(r.numero, r.data))).size !== registro.length) {
  console.error('\nIl registro contiene numeri ripetuti nello stesso anno: va corretto prima di proseguire.');
  process.exit(1);
}

console.log(`Archivio:  ${URL_SUPABASE}`);
const [grezze, incassi, storni, quote] = await Promise.all([
  scarica('fatture_attive', 'id,cliente,numero_fattura,data_fattura,importo,stato,created_at'),
  scarica('incassi', 'id,fattura_attiva_id,importo'),
  scarica('note_credito_attive_righe', 'id,fattura_attiva_id,importo'),
  scarica('imputazioni', 'id,fattura_attiva_id'),
]);
const fatture = conStoria(grezze, { incassi, storni, quote });
console.log(`           ${fatture.length} fatture in archivio, ${eur(fatture.reduce((s, f) => s + Number(f.importo || 0), 0))}`);

const piano = pianifica(registro, fatture);

// ---------- il quadro ----------
titolo(`DOPPIONI DA TOGLIERE: ${piano.daCancellare.length}`);
for (const f of piano.daCancellare) {
  console.log(`  ${f._chiave.padEnd(12)} ${data_it(f.data_fattura).padEnd(11)} ${eur(f.importo).padStart(14)}  ${f.cliente}`);
}
if (piano.doppioniIrrisolti.length) {
  titolo(`DOPPIONI DA DECIDERE A MANO: ${piano.doppioniIrrisolti.length}`);
  console.log('  Più di una riga ha incassi, note di credito o quote: non si cancella nulla.');
  for (const d of piano.doppioniIrrisolti) {
    console.log(`  ${d.chiave}`);
    for (const f of d.gruppo) {
      console.log(`     ${data_it(f.data_fattura).padEnd(11)} ${eur(f.importo).padStart(14)}  ${f.cliente}`
        + `  [incassato ${eur(f._incassato)}, stornato ${eur(f._stornato)}, ${f._quote} quote]`);
    }
  }
}

titolo(`DA INSERIRE: ${piano.daInserire.length}`);
for (const r of piano.daInserire) {
  console.log(`  ${String(r.numero).padEnd(6)} ${data_it(r.data).padEnd(11)} ${eur(r.importo).padStart(14)}  ${r.cliente}`);
}

titolo(`DA CORREGGERE: ${piano.daCorreggere.length}`);
for (const { f, r } of piano.daCorreggere) {
  const pezzi = [];
  if (f.cliente !== r.cliente) pezzi.push(`cliente «${f.cliente}» → «${r.cliente}»`);
  if (f.data_fattura !== r.data) pezzi.push(`data ${data_it(f.data_fattura)} → ${data_it(r.data)}`);
  if (Number(f.importo) !== r.importo) pezzi.push(`importo ${eur(f.importo)} → ${eur(r.importo)}`);
  console.log(`  ${String(r.numero).padEnd(6)} ${pezzi.join(' · ')}`);
}

if (piano.bloccate.length) {
  titolo(`DA CONTROLLARE — importo più basso di quanto già incassato: ${piano.bloccate.length}`);
  for (const { f, r } of piano.bloccate) {
    console.log(`  ${String(r.numero).padEnd(6)} archivio ${eur(f.importo)} (incassato ${eur(f._incassato)}, stornato ${eur(f._stornato)}) → registro ${eur(r.importo)}`);
  }
}

titolo(`INCASSI DA REGISTRARE: ${piano.daIncassare.length}`);
if (piano.daIncassare.length) {
  console.log('  Per intero, alla data che dice il registro. Solo su fatture che non hanno ancora nessun incasso.');
  const anticipati = piano.daIncassare.filter(({ r }) => r.incassata < r.data);
  if (anticipati.length) {
    console.log(`  ${anticipati.length} con data di incasso PRECEDENTE all’emissione — si registrano come stanno, ma vale la pena guardarle:`);
    for (const { r } of anticipati) {
      console.log(`     n.${String(r.numero).padStart(4)} emessa ${data_it(r.data)} · incassata ${data_it(r.incassata)}  ${r.cliente}`);
    }
  }
}
if (piano.incassiGiaPresenti.length) {
  titolo(`INCASSI NON TOCCATI: ${piano.incassiGiaPresenti.length}`);
  console.log('  Queste fatture hanno già un incasso registrato a mano: il registro conosce una data sola');
  console.log('  e l’importo pieno, e sovrascriverlo cancellerebbe un lavoro fatto sull’estratto conto.');
  for (const { f, r } of piano.incassiGiaPresenti) {
    console.log(`     n.${String(r.numero).padStart(4)} in archivio ${eur(f._incassato)} · registro: incassata il ${data_it(r.incassata)}`);
  }
}

if (piano.fuoriRegistro.length) {
  titolo(`IN ARCHIVIO MA NON NEL REGISTRO: ${piano.fuoriRegistro.length}`);
  console.log('  Annullate, diventate note di credito, o numerate male. Non si toccano: si decidono dall’app.');
  for (const f of piano.fuoriRegistro) {
    console.log(`  ${String(f.numero_fattura || '—').padEnd(6)} ${data_it(f.data_fattura).padEnd(11)} ${eur(f.importo).padStart(14)}  ${f.cliente}  [${f.stato}]`);
  }
}
if (piano.altriAnni.length) {
  titolo(`ALTRI ANNI: ${piano.altriAnni.length}`);
  console.log('  Il registro di oggi non li riguarda. Restano come sono.');
}

// ---------- applicare ----------
if (!APPLICA) {
  const quante = piano.daCancellare.length + piano.daCorreggere.length
    + piano.daInserire.length + piano.daIncassare.length;
  console.log(`\n\nNon è stato scritto niente. ${quante ? `Da fare: ${quante} operazioni.` : 'Non c’è niente da fare.'}`);
  if (quante) {
    console.log(`\n    npm run allinea-attive -- ${NOME_REGISTRO} --applica\n`);
  } else {
    console.log('');
  }
  process.exit(0);
}

// La copia di sicurezza esiste già come comando: pretenderla qui costa un
// minuto e vale tutto il resto. Si può saltare, ma bisogna dirlo.
const oggi = new Date();
const cartellaOggi = path.join(RADICE, 'backup',
  `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, '0')}-${String(oggi.getDate()).padStart(2, '0')}`);
if (!SENZA_BACKUP && !fs.existsSync(cartellaOggi)) {
  console.error(`
Prima fai la copia di sicurezza:

    npm run backup

  Questo strumento cancella e riscrive righe di fatture: la copia di oggi è
  l'unica cosa che rende l'errore rimediabile senza ricostruire a mano.
  Per saltarla consapevolmente:  --senza-backup
`);
  process.exit(1);
}

titolo('SCRITTURA');
const fatti = { cancellate: 0, corrette: 0, inserite: 0, incassi: 0 };
const errori = [];

for (const f of piano.daCancellare) {
  try { await chiedi(`fatture_attive?id=eq.${f.id}`, { method: 'DELETE' }); fatti.cancellate++; }
  catch (e) { errori.push(`doppione ${f._chiave}: ${e.message}`); }
}
console.log(`  doppioni cancellati: ${fatti.cancellate}`);

// Una alla volta e non in blocco: il trigger che impedisce di scendere
// sotto le quote attribuite ai centri di costo parla di UNA fattura, e in
// un aggiornamento cumulativo il suo messaggio si perderebbe insieme a
// tutte le altre correzioni.
for (const { f, r } of piano.daCorreggere) {
  try {
    await chiedi(`fatture_attive?id=eq.${f.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        cliente: r.cliente, data_fattura: r.data, importo: r.importo,
        updated_at: new Date().toISOString(),
      }),
    });
    fatti.corrette++;
  } catch (e) { errori.push(`fattura ${r.numero}: ${e.message}`); }
}
console.log(`  fatture corrette:    ${fatti.corrette}`);

if (piano.daInserire.length) {
  const BLOCCO = 100;
  for (let i = 0; i < piano.daInserire.length; i += BLOCCO) {
    const pezzo = piano.daInserire.slice(i, i + BLOCCO).map(r => ({
      cliente: r.cliente, numero_fattura: r.numero, data_fattura: r.data,
      importo: r.importo, stato: 'da_incassare',
      note: `[Registro fatture attive del ${data_it(oggi.toISOString().slice(0, 10))}]`,
    }));
    try {
      await chiedi('fatture_attive', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(pezzo) });
      fatti.inserite += pezzo.length;
    } catch (e) { errori.push(`inserimento righe ${i + 1}–${i + pezzo.length}: ${e.message}`); }
  }
}
console.log(`  fatture inserite:    ${fatti.inserite}`);

// ---------- gli incassi ----------
// Si rileggono le fatture invece di riusare il piano: quelle appena
// inserite non avevano un id quando il piano è stato fatto, e indovinarlo
// avrebbe voluto dire attaccare un incasso alla fattura sbagliata.
if (piano.daIncassare.length) {
  const adesso = conStoria(
    await scarica('fatture_attive', 'id,numero_fattura,data_fattura,importo'),
    { incassi: await scarica('incassi', 'id,fattura_attiva_id,importo') },
  );
  const perChiave = new Map();
  for (const f of adesso) perChiave.set(f._chiave, f);

  const righe = [];
  for (const { r } of piano.daIncassare) {
    const f = perChiave.get(chiave(r.numero, r.data));
    if (!f) { errori.push(`incasso fattura ${r.numero}: la fattura non risulta in archivio`); continue; }
    if (f._incassato > 0) continue;                    // qualcuno l'ha registrato nel frattempo
    righe.push({
      fattura_attiva_id: f.id,
      importo: Number(f.importo),
      data_incasso: r.incassata,
      note: `[Registro fatture attive del ${data_it(oggi.toISOString().slice(0, 10))}]`,
    });
  }
  const BLOCCO = 100;
  for (let i = 0; i < righe.length; i += BLOCCO) {
    const pezzo = righe.slice(i, i + BLOCCO);
    try {
      await chiedi('incassi', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(pezzo) });
      fatti.incassi += pezzo.length;
    } catch (e) { errori.push(`incassi righe ${i + 1}–${i + pezzo.length}: ${e.message}`); }
  }
}
console.log(`  incassi registrati:  ${fatti.incassi}`);

// ---------- la verifica ----------
// Si rilegge il database invece di fidarsi dei contatori qui sopra: i
// contatori dicono che cosa si è chiesto, la rilettura che cosa c'è.
const dopo = await scarica('fatture_attive', 'id,numero_fattura,data_fattura');
const chiaviDopo = new Map();
for (const f of dopo) {
  const k = chiave(f.numero_fattura, f.data_fattura);
  chiaviDopo.set(k, (chiaviDopo.get(k) || 0) + 1);
}
const mancanti = [...piano.chiaviRegistro].filter(k => !chiaviDopo.has(k));
const doppiRimasti = [...chiaviDopo.entries()].filter(([, n]) => n > 1);

titolo('VERIFICA');
console.log(`  fatture in archivio:      ${dopo.length}`);
console.log(`  del registro non trovate: ${mancanti.length}${mancanti.length ? '  → ' + mancanti.join(', ') : ''}`);
console.log(`  numeri ancora doppi:      ${doppiRimasti.length}${doppiRimasti.length ? '  → ' + doppiRimasti.map(([k, n]) => `${k} (${n})`).join(', ') : ''}`);

if (errori.length) {
  console.log(`\n⚠️  ${errori.length} operazioni non riuscite:`);
  for (const e of errori) console.log(`   · ${e}`);
  process.exit(1);
}
console.log('\nFatto. Ogni riga toccata è nel registro modifiche dell’applicazione.\n');
