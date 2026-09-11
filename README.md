# Amministrazione CRI — Genova

Portale gestionale della CRI di Genova. Dopo il login si sceglie una **sezione** dalla home; ogni sezione è un gestionale a sé, con i suoi dati e i suoi permessi, e si entra solo dove si è autorizzati:

| Sezione | Stato |
|---|---|
| **Scadenziario** | attiva (è il contenuto storico di questo progetto, descritto qui sotto) |
| **Formazione Esterna** | attiva: preventivi per i corsi erogati ad aziende ed enti, con uscita in PDF e Word sulla carta intestata |
| **Trasporti lunghi** | attiva: preventivi per i trasporti sanitari fuori Genova (arrivata dal gestionale `preventivo-trasporti`, assorbita qui il 01/09/2026) |
| **Assistenze sanitarie** | attiva: generatore di preventivi per le assistenze a eventi, con uscita in PDF e Word sulla carta intestata |
| **Straordinari** | attiva: registro delle ore in più richieste ai dipendenti dalla centrale operativa |
| **Direttore** | attiva: gli impegni della direzione, ordinati per urgenza, importanza e scadenza |

I permessi hanno due livelli: il **ruolo di portale** (`super_admin`, che gestisce utenti e autorizzazioni di tutti, oppure `utente`) e il **ruolo di sezione** (`admin` o `operatore`, uno per ogni sezione a cui si è abilitati). Vedi "Gestire gli utenti dall'app".

## Identita visiva (Manuale di comunicazione istituzionale CRI)

Il portale segue il Manuale CRI. Le regole che valgono ovunque:

- **Un solo rosso**, in due valori per destinazione: `--cri-red` **#EE0000** a schermo e `--cri-red-print` **#CC0000** (Pantone 485) in stampa, applicato da una `@media print` in fondo a [`css/styles.css`](css/styles.css). Gli errori usano lo stesso rosso: non ne esiste un secondo.
- **Arial** come unico font, a schermo e nei documenti. Nessun webfont, nessun `@font-face`.
- **Marchio testuale per esteso**: «Croce Rossa Italiana — Comitato di Genova». Non si abbrevia. «Amministrazione» e il nome dello strumento, non del marchio.
- **Angoli fra 0 e 4px**, ombre appena percettibili (`--shadow-card`), nessun gradiente, nessun sollevamento in hover. I cerchi veri (spinner, interruttore) restano tondi.
- **L emblema non si ridisegna**: si usano solo gli asset ufficiali del Comitato.

Restano da completare quattro interventi dell audit dell 11/09/2026, tutti fermi sugli asset ufficiali che il Comitato deve fornire in `assets/brand/` e `assets/icons/ifrc/`:

| | Cosa manca |
|---|---|
| **T1** | L emblema nel blocco del marchio e ancora un glifo tipografico dentro un quadrato rosso arrotondato: serve `emblema-genova-orizzontale-rosso.svg`. |
| **T2** | Favicon e icone PWA sono lo stesso emblema alterato: servono l emblema verticale ufficiale e la rigenerazione dei PNG. |
| **T6** | 294 emoji usate come icone in 43 file: servono le icone IFRC 2024 e la libreria Lucide in `js/vendor/` (la CSP vieta i CDN). |
| **T10** | Firma di formato nelle stampe: banda, marchio verticale e payoff «Un Italia che aiuta». |

## Sezione Scadenziario

Inserimento manuale o automatico delle fatture (PDF via AI Gemini, XML fattura elettronica letto direttamente), pagamenti/acconti, alert scadenze, ricerca e filtri, export Excel/PDF, registro modifiche per gli admin.

Si divide a sua volta in due parti indipendenti, selezionabili come due schede dalla barra laterale:
- **Fatture Passive**: fatture ricevute dai fornitori (quando *noi* paghiamo).
- **Fatture Attive**: fatture emesse ai clienti (quando *veniamo pagati*) — stesse funzionalità delle passive (inserimento manuale o da PDF/XML, incassi/acconti, note di credito, export, registro modifiche), più un campo per segnare la data dell'ultimo sollecito di pagamento inviato al cliente.

Le due sezioni hanno tabelle, dati e permessi separati: nulla di quanto inserito in una compare nell'altra.

## Sezione Formazione Esterna

Generatore di preventivi per i **corsi che il Comitato eroga alle aziende**: primo soccorso per i lavoratori designati (gruppo A e gruppo B/C, con i rispettivi aggiornamenti), BLSD e retraining BLSD. Sostituisce la lettera scritta a mano ogni volta, dove i prezzi erano righe discorsive senza somma e mancavano il numero dei discenti, la validità dell'offerta e la riga sull'IVA.

Si compila il destinatario, si scelgono i corsi dal catalogo e per ognuno si indicano **quante persone** e **a che prezzo**. I prezzi sono due, come si è sempre scritto nei preventivi del Comitato: il **listino** e il **prezzo riservato** a quel cliente. Nel documento il listino compare solo dove è più alto, così la formula «euro 60 a discente, per Voi euro 55» resta leggibile senza diventare una colonna che ripete l'altra. Il numero di discenti può anche restare vuoto: in quel caso il corso compare col prezzo a persona e senza totale, che è come si quota quando l'azienda non sa ancora quanti manderà.

Il **catalogo dei corsi** si configura in Impostazioni: per ogni corso denominazione, durata, prezzo di listino, sigla (serve solo a proporre l'oggetto: «PREVENTIVO CORSI BLSD») e **attestazione rilasciata** — che cambia da corso a corso, l'attestato triennale del primo soccorso non è l'autorizzazione all'uso del DAE, e nel documento diventa un elenco sotto la tabella. Dentro il singolo preventivo tutto resta modificabile, e la modifica vale solo per quel preventivo: un preventivo già inviato continua a mostrare i corsi e i prezzi con cui è stato fatto anche se il catalogo cambia. C'è anche il pulsante per una riga **fuori catalogo**, per il corso chiesto una volta sola.

Tre cose si decidono preventivo per preventivo:

- il **numero di protocollo**, che si scrive a mano quando serve (la numerazione la tiene il registro del Comitato, non l'app) e allora compare come «Prot. n. …» sopra la data;
- la **sede**: presso di noi oppure presso il committente. Nel secondo caso si scrive l'indirizzo — che finisce nella frase del documento — e si può aggiungere una **maggiorazione per la trasferta**, che entra nel totale come riga a sé. La cifra proposta si imposta in Impostazioni, e nel preventivo si cambia o si azzera;
- l'**IVA**: nessuna indicazione (come i preventivi scritti finora), esente ai sensi dell'art. 10, oppure soggetta al 22% — e in quel caso il documento mostra imponibile, IVA e totale. Le due frasi si scrivono in Impostazioni.

Ci sono poi i due **sconti** sull'intero pacchetto, percentuale e valore assoluto, che funzionano come nelle assistenze (la percentuale sul totale, l'importo fisso su quello che resta) e sono un'altra cosa rispetto al prezzo riservato del singolo corso. L'IVA, quando c'è, si calcola dopo gli sconti.

Nell'elenco si filtra per stato, si cambia stato con un clic, si cerca anche **per nome del corso** («chi ci ha chiesto il BLSD?») e si **duplica** un preventivo: gli aggiornamenti scadono ogni tre anni e la stessa azienda richiama con la stessa richiesta. Il duplicato nasce come bozza con la data di oggi e **senza protocollo**, che è il numero di quel documento e non va ereditato. I committenti si tengono in una **rubrica** (voce `Rubrica committenti`) che si riempie mentre si lavora, con `Salva in rubrica` dall'editor e `Scegli dalla rubrica` per compilare il destinatario in un colpo solo; anche qui i dati restano copiati dentro il preventivo.

Il preventivo esce in **PDF** (stampa del browser) e in **Word (.docx)**, con lo stesso contenuto e la stessa impaginazione delle assistenze sanitarie: la carta intestata, la resa in Word e quella di stampa sono ora codice condiviso (`js/lib/carta.js`, `js/lib/docxBlocchi.js`, `js/lib/stampaBlocchi.js`), quindi sostituendo il `.dotx` cambiano insieme i documenti di tutte e due le sezioni.

La sezione ha il suo **tour guidato** (il pulsante 🎓): una ventina di passi che attraversano elenco, editor, rubrica e impostazioni: il copione sta in [`js/tour/formazione.js`](js/tour/formazione.js). Passa davvero dall'editor di un preventivo nuovo, ma non salva nulla.

Richiede [`supabase/patch-2026-09-06-formazione.sql`](supabase/patch-2026-09-06-formazione.sql). Il catalogo di partenza — i sei corsi del listino — lo crea l'app alla prima apertura delle Impostazioni, **con i prezzi a zero**: vanno impostati lì prima del primo preventivo, e finché un corso resta a zero l'editor lo segnala.

## Sezione Direttore

Le cose da fare della direzione, tenute in ordine di **peso** invece che di arrivo. Ogni impegno porta tre informazioni, e sono tre cose diverse di proposito:

- l'**importanza** — quanto pesa il risultato, a prescindere da quando va fatto;
- l'**urgenza** — quanto preme il tempo;
- la **scadenza** — entro quando, e può restare vuota: «va fatto, ma non entro una data» è una risposta legittima.

Tenerle separate è tutto il punto della sezione: la riunione di domani preme molto e può contare poco, il bilancio conta molto mesi prima di premere. Confonderle in una sola "priorità" è il modo classico per passare le giornate a spegnere incendi e non fare mai le cose che contano.

**L'elenco si ordina da sé** e cambia da solo con il passare dei giorni: l'ordine nasce da importanza (che pesa il doppio), urgenza e giorni che mancano alla scadenza. Una cosa importante che scade domani sale sopra una urgente che scade fra un mese; una che è già scaduta sale in alto, ma non arriva a coprire ciò che è al massimo su entrambe le scale — se bastasse una scadenza dimenticata su una pratica marginale per finire in testa, l'elenco smetterebbe di dire quale sia il lavoro che conta. Le regole sono fissate da [`test/impegni.prove.mjs`](test/impegni.prove.mjs), caso per caso.

In testa alla pagina ci sono quattro numeri — da fare, scaduti, in scadenza entro sette giorni, senza scadenza — e i due di mezzo sono anche filtri: un clic e l'elenco mostra solo quelli. La **spunta si dà dall'elenco**, senza aprire niente: è il gesto che si fa più spesso, e farlo passare da una scheda sarebbe il modo per non tenere mai l'elenco aggiornato. Siccome segnare «fatto» fa sparire la riga dalla vista *Da fare*, per **cinque secondi** l'avviso in basso offre di annullare, col titolo sott'occhio: senza, chi ha cliccato sulla riga sbagliata non saprebbe più nemmeno quale era. Gli impegni fatti scendono in fondo con la data, i più recenti per primi: è un archivio, non una coda.

Nella scheda l'unica cosa obbligatoria è **che cosa c'è da fare** — un impegno che non si riesce ad annotare in dieci secondi non viene annotato affatto. Man mano che si scelgono i livelli, una riga in fondo dice in che parte dell'elenco comparirà, così non si deve indovinare l'effetto delle tre scelte.

Gli impegni sono **condivisi fra chi ha accesso alla sezione**, come i dati di tutte le altre: Direttore è la scrivania della direzione, non l'agenda privata di una persona.

La sezione ha il suo **tour guidato** (il pulsante 🎓): undici passi fra elenco e scheda, il copione sta in [`js/tour/direttore.js`](js/tour/direttore.js).

Richiede [`supabase/patch-2026-09-11-direttore.sql`](supabase/patch-2026-09-11-direttore.sql) (la sezione nel portale) e [`supabase/patch-2026-09-11-impegni-direttore.sql`](supabase/patch-2026-09-11-impegni-direttore.sql) (la tabella degli impegni, con le sue policy).

## Sezione Trasporti lunghi

Preventivi per i trasporti sanitari fuori Genova: si indica il mezzo, si scrivono le tappe (indirizzi cercati con OpenRouteService, che calcola anche i km del percorso reale) e l'app somma carburante, pedaggi esteri, pasti, pernottamenti e personale sanitario, confrontando la spesa viva con l'addebito al cliente.

Il documento da consegnare esce come nelle altre due sezioni: **PDF** e **Word (.docx)** sulla carta intestata ufficiale, generati dagli stessi moduli condivisi (`js/lib/carta.js`, `js/lib/docxBlocchi.js`, `js/lib/stampaBlocchi.js`). Riporta destinatario, itinerario, dati del servizio e importo richiesto, con la firma e i testi fissi configurati in Impostazioni. Prima aveva una stampa tutta sua, con un'intestazione disegnata in CSS che imitava il logo e nessuna versione Word.

**La spesa viva e il margine non compaiono nel documento.** Ci comparivano — due volte, di cui una in un riquadro accanto al totale — nel foglio consegnato al cliente, che poteva così ricavarsi in un attimo quanto ci guadagna il Comitato. Restano dove servono, nell'editor e nell'elenco dei preventivi.

Il destinatario si compila nella scheda **Destinatario e documento** dell'editor: cliente ed eventuale data del servizio finiscono nelle colonne omonime della tabella (c'erano da sempre e non le scriveva nessuno), mentre indirizzo, codice fiscale, referente, protocollo e data del documento stanno dentro `input`, insieme alla partenza e ai flag dell'interfaccia — così la sezione non ha richiesto nessuna modifica al database.

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

## Sezione Straordinari

Registro delle ore in più richieste ai dipendenti dalla centrale operativa. Sostituisce il foglio mensile *ELENCO DIPENDENTI-ORARI MESE*, dove lo straordinario era una riga "EXTRA" dentro il tabellone dei turni: scritta a mano, senza chi l'avesse chiesta né perché, con i recuperi come numeri negativi in mezzo agli altri e i totali da sommare a occhio.

Qui ogni straordinario è una riga con **dipendente, giorno, orari, ore, tipo e causale**. Il tipo (straordinario, cambio turno, recupero) decide il segno: le ore si scrivono sempre positive e il saldo — straordinari meno recuperi — lo calcola l'app. Non c'è nessuno stato da far avanzare: le righe si scrivono a fine turno, a cose fatte, e una riga sbagliata si corregge o si elimina.

Le pagine della sezione:

- **Registro** — un mese alla volta, con in testa ore in più, recuperi e saldo. Le righe sono raggruppate per giornata e si aprono con un clic. Export **Excel** (una riga per straordinario, con le ore come numeri sommabili) e **stampa** dell'elenco filtrato.
- **Registra ore** — scheda corta: dipendente, giorno e ore bastano. Gli orari si scelgono sul quadrante e le ore si calcolano da soli (restano correggibili: un rientro arrotondato, una frazione concordata a voce). Avvisa se per quel dipendente c'è già una riga in quel giorno. `Salva e nuova` tiene giorno e tipo, per registrare in fila la stessa serata.
- **Riepilogo mensile** — la griglia dipendenti × giorni, cioè la forma del vecchio foglio, ma con i totali calcolati e le celle che si aprono sul dettaglio della giornata. I dipendenti senza ore restano in elenco apposta: vedere gli zeri è il modo per accorgersi di come sono distribuite le ore. Da qui si stampa la griglia (A4 orizzontale, con le righe per le firme).
- **Dipendenti** — l’elenco da cui si sceglie chi ha fatto lo straordinario, col saldo del mese in corso accanto a ogni nome. Cognome, nome e un promemoria: non è una copia del personale dell’ente, e matricola, telefono e ore di contratto sono stati tolti perché non entravano in nessun calcolo. Chi va via si disattiva, non si cancella: lo storico è suo.
- **Impostazioni** — l'elenco delle causali proposte in fase di registrazione. Le modifica l'admin di sezione; gli altri le vedono in sola lettura. C'erano anche due soglie di attenzione, tolte perché gli avvisi che facevano comparire non cambiavano il lavoro di chi registra.

La sezione ha il suo **tour guidato** (il pulsante 🎓): diciotto passi che attraversano registro, scheda di registrazione, riepilogo, dipendenti e impostazioni — il copione sta in [`js/tour/straordinari.js`](js/tour/straordinari.js). Passa davvero dalla scheda di una registrazione nuova, ma non salva nulla.
Richiede `supabase/patch-2026-09-05-straordinari.sql` (tabelle, RLS e voce di menu della sezione) e, subito dopo, `supabase/patch-2026-09-05-dipendenti.sql`, che rinomina l'anagrafica da *autisti* a *dipendenti* — il registro serve per tutto il personale, non solo per chi guida — e carica l'elenco delle 19 persone in servizio al 05/09/2026. Poi `supabase/patch-2026-09-05-dipendenti-essenziali.sql`, che toglie dall'anagrafica matricola, telefono e ore di contratto.

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

> Se il database è stato creato prima del 01/09/2026, esegui anche i patch in `supabase/patch-*.sql` nell'ordine della data nel nome del file. Su un database nuovo non serve: `schema.sql` li include già tutti — comprese le tabelle degli straordinari e la loro riga in `sezioni`, che fino al 05/09/2026 mancavano, e su un database ricostruito da zero facevano nascere un portale con la sezione nel menu e nessuna tabella sotto. Quando aggiungi una sezione, va aggiornato anche `schema.sql`: la pagina *Utenti e autorizzazioni* ora avvisa se una sezione del menu non esiste nel database, che è il sintomo di questa dimenticanza.
>
> **L'ultimo è [`patch-2026-09-01-portale.sql`](supabase/patch-2026-09-01-portale.sql)** ed è obbligatorio su un database già in uso: trasforma lo scadenziario nel portale multi-sezione. Crea le tabelle `sezioni` e `autorizzazioni`, sposta lì i ruoli che stavano in `profili.ruolo` (chi era admin/operatore resta admin/operatore **dello scadenziario** e di nient'altro) e nomina il super admin — nel file c'è un `update` con l'email da controllare prima di eseguirlo.
>
> **Per la sezione assistenze sanitarie** servono [`patch-2026-09-02-assistenze.sql`](supabase/patch-2026-09-02-assistenze.sql) (crea `preventivi_assistenze` e `impostazioni_assistenze`) e [`patch-2026-09-02-assistenze-sconto.sql`](supabase/patch-2026-09-02-assistenze-sconto.sql) (le colonne degli sconti).
>
> **Per la sezione formazione esterna** serve [`patch-2026-09-06-formazione.sql`](supabase/patch-2026-09-06-formazione.sql) (crea `preventivi_formazione`, `clienti_formazione` e `impostazioni_formazione` con le relative RLS). Nella stessa occasione è stata rimediata una dimenticanza di `schema.sql`, che non conteneva `clienti_assistenze`: su un database creato da zero la rubrica delle assistenze rispondeva con un errore, perché quella tabella arrivava solo dal patch del 3 settembre. Su un database già in uso non cambia nulla.
>
> **Per la sezione trasporti** servono in più [`patch-2026-09-01-trasporti.sql`](supabase/patch-2026-09-01-trasporti.sql) (crea `preventivi` e `impostazioni_trasferte`) e, per portarsi dietro i dati del vecchio gestionale, [`export-trasporti.sql`](supabase/export-trasporti.sql) — che però va lanciato sul **vecchio** progetto Supabase: stampa gli insert già pronti da incollare qui.
>
> **[`patch-2026-09-04-permessi-profili.sql`](supabase/patch-2026-09-04-permessi-profili.sql)** chiude due falle nei permessi sulla tabella `profili` e va eseguito su qualunque database già in uso: l'obbligo di cambiare la password provvisoria era aggirabile dal client (adesso il flag lo spegne un trigger che guarda la password vera), e un super admin poteva nominarne un altro nonostante quanto scritto qui sotto. Il sito funziona anche senza — l'app ha una rete di sicurezza per non chiedere la password ad ogni accesso su un database non aggiornato — ma finché non lo esegui quelle due strade restano aperte.

>
> **[`patch-2026-09-05-elimina-utente.sql`](supabase/patch-2026-09-05-elimina-utente.sql)** serve al pulsante *Elimina* in Utenti e autorizzazioni. Le colonne `created_by` (e simili) puntano ad `auth.users` senza regola di cancellazione: finché non la esegui, eliminare una persona che ha inserito anche una sola riga fallisce con un errore di chiave esterna. La patch le porta a `on delete set null` — nessun dato viene cancellato, perdono solo l'indicazione dell'autore. Senza, il resto dell'app funziona normalmente e l'app mostra un errore che rimanda a questo file.
>
> **[`patch-2026-09-05-dipendenti.sql`](supabase/patch-2026-09-05-dipendenti.sql)** riguarda la sola sezione Straordinari: rinomina l'anagrafica da `autisti_straordinari` a `dipendenti_straordinari` (con le colonne `autista_id`/`autista_nome`) e carica l'elenco del personale. Va eseguita **insieme al deploy**: fra i due passaggi la sezione Straordinari dà errore, perché l'app cerca i nomi nuovi. Le altre sezioni non ne risentono.
>
> **[`patch-2026-09-05-rimozione-reperibilita.sql`](supabase/patch-2026-09-05-rimozione-reperibilita.sql)** toglie il tipo *reperibilità* dagli straordinari, lasciando straordinario, cambio turno e recupero. Le righe già registrate come reperibilità diventano straordinari: il segno era lo stesso, quindi nessun totale cambia.
>
> **[`patch-2026-09-05-straordinari-senza-stato.sql`](supabase/patch-2026-09-05-straordinari-senza-stato.sql)** elimina le colonne `stato`, `richiesto_da` e `richiesto_da_nome`: il registro raccoglie ore già svolte, non pratiche da far avanzare. **Cancella dati**: le righe che erano in stato *annullato* vengono eliminate (senza lo stato conterebbero nei totali) e chi aveva chiesto lo straordinario non è più conservato. Se ti serve tenerne traccia, copia la tabella prima di eseguire — il comando è scritto nel file.
>
> **[`patch-2026-09-05-sospensione-e-quote.sql`](supabase/patch-2026-09-05-sospensione-e-quote.sql)** è una **correzione di sicurezza, da eseguire appena possibile**. Rende effettiva la sospensione: `ruolo_sezione()` ora risponde NULL a chi ha il profilo sospeso o non ne ha più uno, e siccome tutte le policy passano da quella funzione, l'accesso ai dati si chiude per tutte le sezioni insieme. Prima il blocco viveva solo nel browser, e un utente sospeso con una sessione aperta continuava a leggere e scrivere via API. La stessa patch aggiunge `consumi_api` e `consuma_quota()`, il tetto giornaliero per utente sugli endpoint che spendono le quote di Gemini e OpenRouteService.
>
> **[`patch-2026-09-11-direttore.sql`](supabase/patch-2026-09-11-direttore.sql)** aggiunge la sezione *Direttore* a `public.sezioni`. Senza, la card compare nella home ma il permesso non si può assegnare, perché quella tabella è la chiave esterna di `autorizzazioni` — ed è esattamente il caso che la pagina *Utenti e autorizzazioni* segnala da sé con un avviso.
>
> **[`patch-2026-09-11-impegni-direttore.sql`](supabase/patch-2026-09-11-impegni-direttore.sql)** crea `impegni_direttore`, la tabella della sezione Direttore, con le policy che la riservano a chi ha quella sezione. Va dopo la patch qui sopra, che crea la sezione stessa.

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

### Le prove automatiche

```bash
npm test
```

Controlla in pochi secondi le parti che non si possono verificare a occhio ogni volta: gli importi in lettere, la lettura degli importi scritti a mano, i calcoli dei preventivi delle tre sezioni, le ore degli straordinari, il contenuto dei documenti (compreso il fatto che **la spesa viva non finisca nel preventivo consegnato al cliente**), la validità del file Word e il comportamento offline del service worker. Non serve né rete né database: le prove lavorano sulle funzioni, non sul sito acceso.

Le prove stanno in [`test/`](test/), un file per argomento (`*.prove.mjs`), e il motore è una cinquantina di righe senza librerie ([`test/aiuto.mjs`](test/aiuto.mjs), [`test/esegui.mjs`](test/esegui.mjs)). **Vale la pena lanciarle prima di ogni `git push`**: un `git commit` non le esegue da solo.

### Copia di sicurezza del database

```bash
npm run backup
```

Scarica tutte le tabelle in `backup/<data>/`, un file JSON per tabella più un `_riepilogo.json` con la data e il numero di righe. Richiede la `SUPABASE_SERVICE_ROLE_KEY` in `.dev.vars` (la stessa del punto 3): è la chiave che scavalca i permessi, quindi vede anche quello che l'utente collegato non vedrebbe.

Serve perché **il piano gratuito di Supabase non garantisce copie ripristinabili da soli**: le fatture del Comitato sono l'unica cosa di questo progetto che, se si perde, non si rimedia riscrivendo del codice. La cartella `backup/` è esclusa dal repository e dal sito: i file contengono dati personali e vanno trattati come si tratterebbe un raccoglitore di fatture — e vanno tenuti **anche fuori da questo computer**, altrimenti non sono una copia di sicurezza ma solo un secondo file nello stesso posto.

Non contiene gli account veri (`auth.users`): le password non sono esportabili per costruzione, e di ogni persona restano id, email, nome e ruolo in `profili`, che è quanto serve per ricrearli.

## 5. Deploy su Cloudflare (Workers con Git integration)

Il progetto Cloudflare collegato a questo repo è di tipo **Worker** (il nuovo flusso unificato "Workers & Pages": build command `npx wrangler deploy`), non la vecchia Pages classica. Per questo motivo il repo contiene già:
- [`wrangler.jsonc`](wrangler.jsonc): configurazione del deploy (nome, asset statici, entry point). Contiene `assets.run_worker_first: true`, ed è importante: senza, Cloudflare serve i file statici **prima** del Worker, che non viene nemmeno eseguito — e le intestazioni di sicurezza (CSP, `nosniff`, `X-Frame-Options`) arrivavano solo sulle risposte delle `/api/*`, mentre la pagina che esegue il codice e tiene la sessione usciva senza nessuna di esse. Dopo un deploy vale la pena ricontrollarlo: `curl -D - -o /dev/null https://<indirizzo>/js/app.js` deve mostrare `Content-Security-Policy`
- [`worker.js`](worker.js): instrada le `/api/*` (lettura AI delle fatture, creazione ed eliminazione utenti, geocoding/percorsi e prezzi carburante dei preventivi) alle function in `functions/api/`, il resto (index.html, css/, js/) viene servito come asset statico
- [`.assetsignore`](.assetsignore): esclude dagli asset statici i file che non fanno parte del sito (node_modules, supabase/, ecc. — senza questo file il deploy falliva per un asset da 146MB)

Passaggi:
1. Push su GitHub (già fatto): `git push`.
2. Nel progetto Cloudflare (Workers & Pages) → **Settings → Variables and Secrets**, aggiungi come **Secret** (non testo in chiaro):
   - `GEMINI_API_KEY` = la tua chiave Gemini
   - `SUPABASE_SERVICE_ROLE_KEY` = la service_role key di Supabase (punto 1.6) — senza, la creazione utenti dall'app risponde con un errore chiaro invece di funzionare a metà
   - `ORS_KEY` = la chiave OpenRouteService usata dalla sezione trasporti per cercare gli indirizzi e calcolare i km (è la stessa che aveva il progetto preventivo-trasporti)
   - (opzionale, se preferisci non hardcodarle nel codice) `SUPABASE_URL` e `SUPABASE_ANON_KEY`
3. Da qui in avanti, **ogni `git push` sul branch collegato aggiorna automaticamente il sito** — nessun altro passaggio richiesto.

### Nome del Worker e indirizzo del portale

Il campo `name` in [`wrangler.jsonc`](wrangler.jsonc) è anche il sottodominio pubblico: con `"name": "amministrazione"` il portale sta su `https://amministrazione.jacopo-ravaiolicri.workers.dev`. Cambiarlo **non rinomina** il Worker già esistente su Cloudflare: al primo deploy ne nasce uno nuovo e vuoto, mentre il vecchio resta online con i suoi secret. Quindi, dopo un cambio di nome:
1. ricrea sul nuovo Worker i secret del punto 2 (non vengono ereditati: senza, lettura AI, creazione utenti e km dei preventivi rispondono con un errore);
2. in Supabase → Authentication → URL Configuration aggiorna la **Site URL** e aggiungi il nuovo indirizzo ai **Redirect URLs** (`https://amministrazione.jacopo-ravaiolicri.workers.dev/**`), altrimenti il link di reset password non funziona;
3. verifica che il nuovo indirizzo funzioni e solo allora elimina il vecchio Worker dalla dashboard Cloudflare.

## Gestire gli utenti dall'app

Tutto avviene in **Utenti e autorizzazioni** (voce in fondo alla barra laterale, visibile solo al super admin).

Da **Aggiungi un utente** si crea l'account con email, nome opzionale e già le sezioni che gli competono: l'app genera una password provvisoria mostrata una sola volta, da comunicare tu stesso al collega (telefono, di persona — non viene inviata via email). Al primo accesso l'app lo obbliga a impostarne una propria prima di poter entrare.

Sotto c'è la tabella di tutti gli account: una riga per utente, una colonna per sezione, e in ogni casella una tendina con **Nessuno / Operatore / Admin**. Assegnare la prima sezione a un utente `in_attesa` lo attiva automaticamente. Il pulsante **Sospendi** blocca del tutto un accesso senza cancellarne i permessi, così riattivarlo non costringe a riassegnarli uno per uno. Due cose non si possono fare dall'app, di proposito: sospendere se stessi e creare un altro super admin (quel ruolo si assegna solo dal database, altrimenti chi gestisce gli utenti potrebbe auto-promuoversi).

Accanto c'è **Elimina**, che è un'altra cosa: cancella l'account per sempre da Supabase, con i suoi permessi, e non si può annullare. Per evitare un click di troppo su una tabella dove le righe si somigliano, la conferma chiede di **riscrivere l'email** della persona. Nella quasi totalità dei casi la scelta giusta è *Sospendi* — un collega che cambia servizio, qualcuno che non deve entrare per un po' —; *Elimina* ha senso per le registrazioni sbagliate, i doppioni e chi ha lasciato l'associazione.

Quello che l'eliminazione **non** porta via: le fatture, le assistenze, i trasporti e i preventivi che quella persona aveva inserito restano tutti, e perdono solo il collegamento al suo account (`created_by` diventa vuoto). Il registro modifiche continua a mostrare nome ed email di chi ha fatto ogni operazione, perché li salva come testo e non come riferimento all'account. Non si può eliminare se stessi né un altro super admin: in quel caso va prima tolto il ruolo dal database.

Le **impostazioni di sezione** sono un'altra cosa: per lo scadenziario stanno in *Impostazioni scadenziario* (scadenza di default e registro modifiche) e le vede l'admin di quella sezione, non il super admin in quanto tale.

## Struttura del progetto

```
index.html                   pagina unica (SPA)
css/styles.css                stile
js/app.js                     router e shell del portale (home, sezioni, permessi)
js/sezioni.js                  elenco delle sezioni (icone, colori, rotte) e regole di accesso
js/sezioniIds.js               i soli id delle sezioni, letti anche dal Worker (creazione utenti)
js/config.js                   configurazione (URL/chiavi Supabase)
js/views/home.js                home del portale: la griglia da cui si sceglie la sezione
js/assistenze/                 sezione Assistenze sanitarie: preventivi per eventi
js/assistenze/calc.js           tariffario, calcolo dei turni e importo in lettere
js/assistenze/views/rubrica.js  la rubrica di questa sezione: il suo store e le sue parole
js/assistenze/views/sceltaCliente.js  il riquadro di scelta (rimanda a rubrica.js)
js/assistenze/lib/documento.js  il preventivo come blocchi, da cui derivano PDF e Word
js/formazione/                 sezione Formazione Esterna: preventivi per i corsi alle aziende
js/formazione/calc.js           catalogo dei corsi, listino/prezzo riservato, sconti e IVA
js/formazione/lib/documento.js  il preventivo dei corsi come blocchi (tabella, attestazioni, sede)
js/formazione/views/preventivo.js  editor: destinatario, corsi, sede, IVA e sconti
js/direttore/                  sezione Direttore: gli impegni della direzione
js/direttore/calc.js            livelli, scadenze e il punteggio con cui si ordina l’elenco
js/direttore/views/impegni.js   l’elenco, i quattro numeri in testa e la spunta rapida
js/direttore/views/impegno.js   la scheda: titolo, i due livelli, scadenza e dettagli
js/lib/carta.js                 legge la carta intestata .dotx (immagini e testi)
js/lib/docxBlocchi.js           dai blocchi al .docx, sostituendo il corpo del modello
js/lib/stampaBlocchi.js         dai blocchi al foglio A4 per la stampa/PDF
js/lib/numeri.js                importo in lettere e arrotondamento ai centesimi
js/lib/importi.js               i campi con i decimali: la virgola si può scrivere e incollare
js/lib/rubrica.js               la rubrica (elenco, scheda, riquadro di scelta), una volta sola
js/lib/zip.js                   zip minimale (scrittura e lettura): serve a .xlsx e .docx
js/vendor/supabase-js-*.js      il client Supabase, dentro il progetto e non su una CDN
test/                          le prove automatiche (npm test)
tools/backup.mjs               la copia di sicurezza del database (npm run backup)
assets/carta-intestata.dotx    modello Word ufficiale del Comitato
js/trasporti/                  sezione Trasporti lunghi: preventivi trasporti sanitari
js/trasporti/calc.js            il calcolo del preventivo (spesa reale, addebito, margine)
js/trasporti/lib/documento.js   il preventivo come blocchi: itinerario, dati del servizio, importo
js/trasporti/sezione.js         ingresso della sezione: carica impostazioni e smista alle viste
js/straordinari/               sezione Straordinari: registro delle ore chieste ai dipendenti
js/straordinari/calc.js         tipi, stati, calcolo delle ore e riepiloghi mensili
js/straordinari/views/registro.js   elenco del mese, filtri e ricerca
js/straordinari/views/riepilogo.js  griglia dipendenti × giorni, con chiusura del mese
js/straordinari/lib/export.js       Excel delle righe + stampa della griglia e dell'elenco
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
                               (il guscio dell'app è messo da parte all'installazione, così offline
                                si apre anche appena aggiunta alla schermata Home)
icons/                          icone PWA (192px, 512px)
functions/api/                 endpoint: proxy verso Gemini (passive+attive), creazione ed eliminazione utenti
functions/_lib/auth.js          verifica sessione/ruolo Supabase lato server
functions/_lib/gemini.mjs       nome del modello Gemini (condiviso con server.js)
supabase/schema.sql            schema database + RLS + trigger di audit log (passive+attive)
supabase/patch-...sql          correzioni da applicare a un database già esistente
worker.js                      entry point del Worker: instrada /api/* e serve gli asset statici
wrangler.jsonc                 configurazione del deploy Cloudflare
.assetsignore                  file esclusi dagli asset statici (node_modules, ecc.)
```

## Note sul funzionamento

- **Lettura automatica**: XML di fattura elettronica → letto localmente nel browser, gratuito e sempre accurato sui campi presenti nel tracciato. Sono accettati anche i file firmati `.xml.p7m` scaricati dal cassetto fiscale: l'XML viene estratto dalla busta di firma direttamente nel browser (la firma non viene verificata — il documento probante resta quello conservato a norma). PDF/immagini → inviati a Gemini (AI) tramite la function serverless, che tiene la chiave al sicuro lato server. Dalle rate di pagamento indicate nel documento si prende come scadenza la **prima data utile**, ignorando le rate che una data non ce l'hanno (nel tracciato è un campo facoltativo): ordinandole per stringa la data vuota finiva prima di quelle vere, il documento risultava senza scadenza e l'app gli applicava lo scadenzario di default — cioè una data che contraddiceva la fattura, senza dirlo.
- **Duplicati**: al salvataggio l'app avvisa se esiste già una fattura con lo stesso numero dello stesso fornitore, e chiede conferma. Non è un blocco: reinserire volutamente un documento resta possibile.
- **Fornitore/cliente**: sono campi di testo libero (non c'è un'anagrafica), ma il campo suggerisce mentre si scrive i nomi già usati in archivio. Serve a non ritrovarsi "Enel SpA" ed "ENEL S.p.A." come due soggetti distinti nel Report, con il totale di quel fornitore spezzato in due. Il campo resta libero: un fornitore nuovo si scrive normalmente.
- **Ricerca, filtri ed export**: la tabella principale mostra le fatture dell'anno corrente più quelle ancora aperte di anni precedenti; le fatture chiuse più vecchie stanno nell'archivio in fondo alla pagina. Appena si cerca o si filtra qualcosa, però, **l'archivio viene incluso**: il pannello si popola coi risultati e il titolo dice quanti ne rientrano. Anche **Esporta Excel/PDF esportano sempre tutto ciò che rispetta i filtri**, archivio compreso.
- **Pagamenti/acconti**: ogni fattura può avere più pagamenti parziali; lo stato (da pagare / pagata parzialmente / pagata) si aggiorna automaticamente in base al totale pagato.
- **Fatture attive**: stesse funzionalità delle passive, tabelle e permessi indipendenti (vedi sopra). Unica differenza voluta: gli **incassi** li registra direttamente anche l'operatore (non solo l'admin come per i pagamenti delle passive), perché qui non esiste un flusso di "proposte" — chiunque può segnare che una fattura è stata incassata. Il campo **sollecito** (data dell'ultimo sollecito di pagamento inviato al cliente) è puramente informativo: si aggiorna a mano dall'editor o con un click rapido dalla tabella, non invia nulla automaticamente. Le fatture attive non hanno una data di scadenza propria: il filtro temporale della dashboard e l'avviso "emesse da troppo tempo e non incassate" lavorano quindi sulla **data di emissione**, con la stessa soglia in giorni configurata in Impostazioni.
- **Registro modifiche**: ogni creazione, modifica, cancellazione di una fattura (e ogni pagamento aggiunto/rimosso) viene registrata automaticamente da un trigger del database — non è disattivabile dall'app, visibile in sola lettura solo agli admin.
- **Niente collegamento diretto al cassetto fiscale**: richiederebbe login SPID/CIE (non automatizzabile) o un accreditamento come intermediario SdI presso l'Agenzia delle Entrate (procedura complessa, sproporzionata per questo progetto). Il flusso previsto è: scarichi tu il PDF o l'XML dal cassetto fiscale, poi lo carichi qui.

## Note trasversali (valgono per tutte le sezioni)

- **Gli importi si scrivono all'italiana.** I campi con i decimali — importi delle fatture, pagamenti, prezzi, tariffe, km — accettano sia «55,50» sia «55.50», e capiscono anche «1.234,56». Non sono campi `type="number"`: quelli scartano in silenzio quello che non riconoscono, e **incollando** un importo con la virgola il campo restava vuoto. Succede anche su Chrome in italiano. Dove la lettura era `Number(v) || 0` si salvava **zero** senza un errore; nello scadenziario, che leggeva già con `parseEuro`, l'app rispondeva «indica un importo valido» su una cifra che era lì scritta. Adesso i campi sono di testo con `inputmode="decimal"` e si leggono tutti con `parseEuro` ([`js/lib/importi.js`](js/lib/importi.js)). I campi che contengono numeri interi (persone, notti, discenti, giorni) restano numerici: lì la virgola non c'entra, e una prova automatica controlla che l'elenco di quelli ammessi non cresca per distrazione.
- **Chi salva per secondo non cancella il lavoro del primo.** Tutte le sezioni salvano confrontando la versione da cui si era partiti (`updated_at`): se nel frattempo qualcun altro ha salvato lo stesso record, il salvataggio si ferma e l'app propone di ricaricare la versione aggiornata, invece di sovrascriverla.
- **Le impostazioni non ripiegano di nascosto sui valori di fabbrica.** Se la lettura delle impostazioni di una sezione fallisce (rete, permessi), la sezione mostra un errore: prima almeno una di esse restituiva i valori di default — tariffe e consumi di listino — come se fossero la configurazione vera del Comitato, e il preventivo usciva con numeri plausibili ma sbagliati.
- **Il client Supabase sta dentro il progetto** ([`js/vendor/`](js/vendor/)), non su una CDN. Prima veniva scaricato da `esm.sh` a ogni avvio: il portale non si apriva se quel sito era irraggiungibile, e chi lo avesse controllato avrebbe potuto eseguire codice proprio nella pagina che maneggia le credenziali. Di conseguenza la Content-Security-Policy non autorizza più nessun host esterno per gli script. Per aggiornarlo, le istruzioni sono in cima a [`js/lib/supabase.js`](js/lib/supabase.js).
- **La rubrica è una sola** ([`js/lib/rubrica.js`](js/lib/rubrica.js)): elenco, scheda e riquadro «Scegli dalla rubrica» sono lo stesso codice per assistenze e formazione, che gli passano soltanto il proprio store e le proprie parole (una sezione ha *clienti*, l'altra *committenti*: in italiano il genere si porta dietro articoli e participi, quindi le frasi sono parametri e non pezzi da incollare). **I dati restano separati**: due tabelle, due permessi — chi è abilitato solo alla formazione non vede i clienti delle assistenze. Unirle sarebbe un'altra cosa, con una migrazione e una decisione su chi può vedere cosa.
