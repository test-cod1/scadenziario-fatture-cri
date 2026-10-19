// ============================================================
//  Passi del tour guidato della sezione SCADENZE.
//  Il motore sta in js/lib/tour.js: qui c'è solo il copione. Il tour
//  passa dalla scheda di una scadenza nuova senza salvare nulla.
// ============================================================

export function passi() {
  return [
    {
      hash: '#/scadenze/elenco',
      titolo: 'Tour guidato',
      testo: 'Un breve giro nella sezione Scadenze: tutto quello che scade e non è una fattura — polizze, bolli, revisioni, contratti, certificazioni — in un elenco solo, in ordine di data.',
    },
    {
      selettore: '.grid.stats',
      titolo: 'Cosa guardare per primo',
      testo: 'Quante scadenze sono aperte, quante sono già passate e quante sono «in preavviso», cioè abbastanza vicine da doverci pensare adesso. I riquadri delle scadute e del preavviso sono anche filtri.',
    },
    {
      selettore: '.dir-lista',
      titolo: 'In ordine di data',
      testo: 'In cima quelle già scadute, poi le prossime. Il colore dice se una scadenza è nel suo preavviso: ognuna ha il suo, perché per rinnovare un contratto servono settimane e per pagare un bollo un giorno.',
    },
    {
      selettore: '.toolbar',
      titolo: 'Ritrovare qualcosa',
      testo: 'La ricerca guarda anche riferimento (una targa, un numero di polizza), responsabile e note. La tendina delle categorie si riempie da sola con quelle che usate.',
    },
    {
      hash: '#/scadenze/nuova',
      selettore: '#f-categoria',
      titolo: 'Scadenze di ogni tipo',
      testo: 'La categoria è libera: si sceglie fra quelle suggerite o se ne scrive una nuova, senza chiedere a nessuno di aggiungerla a un elenco.',
    },
    {
      selettore: '#f-ricorrenza',
      titolo: 'Quelle che si ripetono',
      testo: 'Un bollo ogni anno, una revisione ogni due: scelta la ricorrenza, quando la scadenza viene segnata fatta nasce da sola la successiva, alla data giusta.',
    },
    {
      selettore: '#f-preavviso',
      titolo: 'Il preavviso',
      testo: 'Da quanti giorni prima la scadenza va tenuta d\'occhio. È anche quello che usano i promemoria email (menu «Promemoria email»), se li accendi.',
    },
  ];
}
