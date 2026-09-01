// ============================================================
//  Passi del tour guidato della sezione TRASPORTI LUNGHI (preventivi).
//  Il motore (tooltip, evidenziazione, navigazione fra le pagine) sta in
//  js/lib/tour.js ed è condiviso con le altre sezioni: qui c'è solo il
//  copione, cioè dove andare, cosa evidenziare e cosa raccontare.
//
//  Il tour passa davvero dall'editor di un preventivo nuovo: non salva nulla
//  (finché non si preme "Salva" non esiste alcun preventivo), quindi si può
//  seguire in tranquillità anche in mezzo al lavoro.
// ============================================================

export function passi() {
  return [
    {
      hash: '#/trasporti/preventivi',
      titolo: 'Tour guidato',
      testo: 'Un breve giro tra le funzioni della sezione Trasporti lunghi, il gestionale dei preventivi per i trasporti sanitari fuori Genova. Usa «Avanti» per proseguire, oppure «Salta tour» in qualsiasi momento.',
    },
    {
      selettore: '.grid.stats',
      titolo: 'Il colpo d\'occhio',
      testo: 'Quanti preventivi hai in archivio, quanto valgono in totale come addebito al cliente e quale margine stimato lasciano rispetto alla spesa viva.',
    },
    {
      selettore: '.toolbar',
      titolo: 'Ritrovare un preventivo',
      testo: 'Cerca per titolo o per destinazione: utile quando ti richiedono un trasporto simile a uno già fatto e vuoi ripartire da quei numeri.',
    },
    {
      selettore: '.card .tbl-wrap',
      titolo: 'L\'elenco',
      testo: 'Ogni riga è un preventivo: clicca per riaprirlo e modificarlo. In fondo alla riga i due pulsanti stampano il preventivo in PDF o lo eliminano.',
    },
    {
      hash: '#/trasporti/nuovo',
      selettore: '.page-head .inline',
      titolo: 'Un preventivo nuovo',
      testo: 'Siamo entrati nella creazione di un preventivo. Da qui torni all\'elenco, stampi il documento da consegnare al cliente oppure salvi il lavoro: finché non salvi, nulla viene registrato.',
    },
    {
      selettore: '#mezzo',
      titolo: 'Il mezzo',
      testo: 'Scegli il mezzo dal parco configurato: il consumo in km/l viene da lì ed è il primo ingrediente del costo del carburante. L\'alimentazione accanto decide se usare il prezzo del gasolio o della benzina.',
    },
    {
      selettore: '#prezzoCarb',
      titolo: 'Il prezzo del carburante',
      testo: 'Si compila da solo: media italiana aggiornata dai dati ufficiali del Ministero, oppure prezzo del Paese di destinazione se il viaggio è all\'estero. L\'etichetta "auto" indica che il valore è quello automatico; se lo correggi a mano resta il tuo.',
    },
    {
      selettore: '.tappe',
      titolo: 'L\'itinerario',
      testo: 'La partenza è la sede CRI, ma puoi cambiarla. Scrivi la destinazione e scegli un indirizzo fra quelli proposti: serve a riconoscere il Paese (per prezzi e pedaggi) e a calcolare i chilometri veri. Con "Aggiungi tappa" metti destinazioni intermedie.',
    },
    {
      selettore: '#kmTotali',
      titolo: 'I chilometri',
      testo: 'Si calcolano da soli sul percorso reale, andata e ritorno compresi se la casella è spuntata. Restano comunque correggibili a mano: se il servizio mappe non risponde, scrivi il numero e il preventivo si completa lo stesso.',
    },
    {
      selettore: '#tariffaKm',
      titolo: 'La tariffa al chilometro',
      testo: 'È la leva principale dell\'addebito: totale = km × tariffa, più le voci attive. I tre preset accanto sono le tariffe usate più spesso, per non doverle riscrivere.',
    },
    {
      selettore: '.switch-row',
      titolo: 'Le voci facoltative',
      testo: 'Pasti, pernottamento, personale sanitario e materiale si accendono solo quando servono davvero: ogni interruttore fa comparire i campi corrispondenti, e le voci spente non entrano nel conto.',
    },
    {
      selettore: '.summary',
      titolo: 'Il conto, in tempo reale',
      testo: 'A destra il riepilogo si aggiorna a ogni modifica: il dettaglio della spesa viva (carburante, pasti, pedaggi…), quanto addebiti al cliente e il margine che resta. Se il margine è rosso, il trasporto costa più di quanto stai chiedendo.',
    },
    {
      selettore: '#btn-pdf',
      titolo: 'Stampa e consegna',
      testo: 'Genera il preventivo in versione stampabile, da salvare in PDF o consegnare al cliente. Le note che scrivi in fondo alla pagina compaiono nella stampa.',
    },
    {
      hash: '#/trasporti/impostazioni',
      selettore: '#mezzi',
      titolo: 'Il parco mezzi',
      testo: 'Qui vivono i mezzi con i loro consumi reali: è la base del calcolo del carburante, quindi tenerli aggiornati è ciò che rende affidabili tutti i preventivi.',
    },
    {
      selettore: '#update-eu',
      titolo: 'Prezzi carburante europei',
      testo: 'Per i viaggi all\'estero: un clic scarica il bollettino settimanale della Commissione Europea e aggiorna i prezzi di tutti i Paesi UE in un colpo solo. I valori restano comunque modificabili a mano nella tabella qui sotto.',
    },
    {
      hash: '#/trasporti/preventivi',
      selettore: '.tour-fab',
      titolo: 'Tour completato',
      testo: 'Puoi rivedere questo tour quando vuoi cliccando su questo pulsante. Ogni sezione del portale ha il suo.',
    },
  ];
}
