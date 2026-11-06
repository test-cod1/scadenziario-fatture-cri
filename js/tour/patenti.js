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
      testo: 'Quante richieste sono nuove, in lavorazione o completate. Ogni riquadro è anche un filtro.',
    },
    {
      selettore: '.toolbar',
      titolo: 'Ritrovare una richiesta',
      testo: 'Cerca per nome o cognome, o filtra per stato e per patente. «Da gestire» nasconde quelle già completate.',
    },
    {
      hash: '#/patenti/link',
      selettore: '.pt-link',
      titolo: 'Il link da mandare',
      testo: 'Copialo e mandalo al volontario: il modulo si apre senza accedere al portale, anche dal telefono. La sua richiesta comparirà fra le Richieste.',
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
      testo: 'Requisiti, visita medica, prova pratica, rinnovo e patente digitale, ognuna con l\'articolo del Testo Unico da cui viene. I volontari le trovano anche in fondo al modulo.',
    },
  ];
}
