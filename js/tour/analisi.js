// ============================================================
//  Passi del tour guidato della sezione ANALISI.
//  Il motore (tooltip, evidenziazione, navigazione fra le pagine) sta in
//  js/lib/tour.js ed è condiviso con le altre sezioni: qui c'è solo il
//  copione, cioè dove andare, cosa evidenziare e cosa raccontare.
//
//  Il tour non tocca nessun dato: gira su una pagina di sola lettura.
// ============================================================

export function passi(ctx) {
  const admin = ctx?.user?.ruolo === 'admin';
  return [
    {
      hash: '#/analisi/centri',
      titolo: 'Tour guidato',
      testo: 'Analisi tiene i conti delle singole attività: quanto è costata e quanto ha reso ognuna. Ha numeri suoi, staccati dallo scadenziario: le entrate e le uscite si registrano qui, dentro l\'attività. Usa «Avanti» per proseguire, oppure «Salta tour» in qualsiasi momento.',
    },
    {
      selettore: '.an-periodo',
      titolo: 'Prima il periodo',
      testo: 'Un conto senza un periodo non vuol dire niente: «è costata 4.000 €» ha senso solo insieme a «nel 2026». La pagina si apre sull\'anno in corso; qui si cambia, e vale per tutti i numeri sotto.',
    },
    {
      selettore: '.grid.stats',
      titolo: 'Entrate, uscite, saldo',
      testo: 'La somma dei movimenti di tutte le attività nel periodo. È quello che si sta seguendo, non il bilancio del Comitato.',
    },
    {
      selettore: '.cc-lista',
      titolo: 'Una riga per attività',
      testo: 'In cima quelle in perdita: è la riga per cui si apre questa pagina. Cliccando il nome si apre il conto nel dettaglio, movimento per movimento: è lì che si aggiungono entrate e uscite.',
    },
    ...(admin ? [{
      selettore: '[data-nuovo]',
      titolo: 'Creare un\'attività',
      testo: 'L\'elenco lo tiene l\'amministratore della sezione: è un piano dei conti. Se il nome fosse libero, fra un anno ci sarebbero tre grafie della stessa attività e tre conti al posto di uno.',
    }] : []),
    {
      selettore: '.tour-fab',
      titolo: 'Tour completato',
      testo: 'Puoi rivedere questo tour quando vuoi da questo pulsante.',
    },
  ];
}
