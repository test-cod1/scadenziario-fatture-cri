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
      testo: 'Un breve giro nella sezione Scadenze: tutto quello che scade e non è una fattura — polizze, bolli, revisioni, contratti, certificazioni — in un elenco solo, in ordine di data. Usa «Avanti» per proseguire, oppure «Salta tour» in qualsiasi momento.',
    },
    {
      selettore: '.grid.stats',
      titolo: 'Cosa guardare per primo',
      testo: 'Quante scadenze sono aperte, quante sono già passate, quante sono «in preavviso», cioè abbastanza vicine da doverci pensare adesso, e quante cadono nei prossimi trenta giorni. I riquadri delle scadute e del preavviso sono anche filtri.',
    },
    {
      selettore: '.toolbar',
      titolo: 'Ritrovare qualcosa',
      testo: 'La prima tendina decide cosa vedere: le scadenze da fare (come si apre la pagina), le fatte, o tutte. La ricerca guarda anche riferimento (una targa, un numero di polizza), responsabile e note, e la tendina delle categorie si riempie da sola con quelle che usate.',
    },
    {
      selettore: '.dir-lista',
      titolo: 'In ordine di data',
      testo: 'In cima quelle già scadute, poi le prossime. Il colore dice se una scadenza è nel suo preavviso: ognuna ha il suo, perché per rinnovare un contratto servono settimane e per pagare un bollo un giorno. La spunta a sinistra la segna fatta; se si ripete, nasce subito la successiva, e per cinque secondi c\'è «Annulla».',
    },
    {
      hash: '#/scadenze/calendario',
      selettore: '.dir-cal',
      titolo: 'Le stesse scadenze, sul calendario',
      testo: 'L\'elenco dice cosa sistemare adesso; il mese dice quale settimana è piena di rinnovi. Quelle che si ripetono compaiono anche nei mesi a venire, tratteggiate: sono le ripetizioni previste, che nascono davvero quando si spunta quella prima.',
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
    {
      hash: '#/scadenze/elenco',
      selettore: '.tour-fab',
      titolo: 'Tour completato',
      testo: 'Puoi rivedere questo tour quando vuoi cliccando su questo pulsante. Ogni sezione del portale ha il suo.',
    },
  ];
}
