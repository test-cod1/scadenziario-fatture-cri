// ============================================================
//  Passi del tour guidato della sezione STRAORDINARI.
//  Il motore (tooltip, evidenziazione, navigazione fra le pagine) sta in
//  js/lib/tour.js ed è condiviso con le altre sezioni: qui c'è solo il
//  copione, cioè dove andare, cosa evidenziare e cosa raccontare.
//
//  Il tour passa davvero dalla scheda di una registrazione nuova: non
//  salva nulla (finché non si preme "Salva" non esiste alcuna riga),
//  quindi si può seguire anche in mezzo al lavoro.
//
//  Un passo il cui elemento non compare viene saltato dal motore: è quello
//  che succede sui passi del registro quando il mese è vuoto, e sul passo
//  del riepilogo quando non c'è ancora nessun dipendente.
//
//  Chi ha la sezione in sola visualizzazione (ruolo 'lettore') fa un giro
//  più corto: i passi marcati «scrive» parlano di comandi che per lui non
//  ci sono (la scheda di registrazione, i pulsanti dell'anagrafica) e si
//  tolgono; dove serve, «perLettore» sostituisce selettore e testo.
// ============================================================

export function passi(ctx) {
  const lettore = ctx?.user?.ruolo === 'lettore';
  const tutti = [
    {
      hash: '#/straordinari/registro',
      titolo: 'Tour guidato',
      testo: 'Un breve giro nella sezione Straordinari, il registro delle ore in più chieste ai dipendenti dalla centrale operativa. Sostituisce il foglio mensile «ELENCO DIPENDENTI-ORARI MESE». Usa «Avanti» per proseguire, oppure «Salta tour» in qualsiasi momento.',
    },
    {
      selettore: '.mese-nav',
      titolo: 'Un mese alla volta',
      testo: 'Tutta la sezione lavora sul mese selezionato qui: le frecce lo spostano, «Questo mese» riporta a oggi. Registro e riepilogo restano sempre sullo stesso mese, così passando da uno all\'altro non perdi il segno.',
    },
    {
      selettore: '.grid.stats',
      titolo: 'Il conto del mese',
      testo: 'Le ore in più (straordinari e cambi turno), i recuperi già restituiti e il saldo, che è la differenza fra i due. È il numero che sul foglio di carta si otteneva sommando a mano una riga piena di positivi e negativi.',
    },
    {
      selettore: '.toolbar',
      titolo: 'Trovare una riga',
      testo: 'Filtri per dipendente e per tipo, più una ricerca libera che guarda anche causale, servizio e note. Serve quando a fine mese qualcuno chiede conto di una serata: cerchi il suo nome e vedi solo le sue righe.',
    },
    {
      selettore: '.card .tbl-wrap',
      titolo: 'L\'elenco',
      testo: 'Le righe sono raggruppate per giornata, con il totale della giornata in testa a ogni gruppo. Clicca una riga per riaprirla e correggerla; il cestino in fondo la elimina. Non c\'è uno stato da far avanzare: qui si scrive ciò che è già stato fatto.',
      perLettore: {
        testo: 'Le righe sono raggruppate per giornata, con il totale della giornata in testa a ogni gruppo. Clicca una riga per aprirla e vederne tutti i dati: orari, causale, servizio e note.',
      },
    },
    {
      selettore: '[data-xls]',
      titolo: 'Portarlo fuori',
      testo: 'Excel scarica le righe filtrate con le ore come numeri veri, quindi sommabili nel foglio dell\'ufficio personale; Stampa produce l\'elenco così come lo stai vedendo, filtri compresi.',
    },
    {
      scrive: true,
      hash: '#/straordinari/nuovo',
      selettore: '.page-head .actions',
      titolo: 'Registrare le ore',
      testo: 'Siamo nella scheda di una registrazione nuova. Si compila a turno finito, non prima: finché non premi «Salva» non viene scritto niente. «Salva e nuova» tiene giorno e tipo per registrare in fila più persone della stessa serata.',
    },
    {
      scrive: true,
      selettore: '#f-dipendente',
      titolo: 'Chi ha fatto le ore',
      testo: 'L\'elenco contiene i dipendenti attivi in anagrafica. Se manca qualcuno, lo aggiungi dalla pagina Dipendenti: qui si sceglie un nome, non si scrive.',
    },
    {
      scrive: true,
      selettore: '#f-data',
      titolo: 'Il giorno',
      testo: 'Parte da oggi, perché di norma si registra a fine turno. Sotto compare il giorno della settimana, e un avviso se è un sabato, una domenica o un festivo, o se stai indicando una data futura — non sono errori, ma val la pena accorgersene.',
    },
    {
      scrive: true,
      selettore: '.str-tipi',
      titolo: 'Il tipo decide il segno',
      testo: 'Straordinario e cambio turno sono ore in più; recupero sono ore restituite. Le ore si scrivono sempre positive e il segno lo mette il tipo: sul foglio di carta i recuperi erano numeri negativi in mezzo agli altri, e un meno dimenticato falsava il totale del mese.',
    },
    {
      scrive: true,
      selettore: '.form-row.three',
      titolo: 'Gli orari e le ore',
      testo: 'Gli orari si scelgono sul quadrante — prima l\'ora, poi i minuti — e le ore si calcolano da sole, mezzanotte compresa: un rientro dalle 22 all\'1 fa tre ore, non meno ventuno. Il numero resta correggibile a mano, perché un arrotondamento concordato a voce vale più del calcolo.',
    },
    {
      scrive: true,
      selettore: '#f-causale',
      titolo: 'Perché',
      testo: 'La causale si sceglie fra quelle proposte — emergenza, copertura turno, malattia di un collega… — o si scrive a mano. È la domanda che il foglio non registrava, e che a fine mese non sapeva più rispondere nessuno. Accanto, «Servizio» tiene il riferimento operativo: il mezzo, la convenzione, l\'evento.',
    },
    {
      hash: '#/straordinari/riepilogo',
      selettore: '.str-griglia',
      titolo: 'Il riepilogo mensile',
      testo: 'La griglia dipendenti × giorni: è la forma del vecchio foglio, ma i totali si calcolano da soli, per riga e per giornata. Clicca una cella piena per vedere il dettaglio di quella giornata. I dipendenti senza ore restano in elenco apposta: vedere gli zeri è il modo per accorgersi di come sono distribuite le ore.',
    },
    {
      selettore: '[data-print]',
      titolo: 'La griglia da firmare',
      testo: 'Stampa la griglia in A4 orizzontale, con le righe per le firme: è il foglio che si porta all\'ufficio personale a fine mese. Excel, accanto, dà le stesse ore in numeri sommabili.',
    },
    {
      hash: '#/straordinari/dipendenti',
      selettore: '[data-nuovo]',
      titolo: 'I dipendenti',
      testo: 'Con «Nuovo dipendente» si aggiunge un nome all\'elenco da cui si sceglie chi ha fatto lo straordinario: cognome, nome e un promemoria, nient\'altro. Non è una copia del personale dell\'ente. Accanto a ogni nome c\'è il suo saldo del mese in corso.',
      perLettore: {
        selettore: '.card .tbl-wrap',
        testo: 'L\'elenco da cui si sceglie chi ha fatto lo straordinario: cognome, nome e un promemoria, nient\'altro. Accanto a ogni nome c\'è il suo saldo del mese in corso; chi non è più attivo resta in elenco, e le sue registrazioni restano nello storico.',
      },
    },
    {
      scrive: true,
      selettore: '.card .tbl-wrap',
      titolo: 'Chi va via si disattiva',
      testo: 'Non si cancella: le sue registrazioni restano nello storico e nei riepiloghi dei mesi già chiusi, ma il nome sparisce dagli elenchi di scelta. Il cestino funziona solo per chi non ha ancora nessuna riga a suo carico — a impedirlo è il database, non un permesso.',
    },
    {
      hash: '#/straordinari/impostazioni',
      selettore: '.str-causali',
      titolo: 'Le causali',
      testo: 'Sono i suggerimenti che compaiono nel campo «Causale». Restano scrivibili a mano, ma avere le solite pronte è ciò che rende poi leggibile il registro: un campo libero, dopo tre mesi, diventa venti modi diversi di scrivere «copertura turno». Le modifica l\'admin della sezione; gli altri le vedono in sola lettura.',
    },
    {
      hash: '#/straordinari/registro',
      selettore: '.tour-fab',
      titolo: 'Tour completato',
      testo: 'Puoi rivedere questo tour quando vuoi cliccando su questo pulsante. Ogni sezione del portale ha il suo.',
    },
  ];
  if (!lettore) return tutti.map(({ scrive, perLettore, ...p }) => p);
  return tutti.filter(p => !p.scrive).map(({ scrive, perLettore, ...p }) => ({ ...p, ...perLettore }));
}
