// ============================================================
//  Passi del tour guidato della sezione SCADENZIARIO.
//  Il motore (tooltip, evidenziazione, navigazione fra le pagine) sta in
//  js/lib/tour.js ed è condiviso: qui c'è solo il copione, cioè dove andare,
//  cosa evidenziare e cosa raccontare. Ogni sezione ha il suo file in
//  js/tour/, dichiarato in js/sezioni.js.
// ============================================================

function isAdmin(ctx) { return ctx.user?.ruolo === 'admin'; }
// Sola visualizzazione: i pulsanti che scrivono sono nascosti, quindi i
// passi non devono raccontarli né puntarli.
function isLettore(ctx) { return ctx.user?.ruolo === 'lettore'; }

export function passi(ctx) {
  const admin = isAdmin(ctx);
  const lettore = isLettore(ctx);
  const passi = [
    {
      hash: '#/scadenziario/passive/fatture',
      titolo: 'Tour guidato',
      testo: 'Un breve giro tra le funzioni principali dello Scadenziario Fatture. Usa «Avanti» per proseguire, oppure «Salta tour» in qualsiasi momento.',
    },
    {
      selettore: '.section-switch',
      titolo: 'Due sezioni indipendenti',
      testo: 'Il gestionale è diviso in due parti separate: le fatture da pagare ai fornitori ("Fatture Passive") e le fatture emesse ai clienti ("Fatture Attive"). Si passa dall\'una all\'altra con questi due pulsanti.',
    },
    {
      selettore: '.nav a[data-nav="fatture"]',
      titolo: 'Elenco fatture',
      testo: 'Questa è la vista principale della sezione: l\'elenco di tutte le fatture fornitori ancora aperte.',
    },
    {
      selettore: '#stats',
      titolo: 'Situazione a colpo d\'occhio',
      testo: 'Quanto resta da pagare in totale, cosa è già scaduto, cosa scade nei prossimi 7 giorni e quanto è stato pagato questo mese e quest\'anno. Le prime tre card sono cliccabili: filtrano subito la tabella su quelle fatture.',
    },
    {
      selettore: '.page-head .actions',
      titolo: lettore ? 'Esportare' : 'Aggiungere ed esportare',
      testo: lettore
        ? "Da qui esporti l'elenco filtrato in Excel o in PDF."
        : 'Da qui inserisci una fattura a mano, la carichi da un file PDF o XML (i dati vengono letti automaticamente), registri una nota di credito oppure esporti l\'elenco filtrato in Excel o PDF.',
    },
    {
      selettore: '.toolbar',
      titolo: 'Cerca e filtra',
      testo: 'Cerca per fornitore, numero fattura o note, oppure filtra per stato, intervallo di scadenza e importo.',
    },
    {
      selettore: '#tbl-zone',
      titolo: 'La tabella',
      testo: lettore
        ? 'Clicca su una riga per consultare la fattura, con i pagamenti e le note di credito registrati. Con le caselle a sinistra sommi quanto resta da pagare su più fatture.'
        : admin
        ? 'Clicca su una riga per aprire e modificare la fattura, oppure sul suo stato per registrare subito un pagamento.'
        : 'Clicca su una riga per aprire la fattura, oppure sul suo stato per registrare subito un pagamento (o proporlo a un amministratore).',
    },
    {
      selettore: '#archivio',
      titolo: 'Archivio',
      testo: 'Le fatture ormai chiuse (pagate o stornate) degli anni precedenti non restano nell\'elenco principale: si trovano qui, aprendo questo pannello.',
    },
    {
      hash: '#/scadenziario/passive/proposte',
      selettore: '.nav a[data-nav="proposte"]',
      titolo: 'Proposte di pagamento',
      testo: admin
        ? 'Le proposte di pagamento inviate dagli operatori arrivano qui: confermale quando esegui davvero il pagamento, o rifiutale.'
        : lettore
        ? "Qui gli operatori seguono le proposte di pagamento che inviano agli amministratori: con la sola visualizzazione l'elenco resta vuoto."
        : 'Qui trovi le proposte di pagamento che hai inviato e il loro stato: in attesa, confermata o rifiutata.',
    },
    {
      hash: '#/scadenziario/passive/ritenute',
      selettore: '.nav a[data-nav="ritenute"]',
      titolo: "Ritenute d'acconto",
      testo: admin
        ? "Le ritenute trattenute sulle fatture pagate, mese per mese: ogni mese è un F24 da versare entro il 16 del mese dopo. Quando l'hai versato, segnalo qui."
        : "Le ritenute trattenute sulle fatture pagate, mese per mese, con la scadenza dell'F24 (il 16 del mese dopo) e se è già stato versato.",
    },
    {
      hash: '#/scadenziario/passive/report',
      selettore: '.nav a[data-nav="report"]',
      titolo: 'Report fornitori',
      testo: 'Un riepilogo della spesa per fornitore nel tempo, con un grafico mensile e il totale del periodo scelto.',
    },
    {
      hash: '#/scadenziario/attive/fatture',
      selettore: '.section-switch button[data-sotto="attive"]',
      titolo: 'Fatture Attive',
      testo: 'Sei passato alla sezione Fatture Attive: stessa logica di prima, ma per le fatture che emetti ai clienti invece di quelle dei fornitori.',
    },
    {
      selettore: '#stats',
      titolo: 'Da incassare',
      testo: 'Qui vedi quanto c\'è ancora da incassare in totale e quanto hai già incassato questo mese e quest\'anno. Le card "Da incassare" e "Incassato questo mese" sono cliccabili: filtrano subito la tabella su quelle fatture.',
    },
    {
      selettore: '#tbl-zone',
      titolo: 'Incassi, solleciti e note',
      testo: lettore
        ? "Ogni riga parte dal numero della fattura e mostra lo stato dell'incasso, l'ultimo sollecito al cliente e le note. Un clic sulla riga apre la fattura in consultazione."
        : 'Ogni riga parte dal numero della fattura. Clicca sullo stato per registrare un incasso, su «Sollecito» per segnare la data dell\'ultimo sollecito al cliente, e su «Note» per scrivere un appunto sulla fattura senza aprirla. Un clic sul resto della riga apre la fattura intera.',
    },
    {
      hash: '#/scadenziario/attive/report',
      selettore: '.nav a[data-nav="report"]',
      titolo: 'Report clienti',
      testo: 'Anche qui trovi un Report con l\'andamento degli incassi per cliente nel tempo.',
    },
    {
      hash: '#/scadenziario/attive/clienti',
      selettore: '.nav a[data-nav="clienti"]',
      titolo: 'Clienti',
      testo: admin
        ? 'Lo stesso cliente a volte è scritto in modi diversi sulle fatture. Qui trovi tutte le grafie dei nomi e unifichi quelle che indicano lo stesso cliente, così report e ricerche li contano insieme.'
        : 'Lo stesso cliente a volte è scritto in modi diversi sulle fatture. Qui trovi tutte le grafie dei nomi e quelle da unificare: a unificarle è un amministratore.',
    },
  ];
  if (admin) {
    passi.push({
      hash: '#/scadenziario/impostazioni',
      selettore: '.page-head h1',
      titolo: 'Impostazioni',
      testo: 'Visibile solo agli amministratori dello scadenziario: da qui imposti la scadenza di default per le fatture senza data e consulti il registro di tutte le modifiche. Gli utenti del portale e i loro permessi si gestiscono invece in «Utenti e autorizzazioni».',
    });
  }
  passi.push({
    hash: '#/scadenziario/passive/fatture',
    selettore: '.tour-fab',
    titolo: 'Tour completato',
    testo: 'Puoi rivedere questo tour quando vuoi cliccando su questo pulsante.',
  });
  return passi;
}

