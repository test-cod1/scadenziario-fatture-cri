// ============================================================
//  Passi del tour guidato della sezione ANALISI.
//  Il motore (tooltip, evidenziazione, navigazione fra le pagine) sta in
//  js/lib/tour.js ed è condiviso con le altre sezioni: qui c'è solo il
//  copione, cioè dove andare, cosa evidenziare e cosa raccontare.
//
//  Il tour non tocca nessun dato: gira fra due pagine di sola lettura.
// ============================================================

export function passi(ctx) {
  const admin = ctx?.user?.ruolo === 'admin';
  return [
    {
      hash: '#/analisi/centri',
      titolo: 'Tour guidato',
      testo: 'Analisi legge insieme quello che le altre sezioni scrivono. La prima cosa che ci sa dire sono i centri di costo: quanto è costata e quanto ha reso una singola attività. Usa «Avanti» per proseguire, oppure «Salta tour» in qualsiasi momento.',
    },
    {
      selettore: '.an-periodo',
      titolo: 'Prima il periodo',
      testo: 'Un conto senza un periodo non vuol dire niente: «è costata 4.000 €» ha senso solo insieme a «nel 2026». La pagina si apre sull\'anno in corso; qui si cambia, e vale per tutti i numeri sotto.',
    },
    {
      selettore: '.grid.stats',
      titolo: 'Entrate, uscite, saldo',
      testo: 'I totali di quello che è stato attribuito alle attività. Si contano le fatture, non i pagamenti: la fattura di dicembre pagata a marzo è un costo di dicembre, che è il momento in cui l\'attività l\'ha generata. Quanto sia stato davvero pagato è un\'altra domanda, e la risponde lo scadenziario.',
    },
    {
      selettore: '.stat:last-child',
      titolo: 'Il numero che non va dimenticato',
      testo: 'Quante fatture stanno ancora fuori da ogni attività. Finché quel numero non è zero, la somma delle righe qui sotto NON è il bilancio del Comitato: è solo la parte che stai seguendo. Cliccandolo si va a sistemare l\'arretrato.',
    },
    {
      selettore: '.cc-lista',
      titolo: 'Una riga per attività',
      testo: 'In cima quelle in perdita: è la riga per cui si apre questa pagina. Cliccando il nome si vede il conto nel dettaglio, fattura per fattura — perché un numero rosso, da solo, non dice ancora perché.',
    },
    ...(admin ? [{
      selettore: '[data-nuovo]',
      titolo: 'Creare un\'attività',
      testo: 'L\'elenco lo tiene l\'amministratore della sezione: è un piano dei conti, non una lista che si allunga mentre si registra una fattura. Se il nome fosse libero, fra un anno ci sarebbero tre grafie della stessa attività e tre conti al posto di uno.',
    }] : []),
    {
      hash: '#/analisi/da-attribuire',
      selettore: '.att-lista',
      titolo: 'Attribuire le fatture',
      testo: 'Le fatture che nessuna attività ha ancora preso in carico. La quota parte già compilata con quanto resta, perché quasi sempre la fattura è tutta di una sola attività: se invece va divisa, si abbassa la cifra e si ripassa sulla stessa riga per l\'altra.',
    },
    {
      selettore: '.an-lavoro',
      titolo: 'Un\'attività alla volta',
      testo: 'Chi sistema l\'arretrato lo fa quasi sempre per attività: si sceglie qui una volta sola, e vale per tutte le righe. Insieme alla ricerca è il modo per smaltire un anno di fatture senza impazzire.',
    },
    {
      hash: '#/analisi/centri',
      selettore: '.tour-fab',
      titolo: 'Tour completato',
      testo: 'Una cosa da ricordare: una fattura si attribuisce anche dalla sua scheda nello scadenziario, mentre la si registra — è lì che si sa davvero a che cosa apparteneva. Puoi rivedere questo tour quando vuoi da questo pulsante.',
    },
  ];
}
