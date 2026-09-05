# Amministrazione CRI — Genova

Portale gestionale della CRI di Genova. Dopo il login si sceglie una **sezione** dalla home; ogni sezione è un gestionale a sé, con i suoi dati e i suoi permessi, e si entra solo dove si è autorizzati:

| Sezione | Stato |
|---|---|
| **Scadenziario** | attiva (è il contenuto storico di questo progetto, descritto qui sotto) |
| **Formazione Esterna** | da sviluppare |
| **Trasporti lunghi** | attiva: preventivi per i trasporti sanitari fuori Genova (arrivata dal gestionale `preventivo-trasporti`, assorbita qui il 01/09/2026) |
| **Assistenze sanitarie** | attiva: generatore di preventivi per le assistenze a eventi, con uscita in PDF e Word sulla carta intestata |

I permessi hanno due livelli: il **ruolo di portale** (`super_admin`, che gestisce utenti e autorizzazioni di tutti, oppure `utente`) e il **ruolo di sezione** (`admin` o `operatore`, uno per ogni sezione a cui si è abilitati). Vedi "Gestire gli utenti dall'app".

## Sezione Scadenziario

Inserimento manuale o automatico delle fatture (PDF via AI Gemini, XML fattura elettronica letto direttamente), pagamenti/acconti, alert scadenze, ricerca e filtri, export Excel/PDF, registro modifiche per gli admin.

Si divide a sua volta in due parti indipendenti, selezionabili come due schede dalla barra laterale:
- **Fatture Passive**: fatture ricevute dai fornitori (quando *noi* paghiamo).
- **Fatture Attive**: fatture emesse ai clienti (quando *veniamo pagati*) — stesse funzionalità delle passive (inserimento manuale o da PDF/XML, incassi/acconti, note di credito, export, registro modifiche), più un campo per segnare la data dell'ultimo sollecito di pagamento inviato al cliente.

Le due sezioni hanno tabelle, dati e permessi separati: nulla di quanto inserito in una compare nell'altra.

## Sezione Trasporti lunghi

Preventivi per i trasporti sanitari fuori Genova: si indica il mezzo, si scrivono le tappe (indirizzi cercati con OpenRouteService, che calcola anche i km del percorso reale) e l'app somma carburante, pedaggi esteri, pasti, pernottamenti e personale sanitario, confrontando la spesa viva con l'addebito al cliente. La stampa produce il preventivo da consegnare.

I prezzi del carburante si aggiornano da soli: la media italiana dai dati del MISE ad ogni apertura della sezione, quelli europei su richiesta dal bollettino settimanale della Commissione (pulsante in Impostazioni). Le impostazioni della sezione (parco mezzi, tariffe, prezzi) le modifica chiunque vi abbia accesso, operatori compresi, come nel gestionale da cui arriva.

Serve il secret `ORS_KEY` sul Worker (vedi il punto 5): senza, ricerca indirizzi e calcolo km rispondono con un errore chiaro e i km restano da inserire a mano.

## Sezione Assistenze sanitarie

Generatore di preventivi per le assistenze a manifestazioni ed eventi. Si compila il destinatario, si scelgono le voci del servizio e si inserisce il **calendario dell'assistenza**: una riga per turno, con data, orari e quante ambulanze, medici o altre voci servono in quel turno. Il totale esce da lì (ore × tariffa × quantità) e il calendario viene riportato nel documento consegnato al cliente.

Il **tariffario** si configura in Impostazioni: ogni voce è *a ore* (€/ora, moltiplicata per la durata del turno) oppure *a prezzo fisso* (€ per turno, per cose come il gazebo che non si pagano a tempo). Dentro il singolo preventivo i prezzi restano modificabili, e la modifica vale solo per quel preventivo: un preventivo già inviato continua a mostrare i prezzi con cui è stato fatto anche se il tariffario cambia. Sempre in Impostazioni stanno i testi fissi del documento (premessa, riferimenti bancari, clausole sui mezzi e sul trattamento dei dati, saluti) e la firma.

Nell'elenco si vede la data dell'assistenza (non quella del documento), si filtra per stato, si cambia stato con un clic e si **duplica** un preventivo esistente: le assistenze si ripetono, e ricopiare venti campi a mano non ha senso. Nell'editor il calendario si compila anche per **intervallo di date** (un turno per giornata, con gli stessi orari), le giornate si riordinano da sole, gli orari si scelgono su un **quadrante** — prima l'ora, poi i minuti a passi di dieci — e uscendo con modifiche non salvate l'app avvisa. Il pulsante **Anteprima** mostra il documento senza far partire la stampa.

I clienti si tengono in una **rubrica** (voce `Rubrica clienti` nel menu della sezione): una scheda per ente con codice fiscale, indirizzo, referente e note. Si riempie mentre si lavora — nell'editor del preventivo, `Salva in rubrica` apre la scheda già compilata con quello che hai scritto — e si riusa con `Scegli dalla rubrica`, che compila il destinatario in un colpo solo. I dati restano **copiati dentro il preventivo**, come i prezzi delle voci: correggere una scheda non cambia i documenti già mandati. Richiede `supabase/patch-2026-09-03-assistenze-rubrica.sql`.

Si possono applicare due **sconti**, anche insieme: uno in percentuale sul totale e uno in valore assoluto, che si toglie da quanto resta dopo la percentuale. Nel documento compaiono il totale pieno, una riga per ogni sconto applicato e il totale da corrispondere; la somma degli sconti non supera mai l'importo del servizio. Quello che viene salvato come totale del preventivo è sempre il netto, cioè quanto il cliente paga davvero.

Il preventivo esce in due formati, con lo stesso contenuto:
- **PDF**, tramite la stampa del browser, con la carta intestata ricostruita in HTML;
- **Word (.docx)**, generato a partire da [`assets/carta-intestata.dotx`](assets/carta-intestata.dotx) — il modello ufficiale del Comitato: il file resta quello, cambia solo il corpo, quindi il risultato è modificabile in Word come un documento scritto a mano.

Sostituendo quel .dotx cambiano insieme sia il Word sia il PDF: logo, indirizzo e dati del piè di pagina vengono letti da lì, non copiati nel codice. Tutto il documento usa un solo carattere, **Arial**, che è quello della carta intestata.

## 1. Crea il progetto Supabase

1. Vai su [supabase.com](https://supabase.com) → New project (regione **EU**, es. Frankfurt).
2. Apri **SQL Editor** → New query → copia tutto il contenuto di [`supabase/schema.sql`](supabase/schema.sql) → Run.
3. Vai su **Authentication → Sign In / Providers** e imposta **"Allow new users to sign up" = OFF**: senza questa modifica chiunque conosca l'indirizzo del sito può crearsi un account.
4. Crea il tuo account: **Authentication → Users → Add user**. I colleghi successivi puoi crearli direttamente dall'app (vedi sotto "Gestire gli utenti dall'app"), oppure allo stesso modo da qui.
5. Promuoviti a super admin del portale, in SQL Editor:
   ```sql
   update public.profili set ruolo='super_admin' where email='tua@email.it';
   ```
   Questo è l'unico passaggio da fare in SQL: da qui in avanti utenti e permessi si gestiscono dall'app, in **Utenti e autorizzazioni**. Ogni profilo nasce con ruolo `in_attesa`, che **non entra in nessuna sezione** (e non può nemmeno usare la lettura AI), finché non lo si abilita: è la rete di sicurezza nel caso in cui le iscrizioni pubbliche restino aperte. Dentro una sezione, l'`operatore` inserisce/modifica/elimina i dati mentre l'`admin` vede anche impostazioni e registro modifiche di quella sezione; il `super_admin` è admin ovunque.
6. Vai su **Project Settings → API**: copia **Project URL**, **anon public key** e **service_role key** (quest'ultima serve solo per la creazione utenti dall'app, punto 3 sotto — è una chiave molto potente, mai da esporre lato client).

> Se il database è stato creato prima del 01/09/2026, esegui anche i patch in `supabase/patch-*.sql` nell'ordine della data nel nome del file. Su un database nuovo non serve: `schema.sql` li include già tutti.
>
> **L'ultimo è [`patch-2026-09-01-portale.sql`](supabase/patch-2026-09-01-portale.sql)** ed è obbligatorio su un database già in uso: trasforma lo scadenziario nel portale multi-sezione. Crea le tabelle `sezioni` e `autorizzazioni`, sposta lì i ruoli che stavano in `profili.ruolo` (chi era admin/operatore resta admin/operatore **dello scadenziario** e di nient'altro) e nomina il super admin — nel file c'è un `update` con l'email da controllare prima di eseguirlo.
>
> **Per la sezione assistenze sanitarie** servono [`patch-2026-09-02-assistenze.sql`](supabase/patch-2026-09-02-assistenze.sql) (crea `preventivi_assistenze` e `impostazioni_assistenze`) e [`patch-2026-09-02-assistenze-sconto.sql`](supabase/patch-2026-09-02-assistenze-sconto.sql) (le colonne degli sconti).
>
> **Per la sezione trasporti** servono in più [`patch-2026-09-01-trasporti.sql`](supabase/patch-2026-09-01-trasporti.sql) (crea `preventivi` e `impostazioni_trasferte`) e, per portarsi dietro i dati del vecchio gestionale, [`export-trasporti.sql`](supabase/export-trasporti.sql) — che però va lanciato sul **vecchio** progetto Supabase: stampa gli insert già pronti da incollare qui.
>
> **[`patch-2026-09-04-permessi-profili.sql`](supabase/patch-2026-09-04-permessi-profili.sql)** chiude due falle nei permessi sulla tabella `profili` e va eseguito su qualunque database già in uso: l'obbligo di cambiare la password provvisoria era aggirabile dal client (adesso il flag lo spegne un trigger che guarda la password vera), e un super admin poteva nominarne un altro nonostante quanto scritto qui sotto. Il sito funziona anche senza — l'app ha una rete di sicurezza per non chiedere la password ad ogni accesso su un database non aggiornato — ma finché non lo esegui quelle due strade restano aperte.

## 2. Ottieni una chiave Gemini gratuita (per la lettura AI dei PDF)

1. Vai su [aistudio.google.com/apikey](https://aistudio.google.com/apikey) e crea una chiave API gratuita.
2. Il livello gratuito ha un limite di richieste giornaliere: più che sufficiente per l'uso previsto (poche fatture al giorno). Se un giorno superi la quota, l'app te lo segnala e puoi comunque inserire la fattura a mano o caricare l'XML (che non consuma quota, non usa l'AI).

## 3. Configura il progetto

- In [`js/config.js`](js/config.js): sostituisci `url` e `anonKey` con quelli del tuo progetto Supabase (punto 1.6).
- In [`functions/_lib/auth.js`](functions/_lib/auth.js): sostituisci `SUPABASE_URL` e `SUPABASE_ANON_KEY` con gli stessi valori (servono lato server per verificare che chi chiama l'AI/la creazione utenti sia loggato).
- La **service_role key** (punto 1.6) non va scritta nel codice: si configura solo come secret su Cloudflare (punto 5) e, per uso locale, in `.dev.vars`. Serve all'endpoint `/api/crea-utente` per creare account con l'Admin API di Supabase.

## 4. Prova in locale

```bash
npm run dev
```

Apri `http://localhost:4323`. Per testare anche la lettura AI dei PDF e la creazione utenti in locale, crea un file `.dev.vars` (non versionato) con:

```
GEMINI_API_KEY=la-tua-chiave
SUPABASE_SERVICE_ROLE_KEY=la-tua-service-role-key
ORS_KEY=la-tua-chiave-openrouteservice
```

Senza queste chiavi il resto dell'app funziona lo stesso: manca solo la funzione che dipende dalla chiave assente (lettura AI, creazione utenti, ricerca indirizzi e km dei preventivi).

## 5. Deploy su Cloudflare (Workers con Git integration)

Il progetto Cloudflare collegato a questo repo è di tipo **Worker** (il nuovo flusso unificato "Workers & Pages": build command `npx wrangler deploy`), non la vecchia Pages classica. Per questo motivo il repo contiene già:
- [`wrangler.jsonc`](wrangler.jsonc): configurazione del deploy (nome, asset statici, entry point)
- [`worker.js`](worker.js): instrada le `/api/*` (lettura AI delle fatture, creazione utenti, geocoding/percorsi e prezzi carburante dei preventivi) alle function in `functions/api/`, il resto (index.html, css/, js/) viene servito come asset statico
- [`.assetsignore`](.assetsignore): esclude dagli asset statici i file che non fanno parte del sito (node_modules, supabase/, ecc. — senza questo file il deploy falliva per un asset da 146MB)

Passaggi:
1. Push su GitHub (già fatto): `git push`.
2. Nel progetto Cloudflare (Workers & Pages) → **Settings → Variables and Secrets**, aggiungi come **Secret** (non testo in chiaro):
   - `GEMINI_API_KEY` = la tua chiave Gemini
   - `SUPABASE_SERVICE_ROLE_KEY` = la service_role key di Supabase (punto 1.6) — senza, la creazione utenti dall'app risponde con un errore chiaro invece di funzionare a metà
   - `ORS_KEY` = la chiave OpenRouteService usata dalla sezione trasporti per cercare gli indirizzi e calcolare i km (è la stessa che aveva il progetto preventivo-trasporti)
   - (opzionale, se preferisci non hardcodarle nel codice) `SUPABASE_URL` e `SUPABASE_ANON_KEY`
3. Da qui in avanti, **ogni `git push` sul branch collegato aggiorna automaticamente il sito** — nessun altro passaggio richiesto.

## Gestire gli utenti dall'app

Tutto avviene in **Utenti e autorizzazioni** (voce in fondo alla barra laterale, visibile solo al super admin).

Da **Aggiungi un utente** si crea l'account con email, nome opzionale e già le sezioni che gli competono: l'app genera una password provvisoria mostrata una sola volta, da comunicare tu stesso al collega (telefono, di persona — non viene inviata via email). Al primo accesso l'app lo obbliga a impostarne una propria prima di poter entrare.

Sotto c'è la tabella di tutti gli account: una riga per utente, una colonna per sezione, e in ogni casella una tendina con **Nessuno / Operatore / Admin**. Assegnare la prima sezione a un utente `in_attesa` lo attiva automaticamente. Il pulsante **Sospendi** blocca del tutto un accesso senza cancellarne i permessi, così riattivarlo non costringe a riassegnarli uno per uno. Due cose non si possono fare dall'app, di proposito: sospendere se stessi e creare un altro super admin (quel ruolo si assegna solo dal database, altrimenti chi gestisce gli utenti potrebbe auto-promuoversi).

Le **impostazioni di sezione** sono un'altra cosa: per lo scadenziario stanno in *Impostazioni scadenziario* (scadenza di default e registro modifiche) e le vede l'admin di quella sezione, non il super admin in quanto tale.

## Struttura del progetto

```
index.html                   pagina unica (SPA)
css/styles.css                stile
js/app.js                     router e shell del portale (home, sezioni, permessi)
js/sezioni.js                  elenco delle sezioni (icone, colori, rotte) e regole di accesso
js/config.js                   configurazione (URL/chiavi Supabase)
js/views/home.js                home del portale: la griglia da cui si sceglie la sezione
js/assistenze/                 sezione Assistenze sanitarie: preventivi per eventi
js/assistenze/calc.js           tariffario, calcolo dei turni e importo in lettere
js/assistenze/views/rubrica.js  rubrica clienti: elenco e scheda del singolo cliente
js/assistenze/views/sceltaCliente.js  riquadro per scegliere un cliente dalla rubrica
js/assistenze/lib/documento.js  il preventivo come blocchi, da cui derivano PDF e Word
js/assistenze/lib/carta.js      legge la carta intestata .dotx (immagini e testi)
js/assistenze/lib/docx.js       genera il .docx sostituendo il corpo del modello
js/lib/zip.js                   zip minimale (scrittura e lettura): serve a .xlsx e .docx
assets/carta-intestata.dotx    modello Word ufficiale del Comitato
js/trasporti/                  sezione Trasporti lunghi: preventivi trasporti sanitari
js/trasporti/calc.js            il calcolo del preventivo (spesa reale, addebito, margine)
js/trasporti/sezione.js         ingresso della sezione: carica impostazioni e smista alle viste
js/views/portaleUtenti.js       utenti e autorizzazioni di sezione (solo super admin)
js/views/sezioneVuota.js        segnaposto delle sezioni non ancora sviluppate / esterne
js/data/store.js               layer dati fatture PASSIVE: auth, fatture, pagamenti, log
js/data/storeAttive.js          layer dati fatture ATTIVE: fatture, incassi, log (tabelle indipendenti)
js/lib/                        helper: UI, client Supabase, parser XML (passive+attive), export
js/lib/documenti.js             helper condivisi fra i due editor (anteprima file, autocompletamento, id)
js/views/dashboard.js           dashboard fatture passive
js/views/fattura.js             editor fattura passiva
js/views/proposte.js            proposte di pagamento (operatore -> admin), solo passive
js/views/report.js              report/statistiche fatture passive (per fornitore + andamento mensile)
js/views/dashboardAttive.js     dashboard fatture attive
js/views/fatturaAttiva.js       editor fattura attiva (incl. sollecito di pagamento)
js/views/reportAttive.js        report/statistiche fatture attive (per cliente + andamento mensile)
js/views/registroModifiche.js   registro modifiche unificato (passive+attive), dentro Impostazioni
js/views/impostazioni.js        impostazioni dello scadenziario e registro modifiche (admin di sezione)
manifest.json                  manifest PWA (nome, icone, tema) — abilita "Aggiungi a schermata Home"
sw.js                          service worker: cache di riserva se la rete cade, sempre network-first
icons/                          icone PWA (192px, 512px)
functions/api/                 endpoint: proxy verso Gemini (passive+attive), creazione utenti
functions/_lib/auth.js          verifica sessione/ruolo Supabase lato server
functions/_lib/gemini.mjs       nome del modello Gemini (condiviso con server.js)
supabase/schema.sql            schema database + RLS + trigger di audit log (passive+attive)
supabase/patch-...sql          correzioni da applicare a un database già esistente
worker.js                      entry point del Worker: instrada /api/* e serve gli asset statici
wrangler.jsonc                 configurazione del deploy Cloudflare
.assetsignore                  file esclusi dagli asset statici (node_modules, ecc.)
```

## Note sul funzionamento

- **Lettura automatica**: XML di fattura elettronica → letto localmente nel browser, gratuito e sempre accurato sui campi presenti nel tracciato. Sono accettati anche i file firmati `.xml.p7m` scaricati dal cassetto fiscale: l'XML viene estratto dalla busta di firma direttamente nel browser (la firma non viene verificata — il documento probante resta quello conservato a norma). PDF/immagini → inviati a Gemini (AI) tramite la function serverless, che tiene la chiave al sicuro lato server.
- **Duplicati**: al salvataggio l'app avvisa se esiste già una fattura con lo stesso numero dello stesso fornitore, e chiede conferma. Non è un blocco: reinserire volutamente un documento resta possibile.
- **Fornitore/cliente**: sono campi di testo libero (non c'è un'anagrafica), ma il campo suggerisce mentre si scrive i nomi già usati in archivio. Serve a non ritrovarsi "Enel SpA" ed "ENEL S.p.A." come due soggetti distinti nel Report, con il totale di quel fornitore spezzato in due. Il campo resta libero: un fornitore nuovo si scrive normalmente.
- **Ricerca, filtri ed export**: la tabella principale mostra le fatture dell'anno corrente più quelle ancora aperte di anni precedenti; le fatture chiuse più vecchie stanno nell'archivio in fondo alla pagina. Appena si cerca o si filtra qualcosa, però, **l'archivio viene incluso**: il pannello si popola coi risultati e il titolo dice quanti ne rientrano. Anche **Esporta Excel/PDF esportano sempre tutto ciò che rispetta i filtri**, archivio compreso.
- **Pagamenti/acconti**: ogni fattura può avere più pagamenti parziali; lo stato (da pagare / pagata parzialmente / pagata) si aggiorna automaticamente in base al totale pagato.
- **Fatture attive**: stesse funzionalità delle passive, tabelle e permessi indipendenti (vedi sopra). Unica differenza voluta: gli **incassi** li registra direttamente anche l'operatore (non solo l'admin come per i pagamenti delle passive), perché qui non esiste un flusso di "proposte" — chiunque può segnare che una fattura è stata incassata. Il campo **sollecito** (data dell'ultimo sollecito di pagamento inviato al cliente) è puramente informativo: si aggiorna a mano dall'editor o con un click rapido dalla tabella, non invia nulla automaticamente. Le fatture attive non hanno una data di scadenza propria: il filtro temporale della dashboard e l'avviso "emesse da troppo tempo e non incassate" lavorano quindi sulla **data di emissione**, con la stessa soglia in giorni configurata in Impostazioni.
- **Registro modifiche**: ogni creazione, modifica, cancellazione di una fattura (e ogni pagamento aggiunto/rimosso) viene registrata automaticamente da un trigger del database — non è disattivabile dall'app, visibile in sola lettura solo agli admin.
- **Niente collegamento diretto al cassetto fiscale**: richiederebbe login SPID/CIE (non automatizzabile) o un accreditamento come intermediario SdI presso l'Agenzia delle Entrate (procedura complessa, sproporzionata per questo progetto). Il flusso previsto è: scarichi tu il PDF o l'XML dal cassetto fiscale, poi lo carichi qui.
