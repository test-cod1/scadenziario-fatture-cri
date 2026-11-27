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
      selettore: '.cc-griglia',
      titolo: 'Una card per attività',
      testo: 'Ogni centro di costo è un conto a sé, come una sezione nella home: qui non si sommano fra loro. Cliccando una card si apre il conto dell\'attività: lì si sceglie il periodo, si aggiungono entrate e uscite, ognuna con la sua categoria, e ci sono i grafici dell\'andamento e delle spese per categoria. Il pulsante «🔗 Condividi» crea un link di sola lettura per chi non ha il portale (senza le note): mandalo solo a chi deve vedere quei numeri.',
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
