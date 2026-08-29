# Scadenziario Fatture — CRI Genova

Gestionale online per lo scadenziario delle fatture fornitori: inserimento manuale o automatico (PDF via AI Gemini, XML fattura elettronica letto direttamente), pagamenti/acconti, alert scadenze, ricerca e filtri, export Excel/PDF, registro modifiche per gli admin.

## 1. Crea il progetto Supabase

1. Vai su [supabase.com](https://supabase.com) → New project (regione **EU**, es. Frankfurt).
2. Apri **SQL Editor** → New query → copia tutto il contenuto di [`supabase/schema.sql`](supabase/schema.sql) → Run.
3. Vai su **Authentication → Sign In / Providers** e imposta **"Allow new users to sign up" = OFF**: senza questa modifica chiunque conosca l'indirizzo del sito può crearsi un account.
4. Vai su **Authentication → Users** → Add user, per creare il tuo account e quello dei colleghi che useranno il gestionale.
5. Assegna i ruoli, in SQL Editor:
   ```sql
   update public.profili set ruolo='admin'     where email='tua@email.it';
   update public.profili set ruolo='operatore' where email='collega@cri.it';
   ```
   Ogni profilo nasce con ruolo `in_attesa`, che **non vede alcun dato**, finché un admin non lo abilita: è la rete di sicurezza nel caso in cui le iscrizioni pubbliche restino aperte. Gli `operatore` possono inserire/modificare/eliminare fatture ma non vedono il registro modifiche; gli `admin` vedono tutto.
6. Vai su **Project Settings → API**: copia **Project URL** e **anon public key**.

> Se il database è stato creato prima del 29/08/2026, esegui anche [`supabase/patch-2026-08-29.sql`](supabase/patch-2026-08-29.sql) e poi [`supabase/patch-2026-08-29-rimozione-storage.sql`](supabase/patch-2026-08-29-rimozione-storage.sql) nell'SQL Editor: contengono le correzioni allo schema e la rimozione del bucket storage per i file allegati (l'app non li conserva più). Su un database nuovo non serve: `schema.sql` le include già.

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

## 5. Deploy su Cloudflare (Workers con Git integration)

Il progetto Cloudflare collegato a questo repo è di tipo **Worker** (il nuovo flusso unificato "Workers & Pages": build command `npx wrangler deploy`), non la vecchia Pages classica. Per questo motivo il repo contiene già:
- [`wrangler.jsonc`](wrangler.jsonc): configurazione del deploy (nome, asset statici, entry point)
- [`worker.js`](worker.js): instrada `/api/estrai-fattura` alla function in `functions/api/`, il resto (index.html, css/, js/) viene servito come asset statico
- [`.assetsignore`](.assetsignore): esclude dagli asset statici i file che non fanno parte del sito (node_modules, supabase/, ecc. — senza questo file il deploy falliva per un asset da 146MB)

Passaggi:
1. Push su GitHub (già fatto): `git push`.
2. Nel progetto Cloudflare (Workers & Pages) → **Settings → Variables and Secrets**, aggiungi:
   - `GEMINI_API_KEY` = la tua chiave Gemini (come **Secret**, non testo in chiaro)
   - (opzionale, se preferisci non hardcodarle nel codice) `SUPABASE_URL` e `SUPABASE_ANON_KEY`
3. Da qui in avanti, **ogni `git push` sul branch collegato aggiorna automaticamente il sito** — nessun altro passaggio richiesto.

## Struttura del progetto

```
index.html              pagina unica (SPA)
css/styles.css           stile
js/app.js                router e shell dell'applicazione
js/config.js              configurazione (URL/chiavi Supabase)
js/data/store.js          layer dati: auth, fatture, pagamenti, log
js/lib/                   helper: UI, client Supabase, parser XML, export
js/views/                 dashboard, editor fattura, registro modifiche
functions/api/            logica dell'endpoint: proxy verso Gemini
functions/_lib/auth.js     verifica sessione Supabase lato server
supabase/schema.sql       schema database + RLS + trigger di audit log
supabase/patch-...sql     correzioni da applicare a un database già esistente
worker.js                 entry point del Worker: instrada /api/* e serve gli asset statici
wrangler.jsonc            configurazione del deploy Cloudflare
.assetsignore             file esclusi dagli asset statici (node_modules, ecc.)
```

## Note sul funzionamento

- **Lettura automatica**: XML di fattura elettronica → letto localmente nel browser, gratuito e sempre accurato sui campi presenti nel tracciato. Sono accettati anche i file firmati `.xml.p7m` scaricati dal cassetto fiscale: l'XML viene estratto dalla busta di firma direttamente nel browser (la firma non viene verificata — il documento probante resta quello conservato a norma). PDF/immagini → inviati a Gemini (AI) tramite la function serverless, che tiene la chiave al sicuro lato server.
- **Duplicati**: al salvataggio l'app avvisa se esiste già una fattura con lo stesso numero dello stesso fornitore, e chiede conferma. Non è un blocco: reinserire volutamente un documento resta possibile.
- **Pagamenti/acconti**: ogni fattura può avere più pagamenti parziali; lo stato (da pagare / pagata parzialmente / pagata) si aggiorna automaticamente in base al totale pagato.
- **Registro modifiche**: ogni creazione, modifica, cancellazione di una fattura (e ogni pagamento aggiunto/rimosso) viene registrata automaticamente da un trigger del database — non è disattivabile dall'app, visibile in sola lettura solo agli admin.
- **Niente collegamento diretto al cassetto fiscale**: richiederebbe login SPID/CIE (non automatizzabile) o un accreditamento come intermediario SdI presso l'Agenzia delle Entrate (procedura complessa, sproporzionata per questo progetto). Il flusso previsto è: scarichi tu il PDF o l'XML dal cassetto fiscale, poi lo carichi qui.
