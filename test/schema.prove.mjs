// ============================================================
//  schema.sql deve contenere tutto quello che creano le patch.
//
//  Le patch servono ai database già in uso; schema.sql è la forma
//  definitiva, quella da cui nasce un database nuovo. Quando si aggiunge
//  una sezione è facile scrivere la patch e dimenticare schema.sql: il
//  portale continua a funzionare — chi ha eseguito la patch non vede
//  niente di strano — e il buco salta fuori mesi dopo, ricostruendo il
//  database, sotto forma di una sezione che c'è nel menu e non ha le sue
//  tabelle.
//
//  È già successo due volte: con gli Straordinari (trovato nella
//  revisione del 05/09/2026) e con gli impegni del Direttore, dimenticati
//  l'11/09 subito dopo aver corretto il primo. Da qui in poi lo dice una
//  prova invece di una lettura attenta.
// ============================================================
import { gruppo, prova, uguale, RADICE } from './aiuto.mjs';
import fs from 'node:fs';
import path from 'node:path';

const CARTELLA = path.join(RADICE, 'supabase');
const patch = fs.readdirSync(CARTELLA).filter(f => f.startsWith('patch-') && f.endsWith('.sql')).sort();
const schema = fs.readFileSync(path.join(CARTELLA, 'schema.sql'), 'utf8');

// Quello che una patch crea e che deve finire anche in schema.sql. Si
// guardano le tabelle: sono la struttura, e se manca una tabella manca
// tutto quello che le sta attorno.
function tabelleCreate(sql) {
  return [...sql.matchAll(/create table if not exists public\.([a-z_0-9]+)/g)].map(m => m[1]);
}

// Una tabella può essere stata creata da una patch e poi eliminata da una
// successiva: in quel caso è giusto che in schema.sql non ci sia.
function tabelleEliminate(sql) {
  return [...sql.matchAll(/drop table (?:if exists )?public\.([a-z_0-9]+)/g)].map(m => m[1]);
}

gruppo('Schema del database');

prova('ogni tabella creata da una patch sta anche in schema.sql', () => {
  const create = new Set();
  const drop = new Set();
  for (const f of patch) {
    const sql = fs.readFileSync(path.join(CARTELLA, f), 'utf8');
    for (const t of tabelleCreate(sql)) create.add(t);
    for (const t of tabelleEliminate(sql)) drop.add(t);
  }
  const attese = [...create].filter(t => !drop.has(t)).sort();
  const mancanti = attese.filter(t => !new RegExp(`create table if not exists public\\.${t}\\b`).test(schema));
  uguale(mancanti, [], 'tabelle che nascono solo dalle patch');
});

prova('ogni sezione del portale è nell’elenco che schema.sql scrive in public.sezioni', async () => {
  const { ID_SEZIONI } = await import('../js/sezioniIds.js');
  const blocco = schema.slice(schema.indexOf('insert into public.sezioni'));
  const mancanti = ID_SEZIONI.filter(id => !new RegExp(`\\('${id}'`).test(blocco.slice(0, 600)));
  uguale(mancanti, [], 'sezioni che il codice conosce e schema.sql no');
});

prova('le policy delle tabelle nuove esistono anche in schema.sql', () => {
  // Stessa storia delle tabelle, un gradino più giù: una tabella copiata
  // in schema.sql senza le sue policy nascerebbe con RLS attiva e nessun
  // permesso, cioè invisibile a tutti — un modo peggiore di sbagliare,
  // perché sembra un problema di permessi e non una dimenticanza.
  const mancanti = [];
  for (const f of patch) {
    const sql = fs.readFileSync(path.join(CARTELLA, f), 'utf8');
    for (const t of tabelleCreate(sql)) {
      if (!new RegExp(`create table if not exists public\\.${t}\\b`).test(schema)) continue;  // già segnalata sopra
      const policyDellaPatch = [...sql.matchAll(new RegExp(`create policy ([a-z_0-9]+)\\s+on public\\.${t}\\b`, 'g'))].map(m => m[1]);
      for (const p of policyDellaPatch) {
        // la patch più recente può averla sostituita con un altro nome:
        // basta che in schema.sql la tabella abbia almeno una policy
        const nePatch = new RegExp(`create policy ${p}\\s+on public\\.${t}\\b`).test(schema);
        const neHaQualcuna = new RegExp(`create policy [a-z_0-9]+\\s+on public\\.${t}\\b`).test(schema);
        if (!nePatch && !neHaQualcuna) mancanti.push(`${t}: nessuna policy (la patch ne ha ${policyDellaPatch.length})`);
      }
    }
  }
  uguale([...new Set(mancanti)], [], 'tabelle in schema.sql rimaste senza policy');
});
