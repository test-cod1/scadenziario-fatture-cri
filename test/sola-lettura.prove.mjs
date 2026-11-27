// ============================================================
//  Sola visualizzazione (ruolo di sezione 'lettore').
//
//  Il lettore non scrive grazie a tre policy RESTRICTIVE per ogni tabella
//  di sezione, create da un elenco scritto a mano nella patch (e copiato in
//  schema.sql); lo stesso elenco sta in js/lib/supabase.js, che ferma le
//  scritture prima che partano. Il rischio è quello di sempre: una sezione
//  nuova aggiunge una tabella, ne scrive le policy, e dimentica l'elenco —
//  il lettore di quella sezione potrebbe scriverci. Queste prove lo dicono.
// ============================================================
import { gruppo, prova, uguale, vero, RADICE } from './aiuto.mjs';
import fs from 'node:fs';
import path from 'node:path';

const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');
const patch = leggi('supabase/patch-2026-11-27-sola-lettura.sql');
const schema = leggi('supabase/schema.sql');
const client = leggi('js/lib/supabase.js');

// Le coppie (tabella, sezione) del blocco «values» della patch.
function elencoSql(sql) {
  const blocco = sql.slice(sql.indexOf('select * from (values'), sql.indexOf(') as t(tabella, sezione)'));
  return [...blocco.matchAll(/\('([a-z_0-9]+)',\s*(?:'([a-z]+)'|null)\)/g)]
    .map(m => [m[1], m[2] || null]).sort((a, b) => a[0].localeCompare(b[0]));
}

// Le stesse coppie lette da TABELLE_SEZIONE e TABELLE_CONDIVISE del client.
function elencoClient(js) {
  const coppie = [];
  const blocco = js.slice(js.indexOf('const TABELLE_SEZIONE = {'), js.indexOf('function sezioneSolaLettura'));
  for (const m of blocco.matchAll(/([a-z]+): \[([^\]]*)\]/g)) {
    for (const t of m[2].matchAll(/'([a-z_0-9]+)'/g)) coppie.push([t[1], m[1]]);
  }
  const condivise = blocco.slice(blocco.indexOf('TABELLE_CONDIVISE'));
  for (const t of condivise.matchAll(/'([a-z_0-9]+)'/g)) coppie.push([t[1], null]);
  return coppie.sort((a, b) => a[0].localeCompare(b[0]));
}

gruppo('Sola visualizzazione');

prova('schema.sql protegge le stesse tabelle della patch', () => {
  uguale(elencoSql(schema), elencoSql(patch), 'elenco delle tabelle di sezione');
});

prova('il client blocca le stesse tabelle del database', () => {
  uguale(elencoClient(client), elencoSql(patch), 'TABELLE_SEZIONE di js/lib/supabase.js');
});

prova('ogni tabella con policy di scrittura di sezione è nell’elenco', () => {
  const protette = new Set(elencoSql(schema).map(([t]) => t));
  const scrivibili = new Set();
  // Le policy di scrittura (insert/update/delete/all) che dipendono da un
  // ruolo di sezione: accede_a, e_admin_sezione, puo_scrivere, e_admin.
  for (const m of schema.matchAll(/create policy \w+ on public\.([a-z_0-9]+)\s+(?:as \w+\s+)?for (insert|update|delete|all)([^;]*);/g)) {
    if (/accede_a|e_admin_sezione|puo_scrivere|e_admin\(\)/.test(m[3])) scrivibili.add(m[1]);
  }
  const mancanti = [...scrivibili].filter(t => !protette.has(t)).sort();
  uguale(mancanti, [], 'tabelle scrivibili da una sezione ma senza rete per il lettore');
});

prova('il ruolo lettore è ammesso dal vincolo e dalla creazione utenti', () => {
  vero(/check \(ruolo in \('lettore','operatore','admin'\)\)/.test(schema), 'vincolo su autorizzazioni.ruolo in schema.sql');
  vero(/'lettore', 'operatore', 'admin'/.test(leggi('functions/api/crea-utente.js')), 'crea-utente.js accetta lettore');
  vero(/lettore: 'Sola visualizzazione'/.test(leggi('js/views/portaleUtenti.js')), 'la tendina dei permessi offre la sola visualizzazione');
});

prova('puo_scrivere() esclude il lettore', () => {
  const corpo = schema.slice(schema.indexOf('create or replace function public.puo_scrivere()'));
  vero(/puo_modificare\('scadenziario'\)/.test(corpo.slice(0, 300)), 'puo_scrivere passa da puo_modificare');
});
