// ============================================================
//  COPIA DI SICUREZZA DEL DATABASE
//  Uso:  npm run backup
//
//  Scarica TUTTE le tabelle del portale in file JSON dentro backup/<data>/.
//  Serve perché il piano gratuito di Supabase non garantisce copie che si
//  possano ripristinare da soli: lì dentro ci sono le fatture del Comitato,
//  ed è l'unica cosa di questo progetto che, se va persa, non si rimedia
//  riscrivendo del codice.
//
//  Serve la SERVICE ROLE KEY (Supabase → Project Settings → API), la stessa
//  che sta sul Worker: si legge da .dev.vars o dalla variabile d'ambiente
//  SUPABASE_SERVICE_ROLE_KEY. È una chiave che scavalca tutti i permessi:
//  non va messa nel repository né mandata in giro, e i file prodotti
//  contengono dati personali, quindi vanno tenuti come si terrebbe una
//  cartella di fatture.
//
//  Cosa NON c'è dentro: gli account veri (auth.users). Le password non sono
//  esportabili per costruzione, e di ogni persona restano comunque id, email,
//  nome e ruolo nella tabella `profili`, che è quanto serve a ricrearli.
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL_SUPABASE = 'https://xmfqozojjplccnnttwxu.supabase.co';

// Tutte le tabelle del portale, raggruppate come sono raggruppate le sezioni:
// se un domani se ne aggiunge una, va aggiunta anche qui — meglio un elenco
// esplicito che una scoperta automatica che un giorno salta qualcosa in
// silenzio.
const TABELLE = {
  'Portale': ['profili', 'sezioni', 'autorizzazioni'],
  'Scadenziario — fatture passive': ['fatture', 'pagamenti', 'note_credito', 'note_credito_righe', 'proposte_pagamento', 'log_modifiche', 'impostazioni'],
  'Scadenziario — fatture attive': ['fatture_attive', 'incassi', 'note_credito_attive', 'note_credito_attive_righe', 'log_modifiche_attive'],
  'Trasporti lunghi': ['preventivi', 'impostazioni_trasferte'],
  'Assistenze sanitarie': ['preventivi_assistenze', 'clienti_assistenze', 'impostazioni_assistenze'],
  'Formazione esterna': ['preventivi_formazione', 'clienti_formazione', 'impostazioni_formazione'],
  'Straordinari': ['straordinari', 'dipendenti_straordinari', 'impostazioni_straordinari'],
};

// Chiavi da .dev.vars, stesso formato dei secret di Cloudflare (come fa
// server.js): quelle già presenti nell'ambiente hanno la precedenza.
try {
  for (const riga of fs.readFileSync(path.join(RADICE, '.dev.vars'), 'utf8').split('\n')) {
    const m = riga.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch { /* nessun .dev.vars: si userà l'ambiente */ }

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

const BLOCCO = 1000;

// L'ordinamento serve a paginare senza perdere o ripetere righe: PostgREST
// senza `order` non garantisce che due pagine consecutive non si accavallino.
// Quasi tutte le tabelle hanno una colonna `id`; `autorizzazioni` no — la sua
// chiave è la coppia utente+sezione — e chiedere id.asc lì rispondeva 400.
const ORDINE = {
  autorizzazioni: 'utente_id.asc,sezione.asc',
};

async function scarica(tabella) {
  const righe = [];
  const ordine = ORDINE[tabella] || 'id.asc';
  for (let da = 0; ; da += BLOCCO) {
    const url = `${URL_SUPABASE}/rest/v1/${tabella}?select=*&order=${ordine}&limit=${BLOCCO}&offset=${da}`;
    const res = await fetch(url, { headers: { apikey: CHIAVE, Authorization: `Bearer ${CHIAVE}` } });
    if (!res.ok) {
      const testo = await res.text().catch(() => '');
      throw new Error(`${res.status} ${res.statusText} ${testo.slice(0, 200)}`);
    }
    const blocco = await res.json();
    righe.push(...blocco);
    if (blocco.length < BLOCCO) break;
  }
  return righe;
}

const oggi = new Date();
const stampa = (n) => String(n).padStart(2, '0');
const cartella = path.join(RADICE, 'backup',
  `${oggi.getFullYear()}-${stampa(oggi.getMonth() + 1)}-${stampa(oggi.getDate())}`);
fs.mkdirSync(cartella, { recursive: true });

console.log(`\nCopia di sicurezza in backup/${path.basename(cartella)}\n`);

const riepilogo = { fatta_il: oggi.toISOString(), progetto: URL_SUPABASE, tabelle: {} };
const problemi = [];

for (const [sezione, tabelle] of Object.entries(TABELLE)) {
  console.log(`  ${sezione}`);
  for (const tabella of tabelle) {
    try {
      const righe = await scarica(tabella);
      fs.writeFileSync(path.join(cartella, `${tabella}.json`), JSON.stringify(righe, null, 2), 'utf8');
      riepilogo.tabelle[tabella] = righe.length;
      console.log(`    ✓ ${tabella.padEnd(28)} ${String(righe.length).padStart(6)} righe`);
    } catch (e) {
      problemi.push({ tabella, errore: e.message });
      riepilogo.tabelle[tabella] = null;
      console.log(`    ✗ ${tabella.padEnd(28)} ${e.message}`);
    }
  }
}

fs.writeFileSync(path.join(cartella, '_riepilogo.json'), JSON.stringify(riepilogo, null, 2), 'utf8');

const totale = Object.values(riepilogo.tabelle).reduce((s, n) => s + (n || 0), 0);
console.log(`\n${totale} righe salvate in ${cartella}`);

if (problemi.length) {
  console.log(`\n⚠️  ${problemi.length} tabelle non salvate. Se una di queste non esiste ancora sul database
   (perché la patch della sezione non è stata eseguita) è normale; altrimenti
   la copia è incompleta e va ripetuta.\n`);
  process.exit(1);
}
console.log('\nTienila fuori dal computer di lavoro: una copia che sta solo lì non è una copia.\n');
