# Scadenziario Fatture — CRI Genova

Gestionale online per lo scadenziario delle fatture fornitori: inserimento manuale o automatico (PDF via AI Gemini, XML fattura elettronica letto direttamente), pagamenti/acconti, alert scadenze, ricerca e filtri, export Excel/PDF, registro modifiche per gli admin.

## 1. Crea il progetto Supabase

1. Vai su [supabase.com](https://supabase.com) → New project (regione **EU**, es. Frankfurt).
2. Apri **SQL Editor** → New query → copia tutto il contenuto di [`supabase/schema.sql`](supabase/schema.sql) → Run.
3. Vai su **Storage**: verifica che sia stato creato il bucket privato `fatture-pdf` (creato dallo script).
4. Vai su **Authentication → Users** → Add user, per creare il tuo account e quello dei colleghi che useranno il gestionale.
5. Promuovi il tuo utente ad amministratore, in SQL Editor:
   ```sql
   update public.profili set ruolo='admin' where email='tua@email.it';
   ```
   Gli altri utenti restano `operatore` di default (possono inserire/modificare/eliminare fatture, ma non vedono il registro modifiche).
6. Vai su **Project Settings → API**: copia **Project URL** e **anon public key**.

## 2. Ottieni una chiave Gemini gratuita (per la lettura AI dei PDF)

1. Vai su [aistudio.google.com/apikey](https://aistudio.google.com/apikey) e crea una chiave API gratuita.
2. Il livello gratuito ha un limite di richieste giornaliere: più che sufficiente per l'uso previsto (poche fatture al giorno). Se un giorno superi la quota, l'app te lo segnala e puoi comunque inserire la fattura a mano o caricare l'XML (che non consuma quota, non usa l'AI).

## 3. Configura il progetto

- In [`js/config.js`](js/config.js): sostituisci `url` e `anonKey` con quelli del tuo progetto Supabase (punto 1.6).
- In [`functions/_lib/auth.js`](functions/_lib/auth.js): sostituisci `SUPABASE_URL` e `SUPABASE_ANON_KEY` con gli stessi valori (servono lato server per verificare che chi chiama l'AI sia loggato).

## 4. Prova in locale

```bash
npm run dev
```

Apri `http://localhost:4323`. Per testare anche la lettura AI dei PDF in locale, prima di lanciare il comando imposta la chiave Gemini:

```bash
# Windows PowerShell
$env:GEMINI_API_KEY="la-tua-chiave"; npm run dev
# macOS/Linux
GEMINI_API_KEY=la-tua-chiave npm run dev
```

(oppure crea un file `.dev.vars` con dentro `GEMINI_API_KEY=la-tua-chiave`, non versionato).

## 5. Deploy su Cloudflare Pages

1. Crea un repository git per questa cartella e fai push su GitHub.
2. Su [Cloudflare Pages](https://pages.cloudflare.com): collega il repository. Build command: vuoto. Output directory: `/` (root).
3. In **Settings → Environment variables** del progetto Pages, aggiungi:
   - `GEMINI_API_KEY` = la tua chiave Gemini
   - (opzionale, se preferisci non hardcodarle nel codice) `SUPABASE_URL` e `SUPABASE_ANON_KEY`
4. Da qui in avanti, **ogni `git push` sul branch collegato aggiorna automaticamente il sito** — nessun altro passaggio richiesto.

## Struttura del progetto

```
index.html              pagina unica (SPA)
css/styles.css           stile
js/app.js                router e shell dell'applicazione
js/config.js              configurazione (URL/chiavi Supabase)
js/data/store.js          layer dati: auth, fatture, pagamenti, log
js/lib/                   helper: UI, client Supabase, parser XML, export
js/views/                 dashboard, editor fattura, registro modifiche
functions/api/            Cloudflare Pages Function: proxy verso Gemini
functions/_lib/auth.js     verifica sessione Supabase lato server
supabase/schema.sql       schema database + RLS + trigger di audit log
```

## Note sul funzionamento

- **Lettura automatica**: XML di fattura elettronica → letto localmente nel browser, gratuito e sempre accurato sui campi presenti nel tracciato. PDF/immagini → inviati a Gemini (AI) tramite la function serverless, che tiene la chiave al sicuro lato server.
- **Pagamenti/acconti**: ogni fattura può avere più pagamenti parziali; lo stato (da pagare / pagata parzialmente / pagata) si aggiorna automaticamente in base al totale pagato.
- **Registro modifiche**: ogni creazione, modifica, cancellazione di una fattura (e ogni pagamento aggiunto/rimosso) viene registrata automaticamente da un trigger del database — non è disattivabile dall'app, visibile in sola lettura solo agli admin.
- **Niente collegamento diretto al cassetto fiscale**: richiederebbe login SPID/CIE (non automatizzabile) o un accreditamento come intermediario SdI presso l'Agenzia delle Entrate (procedura complessa, sproporzionata per questo progetto). Il flusso previsto è: scarichi tu il PDF o l'XML dal cassetto fiscale, poi lo carichi qui.
