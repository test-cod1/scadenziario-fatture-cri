// ============================================================
//  Passi del tour guidato della sezione FORMAZIONE ESTERNA.
//  Il motore (tooltip, evidenziazione, navigazione fra le pagine) sta in
//  js/lib/tour.js ed è condiviso con le altre sezioni: qui c'è solo il
//  copione, cioè dove andare, cosa evidenziare e cosa raccontare.
//
//  Come nelle altre sezioni, il tour passa davvero dall'editor di un
//  preventivo nuovo ma non salva nulla: finché non si preme «Salva» quel
//  preventivo non esiste, quindi il giro si può fare anche in mezzo al
//  lavoro senza lasciare tracce.
// ============================================================

export function passi() {
  return [
    {
      hash: '#/formazione/preventivi',
      titolo: 'Tour guidato',
      testo: 'Un breve giro tra le funzioni della sezione Formazione Esterna, dove si preparano i preventivi dei corsi che eroghiamo ad aziende ed enti. Usa «Avanti» per proseguire, oppure «Salta tour» in qualsiasi momento.',
    },
    {
      selettore: '.grid.stats',
      titolo: 'Il colpo d\'occhio',
      testo: 'Quattro riquadri, uno per ogni cosa da fare: le bozze da finire, gli inviati che aspettano risposta (con quanti hanno già l\'offerta scaduta), i confermati con il loro valore, e le aziende da ricontattare perché l\'attestato sta per scadere. Ogni riquadro è anche un filtro: un clic mostra solo quelli, un secondo clic li mostra tutti.',
    },
    {
      selettore: '.toolbar',
      titolo: 'Ritrovare un preventivo',
      testo: 'Cerca per azienda, referente, oggetto, protocollo — o direttamente per nome del corso, che è il modo in cui di solito ci si ricorda le cose: «chi ci aveva chiesto il BLSD?». Il filtro accanto restringe a uno stato, o alle aziende da ricontattare.',
    },
    {
      selettore: '.card .tbl-wrap',
      titolo: 'L\'elenco',
      testo: 'Una riga per preventivo, dal più recente per data del documento: i corsi che contiene, quanti discenti in tutto e il totale. Se l\'azienda ha già mandato i dati per la fattura, sotto il nome compare «📩 dati di fatturazione ricevuti». Clicca la riga per riaprirlo.',
    },
    {
      selettore: '[data-stato]',
      titolo: 'Lo stato, senza aprire nulla',
      testo: 'Bozza, inviato, confermato o annullato si cambiano direttamente da qui: è la modifica più frequente dopo aver mandato il preventivo all\'azienda. Sotto un inviato c\'è da quanti giorni aspetta risposta, e quando supera la validità dell\'offerta lo dice.',
    },
    {
      selettore: '[data-copia]',
      titolo: 'Duplicare e rinnovare',
      testo: 'Il pulsante ⧉ crea una copia come nuova bozza, con la data di oggi. Fra le aziende da ricontattare diventa «Prepara rinnovo»: lo stesso preventivo, pronto da aggiornare e mandare. Il numero di protocollo non viene mai copiato — è il numero di quel documento. Su un preventivo confermato c\'è anche «📅 Pianifica», che crea i corsi da fissare. Accanto ci sono il Word e la stampa in PDF; l\'eliminazione è riservata agli amministratori.',
    },
    {
      hash: '#/formazione/nuovo',
      selettore: '.page-head .inline',
      titolo: 'Un preventivo nuovo',
      testo: 'Siamo entrati nella creazione di un preventivo: sei passi numerati, dall\'alto in basso. Da qui vedi l\'anteprima, scarichi il documento in Word, lo stampi in PDF oppure salvi (anche con Ctrl+S): finché non salvi nulla viene registrato, e accanto al titolo compare «Modifiche non salvate». Quando il preventivo è confermato, qui compare anche «📅 Corsi».',
    },
    {
      selettore: '#cliente',
      titolo: 'A chi va il preventivo',
      testo: 'Azienda, partita IVA e indirizzo finiscono nell\'intestazione del documento, sotto «Spett.le». Basta iniziare a scrivere il nome: le aziende già in rubrica vengono suggerite, e sceglierne una compila tutto il resto, oppure usa «Scegli dalla rubrica». Con «Salva in rubrica» ci metti quella che hai appena scritto. Il referente diventa la riga «Alla c.a.».',
    },
    {
      selettore: '.catalogo-corsi',
      titolo: 'Scegliere i corsi',
      testo: 'Un riquadro per ogni corso del catalogo, con durata e prezzo: un clic e il corso entra nel preventivo, già compilato. Il segno ✓ dice quali hai già scelto. «Corso fuori catalogo» serve per la richiesta una tantum, che scrivi a mano senza sporcare il catalogo.',
    },
    {
      selettore: '#righe',
      titolo: 'Il cuore del preventivo',
      testo: 'Per ogni corso: quante persone, il prezzo di listino e il prezzo riservato a questo cliente, con il totale della riga accanto. È la formula che usiamo da sempre — «euro 60 a discente, per Voi euro 55» — e nel documento il listino compare solo dove è più alto. Il numero di discenti può restare vuoto: il corso uscirà col prezzo a persona e senza totale, come si fa quando l\'azienda non sa ancora quanti ne manderà. Durata e attestazione stanno nel pannello sotto ogni riga. Tutto è modificabile e vale solo per questo preventivo.',
    },
    {
      selettore: '#sede_tipo',
      titolo: 'Dove si tiene il corso',
      testo: 'Da noi in Corso Gastaldi, oppure presso il committente. Nel secondo caso compaiono l\'indirizzo — che entra nella frase del documento — e la maggiorazione per la trasferta, proposta dalle Impostazioni e sempre correggibile o azzerabile.',
    },
    {
      selettore: '#regime_iva',
      titolo: 'L\'IVA, preventivo per preventivo',
      testo: 'Tre possibilità: nessuna indicazione (come i preventivi scritti finora), esente ai sensi dell\'art. 10, oppure soggetto a IVA — e in quel caso il documento mostra imponibile, IVA e totale. Le due frasi si scrivono in Impostazioni.',
    },
    {
      selettore: '#sconto_percentuale',
      titolo: 'Gli sconti sul pacchetto',
      testo: 'Facoltativi e utilizzabili anche insieme: una percentuale sul totale e un importo fisso da togliere. Sono un\'altra cosa rispetto al prezzo riservato del singolo corso: servono per uno sconto sull\'intera fornitura. L\'IVA, quando c\'è, si calcola dopo.',
    },
    {
      selettore: '#oggetto',
      titolo: 'Oggetto e protocollo',
      testo: 'L\'oggetto lo propone l\'app in base ai corsi che hai scelto («PREVENTIVO CORSI BLSD») e resta riscrivibile: da quando lo tocchi, non viene più sovrascritto. Il protocollo accanto lo compili tu quando serve — la numerazione la tiene il registro del Comitato, non questa app — e allora nel documento compare «Prot. n. …» sopra la data.',
    },
    {
      selettore: '.df-corpo',
      titolo: 'I dati per la fattura',
      testo: 'Il sesto passo: salvato il preventivo, crei un link da mandare all\'azienda, che apre un modulo dove scrive da sé i dati per la fattura elettronica — anche quelli della PA, come codice ufficio, CIG e CUP. Il link compare anche nel documento (PDF e Word) e vale 120 giorni. Quando i dati arrivano, un clic li riporta nel destinatario.',
    },
    {
      selettore: '.summary',
      titolo: 'Il conto, in tempo reale',
      testo: 'A destra il riepilogo si aggiorna a ogni modifica: corso per corso con i discenti, la trasferta, gli sconti, l\'IVA e il totale, anche in lettere come richiede il documento. Sotto, «Prima di inviarlo» spunta quello che c\'è e segnala quello che manca — un corso rimasto a 0 €, i discenti ancora da definire — prima che il preventivo esca.',
    },
    {
      selettore: '#btn-word',
      titolo: 'Il documento da consegnare',
      testo: 'Word per un file modificabile, «Stampa / PDF» per la versione da firmare e mandare, «Anteprima» per controllare prima come viene. Esce sulla carta intestata del Comitato, con la tabella dei corsi, le attestazioni rilasciate, la sede e la validità dell\'offerta.',
    },
    {
      hash: '#/formazione/corsi',
      selettore: '.grid.stats',
      titolo: 'Il registro dei corsi',
      testo: 'Quando un preventivo è confermato, «Pianifica i corsi» crea un corso da fissare per ogni sua riga. Qui li ritrovi tutti: quelli ancora senza date, quelli in programma, quelli già passati ma non registrati e quelli svolti. I riquadri sono filtri, come nell\'elenco dei preventivi. Con «Nuovo corso» ne registri uno anche senza preventivo.',
    },
    {
      selettore: '.toolbar',
      titolo: 'Ritrovare un corso',
      testo: 'Si cerca anche per docente o per nome di un partecipante: «quando ha fatto il BLSD il signor Rossi?». Aprendo un corso fissi date e docenti, incolli l\'elenco dei partecipanti da una mail o da Excel, segni l\'esito e stampi il foglio presenze da far firmare in aula. Segnato «Svolto», il corso entra nelle statistiche e fa partire il conto del rinnovo.',
    },
    {
      hash: '#/formazione/statistiche',
      selettore: '.page-head',
      titolo: 'Le statistiche',
      testo: 'Corsi svolti, persone formate, ore di formazione e ricavi dell\'anno, con il confronto sull\'anno prima; poi il dettaglio per mese, per tipo di corso, per committente e per docente, e come vanno i preventivi. Il pulsante Excel scarica l\'elenco dei corsi svolti, per rifare un conto o allegarlo a una relazione.',
    },
    {
      hash: '#/formazione/rubrica',
      selettore: '.toolbar',
      titolo: 'La rubrica dei committenti',
      testo: 'Le aziende registrate, con partita IVA, indirizzo e referente. Si riempie da sé mentre prepari i preventivi, e qui si sistemano le schede: correggere un indirizzo non tocca i preventivi già fatti, che portano con sé la copia dei dati con cui sono stati scritti.',
    },
    {
      hash: '#/formazione/impostazioni',
      selettore: '#corsi',
      titolo: 'Il catalogo dei corsi',
      testo: 'Qui vivono i corsi che si possono mettere in un preventivo: denominazione, durata, prezzo di listino a discente e l\'attestazione rilasciata — che cambia da corso a corso, perché l\'attestato triennale del primo soccorso non è l\'autorizzazione all\'uso del DAE. Il rinnovo dice ogni quanti anni il corso va rifatto, ed è da lì che l\'elenco sa chi ricontattare. La sigla serve solo a proporre l\'oggetto del preventivo.',
    },
    {
      selettore: '#f-trasferta',
      titolo: 'La trasferta proposta',
      testo: 'Quanto si aggiunge, di norma, quando il corso si tiene dall\'azienda invece che da noi. È solo la proposta: dentro il singolo preventivo la cifra si cambia o si azzera.',
    },
    {
      selettore: '#f-ruolo',
      titolo: 'La firma',
      testo: 'Ruolo e nome di chi firma: sono le due righe in fondo a ogni preventivo, così non vanno riscritte ogni volta. Lasciando vuoto il nome resta la sola qualifica.',
    },
    {
      selettore: '#testi textarea',
      titolo: 'I testi fissi',
      testo: 'Premessa, frasi sulla sede, voce della trasferta, oneri di segreteria, le due righe sull\'IVA, validità dell\'offerta e saluti finali: sono le parti del documento uguali per tutti i preventivi. Si scrivono una volta e valgono da lì in poi — utile quando cambia una formula di legge, perché non serve rifare il sito. Dalla frase sulla validità l\'elenco ricava dopo quanti giorni un\'offerta inviata è scaduta.',
    },
    {
      hash: '#/formazione/preventivi',
      selettore: '.tour-fab',
      titolo: 'Tour completato',
      testo: 'Puoi rivedere questo tour quando vuoi cliccando su questo pulsante. Ogni sezione del portale ha il suo.',
    },
  ];
}
