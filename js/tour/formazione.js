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
      testo: 'Quanti preventivi hai in archivio e quante sono ancora bozze, quanti sono stati confermati e quanto valgono, e quante persone ci sono da formare fra i corsi già confermati.',
    },
    {
      selettore: '.toolbar',
      titolo: 'Ritrovare un preventivo',
      testo: 'Cerca per azienda, oggetto, protocollo — o direttamente per nome del corso, che è il modo in cui di solito ci si ricorda le cose: «chi ci aveva chiesto il BLSD?». Il filtro accanto restringe a uno stato.',
    },
    {
      selettore: '.card .tbl-wrap',
      titolo: 'L\'elenco',
      testo: 'Una riga per preventivo, con quanti corsi contiene e quanti discenti in tutto. Clicca la riga per riaprirlo.',
    },
    {
      selettore: '[data-stato]',
      titolo: 'Lo stato, senza aprire nulla',
      testo: 'Bozza, inviato, confermato o annullato si cambiano direttamente da qui: è la modifica più frequente dopo aver mandato il preventivo all\'azienda.',
    },
    {
      selettore: '[data-copia]',
      titolo: 'Duplicare',
      testo: 'Il pulsante ⧉ crea una copia come nuova bozza, con la data di oggi: gli aggiornamenti scadono ogni tre anni e la stessa azienda richiama con la stessa richiesta. Il numero di protocollo non viene copiato — è il numero di quel documento. Accanto ci sono il Word, la stampa in PDF e l\'eliminazione.',
    },
    {
      hash: '#/formazione/nuovo',
      selettore: '.page-head .inline',
      titolo: 'Un preventivo nuovo',
      testo: 'Siamo entrati nella creazione di un preventivo. Da qui vedi l\'anteprima, scarichi il documento in Word, lo stampi in PDF oppure salvi: finché non salvi, nulla viene registrato.',
    },
    {
      selettore: '#cliente',
      titolo: 'A chi va il preventivo',
      testo: 'Azienda, partita IVA e indirizzo finiscono nell\'intestazione del documento, sotto «Spett.le». Con «Scegli dalla rubrica» li compili tutti insieme prendendoli da un\'azienda già registrata; con «Salva in rubrica» ci metti quello che hai appena scritto. Il referente diventa la riga «Alla c.a.».',
    },
    {
      selettore: '#oggetto',
      titolo: 'Oggetto e protocollo',
      testo: 'L\'oggetto lo propone l\'app in base ai corsi che sceglierai («PREVENTIVO CORSI BLSD») e resta riscrivibile: da quando lo tocchi, non viene più sovrascritto. Il protocollo accanto lo compili tu quando serve — la numerazione la tiene il registro del Comitato, non questa app — e allora nel documento compare «Prot. n. …» sopra la data.',
    },
    {
      selettore: '.cal-azioni',
      titolo: 'Scegliere i corsi',
      testo: 'Scegli il corso dal catalogo e premi «Aggiungi»: arriva già con durata, attestazione e prezzo di listino. «Corso non in catalogo» serve per la richiesta una tantum, che scrivi a mano senza sporcare il catalogo.',
    },
    {
      selettore: '#righe',
      titolo: 'Il cuore del preventivo',
      testo: 'Per ogni corso: quante persone, il prezzo di listino e il prezzo riservato a questo cliente. È la formula che usiamo da sempre — «euro 60 a discente, per Voi euro 55» — e nel documento il listino compare solo dove è più alto. Il numero di discenti può restare vuoto: il corso uscirà col prezzo a persona e senza totale, come si fa quando l\'azienda non sa ancora quanti ne manderà. Tutto è modificabile e vale solo per questo preventivo.',
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
      selettore: '.summary',
      titolo: 'Il conto, in tempo reale',
      testo: 'A destra il riepilogo si aggiorna a ogni modifica: corso per corso con i discenti, la trasferta, gli sconti, l\'IVA e il totale, anche in lettere come richiede il documento. Se un corso è rimasto a 0 € te lo dice qui, prima che il preventivo esca.',
    },
    {
      selettore: '#btn-word',
      titolo: 'Il documento da consegnare',
      testo: 'Word per un file modificabile, «Stampa / PDF» per la versione da firmare e mandare, «Anteprima» per controllare prima come viene. Esce sulla carta intestata del Comitato, con la tabella dei corsi, le attestazioni rilasciate, la sede e la validità dell\'offerta.',
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
      testo: 'Qui vivono i corsi che si possono mettere in un preventivo: denominazione, durata, prezzo di listino a discente e l\'attestazione rilasciata — che cambia da corso a corso, perché l\'attestato triennale del primo soccorso non è l\'autorizzazione all\'uso del DAE. La sigla serve solo a proporre l\'oggetto del preventivo.',
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
      testo: 'Premessa, frasi sulla sede, oneri di segreteria, le due righe sull\'IVA, validità dell\'offerta e saluti finali: sono le parti del documento uguali per tutti i preventivi. Si scrivono una volta e valgono da lì in poi — utile quando cambia una formula di legge, perché non serve rifare il sito.',
    },
    {
      hash: '#/formazione/preventivi',
      selettore: '.tour-fab',
      titolo: 'Tour completato',
      testo: 'Puoi rivedere questo tour quando vuoi cliccando su questo pulsante. Ogni sezione del portale ha il suo.',
    },
  ];
}
