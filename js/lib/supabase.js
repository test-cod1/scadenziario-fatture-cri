// ============================================================
//  Caricatore del client Supabase.
//
//  La libreria sta NEL PROGETTO, in js/vendor/, e non su una CDN. Prima
//  arrivava da esm.sh a ogni avvio: significava che il portale — login e dati
//  compresi — non si apriva se quel sito era irraggiungibile, e che chi
//  avesse controllato quel dominio avrebbe potuto far eseguire codice proprio
//  dentro la pagina che maneggia le credenziali di tutti. Per un gestionale
//  che tiene le fatture del Comitato è una dipendenza che non vale la pena
//  correre: il file pesa 200 kB, si scarica una volta e resta.
//
//  Da qui discende anche la Content-Security-Policy, che ora non ha più
//  bisogno di autorizzare host esterni per gli script (js/lib/securityHeaders.mjs).
//
//  Si carica solo quando serve davvero (la prima chiamata al database) e con
//  un <script> classico, perché la build autosufficiente della libreria è
//  quella UMD: espone window.supabase e non ha dipendenze da risolvere.
//
//  PER AGGIORNARE la libreria: scaricare la nuova versione con
//    curl -sL "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@<versione>/dist/umd/supabase.js" \
//         -o js/vendor/supabase-js-<versione>.js
//  aggiornare VERSIONE qui sotto, cancellare il file vecchio e provare
//  l'accesso. La versione è nel nome del file apposta: così un aggiornamento
//  si vede nel controllo delle modifiche invece di passare inosservato.
// ============================================================
import { CONFIG } from '../config.js';

const VERSIONE = '2.112.3';
const PERCORSO = `/js/vendor/supabase-js-${VERSIONE}.js`;

let _client = null;
let _libreria = null;

function caricaLibreria() {
  if (globalThis.supabase?.createClient) return Promise.resolve(globalThis.supabase);
  if (_libreria) return _libreria;
  _libreria = new Promise((risolvi, rifiuta) => {
    const tag = document.createElement('script');
    tag.src = PERCORSO;
    tag.async = true;
    tag.addEventListener('load', () => {
      if (globalThis.supabase?.createClient) risolvi(globalThis.supabase);
      else rifiuta(new Error('Libreria Supabase caricata ma incompleta.'));
    });
    tag.addEventListener('error', () => {
      // Il caricamento fallito non deve restare "in corso" per sempre: senza
      // azzerare la promessa, un tentativo andato male impedirebbe anche a
      // quelli successivi di riprovare.
      _libreria = null;
      rifiuta(new Error(`Libreria Supabase non caricata (${PERCORSO}).`));
    });
    document.head.appendChild(tag);
  });
  return _libreria;
}

export async function getSupabase() {
  if (_client) return _client;
  const { createClient } = await caricaLibreria();
  _client = createClient(CONFIG.supabase.url, CONFIG.supabase.anonKey);
  proteggiScritture(_client);
  return _client;
}

// ------------------------------------------------------------
//  Sola visualizzazione.
//  Il router scrive in <body data-sola-lettura="…"> la sezione in cui
//  l'utente è entrato come «lettore» (js/app.js, segnaSolaLettura);
//  finché ci resta, inserire, modificare e cancellare nelle tabelle di quella
//  sezione si ferma qui, prima di partire. Il motivo non è la sicurezza (le
//  policy restrictive di patch-2026-11-27-sola-lettura.sql la fanno comunque
//  nel database) ma la chiarezza: un UPDATE negato dalle RLS non restituisce
//  un errore, aggiorna zero righe, e la pagina direbbe «Salvato».
//  L'elenco delle tabelle è lo stesso della patch.
// ------------------------------------------------------------
const TABELLE_SEZIONE = {
  scadenziario: ['fatture', 'pagamenti', 'ritenute_versamenti', 'note_credito', 'note_credito_righe',
    'proposte_pagamento', 'impostazioni', 'fatture_attive', 'incassi', 'note_credito_attive',
    'note_credito_attive_righe'],
  trasporti: ['preventivi', 'impostazioni_trasferte'],
  assistenze: ['preventivi_assistenze', 'impostazioni_assistenze', 'clienti_assistenze'],
  formazione: ['preventivi_formazione', 'clienti_formazione', 'impostazioni_formazione', 'corsi_formazione'],
  straordinari: ['dipendenti_straordinari', 'straordinari', 'impostazioni_straordinari'],
  direttore: ['impegni_direttore', 'idee_direttore'],
  analisi: ['centri_costo', 'movimenti_analisi'],
  scadenze: ['scadenze'],
  patenti: ['richieste_patenti'],
};
// dati_fatturazione è di più sezioni insieme (la sezione sta nella riga).
const TABELLE_CONDIVISE = ['dati_fatturazione'];

function sezioneSolaLettura() {
  return globalThis.document?.body?.dataset.solaLettura || null;
}

export function inSolaLettura() {
  return sezioneSolaLettura() !== null;
}

export const MESSAGGIO_SOLA_LETTURA = 'Hai accesso a questa sezione in sola visualizzazione: non puoi inserire, modificare o cancellare dati.';

function tabellaBloccata(tabella) {
  const sezione = sezioneSolaLettura();
  if (!sezione) return false;
  return TABELLE_CONDIVISE.includes(tabella) || (TABELLE_SEZIONE[sezione] || []).includes(tabella);
}

function proteggiScritture(client) {
  const from = client.from.bind(client);
  client.from = (tabella) => {
    const q = from(tabella);
    if (!tabellaBloccata(tabella)) return q;
    for (const metodo of ['insert', 'update', 'upsert', 'delete']) {
      q[metodo] = () => { throw new Error(MESSAGGIO_SOLA_LETTURA); };
    }
    return q;
  };
}

// Token della sessione corrente, da allegare come Authorization alle
// function del Worker (/api/…).
export async function getAccessToken() {
  const sb = await getSupabase();
  const { data } = await sb.auth.getSession();
  return data.session?.access_token || null;
}
