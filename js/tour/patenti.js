// ============================================================
//  Passi del tour guidato della sezione PATENTI.
//  Il motore sta in js/lib/tour.js: qui c'è solo il copione.
// ============================================================

export function passi() {
  return [
    {
      hash: '#/patenti/richieste',
      titolo: 'Tour guidato',
      testo: 'La sezione Patenti raccoglie le richieste di emissione o rinnovo della patente CRI che i volontari mandano da soli, con un modulo online.',
    },
    {
      selettore: '.grid.stats',
      titolo: 'A che punto siamo',
      testo: 'Quante richieste sono nuove, in lavorazione o completate. Se qualcuno ha risposto «No» su un documento di Gaia compare anche «Serve supporto»: è lo stesso numero che si vede accanto a Patenti nel menu, e si spegne quando la richiesta passa «In lavorazione». Ogni riquadro è anche un filtro.',
    },
    {
      selettore: '.toolbar',
      titolo: 'Ritrovare una richiesta',
      testo: 'Cerca per nome o cognome, o filtra per stato e per patente. «Da gestire» nasconde quelle già completate; «Serve supporto» mostra solo chi ha chiesto aiuto con i documenti.',
    },
    {
      selettore: '.tbl-wrap',
      titolo: 'Lavorare una richiesta',
      testo: 'Una riga per richiesta, dalla più recente. «Documenti su Gaia» dice se manca qualcosa; lo stato si cambia dalla tendina della riga, e con ✏️ si scrive una nota della segreteria.',
    },
    {
      hash: '#/patenti/link',
      selettore: '.pt-link',
      titolo: 'Il link da mandare',
      testo: 'C\'è già un messaggio pronto, che puoi modificare: copialo o mandalo direttamente su WhatsApp o per email. Il modulo si apre senza accedere al portale, anche dal telefono, e la richiesta comparirà fra le Richieste.',
    },
    {
      selettore: '.pt-passaggi',
      titolo: 'Cosa troverà il volontario',
      testo: 'I passaggi del modulo e il percorso di ciascuna patente: conversione diretta, con prova pratica o con esame.',
    },
    {
      hash: '#/patenti/domande',
      selettore: '.faq-elenco',
      titolo: 'Domande e risposte',
      testo: 'Requisiti, visita medica, prova pratica, rinnovo e patente digitale, ognuna con la sua fonte: l\'articolo del Testo Unico o la procedura del Comitato. Si cercano per parola. I volontari le trovano in fondo al modulo nei primi passaggi, mentre scelgono che cosa chiedere.',
    },
    {
      selettore: '.tour-fab',
      titolo: 'Tour completato',
      testo: 'Puoi rivedere questo tour quando vuoi da questo pulsante.',
    },
  ];
}
