// ============================================================
//  Passi del tour guidato della sezione ASSISTENZE SANITARIE.
//  Il motore (tooltip, evidenziazione, navigazione fra le pagine) sta in
//  js/lib/tour.js ed è condiviso con le altre sezioni: qui c'è solo il
//  copione, cioè dove andare, cosa evidenziare e cosa raccontare.
//
//  Come nella sezione trasporti, il tour passa davvero dall'editor di un
//  preventivo nuovo ma non salva nulla: finché non si preme «Salva» quel
//  preventivo non esiste, quindi il giro si può fare anche in mezzo al
//  lavoro senza lasciare tracce.
// ============================================================

export function passi() {
  return [
    {
      hash: '#/assistenze/preventivi',
      titolo: 'Tour guidato',
      testo: 'Un breve giro tra le funzioni della sezione Assistenze sanitarie, dove si preparano i preventivi per i servizi a manifestazioni ed eventi. Usa «Avanti» per proseguire, oppure «Salta tour» in qualsiasi momento.',
    },
    {
      selettore: '.grid.stats',
      titolo: 'Il colpo d\'occhio',
      testo: 'Quanti preventivi hai in archivio e quante sono ancora bozze, quanti sono stati confermati e quanto valgono, e il valore complessivo di tutto l\'archivio.',
    },
    {
      selettore: '.toolbar',
      titolo: 'Ritrovare un preventivo',
      testo: 'Cerca per cliente, evento o luogo, oppure filtra per stato: comodo quando ti richiedono la stessa manifestazione dell\'anno prima e vuoi ripartire da quei numeri.',
    },
    {
      selettore: '.card .tbl-wrap',
      titolo: 'L\'elenco',
      testo: 'Una riga per preventivo, con la data della prima giornata di assistenza — quella che hai in mente quando lo cerchi — e il numero di turni. Clicca la riga per riaprirlo.',
    },
    {
      selettore: '[data-stato]',
      titolo: 'Lo stato, senza aprire nulla',
      testo: 'Bozza, inviato, confermato o annullato si cambiano direttamente da qui: è la modifica più frequente dopo aver mandato il preventivo al cliente.',
    },
    {
      selettore: '[data-copia]',
      titolo: 'Duplicare',
      testo: 'Il pulsante ⧉ crea una copia del preventivo come nuova bozza, con la data di oggi: le assistenze si ripetono, e ricopiare venti campi a mano non ha senso. Accanto ci sono il Word, la stampa in PDF e l\'eliminazione.',
    },
    {
      hash: '#/assistenze/nuovo',
      selettore: '.page-head .inline',
      titolo: 'Un preventivo nuovo',
      testo: 'Siamo entrati nella creazione di un preventivo. Da qui vedi l\'anteprima, scarichi il documento in Word, lo stampi in PDF oppure salvi: finché non salvi, nulla viene registrato.',
    },
    {
      selettore: '#cliente',
      titolo: 'A chi va il preventivo',
      testo: 'Cliente, codice fiscale o partita IVA e indirizzo finiscono nell\'intestazione del documento; il referente con email e telefono serve a te per sapere chi chiamare.',
    },
    {
      selettore: '#oggetto',
      titolo: 'Di che servizio si tratta',
      testo: 'L\'oggetto compare nella riga «Oggetto:» del documento, dopo la formula fissa: scrivilo come lo racconteresti («Torneo giovanile di pallavolo del 12 aprile»). Sotto, il luogo dell\'evento.',
    },
    {
      selettore: '#voci',
      titolo: 'Le voci del preventivo',
      testo: 'Spunta cosa serve per questo servizio: ambulanza, soccorritori, gazebo… I prezzi arrivano dal tariffario ma qui restano modificabili, e la modifica vale solo per questo preventivo.',
    },
    {
      selettore: '.cal-tbl',
      titolo: 'Il calendario è anche il calcolo',
      testo: 'Una riga per turno: dagli orari escono le ore (anche se il turno scavalca la mezzanotte) e da lì il totale, che è ore × tariffa × quantità. Per ogni voce spuntata compare una colonna in cui indicare quanti ne servono in quel turno.',
    },
    {
      selettore: '.tutti-turni',
      titolo: 'La stessa dotazione su tutti i turni',
      testo: 'Il campo sotto al nome della voce applica quella quantità a tutti i turni in una volta sola: se l\'ambulanza è una in ogni giornata, la scrivi qui e non riga per riga.',
    },
    {
      selettore: '.cal-azioni',
      titolo: 'Aggiungere i turni',
      testo: 'Un turno alla volta con «Aggiungi turno», oppure indica il primo e l\'ultimo giorno e l\'app crea un turno per ogni giornata, con gli stessi orari e le stesse quantità del turno precedente. I giorni già presenti non vengono duplicati.',
    },
    {
      selettore: '#sconto_percentuale',
      titolo: 'Lo sconto',
      testo: 'Facoltativo e utilizzabile in due modi anche insieme: una percentuale sul totale e un importo fisso da togliere. Nel documento compaiono il totale pieno, gli sconti applicati e il totale da corrispondere.',
    },
    {
      selettore: '.summary',
      titolo: 'Il conto, in tempo reale',
      testo: 'A destra il riepilogo si aggiorna a ogni modifica: il dettaglio voce per voce con le ore complessive, gli eventuali sconti e il totale del preventivo, anche in lettere come richiede il documento.',
    },
    {
      selettore: '#btn-word',
      titolo: 'Il documento da consegnare',
      testo: 'Word per un file modificabile, «Stampa / PDF» per la versione da firmare e mandare, «Anteprima» per controllare prima come viene. Il documento riporta la carta intestata, il calendario delle giornate e i testi fissi.',
    },
    {
      hash: '#/assistenze/impostazioni',
      selettore: '#tariffe',
      titolo: 'Il tariffario',
      testo: 'Qui vivono le voci che si possono mettere in un preventivo. Una voce «a ore» si moltiplica per la durata del turno; una «a prezzo fisso» vale una volta per turno, comunque duri — è il caso del gazebo.',
    },
    {
      selettore: '#f-ruolo',
      titolo: 'La firma',
      testo: 'Ruolo e nome di chi firma: sono le due righe in fondo a ogni preventivo, così non vanno riscritte ogni volta.',
    },
    {
      selettore: '#testi textarea',
      titolo: 'I testi fissi',
      testo: 'Premessa, regime IVA, riferimenti bancari, requisiti di mezzi e personale, privacy e saluti finali: sono le parti del documento uguali per tutti i preventivi. Si scrivono una volta e valgono da lì in poi.',
    },
    {
      hash: '#/assistenze/preventivi',
      selettore: '.tour-fab',
      titolo: 'Tour completato',
      testo: 'Puoi rivedere questo tour quando vuoi cliccando su questo pulsante. Ogni sezione del portale ha il suo.',
    },
  ];
}
