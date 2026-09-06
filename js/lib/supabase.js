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
  return _client;
}

// Token della sessione corrente, da allegare come Authorization alle
// function del Worker (/api/…).
export async function getAccessToken() {
  const sb = await getSupabase();
  const { data } = await sb.auth.getSession();
  return data.session?.access_token || null;
}
