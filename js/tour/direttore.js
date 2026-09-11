// ============================================================
//  Passi del tour guidato della sezione DIRETTORE.
//  Il motore (tooltip, evidenziazione, navigazione fra le pagine) sta in
//  js/lib/tour.js ed è condiviso con le altre sezioni: qui c'è solo il
//  copione, cioè dove andare, cosa evidenziare e cosa raccontare.
//
//  Il tour passa davvero dalla scheda di un impegno nuovo: non salva
//  nulla, quindi si può seguire anche in mezzo al lavoro.
// ============================================================

export function passi() {
  return [
    {
      hash: '#/direttore/impegni',
      titolo: 'Tour guidato',
      testo: 'Un breve giro nella sezione Direttore: le cose da fare della direzione, tenute in ordine di peso invece che di arrivo. Usa «Avanti» per proseguire, oppure «Salta tour» in qualsiasi momento.',
    },
    {
      selettore: '.grid.stats',
      titolo: 'Cosa guardare per primo',
      testo: 'Quante cose sono aperte, quante sono già scadute e quante scadono entro sette giorni. I riquadri degli scaduti e della settimana sono anche filtri: un clic e l\'elenco qui sotto mostra solo quelli.',
    },
    {
      selettore: '.dir-lista',
      titolo: 'L\'elenco si ordina da sé',
      testo: 'Non è in ordine di inserimento: in cima sta ciò che pesa di più. L\'ordine nasce da importanza, urgenza e giorni che mancano alla scadenza, quindi cambia da solo con il passare dei giorni — una cosa importante che scade domani sale sopra una urgente che scade fra un mese.',
    },
    {
      selettore: '.dir-spunta',
      titolo: 'Fatto, con un clic',
      testo: 'La spunta si dà dall\'elenco, senza aprire niente: è il gesto che si fa più spesso. L\'impegno scende fra i fatti e ci resta, con la data — se lo si è segnato per sbaglio, basta ricliccare.',
    },
    {
      selettore: '.toolbar',
      titolo: 'Ritrovare qualcosa',
      testo: 'La prima tendina decide cosa vedere: le cose da fare (come si apre la pagina), i fatti, o tutto. Le altre due filtrano per urgenza e importanza, e la ricerca guarda anche nei dettagli.',
    },
    {
      hash: '#/direttore/nuovo',
      selettore: '#f-titolo',
      titolo: 'Scrivere un impegno',
      testo: 'L\'unica cosa obbligatoria è questa: che cosa c\'è da fare. Tutto il resto ha già un valore ragionevole, perché un impegno che non si riesce ad annotare in dieci secondi non viene annotato affatto.',
    },
    {
      selettore: '[data-campo="importanza"]',
      titolo: 'Importanza: quanto conta',
      testo: 'Quanto pesa il risultato, a prescindere da quando va fatto. Il bilancio di fine anno è importante mesi prima di diventare urgente.',
    },
    {
      selettore: '[data-campo="urgenza"]',
      titolo: 'Urgenza: quanto preme',
      testo: 'Un\'altra cosa dall\'importanza, ed è qui che sta il senso di tenerle separate: la riunione di domani preme molto e può contare poco. Confonderle è il modo classico per passare le giornate a spegnere incendi e non fare mai le cose che contano.',
    },
    {
      selettore: '#f-scadenza',
      titolo: 'Entro quando',
      testo: 'Può restare vuota, ed è una risposta legittima: «va fatto, ma non entro una data». Quando c\'è, avvicinandosi spinge l\'impegno verso l\'alto da sola, senza che tu debba tornare a cambiargli l\'urgenza.',
    },
    {
      selettore: '[data-peso]',
      titolo: 'Dove finirà',
      testo: 'Man mano che scegli, questa riga dice in che parte dell\'elenco comparirà l\'impegno. Serve a non dover indovinare l\'effetto delle tre scelte: se non è dove ti aspetti, cambia un livello e guarda di nuovo.',
    },
    {
      hash: '#/direttore/impegni',
      selettore: '.tour-fab',
      titolo: 'Tour completato',
      testo: 'Puoi rivedere questo tour quando vuoi cliccando su questo pulsante. Ogni sezione del portale ha il suo.',
    },
  ];
}
